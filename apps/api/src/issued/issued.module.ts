import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common'
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { Response } from 'express'
import PDFDocument from 'pdfkit'
import { Prisma } from '@prisma/client'
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

function presentInvoice(invoice: {
  issueDate: Date
  dueDate: Date | null
  base: { toString(): string }
  vat: { toString(): string }
  irpfWithheld: { toString(): string }
  total: { toString(): string }
  paidAmount: { toString(): string }
  series: string | null
  number: number | null
  lines?: Array<{ quantity: { toString(): string }; unitPrice: { toString(): string }; base: { toString(): string }; vatAmount: { toString(): string } }>
  payments?: Array<{ amount: { toString(): string }; date: Date }>
  contact?: { name: string }
  [key: string]: unknown
}) {
  const today = new Date().toISOString().slice(0, 10)
  const due = invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null
  const status = invoice.status as string
  return {
    ...invoice,
    code: invoiceCode(invoice.series, invoice.issueDate, invoice.number),
    issueDate: invoice.issueDate.toISOString().slice(0, 10),
    dueDate: due,
    base: asNumber(invoice.base),
    vat: asNumber(invoice.vat),
    irpfWithheld: asNumber(invoice.irpfWithheld),
    total: asNumber(invoice.total),
    paidAmount: asNumber(invoice.paidAmount),
    displayStatus: status === 'EMITIDA' && due && due < today ? 'VENCIDA' : status,
    lines: invoice.lines?.map((line) => ({
      ...line,
      quantity: asNumber(line.quantity),
      unitPrice: asNumber(line.unitPrice),
      base: asNumber(line.base),
      vatAmount: asNumber(line.vatAmount),
    })),
    payments: invoice.payments?.map((payment) => ({
      ...payment,
      amount: asNumber(payment.amount),
      date: payment.date.toISOString().slice(0, 10),
    })),
  }
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
    return rows.map((row) => presentInvoice(row))
  }

  @Require('issued')
  @Get(':id')
  async one(@Param('id') id: string) {
    return presentInvoice(await this.load(id))
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
      return presentInvoice(draft)
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
    return presentInvoice(issued)
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
    return presentInvoice(issued)
  }

  @Require('issued')
  @Post(':id/payments')
  async pay(@Param('id') id: string, @Body() body: PaymentDto) {
    asDate(body.date, 'La fecha')
    await this.payments.collectIssued(id, body.amount, body.date, body.bankAccountId)
    return presentInvoice(await this.load(id))
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
    return presentInvoice(created)
  }

  @Require('issued')
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.load(id)
    const org = await this.prisma.organization.findFirst()
    if (!org) throw new NotFoundException('Falta la configuración de la empresa')
    const buffer = await renderPdf(invoice, org)
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

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function renderPdf(
  invoice: Awaited<ReturnType<IssuedController['load']>> extends infer T ? T : never,
  org: { legalName: string; nif: string; fiscalAddress: string; logoData: Uint8Array | null; logoMime: string | null },
) {
  const sign = invoice.rectifiesId ? -1 : 1
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    if (org.logoData && org.logoMime && org.logoMime !== 'image/webp') {
      try {
        doc.image(Buffer.from(org.logoData), 48, 42, { fit: [88, 48] })
      } catch {
        // Un logo ilegible no impide emitir el PDF.
      }
    }
    doc.fillColor('#1e2a24').font('Times-Bold').fontSize(20).text('Norte Luz', 150, 48)
    doc.font('Times-Roman').fontSize(10).fillColor('#3d4a43').text(org.legalName, 150, 74)
    doc.text(`NIF ${org.nif}`, 150, 88)
    doc.text(org.fiscalAddress, 150, 102)
    doc.moveDown()
    const code = invoiceCode(invoice.series, invoice.issueDate, invoice.number)
    doc.fillColor('#1c1915').font('Times-Bold').fontSize(16).text(
      invoice.rectifiesId ? `Factura rectificativa ${code}` : `Factura ${code}`,
      48,
      150,
    )
    doc.font('Times-Roman').fontSize(11).text(`Fecha ${invoice.issueDate.toISOString().slice(0, 10)}`)
    doc.moveDown()
    doc.font('Times-Bold').text('Cliente')
    doc.font('Times-Roman').text(invoice.contact.name)
    doc.text(invoice.contact.nif)
    if (invoice.contact.address) doc.text(invoice.contact.address)
    doc.moveDown()
    const top = doc.y + 8
    doc.font('Times-Bold').fontSize(10)
    doc.text('Concepto', 48, top)
    doc.text('Base', 330, top, { width: 70, align: 'right' })
    doc.text('IVA', 410, top, { width: 40, align: 'right' })
    doc.text('Cuota', 460, top, { width: 80, align: 'right' })
    doc.moveTo(48, top + 16).lineTo(547, top + 16).strokeColor('#c4a35a').stroke()
    let y = top + 26
    doc.font('Times-Roman').fillColor('#1c1915')
    for (const line of invoice.lines) {
      doc.text(line.concept, 48, y, { width: 270 })
      doc.text(euro.format(sign * asNumber(line.base)), 330, y, { width: 70, align: 'right' })
      doc.text(`${line.vatRate} %`, 410, y, { width: 40, align: 'right' })
      doc.text(euro.format(sign * asNumber(line.vatAmount)), 460, y, { width: 80, align: 'right' })
      y += 22
    }
    y += 12
    doc.font('Times-Bold')
    doc.text(`Base ${euro.format(sign * asNumber(invoice.base))}`, 330, y, { width: 210, align: 'right' })
    doc.text(`IVA ${euro.format(sign * asNumber(invoice.vat))}`, 330, y + 16, { width: 210, align: 'right' })
    doc.fontSize(13).text(`Total ${euro.format(sign * asNumber(invoice.total))}`, 330, y + 36, {
      width: 210,
      align: 'right',
    })
    doc.font('Times-Roman').fontSize(9).fillColor('#6b645b').text(
      'Documento de demostración. No es una factura presentada ante la Agencia Tributaria.',
      48,
      760,
      { width: 500 },
    )
    doc.end()
  })
}

export function issuedRemaining(total: number, paid: number) {
  return cents(total) - cents(paid)
}
