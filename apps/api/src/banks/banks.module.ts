import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { asNumber, cents, money, utcDay } from '../common/money'
import { asDate, asText } from '../common/parse'
import { euroLimit, LIMIT, MAX_MONEY } from '../common/check'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'
import { bankFromIban } from './spanish-banks'
import { compactIban, isSpanishIban } from './iban'
import { decodeStatement, Norma43File, parseNorma43, sampleNorma43 } from './norma43'

class AccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(LIMIT.name, { message: 'El nombre admite hasta 120 caracteres' })
  name!: string

  @IsString()
  @MinLength(8)
  @MaxLength(LIMIT.iban, { message: 'El IBAN admite hasta 34 caracteres' })
  iban!: string
}

class MovementDto {
  @IsString()
  date!: string

  @IsString()
  @MaxLength(LIMIT.concept, { message: 'El concepto admite hasta 240 caracteres' })
  concept!: string

  @IsNumber()
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  amount!: number
}

class ReconcileDto {
  @IsString()
  paymentId!: string
}

@Controller('banks')
export class BanksController {
  constructor(private prisma: PrismaService) {}

  @Require('banks')
  @Get()
  async overview() {
    const [accounts, payments] = await Promise.all([
      this.prisma.bankAccount.findMany({
        include: { movements: { include: { payment: true }, orderBy: { date: 'desc' } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { bankMovementId: null },
        include: {
          issuedInvoice: { include: { contact: true } },
          receivedInvoice: { include: { supplier: true } },
          expense: true,
        },
        orderBy: { date: 'desc' },
      }),
    ])
    return {
      accounts: accounts.map((account) => ({
        ...account,
        balance: money(
          account.movements.reduce((sum, movement) => sum + asNumber(movement.amount), 0),
        ),
        bankName: bankFromIban(account.iban),
        movements: account.movements.map((movement) => ({
          id: movement.id,
          date: movement.date.toISOString().slice(0, 10),
          concept: movement.concept,
          amount: asNumber(movement.amount),
          reconciled: Boolean(movement.payment),
        })),
      })),
      openPayments: payments.map((payment) => ({
        id: payment.id,
        direction: payment.direction,
        amount: asNumber(payment.amount),
        date: payment.date.toISOString().slice(0, 10),
        label: payment.issuedInvoice
          ? `Cobro ${payment.issuedInvoice.contact.name}`
          : payment.receivedInvoice
            ? `Pago ${payment.receivedInvoice.supplier.name}`
            : `Pago ${payment.expense?.supplierName ?? ''}`.trim(),
      })),
    }
  }

  @Require('banks')
  @Get('lookup')
  lookup(@Query('iban') iban = '') {
    const compact = compactIban(iban)
    return {
      iban: compact,
      entityCode: compact.startsWith('ES') && compact.length >= 8 ? compact.slice(4, 8) : null,
      bankName: bankFromIban(compact),
      valid: isSpanishIban(compact),
    }
  }

  @Require('banks')
  @Post('norma43/ejemplo')
  ejemplo() {
    try {
      return this.persist(parseNorma43(sampleNorma43()))
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo leer el extracto')
    }
  }

  @Require('banks')
  @Post('norma43')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('Adjunta un fichero Norma 43')
    return this.persist(this.read(file.buffer))
  }

  @Require('banks')
  @Post('accounts')
  create(@Body() body: AccountDto) {
    const iban = compactIban(body.iban)
    if (!isSpanishIban(iban)) throw new BadRequestException('El IBAN español no es válido')
    return this.prisma.bankAccount.create({
      data: { name: asText(body.name, 'El nombre', LIMIT.name), iban },
    })
  }

  @Require('banks')
  @Post('accounts/:id/movements')
  async movement(@Param('id') id: string, @Body() body: MovementDto) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } })
    if (!account) throw new NotFoundException('Cuenta no encontrada')
    const date = asDate(body.date, 'La fecha')
    const amount = money(body.amount)
    if (!Number.isFinite(amount) || Math.abs(amount) > MAX_MONEY) {
      throw new BadRequestException(`El importe no puede superar ${euroLimit()}`)
    }
    const movement = await this.prisma.bankMovement.create({
      data: {
        accountId: id,
        date: utcDay(date),
        concept: asText(body.concept, 'El concepto', LIMIT.concept),
        amount,
      },
    })
    return { ...movement, date, amount: asNumber(movement.amount) }
  }

  @Require('banks')
  @Post('movements/:id/reconcile')
  async reconcile(@Param('id') id: string, @Body() body: ReconcileDto) {
    const movement = await this.prisma.bankMovement.findUnique({ where: { id }, include: { payment: true } })
    if (!movement) throw new NotFoundException('Movimiento no encontrado')
    if (movement.payment) throw new BadRequestException('Este movimiento ya está conciliado')
    const payment = await this.prisma.payment.findUnique({ where: { id: body.paymentId } })
    if (!payment) throw new NotFoundException('Cobro o pago no encontrado')
    if (payment.bankMovementId) throw new BadRequestException('Ese cobro o pago ya está conciliado')
    const inbound = asNumber(movement.amount) >= 0
    if (inbound !== (payment.direction === 'IN')) {
      throw new BadRequestException('El signo del movimiento no coincide con el cobro o el pago')
    }
    if (cents(Math.abs(asNumber(movement.amount))) !== cents(asNumber(payment.amount))) {
      throw new BadRequestException('El importe no coincide')
    }
    await this.prisma.payment.update({ where: { id: payment.id }, data: { bankMovementId: movement.id } })
    return { ok: true }
  }

  private read(buffer: Buffer): Norma43File {
    try {
      return parseNorma43(decodeStatement(buffer))
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo leer el extracto')
    }
  }

  private async persist(parsed: Norma43File) {
    const accounts = []
    let imported = 0
    let skipped = 0
    for (const entry of parsed.accounts) {
      const existing = await this.prisma.bankAccount.findFirst({ where: { iban: entry.iban } })
      const account =
        existing ??
        (await this.prisma.bankAccount.create({
          data: { name: entry.bankName ?? `Entidad ${entry.entityCode}`, iban: entry.iban },
        }))
      const known = new Set(
        (
          await this.prisma.bankMovement.findMany({
            where: { accountId: account.id, reference: { in: entry.movements.map((movement) => movement.reference) } },
            select: { reference: true },
          })
        ).map((movement) => movement.reference),
      )
      const fresh = entry.movements.filter((movement) => !known.has(movement.reference))
      if (fresh.length > 0) {
        await this.prisma.bankMovement.createMany({
          data: fresh.map((movement) => ({
            accountId: account.id,
            date: utcDay(movement.date),
            concept: movement.concept,
            amount: money(movement.amount),
            reference: movement.reference,
          })),
        })
      }
      imported += fresh.length
      skipped += entry.movements.length - fresh.length
      accounts.push({
        iban: entry.iban,
        name: account.name,
        bankName: entry.bankName,
        created: !existing,
        imported: fresh.length,
        skipped: entry.movements.length - fresh.length,
      })
    }
    return { imported, skipped, warnings: parsed.warnings, accounts }
  }
}
