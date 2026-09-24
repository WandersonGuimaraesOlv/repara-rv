import { describe, it, expect } from 'vitest'
import { PAYOUT_DEADLINE_HOURS, payoutDeadline, payoutState, markPayoutSchema } from '../lib/payouts'
import { WARRANTY_DAYS, evaluateWarrantyClaim, warrantyClaimSchema, warrantyDeadline, resolveWarrantySchema } from '../lib/warranty'
import { buildOpsAlertEmail, environmentLabel } from '../modules/notifications/services/ops-alert'
import { whatsAppLink } from '../lib/whatsapp-link'

const CALL_ID = '9804049d-74e6-4db9-991a-2e05edce11b0'
const PAID_AT = '2026-09-24T12:00:00.000Z'
const HOUR = 3600_000

describe('repasse manual (lib/payouts)', () => {
  const paid = { status: 'completed', payment_status: 'paid', paid_at: PAID_AT, payout_at: null }

  it('prazo de 48 h contado da confirmação do pagamento (Contrato, cláusula 4)', () => {
    expect(PAYOUT_DEADLINE_HOURS).toBe(48)
    expect(payoutDeadline(PAID_AT).toISOString()).toBe('2026-09-26T12:00:00.000Z')
  })

  it('pendente dentro do prazo, atrasado depois, feito quando registrado', () => {
    const t0 = Date.parse(PAID_AT)
    expect(payoutState(paid, false, t0 + 47 * HOUR)).toBe('pending')
    expect(payoutState(paid, false, t0 + 49 * HOUR)).toBe('overdue')
    expect(payoutState({ ...paid, payout_at: PAID_AT }, false, t0 + 49 * HOUR)).toBe('done')
  })

  it('garantia aberta suspende o repasse; sem pagamento confirmado ainda não é devido', () => {
    const t0 = Date.parse(PAID_AT)
    expect(payoutState(paid, true, t0 + 49 * HOUR)).toBe('suspended')
    expect(payoutState({ ...paid, payment_status: 'pending' }, false, t0)).toBe('not_due')
    expect(payoutState({ ...paid, status: 'awaiting_approval' }, false, t0)).toBe('not_due')
  })

  it('referência do Pix é opcional e limitada', () => {
    expect(markPayoutSchema.safeParse({ callId: CALL_ID }).success).toBe(true)
    expect(markPayoutSchema.safeParse({ callId: CALL_ID, reference: 'x'.repeat(201) }).success).toBe(false)
    expect(markPayoutSchema.safeParse({ callId: 'nao-e-uuid' }).success).toBe(false)
  })
})

describe('garantia de 7 dias (lib/warranty)', () => {
  const completed = { client_id: 'cliente-1', status: 'completed', payment_status: 'paid', completed_at: PAID_AT }
  const t0 = Date.parse(PAID_AT)

  it('vale 7 dias corridos da conclusão', () => {
    expect(WARRANTY_DAYS).toBe(7)
    expect(warrantyDeadline(PAID_AT).toISOString()).toBe('2026-10-01T12:00:00.000Z')
    expect(evaluateWarrantyClaim({ userId: 'cliente-1', call: completed, now: t0 + 6 * 24 * HOUR })).toMatchObject({ allowed: true })
    expect(evaluateWarrantyClaim({ userId: 'cliente-1', call: completed, now: t0 + 8 * 24 * HOUR })).toMatchObject({ allowed: false, status: 409 })
  })

  it('só o cliente do chamado, e só serviço concluído e pago', () => {
    expect(evaluateWarrantyClaim({ userId: null, call: completed, now: t0 })).toMatchObject({ allowed: false, status: 401 })
    expect(evaluateWarrantyClaim({ userId: 'tecnico-1', call: completed, now: t0 })).toMatchObject({ allowed: false, status: 403 })
    expect(evaluateWarrantyClaim({ userId: 'cliente-1', call: { ...completed, payment_status: 'pending' }, now: t0 })).toMatchObject({ allowed: false, status: 409 })
    expect(evaluateWarrantyClaim({ userId: 'cliente-1', call: { ...completed, status: 'in_progress', completed_at: null }, now: t0 })).toMatchObject({ allowed: false, status: 409 })
  })

  it('descrição obrigatória e encerramento com nota', () => {
    expect(warrantyClaimSchema.safeParse({ call_id: CALL_ID, description: 'pinga' }).success).toBe(false)
    expect(warrantyClaimSchema.safeParse({ call_id: CALL_ID, description: '  o registro voltou a pingar  ' }).success).toBe(true)
    expect(resolveWarrantySchema.safeParse({ claimId: CALL_ID, outcome: 'resolved', note: 'ok' }).success).toBe(false)
    expect(resolveWarrantySchema.safeParse({ claimId: CALL_ID, outcome: 'rejected', note: 'defeito de fábrica da peça' }).success).toBe(true)
  })
})

describe('alerta de erro por e-mail (modules/notifications/services/ops-alert)', () => {
  it('diz o ambiente pelo projeto do Supabase', () => {
    expect(environmentLabel('https://rahjxxalusylxdknuiqq.supabase.co')).toBe('STAGING')
    expect(environmentLabel('https://lvjahufllclmkqcbbrcu.supabase.co')).toBe('PRODUÇÃO')
  })

  it('leva ambiente, etapa, chamado, código, horário de Rio Verde, impacto e ação — escapados', () => {
    const { subject, html } = buildOpsAlertEmail(
      {
        kind: 'pix_create_failed',
        route: '/api/pix/create',
        callId: CALL_ID,
        errorCode: 'Pix 500, cartão 500',
        summary: 'O Mercado Pago não gerou o <Pix>',
        impact: 'O cliente não consegue pagar.',
        action: 'Confira o Mercado Pago.',
      },
      'STAGING',
      new Date('2026-09-24T12:00:00.000Z')
    )
    expect(subject.startsWith('[STAGING] ')).toBe(true)
    expect(html).toContain('#9804049D')
    expect(html).toContain('Pix 500, cartão 500')
    expect(html).toContain('09:00:00')
    expect(html).toContain('&lt;Pix&gt;')
    expect(html).not.toContain('<Pix>')
  })
})

describe('link de WhatsApp do painel (lib/whatsapp-link)', () => {
  it('põe o 55 uma vez só e recusa número curto', () => {
    expect(whatsAppLink('(64) 99345-6789', 'oi')).toBe('https://wa.me/5564993456789?text=oi')
    expect(whatsAppLink('+55 64 99345-6789', 'oi')).toBe('https://wa.me/5564993456789?text=oi')
    expect(whatsAppLink('123', 'oi')).toBeNull()
    expect(whatsAppLink(null, 'oi')).toBeNull()
  })
})
