import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PixWebhookPayload } from '@/lib/types'

/**
 * Webhook do Mercado Pago para confirmação de pagamento Pix.
 *
 * Para configurar:
 * 1. No painel do Mercado Pago, adicione a URL de notificação:
 *    https://seu-dominio.com/api/pix/webhook
 * 2. Configure MERCADOPAGO_WEBHOOK_SECRET no .env.local
 *
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body: PixWebhookPayload = await request.json()

    // Ignora eventos que não são de pagamento
    if (body.action !== 'payment.updated' && body.action !== 'payment.created') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 })
    }

    // Busca status do pagamento no Mercado Pago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      console.error('[Webhook] MERCADOPAGO_ACCESS_TOKEN não configurado')
      return NextResponse.json({ received: true })
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payment = await mpResponse.json()

    if (payment.status !== 'approved') {
      // Pagamento ainda não aprovado — aguarda próximo webhook
      return NextResponse.json({ received: true })
    }

    // Atualiza o chamado correspondente
    const supabase = await createServiceClient()

    const { data: call } = await supabase
      .from('service_calls')
      .select('id')
      .eq('pix_payment_id', String(paymentId))
      .single()

    if (!call) {
      console.warn('[Webhook] Chamado não encontrado para payment_id:', paymentId)
      return NextResponse.json({ received: true })
    }

    await supabase
      .from('service_calls')
      .update({
        payment_status: 'paid',
        completed_at: new Date().toISOString(),
      })
      .eq('id', call.id)

    console.log(`[Webhook] Pagamento confirmado para chamado ${call.id}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[API] /api/pix/webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
