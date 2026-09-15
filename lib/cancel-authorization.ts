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

// Valores aceitos pela coluna ENUM cancel_reason do Postgres (types/supabase.ts).
// O prestador (app/chamado/[callId]/page.tsx) manda exatamente um destes
// valores. O cliente (components/cancel-call-modal.tsx) manda um rótulo livre
// em português (ex: "Demorou muito para encontrar prestador") — nunca um
// destes valores. Achado real em produção em 15/09/2026: quando a rota exigia
// `z.enum(CANCEL_REASON_ENUM)` no campo `reason` do payload, todo cancelamento
// de cliente era rejeitado com 422 antes mesmo de chegar na autorização — o
// texto livre nunca batia com o enum. A rota agora aceita qualquer string em
// `reason` e usa esta função pra derivar o valor do enum separadamente.
export const CANCEL_REASON_ENUM = [
  'client_request',
  'provider_absent',
  'wrong_address',
  'technical_issue',
  'no_provider_found',
  'other',
] as const

export type CancelReasonEnum = typeof CANCEL_REASON_ENUM[number]

// Se `reason` já é um dos valores estruturados (caminho do prestador), usa
// direto. Caso contrário (rótulo livre do cliente, ou ausente), cai num valor
// padrão sensato pro papel de quem está cancelando — o texto completo e
// legível continua preservado em `cancellation_reason`, sem perda de detalhe.
export function resolveCancelReasonEnum(reason: string | undefined, isClient: boolean): CancelReasonEnum {
  if (reason && (CANCEL_REASON_ENUM as readonly string[]).includes(reason)) {
    return reason as CancelReasonEnum
  }
  return isClient ? 'client_request' : 'other'
}
