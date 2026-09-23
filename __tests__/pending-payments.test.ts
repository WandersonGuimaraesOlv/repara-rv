import { describe, it, expect } from 'vitest'
import { findPendingPayment, pendingKindOf } from '../lib/pending-payments'

const call = (over: Partial<Parameters<typeof pendingKindOf>[0]>) => ({
  id: 'c1',
  status: 'completed',
  payment_status: 'pending',
  no_show_fee_status: null,
  created_at: '2026-09-23T12:00:00.000Z',
  ...over,
})

describe('pendingKindOf — o que conta como pagamento pendente do cliente', () => {
  it('serviço concluído sem pagamento', () => {
    expect(pendingKindOf(call({}))).toBe('service')
  })

  it('taxa de deslocamento pendente num chamado cancelado', () => {
    expect(pendingKindOf(call({ status: 'cancelled', payment_status: 'pending', no_show_fee_status: 'pending' }))).toBe('no_show_fee')
  })

  it('não conta: pago, estornado, taxa paga, ou chamado ainda em andamento', () => {
    expect(pendingKindOf(call({ payment_status: 'paid' }))).toBeNull()
    expect(pendingKindOf(call({ payment_status: 'refunded' }))).toBeNull()
    expect(pendingKindOf(call({ status: 'cancelled', no_show_fee_status: 'paid' }))).toBeNull()
    expect(pendingKindOf(call({ status: 'cancelled', no_show_fee_status: null }))).toBeNull()
    for (const status of ['searching', 'queued', 'accepted', 'on_the_way', 'in_progress']) {
      expect(pendingKindOf(call({ status }))).toBeNull()
    }
  })
})

describe('findPendingPayment', () => {
  it('sem dívida: null', () => {
    expect(findPendingPayment([call({ payment_status: 'paid' })])).toBeNull()
    expect(findPendingPayment([])).toBeNull()
  })

  it('devolve a dívida mais antiga', () => {
    const result = findPendingPayment([
      call({ id: 'nova', created_at: '2026-09-23T22:14:00.000Z' }),
      call({ id: 'paga', payment_status: 'paid', created_at: '2026-09-20T10:00:00.000Z' }),
      call({ id: 'antiga', created_at: '2026-09-23T21:18:00.000Z' }),
    ])
    expect(result?.call.id).toBe('antiga')
    expect(result?.kind).toBe('service')
  })
})
