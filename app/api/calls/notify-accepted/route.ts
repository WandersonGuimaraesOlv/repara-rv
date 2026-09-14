import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

const notifyAcceptedSchema = z.object({
  call_id:     z.string().uuid('call_id inválido'),
  provider_id: z.string().uuid('provider_id inválido').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = notifyAcceptedSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 });
    }

    const { call_id, provider_id } = parsed.data;

    const supabaseAdmin = await createServiceClient();

    // 1. Busca dados do chamado, cliente e prestador
    const { data: call, error: callErr } = await supabaseAdmin
      .from('service_calls')
      .select('*, client:profiles!client_id(phone, full_name), provider:profiles!provider_id(full_name)')
      .eq('id', call_id)
      .single();

    if (callErr || !call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
    }

    const clientPhone = (call.client as { phone?: string })?.phone;
    let providerName = (call.provider as { full_name?: string })?.full_name;

    if (!providerName && provider_id) {
      const { data: provData } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', provider_id)
        .maybeSingle();
      if (provData?.full_name) providerName = provData.full_name;
    }

    const resolvedProviderName = providerName || 'Profissional Parceiro';
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com';
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
      ? rawAppUrl
      : 'https://repararv.com';

    const trackingUrl = `${appUrl}/acompanhar/${call_id}`;
    const clientMessage = `Tudo certo! O técnico ${resolvedProviderName} acabou de assumir seu chamado e já está a caminho do seu endereço. Acompanhe a chegada por aqui: ${trackingUrl}`;

    console.log(`📲 [WhatsApp Morador] Disparando aviso de técnico a caminho para ${clientPhone}`);

    // Dispara via Webhook / Evolution API / Z-API
    const webhookUrl = process.env.CLIENT_ALERT_WEBHOOK_URL || process.env.WHATSAPP_WEBHOOK_URL;
    if (webhookUrl && clientPhone) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'order_accepted',
            call_id,
            recipient_phone: clientPhone,
            message: clientMessage,
            provider_name: resolvedProviderName,
            tracking_url: trackingUrl,
          }),
        });
      } catch (err) {
        console.warn('[WhatsApp Morador] Erro ao chamar gateway:', err);
      }
    }

    return NextResponse.json({ success: true, message: clientMessage });
  } catch (err: any) {
    console.error('[API /api/calls/notify-accepted] Erro interno:', err);
    return NextResponse.json({ error: 'Erro ao notificar morador' }, { status: 500 });
  }
}
