// =============================================================================
// lib/missed-offers.ts
// Offline automático de quem não responde (decisão do dono, 23/09/2026): 2
// ofertas de chamado seguidas vencendo sem resposta tiram o técnico do ar.
// Sem isso, técnico "online" com o app fechado segurava cada chamado 30 s
// antes de passar pro próximo. Contador em provider_status.missed_offers
// (migration 20260923_auto_offline_missed_offers.sql).
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export const MISSED_OFFERS_LIMIT = 2

// Tempo que o técnico tem pra responder uma oferta (o mesmo do watchdog do
// cliente em app/acompanhar e do contador do CallAlertModal).
export const OFFER_TIMEOUT_MS = 30_000

// Folga pra diferença de relógio entre o celular e o servidor.
const CLOCK_TOLERANCE_MS = 2_000

export type SkipReason = 'rejected' | 'timeout'

export type OfferEnd =
  | 'early' // cliente pediu pra pular antes dos 30 s: não pula
  | 'rejected' // o técnico tocou em Recusar: estava lá, zera o contador
  | 'missed' // a oferta venceu sem resposta: conta
  | 'none' // pula, mas não conta nem zera

// Classifica o fim de uma oferta pedido em /api/calls/skip-provider. O tempo
// da oferta vem do servidor (service_calls.updated_at, gravado quando o
// chamado foi oferecido ao técnico), nunca do relógio do celular — senão um
// cliente com relógio adiantado (ou mal-intencionado) pulava técnicos antes
// da hora e os derrubava do ar.
export function classifyOfferEnd({
  callerIsProvider,
  reason,
  offerAgeMs,
}: {
  callerIsProvider: boolean
  reason: SkipReason | undefined
  offerAgeMs: number
}): OfferEnd {
  const timedOut = offerAgeMs >= OFFER_TIMEOUT_MS - CLOCK_TOLERANCE_MS
  if (callerIsProvider) {
    // Versões antigas do painel não mandam reason: trata como recusa (sem punir).
    if (reason !== 'timeout') return 'rejected'
    return timedOut ? 'missed' : 'none'
  }
  return timedOut ? 'missed' : 'early'
}

// Soma uma oferta perdida; devolve true se o técnico acabou de ser tirado do ar.
export async function registerMissedOffer(supabaseAdmin: SupabaseClient, providerId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('register_missed_offer', {
    p_provider_id: providerId,
    p_limit: MISSED_OFFERS_LIMIT,
  })
  if (error) {
    console.error('[missed-offers] Erro ao registrar oferta perdida:', error)
    return false
  }
  return data === true
}

export async function resetMissedOffers(supabaseAdmin: SupabaseClient, providerId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('provider_status')
    .update({ missed_offers: 0 })
    .eq('provider_id', providerId)
    .neq('missed_offers', 0)
  if (error) {
    console.error('[missed-offers] Erro ao zerar ofertas perdidas:', error)
  }
}
