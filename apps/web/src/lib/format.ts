export const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Fecha local en ISO `yyyy-mm-dd` (p. ej. valores por defecto en formularios). */
export function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  PAGO_PARCIAL: 'Pago parcial',
}

export const operationLabel: Record<string, string> = {
  NACIONAL: 'Nacional',
  INTRACOMUNITARIA_BIENES: 'Intracomunitaria, bienes',
  INTRACOMUNITARIA_SERVICIOS: 'Intracomunitaria, servicios',
  INVERSION_SUJETO_PASIVO: 'Inversión del sujeto pasivo',
}

export const kindLabel: Record<string, string> = {
  CLIENT: 'Me paga',
  SUPPLIER: 'Le pago',
  BOTH: 'Cliente y proveedor',
}
