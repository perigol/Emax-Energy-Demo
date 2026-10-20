import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { IsInt, Max, Min } from 'class-validator'
import { Prisma } from '@prisma/client'
import type { Response } from 'express'
import {
  calculatePeriod,
  calculateYear,
  canLiquidateQuarter,
  canLiquidateYear,
  quarterRange,
  round2,
  type DocStatus,
  type Modelo111,
  type Modelo303,
  type Modelo349Line,
  type OperationType,
  type TaxDocument,
  type VatRate,
} from '@norteluz/tax'
import { asNumber, day, money } from '../common/money'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'
import { renderSettlementPdf, renderYearSettlementPdf } from './settlement-pdf'

class SettleDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number
}

class YearDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number
}

@Controller('tax')
export class TaxController {
  constructor(private prisma: PrismaService) {}

  @Require('tax')
  @Get('summary')
  async summary(@Query('year') yearRaw?: string) {
    const year = this.year(yearRaw)
    const docs = await this.documents()
    const calculated = calculateYear(docs, year)
    const [issued, received, expenses] = await Promise.all([
      this.prisma.issuedInvoice.findMany(),
      this.prisma.receivedInvoice.findMany(),
      this.prisma.expense.findMany(),
    ])
    const inYear = (date: Date) => date.getUTCFullYear() === year
    const pendienteCobro = money(
      issued
        .filter((row) => !row.rectifiesId && inYear(row.issueDate) && (row.status === 'EMITIDA' || row.status === 'COBRADA_PARCIAL'))
        .reduce((sum, row) => sum + (asNumber(row.total) - asNumber(row.paidAmount)), 0),
    )
    const pendientePago = money(
      [
        ...received
          .filter((row) => row.status === 'REGISTRADA' && inYear(row.date))
          .map((row) => asNumber(row.total) - asNumber(row.paidAmount)),
        ...expenses
          .filter((row) => row.status === 'REGISTRADA' && inYear(row.date))
          .map((row) => asNumber(row.total) - asNumber(row.paidAmount)),
      ].reduce((sum, value) => sum + value, 0),
    )
    const issuedOk = new Set(['EMITIDA', 'COBRADA_PARCIAL', 'COBRADA'])
    const ingresos = money(
      issued
        .filter((row) => issuedOk.has(row.status) && inYear(row.issueDate))
        .reduce((sum, row) => sum + (row.rectifiesId ? -asNumber(row.total) : asNumber(row.total)), 0),
    )
    const gastos = money(
      [
        ...received.filter((row) => inYear(row.date)).map((row) => asNumber(row.total)),
        ...expenses.filter((row) => inYear(row.date)).map((row) => asNumber(row.total)),
      ].reduce((sum, value) => sum + value, 0),
    )
    const monthOf = (date: Date) => date.getUTCMonth() + 1
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const monthIngresos = money(
        issued
          .filter((row) => issuedOk.has(row.status) && inYear(row.issueDate) && monthOf(row.issueDate) === month)
          .reduce((sum, row) => sum + (row.rectifiesId ? -asNumber(row.total) : asNumber(row.total)), 0),
      )
      const monthGastos = money(
        [
          ...received.filter((row) => inYear(row.date) && monthOf(row.date) === month).map((row) => asNumber(row.total)),
          ...expenses.filter((row) => inYear(row.date) && monthOf(row.date) === month).map((row) => asNumber(row.total)),
        ].reduce((sum, value) => sum + value, 0),
      )
      return { month, ingresos: monthIngresos, gastos: monthGastos }
    })
    return {
      year,
      ingresos,
      gastos,
      months,
      balance: money(ingresos - gastos),
      pendienteCobro,
      pendientePago,
      quarters: calculated.quarters.map((quarter) => ({
        quarter: quarter.quarter,
        devengado: quarter.modelo303.devengado,
        deducible: quarter.modelo303.deducible,
        resultado: quarter.modelo303.resultado,
        retencion: quarter.modelo111.retencion,
        perceptores: quarter.modelo111.perceptores,
      })),
      total: {
        devengado: calculated.total.modelo303.devengado,
        deducible: calculated.total.modelo303.deducible,
        resultado: calculated.total.modelo303.resultado,
        perceptores: calculated.total.modelo111.perceptores,
        retencion: calculated.total.modelo111.retencion,
      },
    }
  }

  @Require('tax')
  @Get('303')
  async modelo303(@Query('year') yearRaw?: string, @Query('quarter') quarterRaw?: string) {
    const year = this.year(yearRaw)
    const quarter = this.quarter(quarterRaw)
    const period = calculatePeriod(await this.documents(), year, quarter)
    return { year, quarter, ...period.modelo303 }
  }

  @Require('tax')
  @Get('111')
  async modelo111(@Query('year') yearRaw?: string, @Query('quarter') quarterRaw?: string) {
    const year = this.year(yearRaw)
    const quarter = this.quarter(quarterRaw)
    const period = calculatePeriod(await this.documents(), year, quarter)
    return { year, quarter, ...period.modelo111 }
  }

  @Require('tax')
  @Get('349')
  async modelo349(@Query('year') yearRaw?: string, @Query('quarter') quarterRaw?: string) {
    const year = this.year(yearRaw)
    const quarter = this.quarter(quarterRaw)
    const period = calculatePeriod(await this.documents(), year, quarter)
    return { year, quarter, lines: period.modelo349 }
  }

  @Require('tax')
  @Get('settlements')
  async settlements(@Query('year') yearRaw?: string) {
    const year = this.year(yearRaw)
    const today = madridToday()
    const [docs, stored] = await Promise.all([
      this.documents(),
      this.prisma.quarterSettlement.findMany({ where: { year } }),
    ])
    const calculated = calculateYear(docs, year)
    const quarters = ([1, 2, 3, 4] as const).map((quarter) => {
      const row = stored.find((item) => item.quarter === quarter)
      const snapshot = row ? readSnapshot(row.snapshot) : null
      const live = calculated.quarters[quarter - 1]?.modelo303.resultado ?? 0
      return {
        quarter,
        closesOn: quarterRange(year, quarter).to,
        resultado: snapshot ? snapshot.modelo303.resultado : live,
        canSettle: canLiquidateQuarter(year, quarter, today),
        settledOn: row ? madridToday(row.settledAt) : null,
      }
    })
    const settledOn = quarters.every((quarter) => quarter.settledOn)
      ? quarters.map((quarter) => quarter.settledOn as string).sort().at(-1) ?? null
      : null
    return {
      year,
      today,
      quarters,
      exercise: {
        closesOn: `${year}-12-31`,
        canSettle: canLiquidateYear(year, today),
        settledOn,
        resultado: round2(quarters.reduce((sum, quarter) => sum + quarter.resultado, 0)),
      },
    }
  }

  @Require('tax')
  @Post('settlements/year')
  async settleYear(@Body() body: YearDto) {
    const today = madridToday()
    if (!canLiquidateYear(body.year, today)) {
      throw new BadRequestException('El ejercicio todavía no ha cerrado. El cierre anual espera al 31 de diciembre.')
    }
    const calculated = calculateYear(await this.documents(), body.year)
    for (const quarter of [1, 2, 3, 4] as const) {
      const period = calculated.quarters[quarter - 1]
      if (!period) continue
      const existing = await this.prisma.quarterSettlement.findUnique({
        where: { year_quarter: { year: body.year, quarter } },
      })
      if (existing) continue
      await this.prisma.quarterSettlement.create({
        data: {
          year: body.year,
          quarter,
          snapshot: snapshotOf(period),
        },
      })
    }
    return { year: body.year, settledOn: today }
  }

  @Require('tax')
  @Get('settlements/year/:year/pdf')
  async yearPdf(@Param('year') yearRaw: string, @Res() response: Response) {
    const year = Number(yearRaw)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('El ejercicio no es válido')
    }
    const [rows, org] = await Promise.all([
      this.prisma.quarterSettlement.findMany({ where: { year }, orderBy: { quarter: 'asc' } }),
      this.prisma.organization.findFirst(),
    ])
    if (rows.length < 4) throw new NotFoundException('Ese ejercicio no está liquidado.')
    if (!org) throw new NotFoundException('Falta la configuración de la empresa')
    const quarters = ([1, 2, 3, 4] as const).map((quarter) => {
      const row = rows.find((item) => item.quarter === quarter)
      if (!row) throw new NotFoundException('Ese ejercicio no está liquidado.')
      return { quarter, settledAt: row.settledAt, ...readSnapshot(row.snapshot) }
    })
    const modelo349 = new Map<string, Modelo349Line>()
    for (const quarter of quarters) {
      for (const line of quarter.modelo349) {
        const key = `${line.vatId}|${line.clave}`
        const current = modelo349.get(key)
        if (current) current.base = round2(current.base + line.base)
        else modelo349.set(key, { ...line })
      }
    }
    const total303 = quarters.reduce(
      (sum, quarter) => ({
        devengado: round2(sum.devengado + quarter.modelo303.devengado),
        deducible: round2(sum.deducible + quarter.modelo303.deducible),
        resultado: round2(sum.resultado + quarter.modelo303.resultado),
      }),
      { devengado: 0, deducible: 0, resultado: 0 },
    )
    const total111 = quarters.reduce(
      (sum, quarter) => ({
        perceptores: sum.perceptores + quarter.modelo111.perceptores,
        base: round2(sum.base + quarter.modelo111.base),
        retencion: round2(sum.retencion + quarter.modelo111.retencion),
      }),
      { perceptores: 0, base: 0, retencion: 0 },
    )
    const settledOn = quarters.map((quarter) => madridToday(quarter.settledAt)).sort().at(-1) || madridToday()
    const buffer = await renderYearSettlementPdf({
      year,
      settledOn,
      org,
      quarters,
      total303,
      total111,
      modelo349: [...modelo349.values()].sort((a, b) => `${a.clave}${a.vatId}`.localeCompare(`${b.clave}${b.vatId}`)),
      empty: total303.devengado === 0 && total303.deducible === 0 && total111.retencion === 0 && modelo349.size === 0,
    })
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="liquidacion-ejercicio-${year}.pdf"`)
    response.send(buffer)
  }

  @Require('tax')
  @Post('settlements')
  async settle(@Body() body: SettleDto) {
    const quarter = body.quarter as 1 | 2 | 3 | 4
    const today = madridToday()
    if (!canLiquidateQuarter(body.year, quarter, today)) {
      throw new BadRequestException('Ese trimestre todavía no ha cerrado. Solo se liquida un trimestre ya pasado.')
    }
    const period = calculatePeriod(await this.documents(), body.year, quarter)
    try {
      const created = await this.prisma.quarterSettlement.create({
        data: {
          year: body.year,
          quarter,
          snapshot: snapshotOf(period),
        },
      })
      return {
        year: created.year,
        quarter,
        settledOn: madridToday(created.settledAt),
        resultado: period.modelo303.resultado,
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ese trimestre ya está liquidado.')
      }
      throw error
    }
  }

  @Require('tax')
  @Get('settlements/:year/:quarter/pdf')
  async settlementPdf(
    @Param('year') yearRaw: string,
    @Param('quarter') quarterRaw: string,
    @Res() response: Response,
  ) {
    const { year, quarter } = this.periodParams(yearRaw, quarterRaw)
    const [row, org] = await Promise.all([
      this.prisma.quarterSettlement.findUnique({ where: { year_quarter: { year, quarter } } }),
      this.prisma.organization.findFirst(),
    ])
    if (!org) throw new NotFoundException('Falta la configuración de la empresa')
    const snapshot = row
      ? readSnapshot(row.snapshot)
      : periodSnapshot(calculatePeriod(await this.documents(), year, quarter))
    const buffer = await renderSettlementPdf({
      year,
      quarter,
      settledOn: row ? madridToday(row.settledAt) : null,
      org,
      ...snapshot,
    })
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="liquidacion-${quarter}T-${year}.pdf"`)
    response.send(buffer)
  }

  private year(value?: string) {
    const year = Number(value || 2026)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return 2026
    return year
  }

  private quarter(value?: string): 1 | 2 | 3 | 4 {
    const quarter = Number(value || 1)
    if (quarter === 2 || quarter === 3 || quarter === 4) return quarter
    return 1
  }

  private periodParams(yearRaw: string, quarterRaw: string): { year: number; quarter: 1 | 2 | 3 | 4 } {
    const year = Number(yearRaw)
    const quarter = Number(quarterRaw)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('El ejercicio no es válido')
    }
    if (quarter !== 1 && quarter !== 2 && quarter !== 3 && quarter !== 4) {
      throw new BadRequestException('El trimestre no es válido')
    }
    return { year, quarter }
  }

  private async documents(): Promise<TaxDocument[]> {
    const [issued, received, expenses] = await Promise.all([
      this.prisma.issuedInvoice.findMany({ include: { lines: true, contact: true } }),
      this.prisma.receivedInvoice.findMany({ include: { supplier: true } }),
      this.prisma.expense.findMany(),
    ])
    const docs: TaxDocument[] = []
    for (const invoice of issued) {
      const groups = new Map<number, { base: number; vat: number }>()
      for (const line of invoice.lines) {
        const current = groups.get(line.vatRate) ?? { base: 0, vat: 0 }
        current.base = money(current.base + asNumber(line.base))
        current.vat = money(current.vat + asNumber(line.vatAmount))
        groups.set(line.vatRate, current)
      }
      const entries = [...groups.entries()]
      if (!entries.length) entries.push([0, { base: asNumber(invoice.base), vat: asNumber(invoice.vat) }])
      entries.forEach(([rate, amounts], index) => {
        docs.push({
          id: `${invoice.id}:${rate}`,
          kind: 'EMITIDA',
          date: day(invoice.issueDate),
          status: invoice.status as DocStatus,
          isRectificativa: Boolean(invoice.rectifiesId),
          base: amounts.base,
          vatRate: rate as VatRate,
          vatAmount: amounts.vat,
          vatDeductible: false,
          irpfAmount: index === 0 ? asNumber(invoice.irpfWithheld) : 0,
          irpfBase: index === 0 && asNumber(invoice.irpfWithheld) > 0 ? asNumber(invoice.base) : 0,
          operation: invoice.operation as OperationType,
          counterpartyVatId: invoice.contact.vatNumber,
          counterpartyName: invoice.contact.name,
          counterpartyId: invoice.contactId,
        })
      })
    }
    for (const invoice of received) {
      docs.push({
        id: invoice.id,
        kind: 'RECIBIDA',
        date: day(invoice.date),
        status: invoice.status as DocStatus,
        isRectificativa: false,
        base: asNumber(invoice.base),
        vatRate: invoice.vatRate as VatRate,
        vatAmount: asNumber(invoice.vat),
        vatDeductible: invoice.vatDeductible,
        irpfAmount: asNumber(invoice.irpfWithheld),
        irpfBase: asNumber(invoice.irpfWithheld) > 0 ? asNumber(invoice.base) : 0,
        operation: invoice.operation as OperationType,
        counterpartyVatId: invoice.supplier.vatNumber,
        counterpartyName: invoice.supplier.name,
        counterpartyId: invoice.supplierId,
      })
    }
    for (const expense of expenses) {
      docs.push({
        id: expense.id,
        kind: 'GASTO',
        date: day(expense.date),
        status: expense.status as DocStatus,
        isRectificativa: false,
        base: asNumber(expense.base),
        vatRate: expense.vatRate as VatRate,
        vatAmount: asNumber(expense.vat),
        vatDeductible: expense.vatDeductible,
        irpfAmount: asNumber(expense.irpfWithheld),
        irpfBase: asNumber(expense.irpfWithheld) > 0 ? asNumber(expense.base) : 0,
        operation: expense.operation as OperationType,
        counterpartyName: expense.supplierName,
        counterpartyId: `gasto:${expense.supplierName}`,
      })
    }
    return docs
  }
}

function madridToday(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function periodSnapshot(period: {
  modelo303: Modelo303
  modelo111: Modelo111
  modelo349: Modelo349Line[]
}) {
  return {
    modelo303: period.modelo303,
    modelo111: period.modelo111,
    modelo349: period.modelo349,
  }
}

function snapshotOf(period: {
  modelo303: Modelo303
  modelo111: Modelo111
  modelo349: Modelo349Line[]
}): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(periodSnapshot(period))) as Prisma.InputJsonObject
}

function readSnapshot(value: Prisma.JsonValue): {
  modelo303: Modelo303
  modelo111: Modelo111
  modelo349: Modelo349Line[]
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NotFoundException('La liquidación no se puede leer')
  }
  return value as unknown as { modelo303: Modelo303; modelo111: Modelo111; modelo349: Modelo349Line[] }
}
