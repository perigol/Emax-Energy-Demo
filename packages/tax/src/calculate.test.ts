import { describe, expect, it } from 'vitest'
import { calculatePeriod, calculateYear, canLiquidateQuarter, canLiquidateYear, periodOf, quarterRange } from './calculate'
import type { TaxDocument } from './calculate'
import { demoT1Documents } from './demo-t1'

function doc(partial: Partial<TaxDocument> & Pick<TaxDocument, 'id' | 'kind' | 'date'>): TaxDocument {
  return {
    status: 'EMITIDA',
    isRectificativa: false,
    base: 0,
    vatRate: 21,
    vatAmount: 0,
    vatDeductible: false,
    irpfAmount: 0,
    irpfBase: 0,
    operation: 'NACIONAL',
    ...partial,
  }
}

describe('T1 2026', () => {
  const result = calculatePeriod(demoT1Documents(), 2026, 1)

  it('liquida el 303 en 126 a ingresar', () => {
    expect(result.modelo303.devengado).toBe(210 + 42)
    expect(result.modelo303.deducible).toBe(84 + 42)
    expect(result.modelo303.resultado).toBe(126)
    expect(result.modelo303.entregasIntracomunitarias).toBe(500)
    expect(result.modelo303.adquisicionesIntracomunitarias).toBe(200)
    expect(result.modelo303.porTipo.find((row) => row.rate === 21)).toEqual({
      rate: 21,
      base: 1000,
      cuota: 210,
    })
  })

  it('declara un perceptor en el 111', () => {
    expect(result.modelo111).toEqual({ perceptores: 1, base: 400, retencion: 60 })
  })

  it('agrupa el 349 por NIF-IVA y clave', () => {
    expect(result.modelo349).toEqual([
      {
        vatId: 'DE811569869',
        name: 'Kraft Teile GmbH',
        clave: 'A',
        base: 200,
      },
      {
        vatId: 'FR40303265045',
        name: 'Atelier Lumière SARL',
        clave: 'S',
        base: 500,
      },
    ])
  })

  it('deja la comida no deducible fuera del 303', () => {
    expect(result.modelo303.deducible).toBe(126)
    expect(result.modelo303.porTipo.find((row) => row.rate === 10)?.base).toBe(0)
  })
})

describe('reglas de periodo', () => {
  it('lee el trimestre desde el calendario', () => {
    expect(periodOf('2026-01-15').quarter).toBe(1)
    expect(periodOf('2026-04-01T00:00:00.000Z').quarter).toBe(2)
    expect(periodOf('2026-08-01').quarter).toBe(3)
    expect(periodOf('2026-11-03').quarter).toBe(4)
  })

  it('ignora borradores', () => {
    const result = calculatePeriod(
      [
        ...demoT1Documents(),
        doc({
          id: 'borrador',
          kind: 'EMITIDA',
          date: '2026-02-01',
          status: 'BORRADOR',
          base: 10000,
          vatAmount: 2100,
        }),
      ],
      2026,
      1,
    )
    expect(result.modelo303.devengado).toBe(252)
  })

  it('resta una rectificativa una sola vez', () => {
    const result = calculatePeriod(
      [
        doc({
          id: 'original',
          kind: 'EMITIDA',
          date: '2026-02-01',
          base: 1000,
          vatAmount: 210,
        }),
        doc({
          id: 'rect',
          kind: 'EMITIDA',
          date: '2026-02-15',
          isRectificativa: true,
          base: 1000,
          vatAmount: 210,
        }),
      ],
      2026,
      1,
    )
    expect(result.modelo303.devengado).toBe(0)
    expect(result.modelo303.resultado).toBe(0)
  })

  it('no lleva al 111 la retención soportada en una emitida', () => {
    const result = calculatePeriod(
      [
        doc({
          id: 'emitida-irpf',
          kind: 'EMITIDA',
          date: '2026-02-01',
          base: 1000,
          vatAmount: 210,
          irpfAmount: 150,
          irpfBase: 1000,
        }),
      ],
      2026,
      1,
    )
    expect(result.modelo111.perceptores).toBe(0)
    expect(result.modelo111.retencion).toBe(0)
  })

  it('autorrepercute la inversión del sujeto pasivo y no la declara en el 349', () => {
    const result = calculatePeriod(
      [
        doc({
          id: 'isp',
          kind: 'RECIBIDA',
          date: '2026-05-02',
          status: 'REGISTRADA',
          operation: 'INVERSION_SUJETO_PASIVO',
          base: 100,
          vatAmount: 21,
          vatDeductible: true,
          counterpartyVatId: 'ESB00000000',
        }),
      ],
      2026,
      2,
    )
    expect(result.modelo303.devengado).toBe(21)
    expect(result.modelo303.deducible).toBe(21)
    expect(result.modelo303.resultado).toBe(0)
    expect(result.modelo349).toEqual([])
  })

  it('suma los cuatro trimestres del año', () => {
    const docs = [
      ...demoT1Documents(),
      doc({
        id: 't2',
        kind: 'EMITIDA',
        date: '2026-05-10',
        base: 100,
        vatAmount: 21,
      }),
    ]
    const year = calculateYear(docs, 2026)
    expect(year.quarters[0]?.modelo303.resultado).toBe(126)
    expect(year.quarters[1]?.modelo303.devengado).toBe(21)
    expect(year.total.modelo303.devengado).toBe(273)
    expect(year.total.modelo303.resultado).toBe(147)
    expect(year.quarters.map((quarter) => quarter.modelo303.resultado).reduce((a, b) => a + b, 0)).toBe(
      147,
    )
  })
})

describe('liquidación de un trimestre cerrado', () => {
  const today = '2026-10-16'

  it('el 16 de octubre de 2026 solo deja cerrados los tres primeros trimestres', () => {
    expect(quarterRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-03-31' })
    expect(canLiquidateQuarter(2026, 1, today)).toBe(true)
    expect(canLiquidateQuarter(2026, 2, today)).toBe(true)
    expect(canLiquidateQuarter(2026, 3, today)).toBe(true)
    expect(canLiquidateQuarter(2026, 4, today)).toBe(false)
    expect(canLiquidateQuarter(2027, 1, today)).toBe(false)
    expect(canLiquidateQuarter(2025, 4, today)).toBe(true)
  })

  it('el último día del trimestre todavía no se puede liquidar', () => {
    expect(canLiquidateQuarter(2026, 1, '2026-03-31')).toBe(false)
    expect(canLiquidateQuarter(2026, 1, '2026-04-01')).toBe(true)
    expect(canLiquidateQuarter(2026, 4, '2026-12-31')).toBe(false)
    expect(canLiquidateQuarter(2026, 4, '2027-01-01')).toBe(true)
  })

  it('el ejercicio completo espera a que cierre diciembre', () => {
    expect(canLiquidateYear(2025, today)).toBe(true)
    expect(canLiquidateYear(2026, today)).toBe(false)
    expect(canLiquidateYear(2026, '2026-12-31')).toBe(false)
    expect(canLiquidateYear(2026, '2027-01-01')).toBe(true)
  })
})
