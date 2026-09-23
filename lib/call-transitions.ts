// =============================================================================
// lib/call-transitions.ts
// Máquina de estados das transições que o PRESTADOR pede para um chamado
// (app/api/calls/advance e app/api/calls/verify-arrival-pin). Regra pura,
// sem rede — mesmo padrão de lib/cancel-authorization.ts.
//
// Achado de 23/09/2026: o prestador gravava status direto em service_calls
// pelo navegador, com uma política de UPDATE que liberava qualquer coluna não
// financeira — dava pra ir de on_the_way direto pra completed sem o PIN de
// chegada. Agora cada transição tem origem fixa e só o servidor grava.
// =============================================================================

import type { Database } from '@/types/supabase'

type RideStatus = Database['public']['Enums']['ride_status']

export type ProviderAction = 'accept' | 'on_the_way' | 'start' | 'complete'

export const PROVIDER_TRANSITIONS: Record<ProviderAction, { from: readonly RideStatus[]; to: RideStatus }> = {
  // searching = o casamento já apontou este prestador e está esperando o aceite
  accept: { from: ['searching'], to: 'accepted' },
  on_the_way: { from: ['accepted'], to: 'on_the_way' },
  // start só por /api/calls/verify-arrival-pin, depois do PIN certo
  start: { from: ['accepted', 'on_the_way'], to: 'in_progress' },
  complete: { from: ['in_progress'], to: 'completed' },
}

// Quem pode aceitar/assumir chamado. find_nearest_provider não filtra por
// papel, então a conta admin do dono (que também tem provider_status, pra
// testar o fluxo no celular) recebe chamados — e tem que conseguir aceitá-los.
// Achado em 23/09/2026: /api/calls/advance recusava admin com "Prestador não
// autorizado" (antes o aceite era UPDATE direto e não olhava o papel).
export function canActAsProvider(role: string | null | undefined): boolean {
  return role === 'provider' || role === 'admin'
}

export interface TransitionCall {
  provider_id: string | null
  status: string
}

export type TransitionResult =
  | { allowed: true; from: readonly RideStatus[]; to: RideStatus }
  | { allowed: false; status: 401 | 403 | 409; error: string }

const WRONG_STATE_MESSAGES: Record<ProviderAction, string> = {
  accept: 'Este chamado não está mais disponível para aceite.',
  on_the_way: 'Este chamado não está aguardando saída.',
  start: 'Este chamado não está pronto para iniciar o atendimento.',
  complete: 'O atendimento precisa ser iniciado com o PIN do cliente antes de concluir.',
}

export function evaluateProviderTransition({
  userId,
  call,
  action,
}: {
  userId: string | null
  call: TransitionCall
  action: ProviderAction
}): TransitionResult {
  if (!userId) {
    return { allowed: false, status: 401, error: 'Não autenticado.' }
  }
  if (call.provider_id === null || call.provider_id !== userId) {
    return { allowed: false, status: 403, error: 'Este chamado não está atribuído a você.' }
  }
  const { from, to } = PROVIDER_TRANSITIONS[action]
  if (!(from as readonly string[]).includes(call.status)) {
    return { allowed: false, status: 409, error: WRONG_STATE_MESSAGES[action] }
  }
  return { allowed: true, from, to }
}

// ── PIN de chegada ────────────────────────────────────────────────────────────

export const PIN_MAX_FAILED_ATTEMPTS = 5
export const PIN_LOCK_MINUTES = 10

// A rota reserva cada tentativa no banco ANTES de comparar o PIN (UPDATE
// condicional em failed_attempts), senão vários palpites em paralelo seriam
// todos comparados antes de o contador subir.

export function isPinLocked(lockedUntil: string | null, now: Date): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > now.getTime()
}

// O que gravar ao reservar a tentativa número attemptNumber
// (1..PIN_MAX_FAILED_ATTEMPTS) desde o último travamento. A última já grava
// o travamento junto: se o PIN estiver errado, o chamado fica travado sem uma
// segunda escrita (que abriria espaço pra mais palpites no meio do caminho).
export function pinAttemptPatch(attemptNumber: number, now: Date): { failed_attempts: number; locked_until: string | null } {
  if (attemptNumber < PIN_MAX_FAILED_ATTEMPTS) {
    return { failed_attempts: attemptNumber, locked_until: null }
  }
  return { failed_attempts: 0, locked_until: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString() }
}
