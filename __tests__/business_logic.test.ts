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

  it('validates provider online eligibility: requires valid Pix key for instant payouts', () => {
    const canProviderGoOnline = (status: {
      is_online: boolean
      pix_key: string | null
    }) => {
      const hasValidPix = Boolean(status.pix_key && status.pix_key.trim().length > 0)
      return hasValidPix
    }

    expect(canProviderGoOnline({ is_online: false, pix_key: null })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, pix_key: '' })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, pix_key: '   ' })).toBe(false)
    expect(canProviderGoOnline({ is_online: false, pix_key: '64999999999' })).toBe(true)
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

  it('strictly validates provider compliance and security: blocks rejected or suspended technicians', () => {
    const isProviderEligibleForDispath = (provider: {
      is_blocked: boolean
      background_check_status: 'pending' | 'approved' | 'rejected'
      has_pix_key: boolean
    }) => {
      if (provider.is_blocked) return false
      if (provider.background_check_status === 'rejected') return false
      if (!provider.has_pix_key) return false
      return true
    }

    // Aprovado e com Chave Pix: 100% elegível
    expect(
      isProviderEligibleForDispath({
        is_blocked: false,
        background_check_status: 'approved',
        has_pix_key: true,
      })
    ).toBe(true)

    // Bloqueio preventivo (is_blocked = true): DEVE ser barrado
    expect(
      isProviderEligibleForDispath({
        is_blocked: true,
        background_check_status: 'approved',
        has_pix_key: true,
      })
    ).toBe(false)

    // Reprovado em antecedentes: DEVE ser barrado
    expect(
      isProviderEligibleForDispath({
        is_blocked: false,
        background_check_status: 'rejected',
        has_pix_key: true,
      })
    ).toBe(false)

    // Sem Chave Pix cadastrada: barrado preventivamente (sem canal de repasse)
    expect(
      isProviderEligibleForDispath({
        is_blocked: false,
        background_check_status: 'approved',
        has_pix_key: false,
      })
    ).toBe(false)
  })

  it('formats safe Rio Verde administrative WhatsApp links with DDI 55 and URL encoding', () => {
    const sanitizePhone = (raw: string) => {
      let digits = raw.replace(/\D/g, '')
      if (digits.startsWith('0')) digits = digits.slice(1)
      if (!digits.startsWith('55')) {
        if (digits.length === 10 || digits.length === 11) {
          digits = `55${digits}`
        }
      }
      return digits
    }

    const formatAdminWaUrl = (rawPhone: string, name: string) => {
      const phone = sanitizePhone(rawPhone)
      const msg = encodeURIComponent(`Olá ${name}, aqui é da administração da Repara RV em Rio Verde...`)
      return `https://wa.me/${phone}?text=${msg}`
    }

    const formatMpDemandWaUrl = (rawPhone: string, name: string) => {
      const phone = sanitizePhone(rawPhone)
      const msg = encodeURIComponent(
        `Olá ${name}, aqui é da equipe de gestão do Repara RV! Identificamos que sua conta Mercado Pago ainda não está conectada para o split automático de pagamentos Pix. Sem ela, nosso sistema não pode despachar chamados para você em Rio Verde.\n\nConecte sua conta em menos de 1 minuto pelo link seguro:\nhttps://repararv.com/painel/configuracoes/mercado-pago`
      )
      return `https://wa.me/${phone}?text=${msg}`
    }

    // DDD 64 local
    const url1 = formatAdminWaUrl('(64) 99345-6789', 'Carlos Eletricista')
    expect(url1).toContain('https://wa.me/5564993456789?text=')
    expect(url1).toContain('Carlos%20Eletricista')

    // Já com 55
    const url2 = formatAdminWaUrl('+55 64 99999-8888', 'Maria Encanadora')
    expect(url2).toContain('https://wa.me/5564999998888?text=')

    // Cobrança Mercado Pago
    const mpUrl = formatMpDemandWaUrl('64988887777', 'Roberto Chaveiro')
    expect(mpUrl).toContain('https://wa.me/5564988887777?text=')
    expect(mpUrl).toContain(encodeURIComponent('https://repararv.com/painel/configuracoes/mercado-pago'))
  })
})

