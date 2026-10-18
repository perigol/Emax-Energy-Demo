export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function asNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return money(Number(value.toString()))
}

export function cents(value: number): number {
  return Math.round(value * 100)
}

export function day(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function utcDay(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`)
}

export function invoiceCode(series: string | null, issueDate: Date, number: number | null): string {
  if (!series || !number) return 'Borrador'
  return `${series}-${issueDate.getUTCFullYear()}-${String(number).padStart(4, '0')}`
}
