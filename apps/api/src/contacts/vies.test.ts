import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { checkVies, requireVies, viesQuery } from './vies'

function reply(body: unknown, status = 200): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch
}

describe('VIES', () => {
  it('separa el país del número y traduce Grecia', () => {
    expect(viesQuery('FR40303265045')).toEqual({ countryCode: 'FR', vatNumber: '40303265045' })
    expect(viesQuery('GR123456789')).toEqual({ countryCode: 'EL', vatNumber: '123456789' })
    expect(viesQuery('B66521089')).toEqual({ countryCode: 'ES', vatNumber: 'B66521089' })
  })

  it('distingue un alta, un rechazo y una caída del servicio', async () => {
    await expect(checkVies('FR40303265045', reply({ valid: true }))).resolves.toEqual({ status: 'valid' })
    await expect(checkVies('FR40303265045', reply({ valid: false, userError: 'INVALID' }))).resolves.toEqual({
      status: 'invalid',
    })
    await expect(checkVies('FR40303265045', reply({ valid: false, userError: 'MS_UNAVAILABLE' }))).resolves.toEqual({
      status: 'unavailable',
    })
    await expect(checkVies('FR40303265045', reply({ actionSucceed: false }))).resolves.toEqual({
      status: 'unavailable',
    })
    await expect(checkVies('FR40303265045', reply('caído', 503))).resolves.toEqual({ status: 'unavailable' })
    await expect(checkVies('FR40303265045', (async () => { throw new Error('red') }) as typeof fetch)).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('impide guardar un NIF-IVA que VIES rechaza', async () => {
    const original = global.fetch
    global.fetch = reply({ valid: false })
    await expect(requireVies('FR00000000000')).rejects.toBeInstanceOf(BadRequestException)
    global.fetch = original
  })
})
