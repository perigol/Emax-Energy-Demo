import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Prisma } from '@prisma/client'
import { Require } from '../auth/decorators'
import { fitMoney, LIMIT, MAX_MONEY } from '../common/check'
import { asNumber, invoiceCode, money, utcDay } from '../common/money'
import { asDate, type Operation } from '../common/parse'
import { PrismaService } from '../prisma/prisma.service'

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

class CreateQuoteDto {
  @IsString()
  contactId!: string

  @IsString()
  date!: string

  @IsOptional()
  @IsString()
  validUntil?: string

  @IsIn(['NACIONAL', 'INTRACOMUNITARIA_BIENES', 'INTRACOMUNITARIA_SERVICIOS', 'INVERSION_SUJETO_PASIVO'])
  operation!: Operation

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[]
}

class ConvertDto {
  @IsString()
  issueDate!: string
}

function buildLines(lines: LineDto[], operation: Operation) {
  if (!lines.length) throw new BadRequestException('El presupuesto necesita al menos una línea')
  return lines.map((line) => {
    const concept = line.concept?.trim() ?? ''
    if (!concept) throw new BadRequestException('Cada línea necesita un concepto')
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

type QuoteRow = Prisma.QuoteGetPayload<{ include: { contact: true; lines: true } }>

function present(quote: QuoteRow) {
  return {
    id: quote.id,
    code: invoiceCode('P', quote.date, quote.number),
    date: quote.date.toISOString().slice(0, 10),
    validUntil: quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : null,
    status: quote.status,
    operation: quote.operation,
    base: asNumber(quote.base),
    vat: asNumber(quote.vat),
    total: asNumber(quote.total),
    issuedInvoiceId: quote.issuedInvoiceId,
    contact: { id: quote.contact.id, name: quote.contact.name, nif: quote.contact.nif },
    lines: quote.lines.map((line) => ({
      id: line.id,
      concept: line.concept,
      quantity: asNumber(line.quantity),
      unitPrice: asNumber(line.unitPrice),
      vatRate: line.vatRate,
      base: asNumber(line.base),
      vatAmount: asNumber(line.vatAmount),
    })),
  }
}

@Controller('quotes')
export class QuotesController {
  constructor(private prisma: PrismaService) {}

  @Require('issued')
  @Get()
  async list() {
    const rows = await this.prisma.quote.findMany({
      include: { contact: true, lines: true },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
    })
    return rows.map(present)
  }

  @Require('issued')
  @Get(':id')
  async one(@Param('id') id: string) {
    return present(await this.load(id))
  }

  @Require('issued')
  @Post()
  async create(@Body() body: CreateQuoteDto) {
    asDate(body.date, 'La fecha')
    if (body.validUntil) asDate(body.validUntil, 'La validez')
    const contact = await this.prisma.contact.findUnique({ where: { id: body.contactId } })
    if (!contact || contact.kind === 'SUPPLIER') {
      throw new NotFoundException('Elige un cliente')
    }
    const lines = buildLines(body.lines, body.operation)
    const base = money(lines.reduce((sum, line) => sum + line.base, 0))
    const vat = money(lines.reduce((sum, line) => sum + line.vatAmount, 0))
    const total = money(base + vat)
    fitMoney(total, 'El total')
    const created = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst()
      if (!org) throw new BadRequestException('Configura la empresa antes de presupuestar')
      const updated = await tx.organization.update({
        where: { id: org.id },
        data: { nextQuote: { increment: 1 } },
      })
      return tx.quote.create({
        data: {
          number: updated.nextQuote - 1,
          contactId: contact.id,
          date: utcDay(body.date),
          validUntil: body.validUntil ? utcDay(body.validUntil) : null,
          operation: body.operation,
          base,
          vat,
          total,
          lines: { create: lines },
        },
        include: { contact: true, lines: true },
      })
    })
    return present(created)
  }

  @Require('issued')
  @Post(':id/convert')
  async convert(@Param('id') id: string, @Body() body: ConvertDto) {
    const issueDate = asDate(body.issueDate, 'La fecha de la factura')
    const quote = await this.load(id)
    if (quote.status === 'CONVERTIDO' || quote.issuedInvoiceId) {
      throw new BadRequestException('Este presupuesto ya es una factura')
    }
    const invoice = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst()
      if (!org) throw new BadRequestException('Configura la empresa antes de emitir')
      const updated = await tx.organization.update({
        where: { id: org.id },
        data: { nextNumber: { increment: 1 } },
      })
      const created = await tx.issuedInvoice.create({
        data: {
          series: org.invoiceSeries,
          number: updated.nextNumber - 1,
          contactId: quote.contactId,
          issueDate: utcDay(issueDate),
          dueDate: quote.validUntil,
          status: 'EMITIDA',
          operation: quote.operation,
          base: quote.base,
          vat: quote.vat,
          total: quote.total,
          lines: {
            create: quote.lines.map((line) => ({
              concept: line.concept,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              vatRate: line.vatRate,
              base: line.base,
              vatAmount: line.vatAmount,
            })),
          },
        },
      })
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'CONVERTIDO', issuedInvoiceId: created.id },
      })
      return created
    })
    return { id: invoice.id, quote: present(await this.load(id)) }
  }

  @Require('issued', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const quote = await this.load(id)
    if (quote.status === 'CONVERTIDO') {
      throw new BadRequestException('Un presupuesto convertido no se puede borrar')
    }
    await this.prisma.quote.delete({ where: { id } })
    return { ok: true }
  }

  private async load(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { contact: true, lines: true },
    })
    if (!quote) throw new NotFoundException('Presupuesto no encontrado')
    return quote
  }
}
