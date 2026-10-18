import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { assertPassword, taxId } from './check'

describe('contraseña', () => {
  it('acepta mayúscula, minúscula, número y símbolo', () => {
    expect(() => assertPassword('Norte*Luz1')).not.toThrow()
  })

  it('rechaza la clave de la demo y una clave sin símbolo', () => {
    expect(() => assertPassword('demo1234')).toThrow(BadRequestException)
    expect(() => assertPassword('NorteLuz1')).toThrow(BadRequestException)
    expect(() => assertPassword('norte*luz')).toThrow(BadRequestException)
    expect(() => assertPassword('NORTE*LUZ1')).toThrow(BadRequestException)
    expect(() => assertPassword('Norte*Luz')).toThrow(BadRequestException)
    expect(() => assertPassword('Nor*1')).toThrow(BadRequestException)
  })
})

describe('NIF', () => {
  it('acepta DNI, NIE y CIF con el carácter de control', () => {
    expect(taxId('12345678Z')).toBe('12345678Z')
    expect(taxId('X0000000T')).toBe('X0000000T')
    expect(taxId('45678123p')).toBe('45678123P')
    expect(taxId('B11223344')).toBe('B11223344')
    expect(taxId('B66521089')).toBe('B66521089')
    expect(taxId('ESB99887762')).toBe('B99887762')
  })

  it('acepta un NIF-IVA intracomunitario y rechaza un control falso', () => {
    expect(taxId('DE811569869')).toBe('DE811569869')
    expect(taxId('fr40303265045')).toBe('FR40303265045')
    expect(() => taxId('45678123H')).toThrow(BadRequestException)
    expect(() => taxId('B66521084')).toThrow(BadRequestException)
    expect(() => taxId('B99887766')).toThrow(BadRequestException)
    expect(() => taxId('123')).toThrow(BadRequestException)
  })
})
