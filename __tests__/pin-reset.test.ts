import { describe, it, expect } from 'vitest'
import { generateResetCode, hashResetCode, isResetCodeExpired } from '@/lib/pin-reset'

describe('generateResetCode', () => {
  it('sempre gera 6 dígitos numéricos', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateResetCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })
})

describe('hashResetCode', () => {
  it('produz o mesmo hash para o mesmo código', async () => {
    const hash1 = await hashResetCode('123456')
    const hash2 = await hashResetCode('123456')
    expect(hash1).toBe(hash2)
  })

  it('produz hashes diferentes para códigos diferentes', async () => {
    const hash1 = await hashResetCode('123456')
    const hash2 = await hashResetCode('654321')
    expect(hash1).not.toBe(hash2)
  })

  it('ignora espaços em branco ao redor do código', async () => {
    const hash1 = await hashResetCode('123456')
    const hash2 = await hashResetCode('  123456  ')
    expect(hash1).toBe(hash2)
  })

  it('retorna um hex de 64 caracteres (SHA-256)', async () => {
    const hash = await hashResetCode('123456')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('isResetCodeExpired', () => {
  it('considera expirado quando não há data', () => {
    expect(isResetCodeExpired(undefined)).toBe(true)
    expect(isResetCodeExpired(null)).toBe(true)
    expect(isResetCodeExpired('')).toBe(true)
  })

  it('considera expirado quando a data já passou', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isResetCodeExpired(past)).toBe(true)
  })

  it('considera válido quando a data ainda não passou', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isResetCodeExpired(future)).toBe(false)
  })
})
