import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestUserId } from '@/lib/supabase/request-user';
import { canActAsProvider } from '@/lib/call-transitions';
import { generateArrivalPin } from '@/lib/utils';

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
    const bodyProviderId = body.providerId || body.provider_id;

    // Achado de segurança (16/09/2026): quando o body trazia providerId, a
    // rota nunca checava sessão nenhuma — qualquer chamador (autenticado
    // como outra pessoa, ou sem sessão nenhuma) podia forçar a atribuição de
    // um chamado da fila a QUALQUER prestador só sabendo o UUID dele, sem o
    // consentimento/sessão do prestador de verdade. providerId agora vem
    // exclusivamente da sessão autenticada; se o body mandar um valor
    // diferente, rejeita — o único chamador legítimo (app/painel/page.tsx,
    // handleClaimQueued) sempre manda o próprio profile.id, então isso nunca
    // deveria divergir numa requisição de verdade.
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (bodyProviderId && bodyProviderId !== userId) {
      return NextResponse.json({ error: 'providerId não corresponde à sessão autenticada' }, { status: 403 });
    }
    const providerId = userId;

    if (!callId || !providerId) {
      return NextResponse.json({ error: 'Dados incompletos (callId e providerId são obrigatórios)' }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    // 1. Validar se o prestador tem perfil ativo e não está bloqueado
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, is_blocked, background_check_status, mercado_pago_connected')
      .eq('id', providerId)
      .maybeSingle();

    if (providerError || !provider || !canActAsProvider(provider.role)) {
      return NextResponse.json({ error: 'Prestador não autorizado' }, { status: 403 });
    }

    // A trava de cadastro em análise só existia na tela (app/painel) — pela
    // rota direta, um prestador ainda não aprovado assumia chamado da fila.
    if (provider.background_check_status !== 'approved') {
      return NextResponse.json(
        { error: 'Seu cadastro ainda está em análise de segurança — não é possível assumir chamados agora.' },
        { status: 403 }
      );
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

    // 2.1 PIN de chegada — em call_arrival_pins, que só o cliente lê (ver
    // app/api/calls/verify-arrival-pin). Não volta na resposta: quem chama
    // esta rota é o prestador, e ele tem que pedir o PIN ao cliente. Se esta
    // gravação falhar, verify-arrival-pin gera o PIN na hora de iniciar.
    const { error: pinError } = await supabaseAdmin
      .from('call_arrival_pins')
      .upsert({ call_id: callId, pin: generateArrivalPin(), failed_attempts: 0, locked_until: null }, { onConflict: 'call_id' });
    if (pinError) {
      console.error('[claim-queued] Erro ao gravar PIN de chegada:', pinError);
    }
    delete acceptedCall.arrival_pin;

    return NextResponse.json({ success: true, call: acceptedCall }, { status: 200 });
  } catch (err: any) {
    console.error('[API /api/calls/claim-queued] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro ao processar aceite da fila' }, { status: 500 });
  }
}
