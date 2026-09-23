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

export function formatAge(updatedAt: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes === 1) return 'há 1 min'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? 'há 1 hora' : `há ${hours} horas`
}
