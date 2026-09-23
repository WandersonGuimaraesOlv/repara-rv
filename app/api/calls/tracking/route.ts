import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { isTrackingStatus, parseGeoJsonPoint } from '@/lib/tracking'
import { distanceKm } from '@/lib/geocoding'
import { getRouteForCall } from '@/lib/directions'

// Posição do técnico para o mapa de acompanhamento (app/acompanhar e
// app/chamado). provider_status não é mais legível por clientes (migration
// 20260923_provider_status_private.sql) — esta rota entrega só a posição do
// técnico DESTE chamado, só para o cliente e o técnico dele, e só entre o
// aceite e o início do atendimento (lib/tracking.ts).
const trackingSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const parsed = trackingSchema.safeParse({ call_id: request.nextUrl.searchParams.get('call_id') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('client_id, provider_id, status, client_location')
      .eq('id', call_id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }
    if (call.client_id !== userId && call.provider_id !== userId) {
      return NextResponse.json({ error: 'Você não tem acesso a este chamado' }, { status: 403 })
    }

    const destination = parseGeoJsonPoint(call.client_location)

    const noStore = { 'Cache-Control': 'no-store' }

    if (!call.provider_id || !isTrackingStatus(call.status)) {
      return NextResponse.json({ status: call.status, destination, provider: null }, { headers: noStore })
    }

    const { data: providerStatus } = await supabaseAdmin
      .from('provider_status')
      .select('current_location, updated_at')
      .eq('provider_id', call.provider_id)
      .maybeSingle()

    const position = parseGeoJsonPoint(providerStatus?.current_location)
    const provider = position
      ? {
          ...position,
          updated_at: providerStatus?.updated_at ?? null,
          // em linha reta — quando não houver rota pelas ruas (route abaixo)
          distance_km: destination ? distanceKm(position, destination) : null,
        }
      : null

    // Rota pelas ruas + tempo estimado (Google Routes API, guardada por
    // chamado em call_route_cache — lib/directions.ts). null = sem rota.
    const route = position && destination
      ? await getRouteForCall(supabaseAdmin, call_id, position, destination, providerStatus?.updated_at ?? null, new Date())
      : null

    return NextResponse.json({ status: call.status, destination, provider, route }, { headers: noStore })
  } catch (error) {
    console.error('[API] /api/calls/tracking:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
