import { describe, expect, it } from 'vitest'
import { parseInvoiceText } from './read-invoice'

describe('parseInvoiceText', () => {
  it('lee una factura española típica', () => {
    const text = `
      Factura nº NL-2026-014
      Fecha: 19/10/2026
      Concepto: Suministro eléctrico octubre
      Base imponible 1.250,50
      IVA 21% 262,61
      Total 1.513,11
    `
    const scanned = parseInvoiceText(text)
    expect(scanned.number).toBe('NL-2026-014')
    expect(scanned.date).toBe('2026-10-19')
    expect(scanned.concept).toBe('Suministro eléctrico octubre')
    expect(scanned.base).toBe(1250.5)
    expect(scanned.vatRate).toBe(21)
  })

  it('lee núm. de factura, serie y el NIF del emisor', () => {
    const text = `
      Luz del Sur S.L.
      NIF: B66521089
      Núm. factura: 2026/014
      Fecha: 02/03/2026
      Base imponible 80,00
      IVA 21%
    `
    const scanned = parseInvoiceText(text)
    expect(scanned.number).toBe('2026/014')
    expect(scanned.supplierNif).toBe('B66521089')
    expect(scanned.supplierName).toBe('Luz del Sur S.L.')
  })

  it('avisa si el texto no trae datos', () => {
    const scanned = parseInvoiceText('documento ilegible')
    expect(scanned.base).toBeNull()
    expect(scanned.note).toMatch(/Complétalos/)
  })
})
