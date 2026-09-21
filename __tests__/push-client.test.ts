import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array, arrayBufferToBase64Url, detectPushDeviceType } from '../lib/push-client'

describe('lib/push-client', () => {
  it('urlBase64ToUint8Array e arrayBufferToBase64Url são inversas (round trip com 65 bytes, como a chave VAPID)', () => {
    const original = new Uint8Array(65).map((_, i) => (i * 7 + 4) % 256)
    original[0] = 0x04

    const encoded = arrayBufferToBase64Url(original.buffer)
    expect(encoded).not.toMatch(/[+/=]/) // base64url puro, sem padding
    expect(Array.from(urlBase64ToUint8Array(encoded))).toEqual(Array.from(original))
  })

  it('decodifica a chave pública VAPID real (87 caracteres) em exatamente 65 bytes começando com 0x04', () => {
    // Exemplo do Apêndice A da RFC 8291 (ponto P-256 não comprimido)
    const key = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
    const bytes = urlBase64ToUint8Array(key)
    expect(key.length).toBe(87)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(0x04)
  })

  it('detectPushDeviceType reconhece iOS, Android e desktop', () => {
    expect(detectPushDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('safari-ios')
    expect(detectPushDeviceType('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120')).toBe('chrome-android')
    expect(detectPushDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('web')
  })
})
