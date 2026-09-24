// =============================================================================
// lib/warranty.ts
// Garantia de 7 dias corridos da mão de obra (Termos, cláusula "Da Garantia"):
// vale para serviço concluído e quitado, contada da conclusão registrada na
// Plataforma. O cliente aciona pelo app (app/api/calls/warranty) e a equipe
// resolve ou recusa no painel admin. Regra pura, sem rede.
// =============================================================================

import { z } from 'zod'

export const WARRANTY_DAYS = 7
export const WARRANTY_DESCRIPTION_MIN = 10
export const WARRANTY_DESCRIPTION_MAX = 1000

export function warrantyDeadline(completedAt: string): Date {
  return new Date(new Date(completedAt).getTime() + WARRANTY_DAYS * 24 * 3600_000)
}

export interface WarrantyCall {
  client_id: string
  status: string
  payment_status: string | null
  completed_at: string | null
}

export type WarrantyEligibility =
  | { allowed: true; deadline: Date }
  | { allowed: false; status: 401 | 403 | 409; error: string }

export function evaluateWarrantyClaim({ userId, call, now }: { userId: string | null; call: WarrantyCall; now: number }): WarrantyEligibility {
  if (!userId) {
    return { allowed: false, status: 401, error: 'Não autenticado.' }
  }
  if (call.client_id !== userId) {
    return { allowed: false, status: 403, error: 'Só quem pediu o serviço pode acionar a garantia.' }
  }
  if (call.status !== 'completed' || !call.completed_at) {
    return { allowed: false, status: 409, error: 'A garantia vale para serviços concluídos.' }
  }
  if (call.payment_status !== 'paid') {
    return { allowed: false, status: 409, error: 'A garantia vale para serviços pagos. Conclua o pagamento pelo app.' }
  }
  const deadline = warrantyDeadline(call.completed_at)
  if (deadline.getTime() < now) {
    return { allowed: false, status: 409, error: `O prazo de ${WARRANTY_DAYS} dias da garantia terminou. Você pode abrir um novo chamado.` }
  }
  return { allowed: true, deadline }
}

export const warrantyClaimSchema = z.object({
  call_id: z.string().uuid('ID do chamado inválido'),
  description: z
    .string()
    .trim()
    .min(WARRANTY_DESCRIPTION_MIN, `Conte o que aconteceu com pelo menos ${WARRANTY_DESCRIPTION_MIN} caracteres.`)
    .max(WARRANTY_DESCRIPTION_MAX, `Use no máximo ${WARRANTY_DESCRIPTION_MAX} caracteres.`),
})

export const resolveWarrantySchema = z.object({
  claimId: z.string().uuid('ID da garantia inválido'),
  outcome: z.enum(['resolved', 'rejected']),
  note: z.string().trim().min(5, 'Escreva o que foi feito (pelo menos 5 caracteres).').max(1000, 'Use no máximo 1000 caracteres.'),
})
