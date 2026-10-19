const RULES: Array<{ method: string; pattern: RegExp; text: string }> = [
  { method: 'POST', pattern: /^\/banks\/norma43\/ejemplo$/, text: 'Cargó el extracto de ejemplo' },
  { method: 'POST', pattern: /^\/banks\/norma43$/, text: 'Importó un extracto Norma 43' },
  { method: 'POST', pattern: /^\/banks\/accounts\/[^/]+\/movements$/, text: 'Apuntó un movimiento bancario' },
  { method: 'POST', pattern: /^\/banks\/movements\/[^/]+\/reconcile$/, text: 'Concilió un movimiento' },
  { method: 'POST', pattern: /^\/banks\/accounts$/, text: 'Añadió una cuenta bancaria' },
  { method: 'POST', pattern: /^\/issued-invoices\/[^/]+\/issue$/, text: 'Emitió una factura' },
  { method: 'POST', pattern: /^\/issued-invoices\/[^/]+\/payments$/, text: 'Registró un cobro' },
  { method: 'POST', pattern: /^\/issued-invoices\/[^/]+\/rectify$/, text: 'Creó una rectificativa' },
  { method: 'DELETE', pattern: /^\/issued-invoices\/[^/]+$/, text: 'Eliminó un borrador' },
  { method: 'POST', pattern: /^\/quotes\/[^/]+\/convert$/, text: 'Convirtió un presupuesto en factura' },
  { method: 'DELETE', pattern: /^\/quotes\/[^/]+$/, text: 'Eliminó un presupuesto' },
  { method: 'POST', pattern: /^\/quotes$/, text: 'Guardó un presupuesto' },
  { method: 'POST', pattern: /^\/banks\/accounts\/[^/]+\/csv$/, text: 'Importó un CSV bancario' },
  { method: 'POST', pattern: /^\/issued-invoices$/, text: 'Guardó una factura emitida' },
  { method: 'PATCH', pattern: /^\/issued-invoices\/[^/]+$/, text: 'Actualizó una factura emitida' },
  { method: 'POST', pattern: /^\/received-invoices\/scan$/, text: 'Leyó una factura recibida' },
  { method: 'POST', pattern: /^\/received-invoices\/[^/]+\/payments$/, text: 'Registró un pago' },
  { method: 'POST', pattern: /^\/received-invoices$/, text: 'Registró una factura recibida' },
  { method: 'PATCH', pattern: /^\/received-invoices\/[^/]+$/, text: 'Actualizó una factura recibida' },
  { method: 'DELETE', pattern: /^\/received-invoices\/[^/]+$/, text: 'Eliminó una factura recibida' },
  { method: 'DELETE', pattern: /^\/expenses\/[^/]+$/, text: 'Eliminó un gasto' },
  { method: 'POST', pattern: /^\/expenses\/[^/]+\/payments$/, text: 'Registró un pago de un gasto' },
  { method: 'POST', pattern: /^\/expenses$/, text: 'Registró un gasto' },
  { method: 'POST', pattern: /^\/contacts$/, text: 'Creó un contacto' },
  { method: 'PATCH', pattern: /^\/contacts\/[^/]+$/, text: 'Actualizó un contacto' },
  { method: 'DELETE', pattern: /^\/contacts\/[^/]+$/, text: 'Eliminó un contacto' },
  { method: 'POST', pattern: /^\/services$/, text: 'Creó un servicio' },
  { method: 'PATCH', pattern: /^\/services\/[^/]+$/, text: 'Actualizó un servicio' },
  { method: 'DELETE', pattern: /^\/services\/[^/]+$/, text: 'Eliminó un servicio' },
  { method: 'PATCH', pattern: /^\/settings$/, text: 'Actualizó la empresa' },
  { method: 'POST', pattern: /^\/settings\/logo$/, text: 'Subió el logo' },
  { method: 'POST', pattern: /^\/users$/, text: 'Creó un usuario' },
  { method: 'PATCH', pattern: /^\/users\/[^/]+$/, text: 'Actualizó un usuario' },
  { method: 'DELETE', pattern: /^\/users\/[^/]+$/, text: 'Eliminó un usuario' },
  { method: 'POST', pattern: /^\/tax\/settlements\/year$/, text: 'Liquidó un ejercicio' },
  { method: 'POST', pattern: /^\/tax\/settlements$/, text: 'Liquidó un trimestre' },
]

export function describeAction(method: string, path: string, response?: unknown, request?: unknown): string {
  const route = path.split('?')[0].replace(/\/+$/, '') || '/'
  const rule = RULES.find((item) => item.method === method && item.pattern.test(route))
  const base = rule?.text ?? 'Hizo un cambio en el libro'
  const detail = [periodHint(request), safeHint(response)].filter(Boolean).join(' · ')
  const text = detail ? `${base}: ${detail}` : base
  return text.slice(0, 240)
}

export function loginSummary(found: boolean): string {
  return found ? 'Intentó entrar con una contraseña incorrecta' : 'Intentó entrar con un correo que no existe'
}

function periodHint(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null
  const row = source as Record<string, unknown>
  const year = Number(row.year)
  const quarter = Number(row.quarter)
  if (Number.isInteger(year) && year >= 1990 && quarter >= 1 && quarter <= 4) return `${quarter}T ${year}`
  if (Number.isInteger(year) && year >= 1990 && year <= 2100) return String(year)
  return null
}

function safeHint(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null
  const row = source as Record<string, unknown>
  if (typeof row.code === 'string' && row.code.trim()) return row.code.trim()
  if (typeof row.name === 'string' && typeof row.email === 'string') return `${row.name} (${row.email})`
  if (typeof row.legalName === 'string' && row.legalName.trim()) return row.legalName.trim()
  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim()
  if (typeof row.imported === 'number') return `${row.imported} apuntes nuevos`
  return null
}
