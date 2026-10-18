import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
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
import { fitMoney, LIMIT } from '../common/check'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'
import { PaymentsService } from '../payments/payments.service'

class ExpenseForm {
  @IsOptional() @IsString() supplierName?: string
  @IsOptional() @IsString() category?: string
  @IsOptional() @IsString() number?: string
  @IsOptional() @IsString() date?: string
  @IsOptional() @IsString() operation?: string
  @IsOptional() @IsString() concept?: string
  @IsOptional() @IsString() base?: string
  @IsOptional() @IsString() vatRate?: string
  @IsOptional() @IsString() vatDeductible?: string
  @IsOptional() @IsString() isProfessional?: string
  @IsOptional() @IsString() irpfRate?: string
}

class ExpensePayForm {
  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsString()
  date!: string

  @IsOptional()
  @IsString()
  bankAccountId?: string
}

@Controller('expenses')
export class ExpensesController {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  @Require('expenses')
  @Get()
  async list() {
    const rows = await this.prisma.expense.findMany({ orderBy: { date: 'desc' } })
    return rows.map(present)
  }

  @Require('expenses')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async create(
    @Body() body: ExpenseForm,
    @UploadedFile() file?: { size: number; mimetype: string; originalname: string; buffer: Buffer },
  ) {
    const base = asAmount(body.base, 'La base')
    const vatRate = asRate(body.vatRate)
    const operation = asOperation(body.operation ?? 'NACIONAL')
    const vat = money((base * vatRate) / 100)
    const irpfRate = asBool(body.isProfessional, false) ? asPercent(body.irpfRate ?? 15, 'La retención') : 0
    const irpf = money((base * irpfRate) / 100)
    const total = operation === 'NACIONAL' ? money(base + vat - irpf) : money(base - irpf)
    fitMoney(vat, 'El IVA')
    fitMoney(irpf, 'La retención')
    fitMoney(total, 'El total')
    const created = await this.prisma.expense.create({
      data: {
        supplierName: asText(body.supplierName, 'El proveedor', LIMIT.name),
        category: asText(body.category, 'La categoría', LIMIT.category),
        number: optionalText(body.number, LIMIT.number),
        date: utcDay(asDate(body.date, 'La fecha')),
        operation,
        concept: asText(body.concept, 'El concepto', LIMIT.concept),
        base,
        vatRate,
        vat,
        vatDeductible: asBool(body.vatDeductible, false),
        irpfWithheld: irpf,
        total,
        status: 'REGISTRADA',
        ...readUpload(file),
      },
    })
    return present(created)
  }

  @Require('expenses')
  @Post(':id/payments')
  async pay(@Param('id') id: string, @Body() body: ExpensePayForm) {
    await this.payments.payExpense(
      id,
      asAmount(body.amount, 'El importe'),
      asDate(body.date, 'La fecha'),
      optionalText(body.bankAccountId) ?? undefined,
    )
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: { payments: true } })
    if (!expense) throw new NotFoundException('Gasto no encontrado')
    return present(expense)
  }

  @Require('expenses')
  @Get(':id/file')
  async file(@Param('id') id: string, @Res() response: Response) {
    const expense = await this.prisma.expense.findUnique({ where: { id } })
    if (!expense?.fileData || !expense.fileMime) throw new NotFoundException('Este gasto no tiene archivo')
    response.setHeader('Content-Type', expense.fileMime)
    response.setHeader('Content-Disposition', `inline; filename="${expense.fileName || 'gasto'}"`)
    response.send(Buffer.from(expense.fileData))
  }
}

function present(expense: {
  date: Date
  base: { toString(): string }
  vat: { toString(): string }
  irpfWithheld: { toString(): string }
  total: { toString(): string }
  paidAmount: { toString(): string }
  fileData?: Uint8Array | null
  payments?: Array<{ amount: { toString(): string }; date: Date }>
  [key: string]: unknown
}) {
  const { fileData, ...rest } = expense
  return {
    ...rest,
    date: expense.date.toISOString().slice(0, 10),
    base: asNumber(expense.base),
    vat: asNumber(expense.vat),
    irpfWithheld: asNumber(expense.irpfWithheld),
    total: asNumber(expense.total),
    paidAmount: asNumber(expense.paidAmount),
    hasFile: Boolean(fileData),
    payments: expense.payments?.map((payment) => ({
      ...payment,
      amount: asNumber(payment.amount),
      date: payment.date.toISOString().slice(0, 10),
    })),
  }
}
