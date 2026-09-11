import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient()
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login primeiro.' }, { status: 401 })
    }

    const { call_id } = await request.json()
    if (!call_id) {
      return NextResponse.json({ error: 'call_id é obrigatório' }, { status: 400 })
    }

    const supabaseAdmin = await createServiceClient()

    // 1. Verifica se o prestador tem Mercado Pago conectado e está online
    const { data: status } = await supabaseAdmin
      .from('provider_status')
      .select('is_online, recipient_gateway_id')
      .eq('provider_id', user.id)
      .maybeSingle()

    if (!status?.recipient_gateway_id) {
      return NextResponse.json(
        { error: 'Para aceitar chamados e receber seus repasses automáticos via Pix, conecte sua conta do Mercado Pago no painel.' },
        { status: 403 }
      )
    }

    // 2. Busca perfil do prestador
    const { data: providerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()

    // 3. Assunção atômica: garante que o chamado ainda está em 'queued'
    const { data: updatedCall, error: updateErr } = await supabaseAdmin
      .from('service_calls')
      .update({
        provider_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', call_id)
      .eq('status', 'queued')
      .select('*, client:profiles!client_id(full_name, phone), service:quick_services(name)')
      .maybeSingle()

    if (updateErr || !updatedCall) {
      return NextResponse.json(
        { error: 'Este chamado já foi assumido por outro profissional ou não está mais disponível na fila.' },
        { status: 409 }
      )
    }

    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
      ? rawAppUrl
      : 'https://repararv.com'

    // 4. Dispara notificação de confirmação para o WhatsApp do cliente
    const clientPhone = (updatedCall.client as { phone?: string })?.phone
    const providerName = providerProfile?.full_name || 'Técnico Credenciado'
    const trackingUrl = `${appUrl}/acompanhar/${call_id}`

    const clientMessage = `Boa notícia! O técnico ${providerName} aceitou seu chamado de ${(updatedCall.service as { name?: string })?.name || 'serviço'} e já está se preparando para ir até você! 🚗⚡ Acompanhe o deslocamento em tempo real: ${trackingUrl}`

    console.log(`📲 [WhatsApp Cliente] Notificação de aceite disparada para ${clientPhone}: ${clientMessage}`)

    const webhookUrl = process.env.CLIENT_ALERT_WEBHOOK_URL || process.env.WHATSAPP_WEBHOOK_URL
    if (webhookUrl && clientPhone) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'order_accepted_from_queue',
            call_id,
            recipient_phone: clientPhone,
            message: clientMessage,
            provider_name: providerName,
            tracking_url: trackingUrl,
          }),
        })
      } catch (clientWhErr) {
        console.warn('[WhatsApp Cliente] Falha ao enviar webhook:', clientWhErr)
      }
    }

    return NextResponse.json({
      success: true,
      call_id,
      status: 'accepted',
      message: 'Chamado da fila assumido com sucesso!',
    })
  } catch (err: any) {
    console.error('[API /api/calls/claim-queued] Erro interno:', err)
    return NextResponse.json({ error: 'Erro ao assumir chamado da fila.' }, { status: 500 })
  }
}
