// =============================================================================
// lib/tracking.ts
// Acompanhamento do técnico no mapa (app/api/calls/tracking): regras puras,
// sem rede — quando a posição do técnico pode ser mostrada e se ela está
// recente o bastante pra ser chamada de "ao vivo".
// =============================================================================

import type { Coordinates } from '@/lib/geocoding'

// Só entre o aceite e o início do atendimento. Depois do PIN o técnico já
// está na casa do cliente; antes do aceite não existe técnico designado.
export const TRACKING_STATUSES = ['accepted', 'on_the_way'] as const

export function isTrackingStatus(status: string): boolean {
  return (TRACKING_STATUSES as readonly string[]).includes(status)
}

// O navegador do técnico manda a posição a cada ~15 s com o app aberto.
// Quando ele troca pro Waze/Google Maps o app vai pra segundo plano e para
// de mandar — a partir daqui a tela mostra "última posição há X min".
export const TRACKING_STALE_AFTER_MS = 2 * 60_000

export function isPositionStale(updatedAt: string | null, now: Date): boolean {
  if (!updatedAt) return true
  return now.getTime() - new Date(updatedAt).getTime() > TRACKING_STALE_AFTER_MS
}

// PostgREST devolve colunas geography como GeoJSON: { type, coordinates: [lng, lat] }.
export function parseGeoJsonPoint(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object') return null
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown }
  if (type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) return null
  const [lng, lat] = coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

// ── Rota pelas ruas (Google Routes API, lib/directions.ts) ───────────────────

export interface CachedRoute {
  origin_lat: number
  origin_lng: number
  encoded_polyline: string | null
  duration_seconds: number | null
  distance_meters: number | null
  computed_at: string
}

// Cada cálculo é cobrado pelo Google: recalcula só quando vale a pena.
export const ROUTE_MAX_AGE_MS = 3 * 60_000
export const ROUTE_MIN_INTERVAL_MS = 60_000
export const ROUTE_MOVED_METERS = 300
export const ROUTE_RETRY_AFTER_FAILURE_MS = 5 * 60_000

export function shouldRecomputeRoute(cache: CachedRoute | null, movedMeters: number, now: Date): boolean {
  if (!cache) return true
  const ageMs = now.getTime() - new Date(cache.computed_at).getTime()
  if (!cache.encoded_polyline) return ageMs >= ROUTE_RETRY_AFTER_FAILURE_MS
  if (ageMs >= ROUTE_MAX_AGE_MS) return true
  return ageMs >= ROUTE_MIN_INTERVAL_MS && movedMeters >= ROUTE_MOVED_METERS
}

// Routes API devolve a duração como "342s".
export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value)
  return match ? Math.round(Number(match[1])) : null
}

// Minutos que faltam: a duração da rota menos o tempo desde que ela foi
// calculada (o técnico continuou andando). Nunca menos de 1.
export function remainingMinutes(durationSeconds: number, computedAt: string, now: Date): number {
  const elapsed = (now.getTime() - new Date(computedAt).getTime()) / 1000
  return Math.max(1, Math.ceil((durationSeconds - elapsed) / 60))
}

// Algoritmo de polilinha codificada do Google (precisão 5).
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20 && index < encoded.length)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

export function formatAge(updatedAt: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes === 1) return 'há 1 min'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? 'há 1 hora' : `há ${hours} horas`
}
