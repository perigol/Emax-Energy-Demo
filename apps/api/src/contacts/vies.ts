import { BadRequestException } from '@nestjs/common'

const ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'

const EU = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE',
  'SI', 'SK', 'XI',
])

const DOWN = new Set([
  'MS_UNAVAILABLE',
  'MS_MAX_CONCURRENT_REQ',
  'GLOBAL_MAX_CONCURRENT_REQ',
  'SERVICE_UNAVAILABLE',
  'TIMEOUT',
  'IP_BLOCKED',
])

export interface ViesCheck {
  status: 'valid' | 'invalid' | 'unavailable'
}

export function viesQuery(vatNumber: string) {
  const prefix = vatNumber.slice(0, 2)
  if (EU.has(prefix)) {
    return { countryCode: prefix === 'GR' ? 'EL' : prefix, vatNumber: vatNumber.slice(2) }
  }
  return { countryCode: 'ES', vatNumber }
}

export async function checkVies(vatNumber: string, request: typeof fetch = fetch): Promise<ViesCheck> {
  try {
    const response = await request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(viesQuery(vatNumber)),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return { status: 'unavailable' }
    return read(await response.json())
  } catch {
    return { status: 'unavailable' }
  }
}

export async function requireVies(vatNumber: string): Promise<ViesCheck> {
  const vies = await checkVies(vatNumber)
  if (vies.status === 'invalid') {
    throw new BadRequestException('VIES no tiene dado de alta este NIF-IVA.')
  }
  return vies
}

function read(body: unknown): ViesCheck {
  if (!body || typeof body !== 'object') return { status: 'unavailable' }
  const row = body as { valid?: boolean; actionSucceed?: boolean; userError?: string }
  if (row.actionSucceed === false || (row.userError && DOWN.has(row.userError))) {
    return { status: 'unavailable' }
  }
  if (row.valid === true) return { status: 'valid' }
  if (row.valid === false) return { status: 'invalid' }
  return { status: 'unavailable' }
}
