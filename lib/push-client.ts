// Helpers puros do lado do navegador pro Web Push (sem tocar em window/navigator,
// pra dar pra testar em Node).

// A chave pública VAPID vem em base64url; pushManager.subscribe() quer bytes.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ArrayBuffer (o que PushSubscription.getKey() devolve) → base64url
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function detectPushDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'safari-ios'
  if (/android/.test(ua)) return 'chrome-android'
  return 'web'
}
