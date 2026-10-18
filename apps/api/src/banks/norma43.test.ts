import { describe, expect, it } from 'vitest'
import { bankByEntity, bankFromIban } from './spanish-banks'
import { isSpanishIban, spanishIban } from './iban'
import { decodeStatement, parseNorma43, sampleNorma43 } from './norma43'

const CAIXA = 'ES7921000813610123456789'

describe('IBAN español', () => {
  it('reconoce CaixaBank en la cuenta de la demo', () => {
    expect(isSpanishIban(CAIXA)).toBe(true)
    expect(spanishIban('2100', '0813', '0123456789')).toBe(CAIXA)
    expect(bankByEntity('2100')).toBe('CaixaBank')
    expect(bankFromIban('es79 2100 0813 6101 2345 6789')).toBe('CaixaBank')
  })

  it('rechaza un dígito de control cambiado', () => {
    expect(isSpanishIban(`${CAIXA.slice(0, -1)}0`)).toBe(false)
  })
})

describe('Norma 43', () => {
  it('lee el extracto de ejemplo en la cuenta de CaixaBank', () => {
    for (const line of sampleNorma43().split('\r\n')) expect(line).toHaveLength(80)
    const parsed = parseNorma43(sampleNorma43())
    expect(parsed.accounts).toHaveLength(1)
    expect(parsed.accounts[0].iban).toBe(CAIXA)
    expect(parsed.accounts[0].bankName).toBe('CaixaBank')
    expect(parsed.accounts[0].movements.map((movement) => movement.amount)).toEqual([500, -200, -55, 242])
    expect(parsed.accounts[0].movements[0]).toMatchObject({
      date: '2026-02-28',
      concept: 'Cobro Atelier Lumière SARL',
    })
    expect(parsed.accounts[0].movements[2].concept).toBe('Casa Brava comida')
  })

  it('conserva los acentos de un fichero latin1 y de uno utf-8', () => {
    expect(decodeStatement(Buffer.from(sampleNorma43(), 'latin1'))).toBe(sampleNorma43())
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(sampleNorma43(), 'utf8')])
    expect(parseNorma43(decodeStatement(bom)).accounts[0].iban).toBe(CAIXA)
  })

  it('deja el nombre vacío si el código de entidad no está en el registro', () => {
    const text = sampleNorma43().replaceAll('2100', '9999')
    const parsed = parseNorma43(text)
    expect(parsed.accounts[0].bankName).toBeNull()
    expect(parsed.accounts[0].iban).toBe(spanishIban('9999', '0813', '0123456789'))
  })

  it('rechaza un texto que no es un extracto', () => {
    expect(() => parseNorma43('hola')).toThrow(/Norma 43/)
  })
})
