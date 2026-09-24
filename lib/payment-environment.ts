// =============================================================================
// lib/payment-environment.ts
// Trava contra cobrança real fora da produção (achado de 24/09/2026): o app
// local apontando pro staging (npm run dev:staging, E2E_TARGET=staging) usa o
// MERCADOPAGO_ACCESS_TOKEN do .dev.vars, que é o de PRODUÇÃO — um teste que
// chegasse ao Pix criava cobrança de verdade (já aconteceu, ver o plano de
// validação). Token de produção do Mercado Pago começa com "APP_USR-"; o de
// teste, com "TEST-". Regra pura, sem rede.
// =============================================================================

const STAGING_SUPABASE_REF = 'rahjxxalusylxdknuiqq'

export function isLiveMercadoPagoToken(token: string): boolean {
  return token.startsWith('APP_USR-')
}

// Motivo pra recusar a cobrança, ou null se pode seguir
export function livePaymentBlockedReason(token: string, supabaseUrl: string | undefined): string | null {
  if (isLiveMercadoPagoToken(token) && (supabaseUrl ?? '').includes(STAGING_SUPABASE_REF)) {
    return 'staging com token de produção do Mercado Pago'
  }
  return null
}
