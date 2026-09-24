// =============================================================================
// lib/support.ts
// Canal de suporte humano: WhatsApp de clique manual (sem envio automático —
// decisão do dono de 21/09/2026, ver AGENTS.md). Um lugar só pro número e o
// horário: cabeçalho, rodapé e barra do app usam daqui.
//
// Achado de 24/09/2026 (plano de maturação §15: "não publicar um número de
// suporte que não possa responder"): o número era um marcador falso
// (64 99999-9999) em 4 lugares do site, e o rodapé prometia um horário que
// não foi definido. Enquanto o dono não passar o número e o horário de
// verdade, os botões de suporte ficam escondidos.
// =============================================================================

// Só dígitos, com 55 + DDD (ex.: '5564999990000'). null = sem canal definido.
export const SUPPORT_WHATSAPP: string | null = null

// Ex.: 'segunda a sábado, das 7h às 20h'. null = sem horário publicado.
export const SUPPORT_HOURS: string | null = null

export function supportWhatsAppLink(message = 'Olá, preciso de ajuda no Repara RV'): string | null {
  if (!SUPPORT_WHATSAPP) return null
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}
