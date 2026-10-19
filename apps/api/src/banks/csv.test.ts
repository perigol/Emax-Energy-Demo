import { describe, expect, it } from 'vitest'
import { parseBankCsv } from './csv'

describe('parseBankCsv', () => {
  it('lee fecha española, concepto e importe con coma decimal', () => {
    const rows = parseBankCsv('fecha;concepto;importe\n19/10/2026;Cobro cliente;1.250,50\n')
    expect(rows).toEqual([
      expect.objectContaining({ date: '2026-10-19', concept: 'Cobro cliente', amount: 1250.5 }),
    ])
  })

  it('acepta un cargo en negativo y fecha ISO', () => {
    const rows = parseBankCsv('2026-10-18,Pago luz,-55.00\n')
    expect(rows[0]).toMatchObject({ date: '2026-10-18', concept: 'Pago luz', amount: -55 })
  })
})
