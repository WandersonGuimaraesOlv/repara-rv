// =============================================================================
// lib/directions.ts
// Rota de carro entre o técnico e o cliente (Google Routes API, computeRoutes).
// Só no servidor: a chave (GOOGLE_MAPS_API_KEY) é secret do Worker, a mesma
// da busca de endereço (lib/geocoding.ts). Só fetch() nativo.
//
// Sem routingPreference = TRAFFIC_UNAWARE, o SKU "Compute Routes Essentials"
// (10.000 grátis/mês na tabela do Google em 23/09/2026). TRAFFIC_AWARE daria
// o tempo com trânsito ao vivo, mas cai no SKU Pro (5.000 grátis/mês, o dobro
// do preço) — em Rio Verde a diferença no tempo estimado é pequena.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { distanceKm, type Coordinates } from '@/lib/geocoding'
import { isPositionStale, parseDurationSeconds, shouldRecomputeRoute, type CachedRoute } from '@/lib/tracking'

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const TIMEOUT_MS = 6_000

export interface DrivingRoute {
  encodedPolyline: string
  durationSeconds: number
  distanceMeters: number
}

// Nunca lança: sem rota, o mapa continua com a distância em linha reta.
export async function computeDrivingRoute(
  origin: Coordinates,
  destination: Coordinates,
  apiKey: string | undefined
): Promise<DrivingRoute | null> {
  if (!apiKey) return null
  try {
    const res = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: 'DRIVE',
        languageCode: 'pt-BR',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.warn('[directions] Routes API recusou:', res.status, (body as { error?: { status?: string } }).error?.status)
      return null
    }
    const data = (await res.json()) as {
      routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[]
    }
    const route = data.routes?.[0]
    const durationSeconds = parseDurationSeconds(route?.duration)
    const encodedPolyline = route?.polyline?.encodedPolyline
    if (!route || durationSeconds === null || !encodedPolyline || typeof route.distanceMeters !== 'number') {
      return null
    }
    return { encodedPolyline, durationSeconds, distanceMeters: route.distanceMeters }
  } catch (error) {
    console.warn('[directions] Falha ao calcular rota:', error)
    return null
  }
}

export interface RouteView {
  encoded_polyline: string
  duration_seconds: number
  distance_meters: number
  computed_at: string
}

const CACHE_COLUMNS = 'origin_lat, origin_lng, encoded_polyline, duration_seconds, distance_meters, computed_at'

function toView(row: CachedRoute | null): RouteView | null {
  if (!row?.encoded_polyline || row.duration_seconds === null || row.distance_meters === null) return null
  return {
    encoded_polyline: row.encoded_polyline,
    duration_seconds: row.duration_seconds,
    distance_meters: row.distance_meters,
    computed_at: row.computed_at,
  }
}

// Rota do chamado pra /api/calls/tracking: devolve a guardada em
// call_route_cache e só pede uma nova ao Google quando
// shouldRecomputeRoute manda. Quem "reserva" a vez (UPDATE/INSERT
// condicional em computed_at) é o único que chama o Google — cliente e
// técnico olhando ao mesmo tempo não pagam duas vezes. Com a posição do
// técnico parada (app em segundo plano) não recalcula.
export async function getRouteForCall(
  supabaseAdmin: SupabaseClient,
  callId: string,
  origin: Coordinates,
  destination: Coordinates,
  originUpdatedAt: string | null,
  now: Date
): Promise<RouteView | null> {
  const { data: cache, error } = await supabaseAdmin
    .from('call_route_cache')
    .select(CACHE_COLUMNS)
    .eq('call_id', callId)
    .maybeSingle<CachedRoute>()
  if (error) {
    // Sem a tabela não há controle de custo: não chama o Google.
    console.error('[directions] Erro ao ler call_route_cache:', error)
    return null
  }

  const movedMeters = cache ? distanceKm(origin, { lat: cache.origin_lat, lng: cache.origin_lng }) * 1000 : Infinity
  if (isPositionStale(originUpdatedAt, now) || !shouldRecomputeRoute(cache, movedMeters, now)) {
    return toView(cache)
  }

  const nowIso = now.toISOString()
  const claim = cache
    ? supabaseAdmin
        .from('call_route_cache')
        .update({ computed_at: nowIso })
        .eq('call_id', callId)
        .eq('computed_at', cache.computed_at)
        .select('call_id')
    : supabaseAdmin
        .from('call_route_cache')
        .upsert(
          { call_id: callId, origin_lat: origin.lat, origin_lng: origin.lng, computed_at: nowIso },
          { onConflict: 'call_id', ignoreDuplicates: true }
        )
        .select('call_id')
  const { data: claimed } = await claim
  if (!claimed || claimed.length === 0) {
    return toView(cache)
  }

  const fresh = await computeDrivingRoute(origin, destination, process.env.GOOGLE_MAPS_API_KEY)
  if (!fresh) {
    // Mantém a rota anterior (se havia); computed_at já avançou, então a
    // próxima tentativa respeita o intervalo.
    return toView(cache)
  }

  const row: CachedRoute = {
    origin_lat: origin.lat,
    origin_lng: origin.lng,
    encoded_polyline: fresh.encodedPolyline,
    duration_seconds: fresh.durationSeconds,
    distance_meters: fresh.distanceMeters,
    computed_at: nowIso,
  }
  const { error: saveError } = await supabaseAdmin.from('call_route_cache').update(row).eq('call_id', callId)
  if (saveError) console.error('[directions] Erro ao gravar rota:', saveError)
  return toView(row)
}
