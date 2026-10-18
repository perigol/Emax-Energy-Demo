const OFFICE_WEIGHTS = [4, 8, 5, 10, 9, 7, 3, 6]
const ACCOUNT_WEIGHTS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]

export function compactIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

function controlDigit(value: string, weights: number[]): string {
  const sum = [...value].reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
  const digit = 11 - (sum % 11)
  if (digit === 11) return '0'
  if (digit === 10) return '1'
  return String(digit)
}

function mod97(digits: string): number {
  let rest = 0
  for (const char of digits) rest = (rest * 10 + Number(char)) % 97
  return rest
}

function expand(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55))
}

export function spanishIban(entity: string, office: string, account: string): string {
  if (!/^\d{4}$/.test(entity) || !/^\d{4}$/.test(office) || !/^\d{10}$/.test(account)) {
    throw new Error('La cuenta del extracto no tiene el formato español')
  }
  const check = controlDigit(entity + office, OFFICE_WEIGHTS) + controlDigit(account, ACCOUNT_WEIGHTS)
  const bban = `${entity}${office}${check}${account}`
  const remainder = mod97(expand(`${bban}ES00`))
  return `ES${String(98 - remainder).padStart(2, '0')}${bban}`
}

export function isSpanishIban(input: string): boolean {
  const compact = compactIban(input)
  if (!/^ES\d{22}$/.test(compact)) return false
  if (mod97(expand(`${compact.slice(4)}${compact.slice(0, 4)}`)) !== 1) return false
  const entity = compact.slice(4, 8)
  const office = compact.slice(8, 12)
  const check = compact.slice(12, 14)
  const account = compact.slice(14)
  const expected = controlDigit(entity + office, OFFICE_WEIGHTS) + controlDigit(account, ACCOUNT_WEIGHTS)
  return check === expected
}
