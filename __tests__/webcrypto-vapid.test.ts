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

// Gera um par de chaves EC P-256 de teste, no mesmo formato (pkcs8 base64url)
// que o projeto guarda em VAPID_PRIVATE_KEY.
async function generateTestVapidKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  return {
    privateKeyBase64Url: base64UrlEncode(new Uint8Array(pkcs8)),
    publicKeyBase64Url: base64UrlEncode(new Uint8Array(spki)),
    publicCryptoKey: keyPair.publicKey,
  }
}

describe('generateVAPIDHeaders (modules/notifications/services/webcrypto-vapid)', () => {
  it('produz um header Authorization vapid com JWT assinado de verdade e verificável pela chave pública', async () => {
    const { privateKeyBase64Url, publicKeyBase64Url, publicCryptoKey } = await generateTestVapidKeyPair()

    const headers = await generateVAPIDHeaders('https://fcm.googleapis.com/wp/some-endpoint-id', {
      publicKey: publicKeyBase64Url,
      privateKey: privateKeyBase64Url,
      subject: 'mailto:contato@repararv.com',
    })

    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers['Authorization']).toMatch(/^vapid t=.+,k=.+$/)

    const match = headers['Authorization'].match(/^vapid t=(.+),k=(.+)$/)
    expect(match).not.toBeNull()
    const [, jwt, embeddedPublicKey] = match!
    expect(embeddedPublicKey).toBe(publicKeyBase64Url)

    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')
    expect(encodedHeader).toBeTruthy()
    expect(encodedPayload).toBeTruthy()
    expect(encodedSignature).toBeTruthy()

    // Decodifica o payload e confirma aud/sub/exp corretos
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)))
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:contato@repararv.com')
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))

    // Verificação criptográfica de verdade: a assinatura precisa bater com a
    // chave pública gerada junto — prova que o JWT não foi só formatado
    // corretamente, mas assinado com a chave privada correspondente.
    const signingInput = `${encodedHeader}.${encodedPayload}`
    const signatureBytes = base64UrlDecode(encodedSignature)
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicCryptoKey,
      signatureBytes.buffer as ArrayBuffer,
      new TextEncoder().encode(signingInput)
    )
    expect(isValid).toBe(true)
  })

  it('deriva a audiência (aud) do protocolo+host do endpoint, ignorando path e query', async () => {
    const { privateKeyBase64Url, publicKeyBase64Url } = await generateTestVapidKeyPair()

    const headers = await generateVAPIDHeaders(
      'https://updates.push.services.mozilla.com/wpush/v2/abc123?foo=bar',
      { publicKey: publicKeyBase64Url, privateKey: privateKeyBase64Url, subject: 'mailto:x@x.com' }
    )

    const jwt = headers['Authorization'].match(/^vapid t=(.+),k=.+$/)![1]
    const [, encodedPayload] = jwt.split('.')
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)))
    expect(payload.aud).toBe('https://updates.push.services.mozilla.com')
  })

  it('uma assinatura gerada com OUTRA chave privada não verifica contra a chave pública esperada', async () => {
    const pairA = await generateTestVapidKeyPair()
    const pairB = await generateTestVapidKeyPair()

    // Usa a privada de B mas afirma (no header) ser a pública de A — simula
    // um adulteramento/erro de configuração de chaves.
    const headers = await generateVAPIDHeaders('https://example.com/endpoint', {
      publicKey: pairA.publicKeyBase64Url,
      privateKey: pairB.privateKeyBase64Url,
      subject: 'mailto:x@x.com',
    })

    const jwt = headers['Authorization'].match(/^vapid t=(.+),k=.+$/)![1]
    const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')
    const signingInput = `${encodedHeader}.${encodedPayload}`

    const isValidAgainstA = await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      pairA.publicCryptoKey,
      base64UrlDecode(encodedSignature).buffer as ArrayBuffer,
      new TextEncoder().encode(signingInput)
    )
    expect(isValidAgainstA).toBe(false)
  })
})
