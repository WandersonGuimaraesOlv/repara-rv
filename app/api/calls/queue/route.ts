// =============================================================================
// app/api/calls/queue/route.ts
// Lista chamados na fila prioritária (status='queued') pro painel do prestador.
//
// Achado de 14/09/2026: não existe (e nunca existiu) nenhuma política de RLS
// cobrindo leitura de service_calls com status='queued' — só 'searching' (e
// mesmo essa, sem guarda de autenticação, corrigida separadamente). Isso
// significa que app/painel/page.tsx, ao consultar a tabela direto com a
// chave anon do navegador, sempre recebia 0 linhas: a seção "Fila Prioritária
// — Ao vivo" nunca funcionou em produção pra nenhum prestador.
//
// Em vez de criar uma política/view nova no banco (fora do acesso desta
// sessão — só o dono do projeto mexe em RLS), esta rota usa a Service Role
// Key no servidor e devolve só os campos SEM risco de privacidade —
// NUNCA client_address nem client_location, seguindo a mesma regra de
// mascaramento pré-aceite do AGENTS.md já aplicada no card de alerta de
// app/painel/page.tsx.
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const adminDb = await createServiceClient()

    const { data: queuedCalls, error } = await adminDb
      .from('service_calls')
      .select('id, neighborhood, total_price, provider_cut, platform_fee, created_at, service:quick_services(id, name, category, icon, color)')
      .eq('status', 'queued')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[API /api/calls/queue] Erro ao buscar fila:', error)
      return NextResponse.json({ error: 'Falha ao buscar fila de chamados' }, { status: 500 })
    }

    return NextResponse.json({ calls: queuedCalls ?? [] })
  } catch (error) {
    console.error('[API] /api/calls/queue:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
