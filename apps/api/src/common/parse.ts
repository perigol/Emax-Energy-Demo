import { BadRequestException } from '@nestjs/common'
import { euroLimit, MAX_MONEY } from './check'

export const OPERATIONS = [
  'NACIONAL',
  'INTRACOMUNITARIA_BIENES',
  'INTRACOMUNITARIA_SERVICIOS',
  'INVERSION_SUJETO_PASIVO',
] as const

export type Operation = (typeof OPERATIONS)[number]
export type VatRate = 0 | 4 | 10 | 21

export function asText(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} es obligatorio`)
  }
  const text = value.trim()
  if (text.length > max) {
    throw new BadRequestException(`${label} admite hasta ${max} caracteres`)
  }
  return text
}

export function optionalText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const text = value.trim()
  if (text.length > max) {
    throw new BadRequestException(`Este campo admite hasta ${max} caracteres`)
  }
  return text
}

export function asDate(value: unknown, label: string): string {
  const text = asText(value, label, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException(`${label} debe usar el formato aaaa-mm-dd`)
  }
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(5, 7))
  const day = Number(text.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  if (!real || year < 1990 || year > 2100) {
    throw new BadRequestException(`${label} no es una fecha válida`)
  }
  return text
}

export function asAmount(value: unknown, label: string): number {
  const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`${label} no es un importe válido`)
  }
  const rounded = Math.round((number + Number.EPSILON) * 100) / 100
  if (rounded > MAX_MONEY) {
    throw new BadRequestException(`${label} no puede superar ${euroLimit()}`)
  }
  return rounded
}

export function asPercent(value: unknown, label: string): number {
  const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new BadRequestException(`${label} tiene que estar entre 0 y 100`)
  }
  return Math.round((number + Number.EPSILON) * 100) / 100
}

export function asRate(value: unknown): VatRate {
  const number = Number(value)
  if (number !== 0 && number !== 4 && number !== 10 && number !== 21) {
    throw new BadRequestException('El tipo de IVA tiene que ser 0, 4, 10 o 21')
  }
  return number
}

export function asOperation(value: unknown): Operation {
  const text = asText(value, 'El tipo de operación')
  if (!OPERATIONS.includes(text as Operation)) {
    throw new BadRequestException('Tipo de operación no reconocido')
  }
  return text as Operation
}

export function asBool(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return value === 'true' || value === '1' || value === 'on'
}

const ALLOWED_FILES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export function readUpload(file?: { size: number; mimetype: string; originalname: string; buffer: Buffer }) {
  if (!file) return null
  if (file.size > 2 * 1024 * 1024) {
    throw new BadRequestException('El archivo supera los 2 MB')
  }
  if (!ALLOWED_FILES.has(file.mimetype)) {
    throw new BadRequestException('Solo se admiten PDF, JPG, PNG o WebP')
  }
  return {
    fileName: file.originalname.slice(0, 180),
    fileMime: file.mimetype,
    fileData: new Uint8Array(file.buffer) as Uint8Array<ArrayBuffer>,
  }
}
