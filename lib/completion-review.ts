// =============================================================================
// lib/completion-review.ts
// Conferência do serviço pelo cliente ANTES do Pix (pedido do dono em
// 24/09/2026 — evita cobrar serviço que "não ficou bacana"). O técnico pede a
// conclusão (lib/call-transitions.ts → awaiting_approval) e fica no local; o
// cliente aprova (→ completed, o Pix aparece) ou aponta um problema (volta pra
// in_progress, o técnico corrige e pede de novo). Nada aprova sozinho — em
// impasse, o admin aprova pelo cliente ou cancela (app/actions/admin-calls.ts).
// Regra pura, sem rede — mesmo padrão de lib/cancel-authorization.ts.
// =============================================================================

import { z } from 'zod'

export const COMPLETION_ISSUE_MIN_LENGTH = 10
export const COMPLETION_ISSUE_MAX_LENGTH = 500

export const completionReviewSchema = z.discriminatedUnion('decision', [
  z.object({
    call_id: z.string().uuid('ID do chamado inválido'),
    decision: z.literal('approve'),
  }),
  z.object({
    call_id: z.string().uuid('ID do chamado inválido'),
    decision: z.literal('reject'),
    reason: z
      .string()
      .trim()
      .min(COMPLETION_ISSUE_MIN_LENGTH, `Conte o problema com pelo menos ${COMPLETION_ISSUE_MIN_LENGTH} caracteres.`)
      .max(COMPLETION_ISSUE_MAX_LENGTH, `Use no máximo ${COMPLETION_ISSUE_MAX_LENGTH} caracteres.`),
  }),
])

export type CompletionReviewInput = z.infer<typeof completionReviewSchema>

export interface ReviewCall {
  client_id: string
  status: string
}

export type ReviewResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 409; error: string }

// Só o cliente do chamado, e só enquanto o técnico está esperando a conferência.
export function evaluateCompletionReview({ userId, call }: { userId: string | null; call: ReviewCall }): ReviewResult {
  if (!userId) {
    return { allowed: false, status: 401, error: 'Não autenticado.' }
  }
  if (call.client_id !== userId) {
    return { allowed: false, status: 403, error: 'Só quem pediu o serviço pode conferir a conclusão.' }
  }
  if (call.status !== 'awaiting_approval') {
    return { allowed: false, status: 409, error: 'Este chamado não está aguardando a sua conferência.' }
  }
  return { allowed: true }
}

// O que gravar em service_calls em cada decisão (quem grava é o servidor, com
// UPDATE condicional em status = 'awaiting_approval').
export function completionReviewPatch(
  input: CompletionReviewInput,
  ctx: { approvedBy: string; issueCount: number; nowIso: string }
) {
  if (input.decision === 'approve') {
    return {
      status: 'completed' as const,
      completed_at: ctx.nowIso,
      completion_approved_at: ctx.nowIso,
      completion_approved_by: ctx.approvedBy,
      updated_at: ctx.nowIso,
    }
  }
  return {
    status: 'in_progress' as const,
    completion_issue: input.reason,
    completion_issue_count: ctx.issueCount + 1,
    updated_at: ctx.nowIso,
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────

// O que o admin pode cancelar: tudo que ainda não terminou. Concluído (com ou
// sem pagamento) fica de fora — aí a questão é de cobrança, não de chamado.
export const ADMIN_CANCELLABLE_STATUSES = [
  'searching',
  'queued',
  'no_providers_available',
  'accepted',
  'on_the_way',
  'in_progress',
  'awaiting_approval',
] as const

export function canAdminCancel(status: string): boolean {
  return (ADMIN_CANCELLABLE_STATUSES as readonly string[]).includes(status)
}

export const adminCancelCallSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
  reason: z
    .string()
    .trim()
    .min(5, 'Escreva o motivo do cancelamento (pelo menos 5 caracteres).')
    .max(500, 'Use no máximo 500 caracteres.'),
})

export const adminApproveCompletionSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
})
