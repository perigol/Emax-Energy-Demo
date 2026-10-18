export type Role = 'ADMIN' | 'GESTOR' | 'FACTURAS'

export type Action =
  | 'settings'
  | 'users'
  | 'issued'
  | 'received'
  | 'expenses'
  | 'banks'
  | 'tax'
  | 'contacts'
  | 'services'
  | 'delete'
  | 'audit'

const GRANTED: Record<Role, readonly Action[]> = {
  ADMIN: [
    'settings',
    'users',
    'issued',
    'received',
    'expenses',
    'banks',
    'tax',
    'contacts',
    'services',
    'delete',
    'audit',
  ],
  GESTOR: ['issued', 'received', 'expenses', 'banks', 'tax', 'contacts', 'services', 'delete'],
  FACTURAS: ['received', 'expenses'],
}

export function can(role: Role, action: Action): boolean {
  return GRANTED[role].includes(action)
}
