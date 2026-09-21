// =============================================================================
// modules/notifications/services/webpush-encryption.ts
// Criptografia do corpo de uma mensagem Web Push — RFC 8291 (Message
// Encryption for Web Push) sobre o content coding aes128gcm da RFC 8188.
// Web Crypto puro — compatível com Cloudflare Workers, zero módulos Node.
//
// Sem isto o push service recebe JSON em claro com "Content-Encoding:
// aes128gcm" e o navegador não consegue decifrar a mensagem.
// =============================================================================

import { base64UrlToBytes, bytesToBase64Url } from './webcrypto-vapid';

export interface PushSubscriptionKeys {
  p256dh: string; // chave pública ECDH do navegador (65 bytes), base64url
  auth:   string; // segredo de autenticação (16 bytes), base64url
}

// Só pra teste: permite fixar a chave efêmera e o salt pra reproduzir o vetor
// do Apêndice A da RFC 8291. Em produção ficam ambos aleatórios.
export interface EncryptionOverrides {
  serverPublicKey?:  Uint8Array; // ponto P-256 bruto, 65 bytes
  serverPrivateKey?: Uint8Array; // escalar bruto, 32 bytes
  salt?:             Uint8Array; // 16 bytes
}

const RECORD_SIZE      = 4096;
const TAG_LENGTH       = 16;
const MAX_PLAINTEXT    = RECORD_SIZE - TAG_LENGTH - 1; // 1 byte de delimitador
const encoder          = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function decodeKey(name: string, value: string): Uint8Array {
  try {
    return base64UrlToBytes(value);
  } catch {
    throw new Error(`${name} inválido: base64url malformado`);
  }
}

// HKDF-SHA256 (Extract + Expand) via Web Crypto
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function generateServerKeys(overrides?: EncryptionOverrides): Promise<{ privateKey: CryptoKey; publicRaw: Uint8Array }> {
  if (overrides?.serverPrivateKey && overrides.serverPublicKey) {
    const pub = overrides.serverPublicKey;
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: bytesToBase64Url(overrides.serverPrivateKey),
        x: bytesToBase64Url(pub.slice(1, 33)),
        y: bytesToBase64Url(pub.slice(33, 65)),
        ext: true,
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );
    return { privateKey, publicRaw: pub };
  }

  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicRaw };
}

// Devolve o corpo pronto pra enviar ao push service:
//   salt(16) || record_size(4, big-endian) || idlen(1) || keyid(65) || ciphertext
export async function encryptWebPushPayload(
  plaintext:    Uint8Array,
  subscription: PushSubscriptionKeys,
  overrides?:   EncryptionOverrides
): Promise<Uint8Array> {
  if (plaintext.length > MAX_PLAINTEXT) {
    throw new Error(`Payload de push grande demais: ${plaintext.length} bytes (máximo ${MAX_PLAINTEXT})`);
  }

  const uaPublic   = decodeKey('p256dh', subscription.p256dh);
  const authSecret = decodeKey('auth', subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error('p256dh inválido: esperado ponto P-256 não comprimido (65 bytes)');
  }
  if (authSecret.length !== 16) {
    throw new Error('auth inválido: esperado segredo de 16 bytes');
  }

  const salt = overrides?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const { privateKey: asPrivate, publicRaw: asPublic } = await generateServerKeys(overrides);

  // Segredo ECDH compartilhado entre a chave efêmera do servidor e a do navegador
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  // RFC 8291 §3.4: IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info\0"||ua_public||as_public, 32)
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm     = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // RFC 8188 §2.2/2.3: chave e nonce de conteúdo a partir do salt do registro
  const cek   = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  // Um único registro: dados || 0x02 (delimitador do último registro, sem padding extra)
  const record = concat(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, tagLength: TAG_LENGTH * 8 }, aesKey, record as BufferSource)
  );

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concat(header, ciphertext);
}
