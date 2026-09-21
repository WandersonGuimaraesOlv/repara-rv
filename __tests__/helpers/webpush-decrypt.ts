import { createECDH, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

// Decifrador de referência do lado do navegador (RFC 8291 + RFC 8188), escrito
// com o node:crypto e SEM reutilizar nada de modules/notifications — assim um
// erro de criptografia no código de produção não é "compensado" pelo teste.
export function decryptWebPush(body: Uint8Array, uaPrivate: Buffer, uaPublic: Buffer, authSecret: Buffer): Buffer {
  const buf = Buffer.from(body)
  const salt = buf.subarray(0, 16)
  const idLength = buf[20]
  const asPublic = buf.subarray(21, 21 + idLength)
  const ciphertext = buf.subarray(21 + idLength)

  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(uaPrivate)
  const ecdhSecret = ecdh.computeSecret(asPublic)

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
  const record = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()])

  if (record[record.length - 1] !== 0x02) throw new Error('delimitador do último registro (0x02) ausente')
  return record.subarray(0, record.length - 1)
}

// Assinatura de navegador de mentira, mas com chaves de verdade — dá pra decifrar o que o servidor mandar.
export function createTestSubscription(endpoint = 'https://fcm.googleapis.com/wp/test-endpoint') {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const uaPublic = ecdh.getPublicKey()
  const uaPrivate = ecdh.getPrivateKey()
  const authSecret = randomBytes(16)
  const b64u = (b: Buffer) => b.toString('base64url')
  return {
    subscription: { endpoint, p256dh: b64u(uaPublic), auth: b64u(authSecret) },
    uaPrivate,
    uaPublic,
    authSecret,
  }
}
