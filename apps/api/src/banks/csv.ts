import { BadRequestException } from '@nestjs/common'
import { money } from '../common/money'

export interface CsvMovement {
  date: string
  concept: string
  amount: number
  reference: string
}

export function parseBankCsv(raw: string): CsvMovement[] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (rows.length === 0) throw new BadRequestException('El CSV no tiene filas')
  const delimiter = rows[0].split(';').length > rows[0].split(',').length ? ';' : ','
  const cells = rows.map((line) => splitCsv(line, delimiter))
  const start = looksLikeHeader(cells[0]) ? 1 : 0
  const movements: CsvMovement[] = []
  for (let index = start; index < cells.length; index += 1) {
    const row = cells[index]
    if (row.every((cell) => !cell.trim())) continue
    const parsed = readRow(row, index + 1)
    movements.push({
      ...parsed,
      reference: `csv:${index + 1}:${parsed.date}:${parsed.amount}:${parsed.concept.slice(0, 40)}`,
    })
  }
  if (movements.length === 0) throw new BadRequestException('El CSV no tiene movimientos')
  return movements
}

function splitCsv(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function looksLikeHeader(row: string[]): boolean {
  return !row.some((cell) => parseDay(cell) !== null)
}

function readRow(row: string[], line: number): Omit<CsvMovement, 'reference'> {
  const dateIndex = row.findIndex((cell) => parseDay(cell) !== null)
  if (dateIndex < 0) throw new BadRequestException(`La fila ${line} no tiene una fecha`)
  const date = parseDay(row[dateIndex]) as string
  let amountIndex = -1
  for (let index = row.length - 1; index >= 0; index -= 1) {
    if (index === dateIndex) continue
    if (parseAmount(row[index]) !== null) {
      amountIndex = index
      break
    }
  }
  if (amountIndex < 0) throw new BadRequestException(`La fila ${line} no tiene un importe`)
  const amount = parseAmount(row[amountIndex]) as number
  const concept = row
    .filter((_, index) => index !== dateIndex && index !== amountIndex)
    .join(' ')
    .trim()
  if (!concept) throw new BadRequestException(`La fila ${line} no tiene concepto`)
  if (concept.length > 240) throw new BadRequestException(`El concepto de la fila ${line} es demasiado largo`)
  return { date, concept, amount: money(amount) }
}

function parseDay(value: string): string | null {
  const text = value.trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const local = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/)
  if (!local) return null
  const year = Number(local[3].length === 2 ? `20${local[3]}` : local[3])
  return validDay(year, Number(local[2]), Number(local[1]))
}

function validDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseAmount(value: string): number | null {
  let text = value.trim().replace(/\s/g, '').replace(/€/g, '')
  if (!text) return null
  const negative = text.startsWith('-') || (text.startsWith('(') && text.endsWith(')'))
  text = text.replace(/[()]/g, '').replace(/^-/, '')
  if (!/^[\d.,]+$/.test(text)) return null
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '')
  } else if (text.includes(',')) {
    text = text.replace(',', '.')
  }
  const amount = Number(text)
  if (!Number.isFinite(amount)) return null
  return negative ? -amount : amount
}
