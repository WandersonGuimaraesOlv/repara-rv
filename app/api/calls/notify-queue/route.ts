import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const notifyQueueSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
})

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = notifyQueueSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id } = parsed.data

    const supabase = await createServiceClient()

    // 1. Busca os detalhes do chamado em fila
    const { data: call, error: callErr } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(name, category), client:profiles!client_id(full_name, phone)')
      .eq('id', call_id)
      .single()

    if (callErr || !call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    // 2. Busca prestadores cadastrados (especialmente os que possuem subconta vinculada)
    const { data: providers } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'provider')

    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
      ? rawAppUrl
      : 'https://repararv.com'

    const serviceName = (call.service as { name?: string })?.name || 'Serviço Residencial'
    const neighborhood = call.neighborhood || 'Setor Central'
    const totalFormatted = `R$ ${Number(call.total_price || 0).toFixed(2).replace('.', ',')}`
    const providerCutFormatted = `R$ ${Number(call.provider_cut || 0).toFixed(2).replace('.', ',')}`

    const notificationPayloads = (providers || []).map(prov => {
      const firstName = prov.full_name?.split(' ')[0] || 'Profissional'
      const claimUrl = `${appUrl}/painel?claim=${call_id}`
      const message = `Fala, ${firstName}! ⚡ Tem um cliente aguardando atendimento para ${serviceName} no ${neighborhood} (Ganhos líquidos: ${providerCutFormatted} de ${totalFormatted}). Clique no link para aceitar agora: ${claimUrl}`
      return {
        provider_id: prov.id,
        provider_name: prov.full_name,
        provider_phone: prov.phone,
        claim_url: claimUrl,
        message,
      }
    })

    console.log(`📢 [Fila Prioritária] Alerta gerado para ${notificationPayloads.length} prestadores em Rio Verde referente ao chamado #${call_id.slice(0, 8)}`)

    // 3. Dispara webhook de envio para gateway WhatsApp (se configurado)
    const webhookUrl = process.env.PROVIDER_ALERT_WEBHOOK_URL || process.env.WHATSAPP_WEBHOOK_URL
    if (webhookUrl && notificationPayloads.length > 0) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'order_queued',
            call_id,
            service_name: serviceName,
            neighborhood,
            total_price: call.total_price,
            provider_cut: call.provider_cut,
            recipients: notificationPayloads,
            created_at: new Date().toISOString(),
          }),
        })
      } catch (webhookErr) {
        console.warn('[Fila Prioritária] Webhook de alerta WhatsApp falhou ao disparar:', webhookErr)
      }
    }

    return NextResponse.json({
      success: true,
      call_id,
      notified_count: notificationPayloads.length,
      sample_message: notificationPayloads[0]?.message || null,
    })
  } catch (err: any) {
    console.error('[API /api/calls/notify-queue] Erro interno:', err)
    return NextResponse.json({ error: 'Erro ao notificar prestadores da fila' }, { status: 500 })
  }
}
