import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const { call_id, rejected_provider_id } = await request.json()

    if (!call_id) {
      return NextResponse.json({ error: 'call_id obrigatório' }, { status: 400 })
    }

    // Busca o chamado atual
    const { data: call } = await supabase
      .from('service_calls')
      .select('client_location, status')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    if (call.status !== 'accepted' && call.status !== 'searching') {
      return NextResponse.json({ error: 'Chamado não pode ser reencaminhado neste status' }, { status: 400 })
    }

    // Busca prestadores já tentados (excluindo o que recusou)
    const { data: existingExclusions } = await supabase
      .from('service_calls')
      .select('provider_id')
      .eq('id', call_id)

    const excludedIds = [
      ...(existingExclusions?.map(e => e.provider_id).filter(Boolean) ?? []),
      rejected_provider_id,
    ].filter(Boolean)

    // Busca próximo prestador disponível
    const { data: nextProvider } = await supabase.rpc('find_nearest_provider', {
      call_location: call.client_location,
      excluded_ids: excludedIds,
    })

    if (!nextProvider) {
      // Sem mais prestadores disponíveis
      await supabase
        .from('service_calls')
        .update({ status: 'no_providers_available', provider_id: null })
        .eq('id', call_id)

      return NextResponse.json({ status: 'no_providers_available' })
    }

    // Atribui ao próximo prestador
    await supabase
      .from('service_calls')
      .update({
        provider_id: nextProvider,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', call_id)

    return NextResponse.json({ status: 'accepted', provider_id: nextProvider })
  } catch (error) {
    console.error('[API] /api/calls/skip-provider:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
