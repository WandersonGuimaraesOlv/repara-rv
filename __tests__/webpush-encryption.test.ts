import { describe, it, expect } from 'vitest'
import { encryptWebPushPayload } from '../modules/notifications/services/webpush-encryption'
import { decryptWebPush, createTestSubscription } from './helpers/webpush-decrypt'

const b64u = (s: string) => Buffer.from(s, 'base64url')

// Apêndice A da RFC 8291 (valores copiados do texto da RFC; espaços de quebra de linha removidos).
const RFC = {
  plaintext:  b64u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), // "When I grow up, I want to be a watermelon"
  asPublic:   b64u('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
  asPrivate:  b64u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
  uaPublic:   b64u('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
  uaPrivate:  b64u('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94'),
  salt:       b64u('DGv6ra1nlYgDCS1FRnbzlw'),
  auth:       b64u('BTBZMqHH6r4Tts7J_aSIgg'),
  header:     b64u('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
  ciphertext: b64u('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'),
}

describe('encryptWebPushPayload (modules/notifications/services/webpush-encryption)', () => {
  it('reproduz EXATAMENTE o exemplo do Apêndice A da RFC 8291 (known-answer test)', async () => {
    const body = await encryptWebPushPayload(
      new Uint8Array(RFC.plaintext),
      { p256dh: RFC.uaPublic.toString('base64url'), auth: RFC.auth.toString('base64url') },
      { serverPublicKey: new Uint8Array(RFC.asPublic), serverPrivateKey: new Uint8Array(RFC.asPrivate), salt: new Uint8Array(RFC.salt) }
    )

    expect(Buffer.from(body).subarray(0, 86).equals(RFC.header)).toBe(true) // cabeçalho de 86 octetos
    expect(Buffer.from(body).subarray(86).equals(RFC.ciphertext)).toBe(true)
    expect(body.length).toBe(RFC.header.length + RFC.ciphertext.length)
  })

  it('o decifrador de referência do teste decifra o exemplo da RFC (valida o próprio helper)', () => {
    const body = Buffer.concat([RFC.header, RFC.ciphertext])
    const plain = decryptWebPush(body, RFC.uaPrivate, RFC.uaPublic, RFC.auth)
    expect(plain.equals(RFC.plaintext)).toBe(true)
    expect(plain.toString('utf-8')).toBe('When I grow up, I want to be a watermelon')
  })

  it('round trip com chaves aleatórias: o navegador consegue decifrar o que o servidor cifrou', async () => {
    const { subscription, uaPrivate, uaPublic, authSecret } = createTestSubscription()
    const message = JSON.stringify({ title: '🚨 Novo Chamado!', body: 'Instalação de chuveiro — Setor Central, ação rápida', url: 'https://repararv.com/painel' })

    const body = await encryptWebPushPayload(new TextEncoder().encode(message), subscription)
    const plain = decryptWebPush(body, uaPrivate, uaPublic, authSecret)

    expect(plain.toString('utf-8')).toBe(message)
  })

  it('cada envio usa salt e chave efêmera novos (mesma mensagem, corpos diferentes)', async () => {
    const { subscription } = createTestSubscription()
    const data = new TextEncoder().encode('mesma mensagem')

    const a = await encryptWebPushPayload(data, subscription)
    const b = await encryptWebPushPayload(data, subscription)

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
    expect(Buffer.from(a).subarray(0, 16).equals(Buffer.from(b).subarray(0, 16))).toBe(false) // salt
  })

  it('o corpo declara registro de 4096 bytes e a chave do servidor de 65 bytes no cabeçalho', async () => {
    const { subscription } = createTestSubscription()
    const body = Buffer.from(await encryptWebPushPayload(new TextEncoder().encode('x'), subscription))

    expect(body.readUInt32BE(16)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(body[21]).toBe(0x04) // ponto não comprimido
  })

  it('aceita o payload máximo de 4079 bytes e recusa 4080', async () => {
    const { subscription, uaPrivate, uaPublic, authSecret } = createTestSubscription()
    const max = new Uint8Array(4079).fill(97)

    const body = await encryptWebPushPayload(max, subscription)
    expect(body.length).toBe(86 + 4096) // cabeçalho + 1 registro cheio
    expect(decryptWebPush(body, uaPrivate, uaPublic, authSecret).length).toBe(4079)

    await expect(encryptWebPushPayload(new Uint8Array(4080), subscription)).rejects.toThrow(/grande demais/)
  })

  it('recusa p256dh e auth malformados em vez de mandar lixo pro push service', async () => {
    const good = createTestSubscription().subscription
    const data = new TextEncoder().encode('x')

    await expect(encryptWebPushPayload(data, { ...good, p256dh: 'fake-p256dh' })).rejects.toThrow(/p256dh/)
    await expect(encryptWebPushPayload(data, { ...good, auth: 'curto' })).rejects.toThrow(/auth/)
  })
})
