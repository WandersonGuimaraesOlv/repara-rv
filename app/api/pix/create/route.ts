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

    // Se já tiver gerado QR Code e Copia e Cola, retorna os existentes
    if (call.pix_copy_paste && call.pix_qr_code) {
      return NextResponse.json({
        success: true,
        amount: call.total_price,
        pix_qr_code: call.pix_qr_code,
        pix_copy_paste: call.pix_copy_paste,
        checkout_url: call.cancel_note || null,
        payment_id: call.pix_payment_id,
        payment_status: call.payment_status,
      })
    }

    const amount = reqAmount || call.total_price
    const description = reqDesc || `Repara RV — ${call.service?.name ?? 'Serviço residencial'}`
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'

    if (!accessToken) {
      console.error('[API /api/pix/create] MERCADOPAGO_ACCESS_TOKEN não encontrado no ambiente')
      return NextResponse.json({ error: 'Gateway de pagamento em manutenção temporária.' }, { status: 500 })
    }

    const clientName = (call.client as { full_name?: string })?.full_name || 'Cliente Repara RV'
    const nameParts = clientName.trim().split(' ')
    const firstName = nameParts[0] || 'Cliente'
    const lastName = nameParts.slice(1).join(' ') || 'ReparaRV'
    const payerEmail = payer_email || 'cliente@repararv.com'

    // 2. Gera Cobrança Pix Direta no Mercado Pago
    let pixData: any = null
    try {
      const mpPixRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Idempotency-Key': `repararv-pix-${call_id}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description,
          payment_method_id: 'pix',
          payer: {
            email: payerEmail,
            first_name: firstName,
            last_name: lastName,
          },
          notification_url: `${appUrl}/api/pix/webhook`,
        }),
      })

      if (mpPixRes.ok) {
        pixData = await mpPixRes.json()
      } else {
        const pixErr = await mpPixRes.json().catch(() => ({}))
        console.error('[API /api/pix/create] Erro MP Pix:', pixErr)
      }
    } catch (err) {
      console.error('[API /api/pix/create] Falha ao chamar MP Pix:', err)
    }

    // 3. Gera Checkout Preference para Cartão de Crédito e Débito no Mercado Pago
    let checkoutUrl: string | null = null
    try {
      const mpPrefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
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
        }),
      })

      if (mpPrefRes.ok) {
        const prefData = await mpPrefRes.json()
        checkoutUrl = prefData.init_point || null
      } else {
        const prefErr = await mpPrefRes.json().catch(() => ({}))
        console.error('[API /api/pix/create] Erro MP Preference:', prefErr)
      }
    } catch (err) {
      console.error('[API /api/pix/create] Falha ao criar MP Preference:', err)
    }

    const qrCode = pixData?.point_of_interaction?.transaction_data?.qr_code || null
    const qrCodeBase64 = pixData?.point_of_interaction?.transaction_data?.qr_code_base64 || null
    const paymentId = pixData?.id ? String(pixData.id) : null

    // 4. Salva os dados no banco de dados do chamado
    await supabase
      .from('service_calls')
      .update({
        pix_payment_id: paymentId,
        pix_qr_code: qrCodeBase64,
        pix_copy_paste: qrCode,
        cancel_note: checkoutUrl || call.cancel_note,
      })
      .eq('id', call_id)

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
