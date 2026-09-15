// =============================================================================
// app/api/cron/stale-calls-radar/route.ts
// Detecta chamados em fila sem aceite há mais de 5 minutos.
// Chamada a cada 60s pelo workers/cron-monitor.ts via fetch interno.
// Autenticada por CRON_SECRET_TOKEN.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const STALE_THRESHOLD_MINUTES = 5;
// Cron roda a cada 60s (ver workers/cron-monitor.ts) — usado só pra decidir
// quais chamados "acabaram de cruzar" o limiar de estagnação nesta rodada,
// evitando reenviar o alerta de WhatsApp a cada tick enquanto o mesmo
// chamado continua parado.
const CRON_TICK_SECONDS = 60;

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

  // Alerta ativo pro time (achado de 14/09/2026: até aqui só existia o log —
  // "Transformar o log do cron-monitor em alerta ativo" era item pendente do
  // plano de validação). Só dispara pros chamados que ACABARAM de cruzar os 5
  // minutos nesta rodada (janela do tamanho de 1 tick do cron), pra não
  // reenviar a cada 60s enquanto o mesmo chamado continua parado.
  const justCrossedThreshold = enriched.filter(
    (call) => call.minutes_waiting >= STALE_THRESHOLD_MINUTES &&
      call.minutes_waiting < STALE_THRESHOLD_MINUTES + Math.ceil(CRON_TICK_SECONDS / 60) + 1
  );

  if (justCrossedThreshold.length > 0) {
    const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL || process.env.EMERGENCY_WEBHOOK_URL;
    if (webhookUrl) {
      const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com';
      const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
        ? rawAppUrl
        : 'https://repararv.com';

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
    } else {
      console.warn('[stale-calls-radar] Fila estagnada detectada mas OPS_ALERT_WEBHOOK_URL/EMERGENCY_WEBHOOK_URL não configurado — alerta não disparado.');
    }
  }

  return NextResponse.json(
    {
      success:    true,
      stale_count: enriched.length,
      calls:       enriched,
      alert_sent:  justCrossedThreshold.length > 0,
      checked_at:  new Date().toISOString(),
    },
    { status: 200 }
  );
}
