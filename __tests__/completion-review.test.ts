import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('../modules/notifications/services/unified-dispatcher', () => ({
  notifyProvider: vi.fn(),
  notifyProviderBatch: vi.fn(),
}))
vi.mock('../modules/notifications/services/email-dispatcher', () => ({
  sendEmail: vi.fn(),
  FROM_ADDRESS: 'Repara RV <noreply@repararv.com>',
}))

import { createServiceClient } from '@/lib/supabase/server'
import { notifyProvider, notifyProviderBatch } from '../modules/notifications/services/unified-dispatcher'
import { sendEmail } from '../modules/notifications/services/email-dispatcher'
import {
  adminCancelCallSchema,
  canAdminCancel,
  completionReviewPatch,
  completionReviewSchema,
  evaluateCompletionReview,
} from '../lib/completion-review'
import { alertAboutCompletionIssue, buildCompletionIssueEmail } from '../modules/notifications/services/completion-alert'

const CALL_ID = '9804049d-74e6-4db9-991a-2e05edce11b0'
const NOW = '2026-09-24T18:00:00.000Z'

describe('conferência do cliente antes do Pix (lib/completion-review)', () => {
  it('só o cliente do chamado confere, e só em awaiting_approval', () => {
    const call = { client_id: 'cliente-1', status: 'awaiting_approval' }
    expect(evaluateCompletionReview({ userId: null, call })).toMatchObject({ allowed: false, status: 401 })
    // o técnico não aprova o próprio serviço
    expect(evaluateCompletionReview({ userId: 'tecnico-1', call })).toMatchObject({ allowed: false, status: 403 })
    expect(evaluateCompletionReview({ userId: 'cliente-1', call })).toEqual({ allowed: true })
    for (const status of ['in_progress', 'completed', 'cancelled']) {
      expect(evaluateCompletionReview({ userId: 'cliente-1', call: { ...call, status } })).toMatchObject({ allowed: false, status: 409 })
    }
  })

  it('apontar problema exige o motivo escrito (mínimo de 10 caracteres, sem contar espaços nas pontas)', () => {
    expect(completionReviewSchema.safeParse({ call_id: CALL_ID, decision: 'reject' }).success).toBe(false)
    expect(completionReviewSchema.safeParse({ call_id: CALL_ID, decision: 'reject', reason: '   pinga   ' }).success).toBe(false)
    const ok = completionReviewSchema.safeParse({ call_id: CALL_ID, decision: 'reject', reason: '  continua pingando  ' })
    expect(ok.success && ok.data.decision === 'reject' && ok.data.reason).toBe('continua pingando')
    expect(completionReviewSchema.safeParse({ call_id: CALL_ID, decision: 'approve' }).success).toBe(true)
    expect(completionReviewSchema.safeParse({ call_id: 'x', decision: 'approve' }).success).toBe(false)
  })

  it('aprovar conclui o chamado e registra quem aprovou; apontar problema volta pro técnico', () => {
    expect(completionReviewPatch({ call_id: CALL_ID, decision: 'approve' }, { approvedBy: 'cliente-1', issueCount: 1, nowIso: NOW })).toEqual({
      status: 'completed',
      completed_at: NOW,
      completion_approved_at: NOW,
      completion_approved_by: 'cliente-1',
      updated_at: NOW,
    })
    expect(completionReviewPatch({ call_id: CALL_ID, decision: 'reject', reason: 'continua pingando' }, { approvedBy: 'cliente-1', issueCount: 1, nowIso: NOW })).toEqual({
      status: 'in_progress',
      completion_issue: 'continua pingando',
      completion_issue_count: 2,
      updated_at: NOW,
    })
  })

  it('admin cancela o que ainda não terminou; concluído e encerrado ficam de fora', () => {
    for (const status of ['searching', 'queued', 'accepted', 'on_the_way', 'in_progress', 'awaiting_approval']) {
      expect(canAdminCancel(status)).toBe(true)
    }
    for (const status of ['completed', 'cancelled', 'expired']) {
      expect(canAdminCancel(status)).toBe(false)
    }
    expect(adminCancelCallSchema.safeParse({ callId: CALL_ID, reason: '  ' }).success).toBe(false)
    expect(adminCancelCallSchema.safeParse({ callId: CALL_ID, reason: 'técnico sumiu' }).success).toBe(true)
  })
})

describe('aviso de problema na conferência (modules/notifications/services/completion-alert)', () => {
  const input = {
    callId: CALL_ID,
    providerId: 'tecnico-1',
    serviceName: 'Troca de Chuveiro',
    reason: 'O chuveiro <b>continua</b> pingando no registro e a água sai fria mesmo no modo inverno, precisa ver a resistência de novo por favor',
    issueCount: 2,
    appUrl: 'https://repararv.com',
  }

  it('e-mail da equipe leva o motivo escapado e diz quantas vezes', () => {
    const { subject, html } = buildCompletionIssueEmail(input)
    expect(subject).toBe('Problema apontado na conferência — chamado #9804049D — Repara RV')
    expect(html).toContain('2ª vez neste chamado')
    expect(html).toContain('&lt;b&gt;continua&lt;/b&gt;')
    expect(html).not.toContain('<b>continua</b>')
    expect(html).toContain('https://repararv.com/admin/dashboard')
  })

  describe('envio', () => {
    beforeEach(() => {
      vi.stubEnv('OPS_ALERT_EMAIL', 'ops@exemplo.com')
      vi.stubEnv('RESEND_API_KEY', 're_teste')
      vi.mocked(notifyProvider).mockReset().mockResolvedValue({ sent: 1, failed: 0, removed: 0 })
      vi.mocked(notifyProviderBatch).mockReset().mockResolvedValue({ sent: 1, failed: 0, removed: 0 })
      vi.mocked(sendEmail).mockReset().mockResolvedValue({ success: true })
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: 'admin-1' }], error: null }),
      }
      vi.mocked(createServiceClient).mockResolvedValue({ from: vi.fn(() => builder) } as never)
    })
    afterEach(() => vi.unstubAllEnvs())

    it('técnico recebe o motivo (resumido) com link pro chamado; o push da equipe não leva o texto do cliente', async () => {
      const result = await alertAboutCompletionIssue(input)
      expect(result).toEqual({ email: true, providerPush: 1, adminPush: 1 })

      const [providerId, providerPayload] = vi.mocked(notifyProvider).mock.calls[0]
      expect(providerId).toBe('tecnico-1')
      expect(providerPayload.url).toBe(`/chamado/${CALL_ID}`)
      expect(providerPayload.body.length).toBeLessThanOrEqual(170)
      expect(providerPayload.body).toContain('O chuveiro <b>continua</b> pingando')

      const [adminIds, adminPayload] = vi.mocked(notifyProviderBatch).mock.calls[0]
      expect(adminIds).toEqual(['admin-1'])
      expect(adminPayload.body).not.toContain('chuveiro')
      expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe('ops@exemplo.com')
    })

    it('nunca lança: push e e-mail falhando devolvem zerado', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(notifyProvider).mockRejectedValue(new Error('push caiu'))
      vi.mocked(notifyProviderBatch).mockRejectedValue(new Error('push caiu'))
      vi.mocked(sendEmail).mockRejectedValue(new Error('resend caiu'))
      await expect(alertAboutCompletionIssue(input)).resolves.toEqual({ email: false, providerPush: 0, adminPush: 0 })
    })
  })
})
