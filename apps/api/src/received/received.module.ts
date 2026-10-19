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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { asNumber, money, utcDay } from '../common/money'
import { asAmount, asBool, asDate, asOperation, asPercent, asRate, asText, optionalText, readUpload } from '../common/parse'
import { fitMoney, LIMIT, taxId } from '../common/check'
import { requireVies } from '../contacts/vies'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'
import { PaymentsService } from '../payments/payments.service'
import { scanInvoiceFile } from './scan-file'

class ReceivedForm {
  @IsOptional() @IsString() contactId?: string
  @IsOptional() @IsString() supplierName?: string
  @IsOptional() @IsString() supplierNif?: string
  @IsOptional() @IsString() country?: string
  @IsOptional() @IsString() vatNumber?: string
  @IsOptional() @IsString() isProfessional?: string
  @IsOptional() @IsString() irpfRate?: string
  @IsOptional() @IsString() base?: string
  @IsOptional() @IsString() vatRate?: string
  @IsOptional() @IsString() vatDeductible?: string
  @IsOptional() @IsString() operation?: string
  @IsOptional() @IsString() date?: string
  @IsOptional() @IsString() concept?: string
  @IsOptional() @IsString() number?: string
}

class ReceivedUpdate {
  @IsOptional() @IsString() base?: string
  @IsOptional() @IsString() vatRate?: string
  @IsOptional() @IsString() vatDeductible?: string
  @IsOptional() @IsString() operation?: string
  @IsOptional() @IsString() date?: string
  @IsOptional() @IsString() concept?: string
  @IsOptional() @IsString() number?: string
}

class PayForm {
  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsString()
  date!: string

  @IsOptional()
  @IsString()
  bankAccountId?: string
}

@Controller('received-invoices')
export class ReceivedController {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  @Require('received')
  @Get()
  async list() {
    const rows = await this.prisma.receivedInvoice.findMany({
      include: { supplier: true },
      orderBy: { date: 'desc' },
    })
    return rows.map(present)
  }

  @Require('received')
  @Post('scan')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async scan(
    @UploadedFile() file?: { size: number; mimetype: string; originalname: string; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Adjunta un PDF o una imagen')
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('El archivo supera los 2 MB')
    return scanInvoiceFile(file)
  }

  @Require('received')
  @Get(':id')
  async one(@Param('id') id: string) {
    return present(await this.load(id))
  }

  @Require('received')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async create(
    @Body() body: ReceivedForm,
    @UploadedFile() file?: { size: number; mimetype: string; originalname: string; buffer: Buffer },
  ) {
    const base = asAmount(body.base, 'La base')
    const vatRate = asRate(body.vatRate)
    const operation = asOperation(body.operation)
    const date = asDate(body.date, 'La fecha')
    const concept = asText(body.concept, 'El concepto', LIMIT.concept)
    const number = asText(body.number, 'El número de factura', LIMIT.number)
    const supplier = await this.resolveSupplier(body)
    const amounts = computeAmounts(base, vatRate, operation, supplier)
    const upload = readUpload(file)
    const created = await this.prisma.receivedInvoice.create({
      data: {
        supplierId: supplier.id,
        number,
        date: utcDay(date),
        operation,
        concept,
        base,
        vatRate,
        vat: amounts.vat,
        vatDeductible: asBool(body.vatDeductible, true),
        irpfWithheld: amounts.irpf,
        total: amounts.total,
        status: 'REGISTRADA',
        ...upload,
      },
      include: { supplier: true, payments: true },
    })
    return present(created)
  }

  @Require('received')
  @Post(':id/payments')
  async pay(@Param('id') id: string, @Body() body: PayForm) {
    await this.payments.payReceived(
      id,
      asAmount(body.amount, 'El importe'),
      asDate(body.date, 'La fecha'),
      optionalText(body.bankAccountId) ?? undefined,
    )
    return present(await this.load(id))
  }

  @Require('received')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: ReceivedUpdate) {
    const invoice = await this.load(id)
    if (asNumber(invoice.paidAmount) > 0) {
      throw new BadRequestException('No se puede editar una factura con pagos registrados')
    }
    const base = asAmount(body.base, 'La base')
    const vatRate = asRate(body.vatRate)
    const operation = asOperation(body.operation)
    const date = asDate(body.date, 'La fecha')
    const concept = asText(body.concept, 'El concepto', LIMIT.concept)
    const number = asText(body.number, 'El número de factura', LIMIT.number)
    const amounts = computeAmounts(base, vatRate, operation, invoice.supplier)
    const updated = await this.prisma.receivedInvoice.update({
      where: { id },
      data: {
        number,
        date: utcDay(date),
        operation,
        concept,
        base,
        vatRate,
        vat: amounts.vat,
        vatDeductible: asBool(body.vatDeductible, true),
        irpfWithheld: amounts.irpf,
        total: amounts.total,
      },
      include: { supplier: true, payments: true },
    })
    return present(updated)
  }

  @Require('received', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const invoice = await this.load(id)
    if (asNumber(invoice.paidAmount) > 0 || invoice.payments.length > 0) {
      throw new BadRequestException('No se puede borrar una factura con pagos registrados')
    }
    await this.prisma.receivedInvoice.delete({ where: { id } })
    return { ok: true }
  }

  @Require('received')
  @Get(':id/file')
  async file(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.prisma.receivedInvoice.findUnique({ where: { id } })
    if (!invoice?.fileData || !invoice.fileMime) throw new NotFoundException('Esta factura no tiene archivo')
    response.setHeader('Content-Type', invoice.fileMime)
    response.setHeader('Content-Disposition', `inline; filename="${invoice.fileName || 'factura'}"`)
    response.send(Buffer.from(invoice.fileData))
  }

  private async load(id: string) {
    const invoice = await this.prisma.receivedInvoice.findUnique({
      where: { id },
      include: { supplier: true, payments: { orderBy: { date: 'asc' } } },
    })
    if (!invoice) throw new NotFoundException('Factura no encontrada')
    return invoice
  }

  private async resolveSupplier(body: ReceivedForm) {
    const contactId = optionalText(body.contactId)
    if (contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: contactId } })
      if (!contact) throw new NotFoundException('Proveedor no encontrado')
      return contact
    }
    const nif = taxId(asText(body.supplierNif, 'El NIF del proveedor', LIMIT.nif))
    const existing = await this.prisma.contact.findFirst({ where: { nif } })
    if (existing) return existing
    const professional = asBool(body.isProfessional, false)
    const country = (optionalText(body.country, 2) || 'ES').toUpperCase()
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException('El país se indica con dos letras, por ejemplo ES')
    }
    const vatNumber = optionalText(body.vatNumber, LIMIT.nif)
    const normalizedVat = vatNumber ? taxId(vatNumber) : null
    if (normalizedVat) await requireVies(normalizedVat)
    return this.prisma.contact.create({
      data: {
        name: asText(body.supplierName, 'El proveedor', LIMIT.name),
        nif,
        country,
        vatNumber: normalizedVat,
        kind: 'SUPPLIER',
        isProfessional: professional,
        defaultIrpfRate: professional ? asPercent(body.irpfRate ?? 15, 'La retención') : null,
      },
    })
  }
}

function computeAmounts(
  base: number,
  vatRate: number,
  operation: ReturnType<typeof asOperation>,
  supplier: { isProfessional: boolean; defaultIrpfRate: { toString(): string } | null },
) {
  const irpfRate = supplier.isProfessional ? asNumber(supplier.defaultIrpfRate) || 15 : 0
  const vat = money((base * vatRate) / 100)
  const irpf = money((base * irpfRate) / 100)
  const total = operation === 'NACIONAL' ? money(base + vat - irpf) : money(base - irpf)
  fitMoney(vat, 'El IVA')
  fitMoney(irpf, 'La retención')
  fitMoney(total, 'El total')
  return { vat, irpf, total }
}

function present(invoice: {
  date: Date
  base: { toString(): string }
  vat: { toString(): string }
  irpfWithheld: { toString(): string }
  total: { toString(): string }
  paidAmount: { toString(): string }
  fileData?: Uint8Array | null
  supplier?: { defaultIrpfRate: { toString(): string } | null; name: string; nif: string; id: string; isProfessional: boolean; country: string; vatNumber: string | null }
  payments?: Array<{ amount: { toString(): string }; date: Date; id: string }>
  [key: string]: unknown
}) {
  const { fileData, ...rest } = invoice
  return {
    ...rest,
    date: invoice.date.toISOString().slice(0, 10),
    base: asNumber(invoice.base),
    vat: asNumber(invoice.vat),
    irpfWithheld: asNumber(invoice.irpfWithheld),
    total: asNumber(invoice.total),
    paidAmount: asNumber(invoice.paidAmount),
    hasFile: Boolean(fileData),
    supplier: invoice.supplier
      ? {
          ...invoice.supplier,
          defaultIrpfRate: invoice.supplier.defaultIrpfRate ? asNumber(invoice.supplier.defaultIrpfRate) : null,
        }
      : undefined,
    payments: invoice.payments?.map((payment) => ({
      ...payment,
      amount: asNumber(payment.amount),
      date: payment.date.toISOString().slice(0, 10),
    })),
  }
}
