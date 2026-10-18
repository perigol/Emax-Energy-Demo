import { describe, expect, it } from 'vitest'
import { describeAction, loginSummary } from './describe'

describe('bitácora', () => {
  it('describe altas y liquidaciones sin guardar la contraseña', () => {
    expect(describeAction('POST', '/contacts', { name: 'Taller Sol' })).toBe('Creó un contacto: Taller Sol')
    expect(describeAction('POST', '/users', { name: 'Ana', email: 'ana@norteluz.es', password: 'Norte*Luz1' })).toBe(
      'Creó un usuario: Ana (ana@norteluz.es)',
    )
    expect(describeAction('POST', '/tax/settlements', { ok: true }, { year: 2026, quarter: 1 })).toBe(
      'Liquidó un trimestre: 1T 2026',
    )
    expect(describeAction('POST', '/issued-invoices/abc/issue', { code: 'NL-2026-0005' })).toBe(
      'Emitió una factura: NL-2026-0005',
    )
  })

  it('distingue un acceso fallido', () => {
    expect(loginSummary(true)).toBe('Intentó entrar con una contraseña incorrecta')
    expect(loginSummary(false)).toBe('Intentó entrar con un correo que no existe')
  })
})
