// =============================================================================
// lib/pin-reset.ts
// Geração e verificação do código de recuperação de PIN por e-mail. Puro
// (sem I/O) — o código em si nunca é persistido, só o hash SHA-256 dele
// (via Web Crypto, nativo do Cloudflare Workers), pra uma leitura do banco
// não expor o código de quem ainda não usou.
// =============================================================================

export const PIN_RESET_CODE_TTL_MINUTES = 15

export function generateResetCode(): string {
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  // 6 dígitos, sempre com zero à esquerda se precisar (ex: "004821")
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}

export async function hashResetCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function isResetCodeExpired(expiresAtIso: string | undefined | null): boolean {
  if (!expiresAtIso) return true
  return new Date(expiresAtIso).getTime() < Date.now()
}
