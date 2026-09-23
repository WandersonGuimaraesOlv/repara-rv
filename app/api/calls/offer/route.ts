import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'

// Oferta de chamado pendente do técnico logado (status 'searching' já
// apontado pra ele), pro alerta do app/painel. Achado J1 do plano de
// lançamento (23/09/2026): o painel lia a oferta direto de service_calls, e a
// política deixava o técnico ler a LINHA INTEIRA antes de aceitar — endereço
// e coordenadas do cliente chegavam ao celular dele (a tela só escondia; o
// Realtime mandava a linha completa). Agora o técnico só lê o chamado depois
// do aceite (migration 20260924_provider_reads_after_accept.sql) e a oferta
// vem daqui, só com o que o radar pode mostrar: serviço, bairro e valores.
export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabaseAdmin = await createServiceClient()
    const { data: offer, error } = await supabaseAdmin
      .from('service_calls')
      .select('id, status, service_id, total_price, provider_cut, platform_fee, neighborhood, created_at, service:quick_services(name)')
      .eq('provider_id', userId)
      .eq('status', 'searching')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[API /api/calls/offer] Erro ao buscar oferta:', error)
      return NextResponse.json({ error: 'Falha ao buscar oferta' }, { status: 500 })
    }

    return NextResponse.json({ offer: offer ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[API] /api/calls/offer:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
