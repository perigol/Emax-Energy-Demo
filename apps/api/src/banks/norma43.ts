import { bankByEntity } from './spanish-banks'
import { spanishIban } from './iban'

const COMMON_CONCEPT: Record<string, string> = {
  '01': 'Talones y reintegros',
  '02': 'Ingresos',
  '03': 'Recibos domiciliados',
  '04': 'Transferencia',
  '05': 'Amortización de préstamo',
  '06': 'Remesa de efectos',
  '07': 'Suscripciones y canjes',
  '08': 'Dividendos y cupones',
  '09': 'Operaciones de bolsa',
  '10': 'Cheques gasolina',
  '11': 'Cajero automático',
  '12': 'Tarjeta',
  '13': 'Operaciones con el extranjero',
  '14': 'Devoluciones e impagados',
  '15': 'Nóminas y seguros sociales',
  '16': 'Timbres y corretaje',
  '17': 'Intereses, comisiones y gastos',
  '98': 'Anulación',
  '99': 'Varios',
}

export interface Norma43Movement {
  date: string
  concept: string
  amount: number
  reference: string
}

export interface Norma43Account {
  iban: string
  entityCode: string
  office: string
  bankName: string | null
  movements: Norma43Movement[]
}

export interface Norma43File {
  accounts: Norma43Account[]
  warnings: string[]
}

interface DraftMovement {
  date: string
  sign: string
  amount: number
  document: string
  reference2: string
  common: string
  concepts: string[]
}

export function decodeStatement(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }
  return buffer.toString('latin1')
}

export function parseNorma43(text: string): Norma43File {
  const records = splitRecords(text)
  if (!records.some((record) => record.startsWith('11'))) {
    throw new Error('El fichero no es un extracto Norma 43')
  }

  const accounts: Norma43Account[] = []
  const warnings: string[] = []
  let current: Norma43Account | null = null
  let pending: DraftMovement | null = null
  let skip = false

  function flushMovement() {
    if (!current || !pending || skip) {
      pending = null
      return
    }
    const concept = movementConcept(pending)
    const key = `${pending.date}|${pending.document}|${Math.round(pending.amount * 100)}`
    const order = current.movements.filter((movement) => movement.reference.startsWith(`n43:${key}|`)).length + 1
    current.movements.push({
      date: pending.date,
      concept,
      amount: pending.amount,
      reference: `n43:${key}|${order}`,
    })
    pending = null
  }

  for (const record of records) {
    const code = record.slice(0, 2)
    if (code === '11') {
      flushMovement()
      const entity = record.slice(2, 6)
      const office = record.slice(6, 10)
      const account = record.slice(10, 20)
      const currency = record.slice(47, 50)
      let iban: string
      try {
        iban = spanishIban(entity, office, account)
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'La cuenta del extracto no es válida')
      }
      skip = Boolean(currency.trim()) && currency !== '978'
      if (skip) warnings.push(`La cuenta ${iban} no está en euros y no se ha importado.`)
      current = {
        iban,
        entityCode: entity,
        office,
        bankName: bankByEntity(entity),
        movements: [],
      }
      if (!skip) accounts.push(current)
      pending = null
      continue
    }
    if (code === '22') {
      if (!current) throw new Error('El extracto trae un apunte antes de la cabecera de la cuenta')
      flushMovement()
      pending = readMovement(record)
      continue
    }
    if (code === '23' && pending) {
      pending.concepts.push(record.slice(4, 42), record.slice(42, 80))
    }
  }
  flushMovement()

  const withMovements = accounts.filter((account) => account.movements.length > 0)
  if (withMovements.length === 0) {
    throw new Error(warnings[0] || 'El extracto no contiene apuntes')
  }
  return { accounts: withMovements, warnings }
}

function readMovement(record: string): DraftMovement {
  const sign = record.slice(27, 28)
  const rawAmount = record.slice(28, 42)
  if (!/^\d{14}$/.test(rawAmount) || (sign !== '1' && sign !== '2')) {
    throw new Error('Hay un apunte con un importe ilegible')
  }
  const value = Number(rawAmount) / 100
  return {
    date: readDate(record.slice(10, 16)),
    sign,
    amount: sign === '1' ? -value : value,
    document: record.slice(42, 52).trim(),
    reference2: record.slice(64, 80).trim(),
    common: record.slice(22, 24),
    concepts: [],
  }
}

function readDate(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new Error('Hay un apunte con una fecha ilegible')
  const year = Number(value.slice(0, 2))
  const fullYear = year >= 70 ? 1900 + year : 2000 + year
  const month = Number(value.slice(2, 4))
  const day = Number(value.slice(4, 6))
  const date = new Date(Date.UTC(fullYear, month - 1, day))
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Hay un apunte con una fecha ilegible')
  }
  return date.toISOString().slice(0, 10)
}

function movementConcept(movement: DraftMovement): string {
  const extra = movement.concepts.map((item) => item.trim()).filter(Boolean)
  const reference =
    extra.length === 0 && movement.reference2 && !/^\d+$/.test(movement.reference2) ? [movement.reference2] : []
  const text = [...extra, ...reference].join(' ').replace(/\s+/g, ' ').trim()
  return (text || COMMON_CONCEPT[movement.common] || 'Apunte bancario').slice(0, 240)
}

function splitRecords(text: string): string[] {
  const records: string[] = []
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue
    if (line.length > 80 && line.length % 80 === 0) {
      for (let index = 0; index < line.length; index += 80) records.push(line.slice(index, index + 80))
      continue
    }
    records.push(line.slice(0, 80).padEnd(80, ' '))
  }
  return records
}

function column(value: string, length: number): string {
  return value.padEnd(length, ' ').slice(0, length)
}

function digits(value: number, length: number): string {
  return String(value).padStart(length, '0').slice(-length)
}

function cents(euros: number): string {
  return digits(Math.round(Math.abs(euros) * 100), 14)
}

export function sampleNorma43(): string {
  const lines = [
    `112100081301234567892601012608312${cents(756)}9782${column('ENERFACTURA', 26)}   `,
    movement('260228', '04', '2', 500, 'Cobro Atelier Lumiere'),
    concept('Cobro Atelier Lumière SARL'),
    movement('260310', '04', '1', 200, 'Pago Kraft Teile'),
    concept('Pago Kraft Teile GmbH'),
    movement('260318', '03', '1', 55, 'Casa Brava'),
    concept('Casa Brava comida'),
    movement('260820', '02', '2', 242, 'Cobro Taller Sol'),
    concept('Cobro Taller Sol'),
    `33210008130123456789${digits(2, 5)}${cents(255)}${digits(2, 5)}${cents(742)}2${cents(1243)}978    `,
    `88${'9'.repeat(18)}${digits(10, 6)}${' '.repeat(54)}`,
  ]
  return lines.join('\r\n')
}

function movement(date: string, common: string, sign: string, euros: number, reference: string): string {
  return `22    0813${date}${date}${common}000${sign}${cents(euros)}${digits(0, 10)}${' '.repeat(12)}${column(reference, 16)}`
}

function concept(text: string): string {
  return `2301${column(text, 38)}${' '.repeat(38)}`
}
