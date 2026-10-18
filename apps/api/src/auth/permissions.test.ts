import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('permisos', () => {
  it('el rol facturas solo carga recibidas y gastos', () => {
    expect(can('FACTURAS', 'received')).toBe(true)
    expect(can('FACTURAS', 'expenses')).toBe(true)
    expect(can('FACTURAS', 'tax')).toBe(false)
    expect(can('FACTURAS', 'issued')).toBe(false)
    expect(can('FACTURAS', 'banks')).toBe(false)
    expect(can('FACTURAS', 'settings')).toBe(false)
    expect(can('FACTURAS', 'users')).toBe(false)
    expect(can('FACTURAS', 'contacts')).toBe(false)
    expect(can('FACTURAS', 'delete')).toBe(false)
    expect(can('FACTURAS', 'audit')).toBe(false)
  })

  it('el gestor opera y no administra', () => {
    expect(can('GESTOR', 'tax')).toBe(true)
    expect(can('GESTOR', 'issued')).toBe(true)
    expect(can('GESTOR', 'delete')).toBe(true)
    expect(can('GESTOR', 'settings')).toBe(false)
    expect(can('GESTOR', 'users')).toBe(false)
    expect(can('GESTOR', 'audit')).toBe(false)
  })

  it('el administrador crea usuarios y configura', () => {
    expect(can('ADMIN', 'users')).toBe(true)
    expect(can('ADMIN', 'settings')).toBe(true)
    expect(can('ADMIN', 'audit')).toBe(true)
  })
})
