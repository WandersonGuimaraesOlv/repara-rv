// =============================================================================
// modules/notifications/services/webcrypto-vapid.ts
// Geração de headers VAPID usando exclusivamente a Web Crypto API nativa.
// 100% compatível com Cloudflare Workers — zero dependências Node.js.
// =============================================================================

interface VAPIDOptions {
  publicKey:  string;
  privateKey: string;
  subject:    string; // ex: 'mailto:contato@repararv.com'
}

// Decodifica uma string Base64URL para bytes
export function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Codifica ArrayBuffer ou Uint8Array para Base64URL
export function bytesToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// VAPID (RFC 8292) usa a chave pública como o ponto P-256 NÃO comprimido de
// 65 bytes (0x04 || X || Y). Aceita também SPKI (91 bytes, o ponto são os
// últimos 65) e devolve sempre o ponto bruto.
function toRawPublicKey(publicKey: string): Uint8Array {
  const bytes = base64UrlToBytes(publicKey);
  const raw = bytes.length === 65 ? bytes : bytes.slice(bytes.length - 65);
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY inválida: esperado ponto P-256 não comprimido (65 bytes)');
  }
  return raw;
}

// A chave privada VAPID gerada por `npx web-push generate-vapid-keys` (e a que
// está em produção) é o escalar bruto de 32 bytes — NÃO um envelope PKCS8.
// Importar isso como 'pkcs8' falha com "Invalid keyData", então o escalar é
// montado num JWK usando as coordenadas da chave pública. PKCS8 continua
// aceito (qualquer coisa diferente de 32 bytes).
async function importSigningKey(privateKey: string, publicKey: string): Promise<CryptoKey> {
  const privateBytes = base64UrlToBytes(privateKey);

  if (privateBytes.length === 32) {
    const rawPublic = toRawPublicKey(publicKey);
    return crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: bytesToBase64Url(privateBytes),
        x: bytesToBase64Url(rawPublic.slice(1, 33)),
        y: bytesToBase64Url(rawPublic.slice(33, 65)),
        ext: true,
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }

  return crypto.subtle.importKey(
    'pkcs8',
    privateBytes as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Cria um JWT compacto assinado com ES256 para VAPID
async function createVAPIDJwt(
  audience:   string,
  subject:    string,
  privateKey: CryptoKey
): Promise<string> {
  const now        = Math.floor(Date.now() / 1000);
  const expiration = now + 12 * 60 * 60; // 12 horas

  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: subject };

  const encodedHeader  = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  // ECDSA do Web Crypto já devolve r||s (IEEE P1363), que é o que o ES256 do JWT exige
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${bytesToBase64Url(signatureBuffer)}`;
}

// Gera o header de autorização VAPID para um endpoint push. Só a autorização:
// Content-Encoding/Content-Type descrevem o CORPO e são definidos por quem
// criptografa o payload (push-dispatcher.ts).
export async function generateVAPIDHeaders(
  endpoint: string,
  options:  VAPIDOptions
): Promise<Record<string, string>> {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const signingKey = await importSigningKey(options.privateKey, options.publicKey);
  const jwt        = await createVAPIDJwt(audience, options.subject, signingKey);
  const rawPublic  = bytesToBase64Url(toRawPublicKey(options.publicKey));

  return {
    'Authorization': `vapid t=${jwt},k=${rawPublic}`,
  };
}
