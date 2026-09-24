import { describe, it, expect } from 'vitest'
import { isLiveMercadoPagoToken, livePaymentBlockedReason } from '../lib/payment-environment'

const STAGING_URL = 'https://rahjxxalusylxdknuiqq.supabase.co'
const PROD_URL = 'https://lvjahufllclmkqcbbrcu.supabase.co'

describe('trava de cobrança real fora da produção (lib/payment-environment)', () => {
  it('reconhece o token de produção do Mercado Pago pelo prefixo', () => {
    expect(isLiveMercadoPagoToken('APP_USR-123')).toBe(true)
    expect(isLiveMercadoPagoToken('TEST-123')).toBe(false)
  })

  it('bloqueia token de produção quando o app aponta pro staging', () => {
    expect(livePaymentBlockedReason('APP_USR-123', STAGING_URL)).not.toBeNull()
  })

  it('libera produção, e token de teste em qualquer banco', () => {
    expect(livePaymentBlockedReason('APP_USR-123', PROD_URL)).toBeNull()
    expect(livePaymentBlockedReason('TEST-123', STAGING_URL)).toBeNull()
    expect(livePaymentBlockedReason('APP_USR-123', undefined)).toBeNull()
  })
})
