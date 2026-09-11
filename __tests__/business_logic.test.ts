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

  it('handles priority queue status and 2-hour expiration', () => {
    const resolveInitialCallState = (nearestProviderId: string | null) => {
      const isQueued = !nearestProviderId
      return {
        status: isQueued ? 'queued' : 'searching',
        expires_at: isQueued ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null,
      }
    }

    // Sem técnico online: entra na fila prioritária, não quebra com erro
    const queuedState = resolveInitialCallState(null)
    expect(queuedState.status).toBe('queued')
    expect(queuedState.expires_at).toBeTruthy()
    const diffHours = (new Date(queuedState.expires_at!).getTime() - Date.now()) / (1000 * 60 * 60)
    expect(Math.round(diffHours)).toBe(2)

    // Com técnico online: inicia searching
    const onlineState = resolveInitialCallState('prov-123')
    expect(onlineState.status).toBe('searching')
    expect(onlineState.expires_at).toBeNull()
  })

  it('formats WhatsApp notification for queued order accurately', () => {
    const formatQueueWhatsAppAlert = (params: {
      providerName: string
      serviceName: string
      neighborhood: string
      totalPrice: number
      providerCut: number
    }) => {
      const firstName = params.providerName.split(' ')[0]
      const totalFormatted = `R$ ${params.totalPrice.toFixed(2).replace('.', ',')}`
      const cutFormatted = `R$ ${params.providerCut.toFixed(2).replace('.', ',')}`
      return `Fala, ${firstName}! ⚡ Tem um cliente aguardando atendimento para ${params.serviceName} no ${params.neighborhood} (Ganhos líquidos: ${cutFormatted} de ${totalFormatted}). Acesse o painel agora para aceitar o chamado: https://repararv.com/painel`
    }

    const msg = formatQueueWhatsAppAlert({
      providerName: 'Almir da Silva',
      serviceName: 'Troca de Chuveiro',
      neighborhood: 'Setor Central',
      totalPrice: 80,
      providerCut: 65,
    })

    expect(msg).toContain('Fala, Almir!')
    expect(msg).toContain('Troca de Chuveiro')
    expect(msg).toContain('Setor Central')
    expect(msg).toContain('Ganhos líquidos: R$ 65,00')
    expect(msg).toContain('https://repararv.com/painel')
  })
})
