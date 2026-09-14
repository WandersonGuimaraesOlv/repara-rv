import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Aceita os dois formatos de chave (camelCase e snake_case) que já circulam
// entre os chamadores existentes desta rota.
const claimQueuedSchema = z.object({
  callId:      z.string().uuid('callId inválido').optional(),
  call_id:     z.string().uuid('call_id inválido').optional(),
  providerId:  z.string().uuid('providerId inválido').optional(),
  provider_id: z.string().uuid('provider_id inválido').optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = claimQueuedSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 });
    }

    const body = parsed.data;
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

    // 1. Validar se o prestador tem perfil ativo e não está bloqueado
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, is_blocked, mercado_pago_connected')
      .eq('id', providerId)
      .maybeSingle();

    if (providerError || !provider || provider.role !== 'provider') {
      return NextResponse.json({ error: 'Prestador não autorizado' }, { status: 403 });
    }

    // 1.1 Verifica se o prestador está suspenso ou sem Chave Pix
    const { data: status } = await supabaseAdmin
      .from('provider_status')
      .select('pix_key, is_online')
      .eq('provider_id', providerId)
      .maybeSingle();

    if (provider.is_blocked) {
      return NextResponse.json(
        { error: 'Sua conta de prestador está suspensa temporariamente.' }, 
        { status: 403 }
      );
    }

    const hasPix = Boolean(status?.pix_key && status.pix_key.trim().length > 0) || Boolean(provider.phone && provider.phone.trim().length > 0);
    if (!hasPix) {
      return NextResponse.json(
        { error: 'Cadastre sua Chave Pix no painel para aceitar chamados.' }, 
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
        const clientMessage = `Tudo certo! O técnico ${providerName} acabou de assumir seu chamado e já está a caminho do seu endereço. Acompanhe a chegada por aqui: ${trackingUrl}`;

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
