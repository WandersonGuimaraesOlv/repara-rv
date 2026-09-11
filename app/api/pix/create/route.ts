import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PixCreatePayload } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const body: PixCreatePayload = await request.json()
    const { call_id, amount: reqAmount, description: reqDesc, payer_email } = body

    if (!call_id) {
      return NextResponse.json({ error: 'call_id é obrigatório' }, { status: 400 })
    }

    // 1. Busca os detalhes do chamado
    const { data: call, error: callErr } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(name), client:profiles!client_id(full_name, phone)')
      .eq('id', call_id)
      .single()

    if (callErr || !call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const existingCheckout = (call.cancel_metadata as Record<string, unknown>)?.checkout_url as string | undefined || call.cancel_note || null

    // Se já tiver gerado QR Code Pix e URL do Cartão, retorna os existentes de imediato
    if (call.pix_copy_paste && call.pix_qr_code && existingCheckout) {
      return NextResponse.json({
        success: true,
        amount: call.total_price,
        pix_qr_code: call.pix_qr_code,
        pix_copy_paste: call.pix_copy_paste,
        checkout_url: existingCheckout,
        payment_id: call.pix_payment_id,
        payment_status: call.payment_status,
      })
    }

    const amount = reqAmount || call.total_price
    const description = reqDesc || `Repara RV — ${call.service?.name ?? 'Serviço residencial'}`
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    
    // Garante que notification_url e back_urls sejam sempre HTTPS públicos aceitos pelo Mercado Pago
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost')) 
      ? rawAppUrl 
      : 'https://repararv.com'

    if (!accessToken) {
      console.error('[API /api/pix/create] MERCADOPAGO_ACCESS_TOKEN não encontrado no ambiente')
      return NextResponse.json({ error: 'Gateway de pagamento em manutenção temporária.' }, { status: 500 })
    }

    // 2. Verifica se o prestador possui subconta conectada via OAuth para Split Automático
    let activeAccessToken = accessToken
    let isSplitActive = false
    const platformFee = Number(call.platform_fee || 12)

    if (call.provider_id) {
      const { data: gatewayAcc } = await supabase
        .from('provider_gateway_accounts')
        .select('mp_access_token, mp_user_id')
        .eq('provider_id', call.provider_id)
        .maybeSingle()

      if (gatewayAcc?.mp_access_token) {
        activeAccessToken = gatewayAcc.mp_access_token
        isSplitActive = true
        console.log(`[Split Mercado Pago] Ativado para prestador ${call.provider_id} (MP User: ${gatewayAcc.mp_user_id}). Fee retida: R$ ${platformFee}`)
      } else {
        // Fallback resiliente: se o prestador ainda não concluiu o OAuth, NÃO barra o morador/cliente no local!
        // O Pix é gerado via conta master da Repara RV e o repasse fica garantido para a chave Pix do prestador.
        console.log(`[Split Mercado Pago] Prestador ${call.provider_id} sem OAuth ativo. Processando cobrança Pix via conta master para liberar o morador.`)
      }
    }

    const clientName = (call.client as { full_name?: string })?.full_name || 'Cliente Repara RV'
    const nameParts = clientName.trim().split(' ')
    const firstName = nameParts[0] || 'Cliente'
    const lastName = nameParts.slice(1).join(' ') || 'ReparaRV'
    const payerEmail = payer_email || 'financeiro@repararv.com'

    // 3. Gera Cobrança Pix Direta no Mercado Pago (com application_fee obrigatório se split ativo)
    let qrCode = call.pix_copy_paste || null
    let qrCodeBase64 = call.pix_qr_code || null
    let paymentId = call.pix_payment_id || null

    if (!qrCodeBase64 || !qrCode) {
      try {
        const pixPayload: Record<string, any> = {
          transaction_amount: amount,
          description,
          payment_method_id: 'pix',
          payer: {
            email: payerEmail,
            first_name: firstName,
            last_name: lastName,
          },
          notification_url: `${appUrl}/api/pix/webhook`,
        }

        if (isSplitActive && platformFee > 0 && platformFee < amount) {
          pixPayload.application_fee = platformFee
        }

        const mpPixRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeAccessToken}`,
            'X-Idempotency-Key': `repararv-pix-${call_id}-${Date.now()}`,
          },
          body: JSON.stringify(pixPayload),
        })

        if (mpPixRes.ok) {
          const pixData = await mpPixRes.json()
          qrCode = pixData?.point_of_interaction?.transaction_data?.qr_code || null
          qrCodeBase64 = pixData?.point_of_interaction?.transaction_data?.qr_code_base64 || null
          paymentId = pixData?.id ? String(pixData.id) : null
        } else {
          const pixErr = await mpPixRes.json().catch(() => ({}))
          console.error('[API /api/pix/create] Erro MP Pix com split:', pixErr)
        }
      } catch (err) {
        console.error('[API /api/pix/create] Falha ao chamar MP Pix:', err)
      }
    }

    // 4. Gera Checkout Preference para Cartão de Crédito e Débito no Mercado Pago
    let checkoutUrl: string | null = existingCheckout

    if (!checkoutUrl) {
      try {
        const prefPayload: Record<string, any> = {
          items: [
            {
              title: description,
              quantity: 1,
              unit_price: amount,
              currency_id: 'BRL',
            },
          ],
          back_urls: {
            success: `${appUrl}/acompanhar/${call_id}`,
            failure: `${appUrl}/acompanhar/${call_id}`,
            pending: `${appUrl}/acompanhar/${call_id}`,
          },
          auto_return: 'approved',
          external_reference: call_id,
          statement_descriptor: 'REPARARV',
        }

        if (isSplitActive && platformFee > 0 && platformFee < amount) {
          prefPayload.marketplace_fee = platformFee
        }

        const mpPrefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeAccessToken}`,
          },
          body: JSON.stringify(prefPayload),
        })

        if (mpPrefRes.ok) {
          const prefData = await mpPrefRes.json()
          checkoutUrl = prefData.init_point || null
        } else {
          const prefErr = await mpPrefRes.json().catch(() => ({}))
          console.error('[API /api/pix/create] Erro MP Preference com split:', prefErr)
        }
      } catch (err) {
        console.error('[API /api/pix/create] Falha ao criar MP Preference:', err)
      }
    }

    // Se falhou a geração de ambos
    if (!qrCodeBase64 && !checkoutUrl) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível comunicar com o Mercado Pago para gerar a cobrança. Tente novamente em instantes.' },
        { status: 502 }
      )
    }

    // 4. Salva os dados no banco de dados do chamado
    const updatePayload: Record<string, unknown> = {}
    if (paymentId) updatePayload.pix_payment_id = paymentId
    if (qrCodeBase64) updatePayload.pix_qr_code = qrCodeBase64
    if (qrCode) updatePayload.pix_copy_paste = qrCode
    if (checkoutUrl) {
      updatePayload.cancel_note = checkoutUrl
      const existingMeta = (call.cancel_metadata as Record<string, unknown>) || {}
      updatePayload.cancel_metadata = { ...existingMeta, checkout_url: checkoutUrl }
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from('service_calls')
        .update(updatePayload)
        .eq('id', call_id)
    }

    return NextResponse.json({
      success: true,
      amount,
      pix_qr_code: qrCodeBase64,
      pix_copy_paste: qrCode,
      checkout_url: checkoutUrl,
      payment_id: paymentId,
      payment_status: call.payment_status || 'pending',
    })
  } catch (error) {
    console.error('[API] /api/pix/create exceção:', error)
    return NextResponse.json({ error: 'Erro interno ao gerar pagamento.' }, { status: 500 })
  }
}
