import { describe, it, expect } from 'vitest'
import { generateVAPIDHeaders } from '../modules/notifications/services/webcrypto-vapid'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Gera um par de chaves EC P-256 de teste no formato REAL de produção — o mesmo
// de `npx web-push generate-vapid-keys`: privada = escalar bruto de 32 bytes,
// pública = ponto não comprimido de 65 bytes. (Antes os testes geravam PKCS8 +
// SPKI, formato que produção não usa — e por isso não pegavam que o código
// falhava com "Invalid keyData" na chave de verdade.)
async function generateTestVapidKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey))
  return {
    privateKeyBase64Url: jwk.d as string, // 32 bytes brutos
    publicKeyBase64Url: base64UrlEncode(raw), // 65 bytes brutos
    legacyPkcs8Base64Url: base64UrlEncode(pkcs8),
    legacySpkiBase64Url: base64UrlEncode(spki),
    publicCryptoKey: keyPair.publicKey,
  }
}

async function verifyJwt(jwt: string, publicKey: CryptoKey): Promise<boolean> {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    publicKey,
    base64UrlDecode(encodedSignature).buffer as ArrayBuffer,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  )
}

describe('generateVAPIDHeaders (modules/notifications/services/webcrypto-vapid)', () => {
  it('a chave do formato de produção (32 bytes brutos) assina um JWT verificável pela chave pública', async () => {
    const { privateKeyBase64Url, publicKeyBase64Url, publicCryptoKey } = await generateTestVapidKeyPair()
    expect(base64UrlDecode(privateKeyBase64Url).length).toBe(32)
    expect(base64UrlDecode(publicKeyBase64Url).length).toBe(65)

    const headers = await generateVAPIDHeaders('https://fcm.googleapis.com/wp/some-endpoint-id', {
      publicKey: publicKeyBase64Url,
      privateKey: privateKeyBase64Url,
      subject: 'mailto:contato@repararv.com',
    })

    // Content-Encoding descreve o CORPO e agora é definido por quem criptografa (push-dispatcher)
    expect(headers['Content-Encoding']).toBeUndefined()
    expect(headers['Authorization']).toMatch(/^vapid t=.+,k=.+$/)

    const [, jwt, embeddedPublicKey] = headers['Authorization'].match(/^vapid t=(.+),k=(.+)$/)!
    expect(embeddedPublicKey).toBe(publicKeyBase64Url)

    const [encodedHeader, encodedPayload] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)))
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:contato@repararv.com')
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))

    // Verificação criptográfica de verdade, não só formato
    expect(await verifyJwt(jwt, publicCryptoKey)).toBe(true)
  })

  it('continua aceitando o formato antigo (PKCS8 + SPKI) e devolve sempre a chave pública BRUTA no k=', async () => {
    const { legacyPkcs8Base64Url, legacySpkiBase64Url, publicKeyBase64Url, publicCryptoKey } = await generateTestVapidKeyPair()

    const headers = await generateVAPIDHeaders('https://example.com/endpoint', {
      publicKey: legacySpkiBase64Url,
      privateKey: legacyPkcs8Base64Url,
      subject: 'mailto:x@x.com',
    })

    const [, jwt, embeddedPublicKey] = headers['Authorization'].match(/^vapid t=(.+),k=(.+)$/)!
    expect(embeddedPublicKey).toBe(publicKeyBase64Url) // VAPID exige o ponto bruto de 65 bytes, nunca SPKI
    expect(await verifyJwt(jwt, publicCryptoKey)).toBe(true)
  })

  it('deriva a audiência (aud) do protocolo+host do endpoint, ignorando path e query', async () => {
    const { privateKeyBase64Url, publicKeyBase64Url } = await generateTestVapidKeyPair()

    const headers = await generateVAPIDHeaders(
      'https://updates.push.services.mozilla.com/wpush/v2/abc123?foo=bar',
      { publicKey: publicKeyBase64Url, privateKey: privateKeyBase64Url, subject: 'mailto:x@x.com' }
    )

    const jwt = headers['Authorization'].match(/^vapid t=(.+),k=.+$/)![1]
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(jwt.split('.')[1])))
    expect(payload.aud).toBe('https://updates.push.services.mozilla.com')
  })

  it('uma assinatura gerada com OUTRA chave privada não verifica contra a chave pública esperada', async () => {
    const pairA = await generateTestVapidKeyPair()
    const pairB = await generateTestVapidKeyPair()

    // Privada de B com as coordenadas públicas de A: a chave montada é inconsistente,
    // então ou falha ao importar ou assina algo que a pública de A não verifica.
    let verifiedAgainstA = false
    try {
      const headers = await generateVAPIDHeaders('https://example.com/endpoint', {
        publicKey: pairA.publicKeyBase64Url,
        privateKey: pairB.privateKeyBase64Url,
        subject: 'mailto:x@x.com',
      })
      const jwt = headers['Authorization'].match(/^vapid t=(.+),k=.+$/)![1]
      verifiedAgainstA = await verifyJwt(jwt, pairA.publicCryptoKey)
    } catch {
      verifiedAgainstA = false
    }
    expect(verifiedAgainstA).toBe(false)
  })

  it('rejeita uma chave pública que não é um ponto P-256 não comprimido', async () => {
    const { privateKeyBase64Url } = await generateTestVapidKeyPair()

    await expect(
      generateVAPIDHeaders('https://example.com/endpoint', {
        publicKey: base64UrlEncode(new Uint8Array(65)), // 65 bytes, mas sem o prefixo 0x04
        privateKey: privateKeyBase64Url,
        subject: 'mailto:x@x.com',
      })
    ).rejects.toThrow(/VAPID_PUBLIC_KEY inválida/)
  })
})
