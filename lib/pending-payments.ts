// =============================================================================
// lib/pending-payments.ts
// O que o cliente ainda deve (pedido do dono, 23/09/2026): serviço concluído
// sem pagamento ou taxa de deslocamento (no-show) pendente. Enquanto houver,
// ele não abre chamado novo (app/api/calls/create) e o app mostra a cobrança
// ao entrar (components/pending-payment-reminder.tsx). Regra pura, sem rede.
// =============================================================================

export interface PendingPaymentCandidate {
  id: string
  status: string
  payment_status: string | null
  no_show_fee_status: string | null
  created_at: string
}

export type PendingKind = 'service' | 'no_show_fee'

// Taxa de deslocamento (no-show) — o mesmo valor fixo de app/api/pix/create.
export const NO_SHOW_FEE_AMOUNT = 25

// Filtro PostgREST equivalente, pra buscar só as candidatas no banco.
export const PENDING_PAYMENT_FILTER =
  'and(status.eq.completed,payment_status.eq.pending),and(status.eq.cancelled,no_show_fee_status.eq.pending)'

export function pendingKindOf(call: PendingPaymentCandidate): PendingKind | null {
  if (call.status === 'completed' && call.payment_status === 'pending') return 'service'
  if (call.status === 'cancelled' && call.no_show_fee_status === 'pending') return 'no_show_fee'
  return null
}

// A dívida mais antiga primeiro — é a que o cliente vê e paga antes.
export function findPendingPayment<T extends PendingPaymentCandidate>(calls: T[]): { call: T; kind: PendingKind } | null {
  const pending = calls
    .map(call => ({ call, kind: pendingKindOf(call) }))
    .filter((item): item is { call: T; kind: PendingKind } => item.kind !== null)
    .sort((a, b) => new Date(a.call.created_at).getTime() - new Date(b.call.created_at).getTime())
  return pending[0] ?? null
}
