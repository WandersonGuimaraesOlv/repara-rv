import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PixCreatePayload } from '@/lib/types'

/**
 * TODO: Integrar com Mercado Pago (ou Asaas).
 *
 * Fluxo Mercado Pago:
 * 1. POST https://api.mercadopago.com/v1/payments
 *    - transaction_amount: amount
 *    - payment_method_id: 'pix'
 *    - payer: { email: payer_email }
 *    - description: description
 *    - notification_url: NEXT_PUBLIC_APP_URL/api/pix/webhook
 *
 * 2. Response contém:
 *    - id: payment_id
 *    - point_of_interaction.transaction_data.qr_code_base64
 *    - point_of_interaction.transaction_data.qr_code (copia e cola)
 *
 * Documentação: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */

async function createMercadoPagoPixCharge(payload: {
  amount: number
  description: string
  payerEmail: string
  callbackUrl: string
}) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  }

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': `repararv-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: payload.amount,
      description: payload.description,
      payment_method_id: 'pix',
      payer: { email: payload.payerEmail },
      notification_url: payload.callbackUrl,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Mercado Pago error: ${JSON.stringify(err)}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body: PixCreatePayload = await request.json()
    const { call_id, amount, description, payer_email } = body

    if (!call_id || !amount) {
      return NextResponse.json({ error: 'call_id e amount são obrigatórios' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Se não tiver token configurado, cria um mock para desenvolvimento
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn('[Pix] MERCADOPAGO_ACCESS_TOKEN não configurado — usando mock')
      await supabase
        .from('service_calls')
        .update({
          pix_payment_id: `mock-${call_id}`,
          pix_qr_code: null,
          pix_copy_paste: `00020126580014br.gov.bcb.pix0136${call_id.slice(0,36)}5204000053039865406${amount.toFixed(2).replace('.', '')}5802BR5913ReparaRV6009RioVerde62070503***6304MOCK`,
        })
        .eq('id', call_id)

      return NextResponse.json({ success: true, mock: true })
    }

    // Cria cobrança real no Mercado Pago
    // Em teste: o email do pagador deve ser um email de conta de teste do MP
    const payerEmailToUse = payer_email ?? user.email ?? 'test_user_123456789@testuser.com'

    const mpData = await createMercadoPagoPixCharge({
      amount,
      description: description ?? 'Repara RV — Serviço residencial',
      payerEmail: payerEmailToUse,
      callbackUrl: `${appUrl}/api/pix/webhook`,
    })

    const pixData = mpData.point_of_interaction?.transaction_data

    // Salva dados Pix no chamado
    await supabase
      .from('service_calls')
      .update({
        pix_payment_id: String(mpData.id),
        pix_qr_code: pixData?.qr_code_base64 ?? null,
        pix_copy_paste: pixData?.qr_code ?? null,
        payment_status: 'pending',
      })
      .eq('id', call_id)

    return NextResponse.json({ success: true, payment_id: mpData.id })
  } catch (error) {
    console.error('[API] /api/pix/create:', error)
    return NextResponse.json({ error: 'Erro ao gerar cobrança Pix' }, { status: 500 })
  }
}
