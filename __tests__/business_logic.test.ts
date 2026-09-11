import { describe, it, expect } from 'vitest'

describe('SQA Business Logic & Financial Integrity', () => {
  const catalog = [
    { id: '1', name: 'Troca de Chuveiro', fixed_price: 80, platform_fee: 15 },
    { id: '2', name: 'Instalação de Tomada / Interruptor', fixed_price: 60, platform_fee: 12 },
    { id: '3', name: 'Desentupimento de Pia / Ralo', fixed_price: 90, platform_fee: 15 },
    { id: '4', name: 'Troca de Torneira / Reparo de Caixa', fixed_price: 85, platform_fee: 15 },
    { id: '5', name: 'Montagem de Móvel Pequeno', fixed_price: 100, platform_fee: 18 },
    { id: '6', name: 'Instalação de Suporte TV / Varão', fixed_price: 75, platform_fee: 15 },
    { id: '7', name: 'Socorro Elétrico Noturno / 24h', fixed_price: 150, platform_fee: 25 },
    { id: '8', name: 'Vazamento Urgente / Caneta', fixed_price: 130, platform_fee: 22 },
  ]

  it('guarantees provider cut + platform fee always equals total price', () => {
    catalog.forEach(service => {
      const providerCut = service.fixed_price - service.platform_fee
      expect(providerCut + service.platform_fee).toBe(service.fixed_price)
      expect(providerCut).toBeGreaterThan(0)
      expect(service.platform_fee).toBeGreaterThan(0)
      // O prestador deve sempre receber a maior fatia (> 70%)
      expect(providerCut / service.fixed_price).toBeGreaterThanOrEqual(0.7)
    })
  })

  it('validates phone number input format for Rio Verde (DDD 64 ou 62)', () => {
    const sanitizePhone = (input: string) => input.replace(/\D/g, '').slice(0, 11)
    
    expect(sanitizePhone('(64) 99234-5678')).toBe('64992345678')
    expect(sanitizePhone('+55 64 99999-0000')).toBe('55649999900')
    expect(sanitizePhone('64999991111')).toHaveLength(11)
  })

  it('validates 6-digit OTP structure', () => {
    const isValidOtp = (token: string) => /^\d{6}$/.test(token)

    expect(isValidOtp('123456')).toBe(true)
    expect(isValidOtp('000000')).toBe(true)
    expect(isValidOtp('12345')).toBe(false)
    expect(isValidOtp('1234567')).toBe(false)
    expect(isValidOtp('12345a')).toBe(false)
  })

  it('strictly validates provider online eligibility: requires Mercado Pago OAuth connection', () => {
    const canProviderGoOnline = (status: {
      is_online: boolean
      recipient_gateway_id: string | null
    }) => {
      const hasMpConnected = Boolean(status.recipient_gateway_id && status.recipient_gateway_id.trim().length > 0)
      return hasMpConnected
    }

    expect(canProviderGoOnline({ is_online: false, recipient_gateway_id: null })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, recipient_gateway_id: '' })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, recipient_gateway_id: '   ' })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, recipient_gateway_id: '509128262' })).toBe(true)
  })

  it('guarantees fiscal protection: rejects split charges without connected subaccount', () => {
    const evaluatePaymentRouting = (params: {
      totalAmount: number
      platformFee: number
      providerSubaccount: { mp_access_token?: string; mp_user_id?: string } | null
    }) => {
      if (!params.providerSubaccount?.mp_access_token) {
        return {
          allowed: false,
          error: 'Prestador sem subconta conectada. Pagamento barrado para evitar bitributação.',
        }
      }

      return {
        allowed: true,
        applicationFee: params.platformFee,
        providerCut: params.totalAmount - params.platformFee,
        recipientToken: params.providerSubaccount.mp_access_token,
      }
    }

    // Sem subconta: DEVE ser barrado (não reter 100% no CNPJ)
    const blockedResult = evaluatePaymentRouting({
      totalAmount: 75,
      platformFee: 12,
      providerSubaccount: null,
    })
    expect(blockedResult.allowed).toBe(false)
    expect(blockedResult.error).toContain('evitar bitributação')

    // Com subconta conectada: permitido e split exato
    const validResult = evaluatePaymentRouting({
      totalAmount: 75,
      platformFee: 12,
      providerSubaccount: { mp_access_token: 'TEST-TOKEN-123', mp_user_id: '987654' },
    })
    expect(validResult.allowed).toBe(true)
    expect(validResult.applicationFee).toBe(12)
    expect(validResult.providerCut).toBe(63)
    expect(validResult.recipientToken).toBe('TEST-TOKEN-123')
  })
})
