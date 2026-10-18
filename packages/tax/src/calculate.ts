export type VatRate = 0 | 4 | 10 | 21

export type OperationType =
  | 'NACIONAL'
  | 'INTRACOMUNITARIA_BIENES'
  | 'INTRACOMUNITARIA_SERVICIOS'
  | 'INVERSION_SUJETO_PASIVO'

export type DocKind = 'EMITIDA' | 'RECIBIDA' | 'GASTO'

export type DocStatus =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'COBRADA_PARCIAL'
  | 'COBRADA'
  | 'REGISTRADA'
  | 'PAGADA'

export interface TaxDocument {
  id: string
  kind: DocKind
  /** Fecha de devengo, `YYYY-MM-DD` o ISO. Se lee el calendario, no la zona horaria. */
  date: string
  status: DocStatus
  /** Importes en valor absoluto. El motor aplica el signo una sola vez. */
  isRectificativa: boolean
  base: number
  vatRate: VatRate
  vatAmount: number
  vatDeductible: boolean
  irpfAmount: number
  irpfBase: number
  operation: OperationType
  counterpartyVatId?: string | null
  counterpartyName?: string | null
  counterpartyId?: string | null
}

export interface VatBreakdown {
  rate: VatRate
  base: number
  cuota: number
}

export interface Modelo303 {
  devengado: number
  deducible: number
  resultado: number
  entregasIntracomunitarias: number
  adquisicionesIntracomunitarias: number
  porTipo: VatBreakdown[]
}

export interface Modelo111 {
  perceptores: number
  base: number
  retencion: number
}

export type Clave349 = 'A' | 'E' | 'S' | 'I'

export interface Modelo349Line {
  vatId: string
  name: string
  clave: Clave349
  base: number
}

export interface PeriodResult {
  year: number
  quarter: 1 | 2 | 3 | 4 | null
  modelo303: Modelo303
  modelo111: Modelo111
  modelo349: Modelo349Line[]
}

export interface YearResult {
  year: number
  quarters: PeriodResult[]
  total: PeriodResult
}

const ISSUED_OK = new Set<DocStatus>(['EMITIDA', 'COBRADA_PARCIAL', 'COBRADA'])
const BOOK_OK = new Set<DocStatus>(['REGISTRADA', 'PAGADA'])
const RATES: VatRate[] = [0, 4, 10, 21]

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const QUARTER_START = ['01-01', '04-01', '07-01', '10-01'] as const
const QUARTER_END = ['03-31', '06-30', '09-30', '12-31'] as const

export function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } {
  return {
    from: `${year}-${QUARTER_START[quarter - 1]}`,
    to: `${year}-${QUARTER_END[quarter - 1]}`,
  }
}

export function canLiquidateQuarter(year: number, quarter: 1 | 2 | 3 | 4, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return false
  return today > quarterRange(year, quarter).to
}

export function canLiquidateYear(year: number, today: string): boolean {
  return canLiquidateQuarter(year, 4, today)
}

export function periodOf(date: string): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!match) {
    throw new Error(`Fecha inválida: ${date}`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4
  return { year, quarter }
}

export function isIncluded(doc: TaxDocument): boolean {
  if (doc.kind === 'EMITIDA') return ISSUED_OK.has(doc.status)
  return BOOK_OK.has(doc.status)
}

function signed(doc: TaxDocument) {
  const sign = doc.isRectificativa ? -1 : 1
  return {
    base: round2(doc.base * sign),
    vat: round2(doc.vatAmount * sign),
    irpf: round2(doc.irpfAmount * sign),
    irpfBase: round2(doc.irpfBase * sign),
  }
}

function empty303(): Modelo303 {
  return {
    devengado: 0,
    deducible: 0,
    resultado: 0,
    entregasIntracomunitarias: 0,
    adquisicionesIntracomunitarias: 0,
    porTipo: RATES.map((rate) => ({ rate, base: 0, cuota: 0 })),
  }
}

function claveOf(doc: TaxDocument): Clave349 | null {
  if (doc.kind === 'EMITIDA' && doc.operation === 'INTRACOMUNITARIA_BIENES') return 'E'
  if (doc.kind === 'EMITIDA' && doc.operation === 'INTRACOMUNITARIA_SERVICIOS') return 'S'
  if (doc.kind !== 'EMITIDA' && doc.operation === 'INTRACOMUNITARIA_BIENES') return 'A'
  if (doc.kind !== 'EMITIDA' && doc.operation === 'INTRACOMUNITARIA_SERVICIOS') return 'I'
  return null
}

export function calculatePeriod(
  docs: TaxDocument[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | null,
): PeriodResult {
  const modelo303 = empty303()
  const perceptores = new Set<string>()
  let irpfBase = 0
  let irpf = 0
  const intra = new Map<string, Modelo349Line>()

  for (const doc of docs) {
    if (!isIncluded(doc)) continue
    const period = periodOf(doc.date)
    if (period.year !== year) continue
    if (quarter !== null && period.quarter !== quarter) continue

    const amounts = signed(doc)
    const nationalIssued = doc.kind === 'EMITIDA' && doc.operation === 'NACIONAL'
    const intraIssued =
      doc.kind === 'EMITIDA' &&
      (doc.operation === 'INTRACOMUNITARIA_BIENES' ||
        doc.operation === 'INTRACOMUNITARIA_SERVICIOS')
    const selfAssessed =
      doc.kind !== 'EMITIDA' &&
      (doc.operation === 'INTRACOMUNITARIA_BIENES' ||
        doc.operation === 'INTRACOMUNITARIA_SERVICIOS' ||
        doc.operation === 'INVERSION_SUJETO_PASIVO')
    const nationalBook = doc.kind !== 'EMITIDA' && doc.operation === 'NACIONAL'

    if (nationalIssued) {
      modelo303.devengado = round2(modelo303.devengado + amounts.vat)
      const row = modelo303.porTipo.find((item) => item.rate === doc.vatRate)
      if (row) {
        row.base = round2(row.base + amounts.base)
        row.cuota = round2(row.cuota + amounts.vat)
      }
    }

    if (intraIssued) {
      modelo303.entregasIntracomunitarias = round2(
        modelo303.entregasIntracomunitarias + amounts.base,
      )
    }

    if (selfAssessed) {
      modelo303.devengado = round2(modelo303.devengado + amounts.vat)
      if (doc.vatDeductible) {
        modelo303.deducible = round2(modelo303.deducible + amounts.vat)
      }
      if (
        doc.operation === 'INTRACOMUNITARIA_BIENES' ||
        doc.operation === 'INTRACOMUNITARIA_SERVICIOS'
      ) {
        modelo303.adquisicionesIntracomunitarias = round2(
          modelo303.adquisicionesIntracomunitarias + amounts.base,
        )
      }
    }

    if (nationalBook && doc.vatDeductible) {
      modelo303.deducible = round2(modelo303.deducible + amounts.vat)
    }

    if (doc.kind !== 'EMITIDA' && amounts.irpf !== 0) {
      irpf = round2(irpf + amounts.irpf)
      irpfBase = round2(irpfBase + amounts.irpfBase)
      perceptores.add(doc.counterpartyId || doc.counterpartyName || doc.id)
    }

    const clave = claveOf(doc)
    if (clave && doc.counterpartyVatId) {
      const key = `${doc.counterpartyVatId}|${clave}`
      const current = intra.get(key)
      if (current) {
        current.base = round2(current.base + amounts.base)
      } else {
        intra.set(key, {
          vatId: doc.counterpartyVatId,
          name: doc.counterpartyName || doc.counterpartyVatId,
          clave,
          base: amounts.base,
        })
      }
    }
  }

  modelo303.resultado = round2(modelo303.devengado - modelo303.deducible)

  return {
    year,
    quarter,
    modelo303,
    modelo111: {
      perceptores: perceptores.size,
      base: irpfBase,
      retencion: irpf,
    },
    modelo349: [...intra.values()].sort((a, b) =>
      `${a.clave}${a.vatId}`.localeCompare(`${b.clave}${b.vatId}`),
    ),
  }
}

export function calculateYear(docs: TaxDocument[], year: number): YearResult {
  const quarters = ([1, 2, 3, 4] as const).map((quarter) =>
    calculatePeriod(docs, year, quarter),
  )
  const total = calculatePeriod(docs, year, null)
  total.modelo111.perceptores = quarters.reduce(
    (sum, quarter) => sum + quarter.modelo111.perceptores,
    0,
  )
  return { year, quarters, total }
}
