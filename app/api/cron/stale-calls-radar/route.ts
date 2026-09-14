// =============================================================================
// app/api/cron/stale-calls-radar/route.ts
// Detecta chamados em fila sem aceite há mais de 5 minutos.
// Chamada a cada 60s pelo workers/cron-monitor.ts via fetch interno.
// Autenticada por CRON_SECRET_TOKEN.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const STALE_THRESHOLD_MINUTES = 5;

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

  const supabase = await createClient();

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

  return NextResponse.json(
    {
      success:    true,
      stale_count: enriched.length,
      calls:       enriched,
      checked_at:  new Date().toISOString(),
    },
    { status: 200 }
  );
}
