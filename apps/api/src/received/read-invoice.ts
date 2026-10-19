export interface ScannedInvoice {
  number: string | null
  date: string | null
  concept: string | null
  base: number | null
  vatRate: 0 | 4 | 10 | 21 | null
  supplierName: string | null
  supplierNif: string | null
  note: string
}

const RATES = [0, 4, 10, 21] as const

export function parseInvoiceText(text: string): ScannedInvoice {
  const source = text.replace(/\u00a0/g, ' ')
  const flat = source.replace(/\s+/g, ' ').trim()
  const number = matchNumber(flat)
  const date = matchDate(source) || matchDate(flat)
  const concept = matchConcept(source)
  const base = matchBase(flat)
  const vatRate = matchRate(flat)
  const supplier = matchSupplier(source)
  const found = [number, date, concept, base, vatRate, supplier.supplierName, supplier.supplierNif].filter((item) => item !== null).length
  const note = found === 0
    ? 'No se han reconocido datos en el archivo. Complétalos a mano.'
    : 'Datos leídos del archivo. Revísalos antes de guardar.'
  return { number, date, concept, base, vatRate, ...supplier, note }
}

const NUMBER_STOP = new Set([
  'fecha', 'factura', 'total', 'base', 'iva', 'concepto', 'simplificada', 'original',
  'proforma', 'numero', 'número', 'nif', 'cif', 'serie', 'documento',
])

function matchNumber(text: string) {
  const patterns = [
    /(?:n[úu]m(?:ero)?\.?|n[ºo°.]|n\.?\s*º|no\.?|fra\.?|serie(?:\s+y\s+n[úu]mero)?|documento|referencia)\s*[:\s#-]*([A-Z0-9][A-Z0-9./-]{0,38})/gi,
    /factura\s*(?:n[ºo°.]|n[úu]m(?:ero)?\.?|no\.?)?\s*[:\s#-]*([A-Z0-9][A-Z0-9./-]{0,38})/gi,
  ]
  for (const pattern of patterns) {
    for (const hit of text.matchAll(pattern)) {
      const value = cleanNumber(hit[1] || '')
      if (value) return value
    }
  }
  return null
}

function cleanNumber(raw: string) {
  const value = raw.replace(/[.,;:]+$/, '').slice(0, 40)
  if (value.length < 2 || !/\d/.test(value)) return null
  if (NUMBER_STOP.has(value.toLowerCase())) return null
  return value
}

function matchSupplier(text: string) {
  const nif = text.match(/(?:nif|cif|n\.?\s*i\.?\s*f\.?)\s*[:\s-]*([A-Z]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])/i)
  const supplierNif = nif?.[1]?.toUpperCase() ?? null
  const named = text.match(/(?:raz[oó]n\s+social|emisor|proveedor)\s*[:\s]+([^\n]{3,120})/i)
  let supplierName = named ? tidyName(named[1]) : null
  if (!supplierName && supplierNif) {
    const before = text.split(new RegExp(supplierNif, 'i'))[0] || ''
    const line = before
      .split(/\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .reverse()
      .find((item) => !/fecha|factura|nif|cif|base|iva/i.test(item))
    if (line) supplierName = tidyName(line)
  }
  return { supplierName, supplierNif }
}

function tidyName(value: string) {
  const name = value.replace(/\s+/g, ' ').replace(/[:\s]+$/, '').trim()
  if (name.length < 3 || name.length > 120) return null
  return name
}

function matchDate(text: string) {
  const labeled = text.match(/fecha\s*[:\s]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i)
  if (labeled) return iso(labeled[3], labeled[2], labeled[1])
  const isoDate = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (isoDate) return iso(isoDate[1], isoDate[2], isoDate[3])
  const any = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/)
  if (any) return iso(any[3], any[2], any[1])
  return null
}

function iso(year: string, month: string, day: string) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function matchConcept(text: string) {
  const labeled = text.match(/concepto\s*[:\s]+([^\n]{3,120})/i)
  if (!labeled) return null
  return labeled[1].replace(/\s+/g, ' ').trim().slice(0, 240)
}

function matchBase(text: string) {
  const labeled = text.match(/base(?:\s+imponible)?\s*[:\s]*(-?[\d.]+,\d{2}|-?[\d,]+\.\d{2}|-?\d+(?:[.,]\d{1,2})?)/i)
  return labeled ? parseAmount(labeled[1]) : null
}

function matchRate(text: string) {
  const labeled = text.match(/(?:iva|tipo)\s*[:\s]*(\d{1,2})\s*%/i)
  if (!labeled) return null
  const rate = Number(labeled[1])
  return RATES.includes(rate as (typeof RATES)[number]) ? (rate as (typeof RATES)[number]) : null
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/[€\s]/g, '')
  let normalized = cleaned
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.')
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 9999999999.99) return null
  return Math.round(value * 100) / 100
}
