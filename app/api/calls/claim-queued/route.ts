import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const callId = body.callId || body.call_id;
    let providerId = body.providerId || body.provider_id;

    // Se providerId não for enviado no body, obtém do usuário autenticado na sessão
    if (!providerId) {
      const supabaseUser = await createClient();
      const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }));
      if (user) {
        providerId = user.id;
      }
    }

    if (!callId || !providerId) {
      return NextResponse.json({ error: 'Dados incompletos (callId e providerId são obrigatórios)' }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    // 1. Validar se o prestador tem Mercado Pago conectado e perfil ativo
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, mercado_pago_connected')
      .eq('id', providerId)
      .maybeSingle();

    if (providerError || !provider || provider.role !== 'provider') {
      return NextResponse.json({ error: 'Prestador não autorizado' }, { status: 403 });
    }

    // Verifica conexão Mercado Pago (em profiles ou em provider_status/gateway_accounts)
    const { data: status } = await supabaseAdmin
      .from('provider_status')
      .select('recipient_gateway_id, is_online')
      .eq('provider_id', providerId)
      .maybeSingle();

    const isMpConnected = Boolean(provider.mercado_pago_connected || status?.recipient_gateway_id);

    if (!isMpConnected) {
      return NextResponse.json(
        { error: 'Conecte sua conta do Mercado Pago para aceitar chamados' }, 
        { status: 412 }
      );
    }

    // 2. Executar atribuição atômica no PostgreSQL (Quem gravar primeiro, ganha)
    // Só atualiza se o status AINDA FOR 'queued'
    let updatedCall: any[] | null = null;
    const { data: rpcData, error: claimError } = await supabaseAdmin
      .rpc('claim_queued_call', {
        p_call_id: callId,
        p_provider_id: providerId,
      });

    if (!claimError && rpcData) {
      updatedCall = rpcData;
    } else {
      // Fallback para instrução SQL atômica direta via PostgREST
      const nowIso = new Date().toISOString();
      const { data: directData, error: directError } = await supabaseAdmin
        .from('service_calls')
        .update({
          provider_id: providerId,
          status: 'accepted',
          accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', callId)
        .eq('status', 'queued')
        .select();

      if (directError) {
        console.error('[claim-queued] Erro ao atualizar atomicamente chamado:', directError);
        return NextResponse.json({ error: directError.message }, { status: 500 });
      }
      updatedCall = directData;
    }

    // Se 0 linhas afetadas, outro técnico clicou 1 milissegundo antes
    if (!updatedCall || updatedCall.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'CALL_ALREADY_CLAIMED',
          message: 'Este chamado já foi assumido por outro profissional parceiro.',
          error: 'Este chamado já foi assumido por outro profissional parceiro.',
        },
        { status: 409 }
      );
    }

    const acceptedCall = updatedCall[0];

    // 3. Disparo assíncrono (fire-and-forget) para notificar o cliente via WhatsApp
    void (async () => {
      try {
        const { data: fullCall } = await supabaseAdmin
          .from('service_calls')
          .select('*, client:profiles!client_id(phone), service:quick_services(name)')
          .eq('id', callId)
          .single();

        const clientPhone = (fullCall?.client as { phone?: string })?.phone;
        const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com';
        const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
          ? rawAppUrl
          : 'https://repararv.com';

        const providerName = provider.full_name || 'Técnico Credenciado';
        const trackingUrl = `${appUrl}/acompanhar/${callId}`;
        const serviceName = (fullCall?.service as { name?: string })?.name || 'serviço';
        const clientMessage = `Boa notícia! O técnico ${providerName} aceitou seu chamado de ${serviceName} e já está se preparando para ir até você! 🚗⚡ Acompanhe em tempo real: ${trackingUrl}`;

        console.log(`📲 [WhatsApp Cliente] Notificação de aceite disparada para ${clientPhone}`);

        const webhookUrl = process.env.CLIENT_ALERT_WEBHOOK_URL || process.env.WHATSAPP_WEBHOOK_URL;
        if (webhookUrl && clientPhone) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'order_accepted_from_queue',
              call_id: callId,
              recipient_phone: clientPhone,
              message: clientMessage,
              provider_name: providerName,
              tracking_url: trackingUrl,
            }),
          });
        }
      } catch (whErr) {
        console.warn('[WhatsApp Cliente] Falha ao enviar notificação assíncrona:', whErr);
      }
    })();

    return NextResponse.json({ success: true, call: acceptedCall }, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/calls/claim-queued] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro ao processar aceite da fila' }, { status: 500 });
  }
}
