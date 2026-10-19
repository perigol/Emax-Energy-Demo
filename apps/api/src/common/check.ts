import { BadRequestException } from '@nestjs/common'

/** Tope de Decimal(12,2): diez dígitos enteros y dos decimales. */
export const MAX_MONEY = 9_999_999_999.99

export const LIMIT = {
  name: 120,
  email: 160,
  nif: 20,
  address: 200,
  concept: 240,
  description: 500,
  number: 40,
  category: 80,
  iban: 34,
  password: 72,
  legalName: 160,
} as const

const PASSWORD_MESSAGE =
  'La contraseña necesita entre 8 y 72 caracteres, con mayúscula, minúscula, un número y un símbolo.'

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const CIF_LETTERS = 'JABCDEFGHI'
const EU_VAT = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE',
  'SI', 'SK', 'XI',
])

export function euroLimit(): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(MAX_MONEY)
}

export function fitMoney(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new BadRequestException(`${label} no puede superar ${euroLimit()}`)
  }
}

export function assertPassword(password: string): void {
  const symbol = /[^A-Za-z0-9\s]/
  const valid =
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= LIMIT.password &&
    Buffer.byteLength(password) <= LIMIT.password &&
    !/\s/.test(password) &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    symbol.test(password)
  if (!valid) throw new BadRequestException(PASSWORD_MESSAGE)
}

export function taxId(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[\s.-]/g, '')
  if (!compact || compact.length > LIMIT.nif) {
    throw new BadRequestException('El NIF o el NIF-IVA no es válido')
  }
  if (isSpanishId(compact)) return compact
  if (compact.startsWith('ES') && isSpanishId(compact.slice(2))) return compact.slice(2)
  const country = compact.slice(0, 2)
  const body = compact.slice(2)
  if (EU_VAT.has(country) && country !== 'ES' && /^[A-Z0-9]{2,12}$/.test(body)) return compact
  throw new BadRequestException(`«${compact}» no es un NIF válido. La letra o el dígito de control no cuadran.`)
}

function isSpanishId(value: string): boolean {
  if (/^\d{8}[A-Z]$/.test(value)) {
    return DNI_LETTERS[Number(value.slice(0, 8)) % 23] === value[8]
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(value)) {
    const digits = value.replace('X', '0').replace('Y', '1').replace('Z', '2')
    return DNI_LETTERS[Number(digits.slice(0, 8)) % 23] === value[8]
  }
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(value)) return false
  let sum = 0
  for (let index = 0; index < 7; index += 1) {
    const digit = Number(value[index + 1])
    if (index % 2 === 0) {
      const doubled = digit * 2
      sum += Math.floor(doubled / 10) + (doubled % 10)
    } else {
      sum += digit
    }
  }
  const control = (10 - (sum % 10)) % 10
  const got = value[8]
  const letter = CIF_LETTERS[control]
  const type = value[0]
  if ('ABEH'.includes(type)) return got === String(control)
  if ('KPQS'.includes(type)) return got === letter
  return got === String(control) || got === letter
}
