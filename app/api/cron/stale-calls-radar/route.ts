// =============================================================================
// app/api/cron/stale-calls-radar/route.ts
// Detecta chamados em fila sem aceite há mais de 5 minutos e encerra
// ('expired') os que passaram das 2h da fila.
// Chamada a cada 60s pelo handler `scheduled` de custom-worker.ts (Cron Trigger
// do Cloudflare). Autenticada por CRON_SECRET_TOKEN.
// Alerta o time por e-mail (OPS_ALERT_EMAIL, via Resend) e, se configurado, por
// webhook genérico (OPS_ALERT_WEBHOOK_URL / EMERGENCY_WEBHOOK_URL).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  sendEmail,
  selectJustCrossed,
  buildStaleQueueEmail,
  STALE_THRESHOLD_SECONDS,
} from '@/modules/notifications';

const STALE_THRESHOLD_MINUTES = STALE_THRESHOLD_SECONDS / 60;

export interface StaleCall {
  id:              string;
  neighborhood:    string | null;
  provider_cut:    number;
  created_at:      string;
  minutes_waiting: number;
  service_id:      string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Autenticação por token secreto
  const authHeader = req.headers.get('Authorization');
  const cronToken  = process.env.CRON_SECRET_TOKEN;

  if (!cronToken || authHeader !== `Bearer ${cronToken}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Achado de segurança/monitoramento (14/09/2026): esta rota usava
  // createClient() (chave anon, sujeita a RLS) — mas é uma chamada
  // servidor-a-servidor autenticada por token, sem sessão/cookie de usuário
  // nenhum. Como nunca existiu política de RLS cobrindo leitura de
  // service_calls com status='queued' (mesmo achado da fila do painel, ver
  // Camada 4), esta consulta SEMPRE retornava 0 linhas — o radar de fila
  // estagnada nunca detectou nada de verdade, desde sempre. Corrigido usando
  // Service Role, que é o padrão correto pra uma rota interna de cron.
  const supabase = await createServiceClient();

  // Chamado que passou das 2h da fila sem técnico vira 'expired' (item C5,
  // 24/09/2026): até aqui nada mudava o status — ficava 'queued' pra sempre e
  // o cliente esperava na tela sem aviso. Só o que AINDA está 'queued'; depois
  // do prazo claim_queued_call já recusa o aceite, então não há disputa com
  // um técnico assumindo no mesmo instante. Falha aqui não derruba o radar.
  const nowIso = new Date().toISOString();
  const { data: expiredCalls, error: expireError } = await supabase
    .from('service_calls')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('status', 'queued')
    .lte('expires_at', nowIso)
    .select('id');

  if (expireError) {
    console.error('[stale-calls-radar] falha ao expirar chamados vencidos:', expireError.message);
  }

  // Busca chamados em queued há mais de 5 minutos e que não expiraram
  const { data: staleCalls, error } = await supabase
    .from('service_calls')
    .select('id, neighborhood, provider_cut, created_at, service_id')
    .eq('status', 'queued')
    .lt('created_at', new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString())
    .gt('expires_at', new Date().toISOString()) // Ainda dentro do TTL de 2h
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[stale-calls-radar] query error:', error.message);
    return NextResponse.json({ error: 'Falha ao consultar chamados' }, { status: 500 });
  }

  const enriched: StaleCall[] = (staleCalls ?? []).map((call) => ({
    id:              call.id,
    neighborhood:    call.neighborhood,
    provider_cut:    Number(call.provider_cut),
    created_at:      call.created_at,
    service_id:      call.service_id,
    minutes_waiting: Math.floor(
      (Date.now() - new Date(call.created_at).getTime()) / 60000
    ),
  }));

  // Alerta ativo pro time (achado de 14/09/2026: até aqui só existia o log).
  // Só dispara pros chamados que ACABARAM de cruzar os 5 minutos nesta rodada
  // (janela do tamanho de 1 tick do cron, ver stale-queue-alert.ts), pra não
  // reenviar a cada 60s enquanto o mesmo chamado continua parado.
  const justCrossedThreshold = selectJustCrossed(enriched, Date.now());

  if (justCrossedThreshold.length > 0) {
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com';
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
      ? rawAppUrl
      : 'https://repararv.com';

    const opsEmail = process.env.OPS_ALERT_EMAIL?.trim();
    if (opsEmail) {
      const { subject, html } = buildStaleQueueEmail(justCrossedThreshold, appUrl);
      const emailResult = await sendEmail({ to: opsEmail, subject, html }, process.env.RESEND_API_KEY);
      if (!emailResult.success) {
        console.error('[stale-calls-radar] Falha ao enviar e-mail de fila estagnada:', emailResult.error);
      }
    }

    const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL || process.env.EMERGENCY_WEBHOOK_URL;
    if (webhookUrl) {
      const lines = justCrossedThreshold.map(
        (c) => `• ${c.neighborhood ?? 'Bairro não informado'} — R$ ${c.provider_cut.toFixed(2)} — ${c.minutes_waiting} min parado`
      );
      const message = [
        `⏱️ *Fila estagnada — Repara RV*`,
        `${justCrossedThreshold.length} chamado(s) sem prestador há mais de ${STALE_THRESHOLD_MINUTES} minutos:`,
        ...lines,
        ``,
        `Painel: ${appUrl}/admin/dashboard`,
      ].join('\n');

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'stale_queue_alert',
            stale_count: justCrossedThreshold.length,
            calls: justCrossedThreshold,
            message,
          }),
        });
      } catch (webhookErr) {
        console.error('[stale-calls-radar] Falha ao disparar alerta de fila estagnada:', webhookErr);
      }
    }

    if (!opsEmail && !webhookUrl) {
      console.warn('[stale-calls-radar] Fila estagnada detectada mas nem OPS_ALERT_EMAIL nem OPS_ALERT_WEBHOOK_URL/EMERGENCY_WEBHOOK_URL estão configurados — alerta não disparado.');
    }
  }

  return NextResponse.json(
    {
      success:    true,
      stale_count: enriched.length,
      calls:       enriched,
      alert_sent:  justCrossedThreshold.length > 0,
      expired_count: expiredCalls?.length ?? 0,
      checked_at:  new Date().toISOString(),
    },
    { status: 200 }
  );
}
