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

// Decodifica uma string Base64URL para ArrayBuffer
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

// Codifica ArrayBuffer ou Uint8Array para Base64URL
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Cria um JWT compacto assinado com ES256 para VAPID
async function createVAPIDJwt(
  audience: string,
  subject:  string,
  privateKeyBuffer: ArrayBuffer
): Promise<string> {
  const now        = Math.floor(Date.now() / 1000);
  const expiration = now + 12 * 60 * 60; // 12 horas

  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: subject };

  const encodedHeader  = bufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = bufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signingInputBytes = new TextEncoder().encode(signingInput);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    signingInputBytes.buffer as ArrayBuffer
  );

  return `${signingInput}.${bufferToBase64Url(signatureBuffer)}`;
}

// Gera os headers de autorização VAPID para um endpoint push
export async function generateVAPIDHeaders(
  endpoint: string,
  options:  VAPIDOptions
): Promise<Record<string, string>> {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const privateKeyBuffer = base64UrlToBuffer(options.privateKey);
  const jwt              = await createVAPIDJwt(audience, options.subject, privateKeyBuffer);

  return {
    'Authorization': `vapid t=${jwt},k=${options.publicKey}`,
    'Content-Encoding': 'aes128gcm',
  };
}
