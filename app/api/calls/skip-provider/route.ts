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
      .select('id, client_location, status, provider_id, cancel_metadata')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    if (call.status !== 'accepted' && call.status !== 'searching') {
      return NextResponse.json({ error: 'Chamado não pode ser reencaminhado neste status' }, { status: 400 })
    }

    // Histórico cumulativo de prestadores já tentados para evitar loop infinito
    const prevExclusions = (call.cancel_metadata as any)?.rejected_providers || []
    const excludedIds = Array.from(
      new Set([
        ...prevExclusions,
        call.provider_id,
        rejected_provider_id,
      ].filter(Boolean))
    )

    // Busca próximo prestador disponível no radar PostGIS
    const { data: nextProvider } = await supabase.rpc('find_nearest_provider', {
      call_location: call.client_location,
      excluded_ids: excludedIds,
    })

    const updatedMetadata = {
      ...(call.cancel_metadata || {}),
      rejected_providers: excludedIds,
    }

    if (!nextProvider) {
      // Sem mais prestadores disponíveis no momento: entra na fila prioritária!
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('service_calls')
        .update({
          status: 'queued',
          provider_id: null,
          expires_at: expiresAt,
          cancel_metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', call_id)

      // Notifica prestadores cadastrados da fila prioritária
      const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
      const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
        ? rawAppUrl
        : 'https://repararv.com'

      fetch(`${appUrl}/api/calls/notify-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id }),
      }).catch(err => console.warn('[API /api/calls/skip-provider] Falha ao invocar notify-queue:', err))

      return NextResponse.json({ status: 'queued' })
    }

    // Atribui ao próximo prestador no radar com status 'searching' para que ele receba a oferta
    await supabase
      .from('service_calls')
      .update({
        provider_id: nextProvider,
        status: 'searching',
        accepted_at: null,
        cancel_metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', call_id)

    return NextResponse.json({ status: 'searching', provider_id: nextProvider })
  } catch (error) {
    console.error('[API] /api/calls/skip-provider:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
