// =============================================================================
// lib/cancel-authorization.ts
// Regra pura de autorização para cancelamento de chamados (app/api/calls/cancel).
// Extraída da rota para ser testável sem mocks de Next.js/Supabase — recebe
// dados simples, devolve uma decisão simples. Nenhuma chamada de rede aqui.
// =============================================================================

export interface CancelAuthCall {
  client_id: string
  provider_id: string | null
  status: string
}

export interface CancelAuthContext {
  userId: string | null
  call: CancelAuthCall
}

export type CancelAuthResult =
  | { allowed: true; isClient: boolean; isProvider: boolean }
  | { allowed: false; status: 401 | 403 | 400; error: string }

// Cliente só pode cancelar enquanto ainda não há prestador comprometido.
// Depois de 'accepted' o cancelamento de cliente segue outro fluxo (ex: taxa de no-show).
const CLIENT_CANCELLABLE_STATUSES = ['searching', 'queued', 'no_providers_available']

export function evaluateCancelAuthorization({
  userId,
  call,
}: CancelAuthContext): CancelAuthResult {
  if (!userId) {
    return { allowed: false, status: 401, error: 'Não autenticado.' }
  }

  const isClient = call.client_id === userId
  const isProvider = call.provider_id !== null && call.provider_id === userId

  if (!isClient && !isProvider) {
    return {
      allowed: false,
      status: 403,
      error: 'Você não tem permissão para cancelar este chamado.',
    }
  }

  if (isClient && !CLIENT_CANCELLABLE_STATUSES.includes(call.status)) {
    return {
      allowed: false,
      status: 400,
      error:
        'Cancelamento de cliente só é permitido enquanto o chamado está em busca ou na fila de espera.',
    }
  }

  return { allowed: true, isClient, isProvider }
}
