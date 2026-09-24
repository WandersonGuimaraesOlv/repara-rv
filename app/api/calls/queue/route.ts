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

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { canActAsProvider } from '@/lib/call-transitions'

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const adminDb = await createServiceClient()

    // Só quem atende chamado vê a fila (auditoria de 24/09/2026: bastava estar
    // logado — um cliente listava os chamados de todo mundo na fila).
    const { data: profile } = await adminDb
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (!profile || !canActAsProvider(profile.role)) {
      return NextResponse.json({ error: 'Acesso restrito a prestadores' }, { status: 403 })
    }

    // Só o que ainda dá pra assumir: mesma regra de claim_queued_call()
    // (expires_at nulo ou no futuro). Achado de 23/09/2026: chamados de fila
    // vencidos continuavam na lista, o "Atender" era recusado e o polling
    // trazia o card de volta a cada 4s.
    // Nem o chamado que a própria conta abriu como cliente (achado de
    // 24/09/2026): o banco recusa o aceite (chk_client_ne_provider), então
    // ele só aparecia pra dar erro no "Atender".
    const nowIso = new Date().toISOString()
    const { data: queuedCalls, error } = await adminDb
      .from('service_calls')
      .select('id, neighborhood, total_price, provider_cut, platform_fee, created_at, service:quick_services(id, name, category, icon, color)')
      .eq('status', 'queued')
      .neq('client_id', userId)
      .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
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
