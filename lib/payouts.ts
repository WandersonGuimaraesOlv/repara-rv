// =============================================================================
// lib/payouts.ts
// Repasse manual ao técnico (decisão do dono: manual, por Pix, até existir
// CNPJ — ver memória/Contrato). O Contrato promete o repasse em até 48 h
// depois da confirmação do pagamento, e permite suspender enquanto houver
// garantia aberta. Regra pura, sem rede.
// =============================================================================

import { z } from 'zod'

export const PAYOUT_DEADLINE_HOURS = 48

export type PayoutState =
  | 'not_due'   // pagamento do cliente ainda não confirmado
  | 'suspended' // garantia aberta: repasse suspenso até resolver
  | 'pending'   // dentro das 48 h
  | 'overdue'   // passou das 48 h
  | 'done'      // repasse feito

export interface PayoutCall {
  status: string
  payment_status: string | null
  paid_at: string | null
  payout_at: string | null
}

export function payoutDeadline(paidAt: string): Date {
  return new Date(new Date(paidAt).getTime() + PAYOUT_DEADLINE_HOURS * 3600_000)
}

export function payoutState(call: PayoutCall, hasOpenWarranty: boolean, now: number): PayoutState {
  if (call.payout_at) return 'done'
  if (call.status !== 'completed' || call.payment_status !== 'paid') return 'not_due'
  if (hasOpenWarranty) return 'suspended'
  if (call.paid_at && payoutDeadline(call.paid_at).getTime() < now) return 'overdue'
  return 'pending'
}

export const markPayoutSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
  reference: z.string().trim().max(200, 'Use no máximo 200 caracteres.').optional(),
})

export const undoPayoutSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
})
