import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common'
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { Response } from 'express'
import { Prisma } from '@prisma/client'
import { renderInvoicePdf } from './invoice-pdf'
import { loadRectifiedLookup, presentIssuedInvoice } from './present'
import { asNumber, cents, invoiceCode, money, utcDay } from '../common/money'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'
import { PaymentsService } from '../payments/payments.service'
import { asDate, type Operation } from '../common/parse'
import { fitMoney, LIMIT, MAX_MONEY } from '../common/check'

class LineDto {
  @IsString()
  @MaxLength(LIMIT.concept, { message: 'El concepto admite hasta 240 caracteres' })
  concept!: string

  @IsNumber()
  @Min(0.01)
  @Max(MAX_MONEY)
  quantity!: number

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice!: number

  @IsIn([0, 4, 10, 21])
  vatRate!: number
}

class CreateIssuedDto {
  @IsString()
  contactId!: string

  @IsString()
  issueDate!: string

  @IsOptional()
  @IsString()
  dueDate?: string

  @IsIn(['NACIONAL', 'INTRACOMUNITARIA_BIENES', 'INTRACOMUNITARIA_SERVICIOS', 'INVERSION_SUJETO_PASIVO'])
  operation!: Operation

  @IsBoolean()
  issue!: boolean

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[]
}

class PaymentDto {
  @IsNumber()
  @Min(0.01)
  @Max(MAX_MONEY)
  amount!: number

  @IsString()
  date!: string

  @IsOptional()
  @IsString()
  bankAccountId?: string
}

function buildLines(lines: LineDto[], operation: Operation) {
  if (!lines.length) throw new BadRequestException('La factura necesita al menos una línea')
  return lines.map((line) => {
    const concept = line.concept?.trim() ?? ''
    if (!concept) throw new BadRequestException('Cada línea necesita un concepto')
    if (concept.length > LIMIT.concept) {
      throw new BadRequestException('El concepto admite hasta 240 caracteres')
    }
    const base = money(line.quantity * line.unitPrice)
    const vatRate = operation === 'NACIONAL' ? line.vatRate : 0
    const vatAmount = money((base * vatRate) / 100)
    fitMoney(base, 'La base')
    fitMoney(vatAmount, 'El IVA')
    return {
      concept,
      quantity: money(line.quantity),
      unitPrice: money(line.unitPrice),
      vatRate,
      base,
      vatAmount,
    }
  })
}

@Controller('issued-invoices')
export class IssuedController {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  @Require('issued')
  @Get()
  async list() {
    const rows = await this.prisma.issuedInvoice.findMany({
      include: { contact: true },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
    })
    const lookup = await loadRectifiedLookup(
      this.prisma,
      rows.map((row) => row.id),
    )
    return rows.map((row) => presentIssuedInvoice(row, lookup))
  }

  @Require('issued')
  @Get(':id')
  async one(@Param('id') id: string) {
    return this.presentOne(await this.load(id))
  }

  @Require('issued')
  @Post()
  async create(@Body() body: CreateIssuedDto) {
    asDate(body.issueDate, 'La fecha')
    if (body.dueDate) asDate(body.dueDate, 'El vencimiento')
    const contact = await this.prisma.contact.findUnique({ where: { id: body.contactId } })
    if (!contact) throw new NotFoundException('Contacto no encontrado')
    const lines = buildLines(body.lines, body.operation)
    const base = money(lines.reduce((sum, line) => sum + line.base, 0))
    const vat = money(lines.reduce((sum, line) => sum + line.vatAmount, 0))
    const total = money(base + vat)
    fitMoney(base, 'La base')
    fitMoney(vat, 'El IVA')
    fitMoney(total, 'El total')
    if (!body.issue) {
      const draft = await this.prisma.issuedInvoice.create({
        data: {
          contactId: contact.id,
          issueDate: utcDay(body.issueDate),
          dueDate: body.dueDate ? utcDay(body.dueDate) : null,
          status: 'BORRADOR',
          operation: body.operation,
          base,
          vat,
          total,
          lines: { create: lines },
        },
        include: { contact: true, lines: true, payments: true },
      })
      return this.presentOne(draft)
    }
    const issued = await this.assignNumber((tx, number, series) =>
      tx.issuedInvoice.create({
        data: {
          series,
          number,
          contactId: contact.id,
          issueDate: utcDay(body.issueDate),
          dueDate: body.dueDate ? utcDay(body.dueDate) : null,
          status: 'EMITIDA',
          operation: body.operation,
          base,
          vat,
          total,
          lines: { create: lines },
        },
        include: { contact: true, lines: true, payments: true },
      }),
    )
    return this.presentOne(issued)
  }

  @Require('issued')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: CreateIssuedDto) {
    const invoice = await this.load(id)
    if (invoice.rectifiesId) throw new BadRequestException('Una rectificativa no se edita. Corrige la factura original.')
    if (asNumber(invoice.paidAmount) > 0) {
      throw new BadRequestException('No se puede editar una factura con cobros registrados')
    }
    const lookup = await loadRectifiedLookup(this.prisma, [id])
    if (lookup.originalIds.has(id)) {
      throw new BadRequestException('Esta factura ya tiene una rectificativa')
    }
    asDate(body.issueDate, 'La fecha')
    if (body.dueDate) asDate(body.dueDate, 'El vencimiento')
    const contact = await this.prisma.contact.findUnique({ where: { id: body.contactId } })
    if (!contact) throw new NotFoundException('Contacto no encontrado')
    const lines = buildLines(body.lines, body.operation)
    const base = money(lines.reduce((sum, line) => sum + line.base, 0))
    const vat = money(lines.reduce((sum, line) => sum + line.vatAmount, 0))
    const total = money(base + vat)
    fitMoney(base, 'La base')
    fitMoney(vat, 'El IVA')
    fitMoney(total, 'El total')
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.issuedInvoiceLine.deleteMany({ where: { invoiceId: id } })
      return tx.issuedInvoice.update({
        where: { id },
        data: {
          contactId: contact.id,
          issueDate: utcDay(body.issueDate),
          dueDate: body.dueDate ? utcDay(body.dueDate) : null,
          operation: body.operation,
          base,
          vat,
          total,
          lines: { create: lines },
        },
        include: { contact: true, lines: true, payments: true },
      })
    })
    return this.presentOne(updated)
  }

  @Require('issued')
  @Post(':id/issue')
  async issue(@Param('id') id: string) {
    const invoice = await this.load(id)
    if (invoice.status !== 'BORRADOR') throw new BadRequestException('Solo se emite un borrador')
    const issued = await this.assignNumber((tx, number, series) =>
      tx.issuedInvoice.update({
        where: { id },
        data: { series, number, status: 'EMITIDA' },
        include: { contact: true, lines: true, payments: true },
      }),
    )
    return this.presentOne(issued)
  }

  @Require('issued')
  @Post(':id/payments')
  async pay(@Param('id') id: string, @Body() body: PaymentDto) {
    asDate(body.date, 'La fecha')
    await this.payments.collectIssued(id, body.amount, body.date, body.bankAccountId)
    return this.presentOne(await this.load(id))
  }

  @Require('issued')
  @Post(':id/rectify')
  async rectify(@Param('id') id: string) {
    const original = await this.load(id)
    if (original.status === 'BORRADOR' || original.rectifiesId) {
      throw new BadRequestException('Este documento no se puede rectificar')
    }
    const already = await this.prisma.issuedInvoice.findFirst({ where: { rectifiesId: id } })
    if (already) throw new BadRequestException('Ya existe una rectificativa de esta factura')
    const today = new Date().toISOString().slice(0, 10)
    const created = await this.assignNumber((tx, number, series) =>
      tx.issuedInvoice.create({
        data: {
          series,
          number,
          contactId: original.contactId,
          issueDate: utcDay(today),
          status: 'EMITIDA',
          operation: original.operation,
          rectifiesId: original.id,
          base: original.base,
          vat: original.vat,
          total: original.total,
          lines: {
            create: original.lines.map((line) => ({
              concept: `Rectifica: ${line.concept}`,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatRate: line.vatRate,
              base: line.base,
              vatAmount: line.vatAmount,
            })),
          },
        },
        include: { contact: true, lines: true, payments: true },
      }),
    )
    return this.presentOne(created)
  }

  @Require('issued')
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.load(id)
    const org = await this.prisma.organization.findFirst()
    if (!org) throw new NotFoundException('Falta la configuración de la empresa')
    const buffer = await renderInvoicePdf(invoice, org)
    const code = invoiceCode(invoice.series, invoice.issueDate, invoice.number)
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `inline; filename="${code}.pdf"`)
    response.send(buffer)
  }

  @Require('issued', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const invoice = await this.load(id)
    if (invoice.status !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede borrar un borrador')
    }
    await this.prisma.issuedInvoice.delete({ where: { id } })
    return { ok: true }
  }

  private async presentOne(invoice: Awaited<ReturnType<IssuedController['load']>>) {
    const lookup = await loadRectifiedLookup(this.prisma, [invoice.id])
    return presentIssuedInvoice(invoice, lookup)
  }

  private async load(id: string) {
    const invoice = await this.prisma.issuedInvoice.findUnique({
      where: { id },
      include: { contact: true, lines: true, payments: { orderBy: { date: 'asc' } } },
    })
    if (!invoice) throw new NotFoundException('Factura no encontrada')
    return invoice
  }

  private async assignNumber<T>(
    write: (tx: Prisma.TransactionClient, number: number, series: string) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst()
      if (!org) throw new BadRequestException('Configura la empresa antes de emitir')
      const updated = await tx.organization.update({
        where: { id: org.id },
        data: { nextNumber: { increment: 1 } },
      })
      return write(tx, updated.nextNumber - 1, org.invoiceSeries)
    })
  }
}

export function issuedRemaining(total: number, paid: number) {
  return cents(total) - cents(paid)
}
