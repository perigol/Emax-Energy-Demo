export const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Fecha local en ISO `yyyy-mm-dd` (p. ej. valores por defecto en formularios). */
export function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fechaHora(value: Date) {
  return value.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

export function fecha(iso?: string | null) {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export function trimestre(quarter: number, year: number) {
  return `${quarter}T ${year}`
}

/** Mismo calendario que `quarterRange` en packages/tax (fecha del documento). */
export function trimestreRango(quarter: 1 | 2 | 3 | 4, year: number) {
  const start = (['01-01', '04-01', '07-01', '10-01'] as const)[quarter - 1]
  const end = (['03-31', '06-30', '09-30', '12-31'] as const)[quarter - 1]
  return `${fecha(`${year}-${start}`)} – ${fecha(`${year}-${end}`)}`
}

export const roleLabel: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  FACTURAS: 'Carga de facturas',
}

export const statusLabel: Record<string, string> = {
  BORRADOR: 'Borrador',
  EMITIDA: 'Emitida',
  COBRADA_PARCIAL: 'Cobro parcial',
  COBRADA: 'Cobrada',
  REGISTRADA: 'Pendiente',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
  RECTIFICADA: 'Rectificada',
  RECTIFICATIVA: 'Rectificativa',
  ABIERTO: 'Abierto',
  CONVERTIDO: 'Convertido',
  PAGO_PARCIAL: 'Pago parcial',
}

/** Estado mostrado en listados: rectificativa / rectificada primero, luego displayStatus de la API. */
export function issuedDisplayStatus(row: {
  displayStatus?: string
  status?: string
  rectifiesId?: string | null
  hasRectificativa?: boolean
}) {
  if (row.rectifiesId) return 'RECTIFICATIVA'
  if (row.hasRectificativa) return 'RECTIFICADA'
  return row.displayStatus || row.status || 'EMITIDA'
}

export const operationLabel: Record<string, string> = {
  NACIONAL: 'En España',
  INTRACOMUNITARIA_BIENES: 'Bienes dentro de la UE',
  INTRACOMUNITARIA_SERVICIOS: 'Servicios dentro de la UE',
  INVERSION_SUJETO_PASIVO: 'El IVA lo declara el cliente',
}

export const kindLabel: Record<string, string> = {
  CLIENT: 'Cliente',
  SUPPLIER: 'Proveedor',
  BOTH: 'Cliente y proveedor',
}
