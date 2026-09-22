// =============================================================================
// lib/geocoding.ts
// Transforma o endereço digitado pelo cliente em coordenadas (Google Geocoding
// API, chamada só do servidor) e decide qual localização vale para o chamado.
//
// Por que existe: até 22/09/2026 o chamado usava o GPS do celular do cliente e,
// se o GPS estivesse negado, um ponto fixo no centro de Rio Verde
// (-17.7915, -50.9192). A navegação do prestador usa essas coordenadas, então
// quem negava o GPS mandava o prestador pro lugar errado. E mesmo com GPS, o que
// importa é o endereço do SERVIÇO, não onde o cliente está agora (ele pode estar
// no trabalho pedindo o serviço da casa).
//
// Só usa fetch() nativo (Cloudflare Workers). A chave (GOOGLE_MAPS_API_KEY) é
// secret do Worker e nunca vai pro navegador nem pro log.
// =============================================================================

import { z } from 'zod'

// Centro de Rio Verde (o mesmo ponto que o app usava como padrão) e o raio em
// que um chamado é aceito. find_nearest_provider já limita o casamento a 25 km;
// 50 km cobre a zona rural do entorno e barra endereço de outra cidade.
export const RIO_VERDE_CENTER = { lat: -17.7915, lng: -50.9192 } as const
export const SERVICE_AREA_RADIUS_KM = 50

export interface Coordinates {
  lat: number
  lng: number
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function isInsideServiceArea(point: Coordinates): boolean {
  return distanceKm(point, RIO_VERDE_CENTER) <= SERVICE_AREA_RADIUS_KM
}

export type LocationType = 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE'

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; locationType: LocationType; partialMatch: boolean; formatted: string }
  | { ok: false; reason: 'not_found' | 'denied' | 'unavailable' | 'timeout' }

const googleResponseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z.object({
        formatted_address: z.string().optional(),
        partial_match: z.boolean().optional(),
        geometry: z.object({
          location: z.object({ lat: z.number(), lng: z.number() }),
          location_type: z.enum(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE']),
        }),
      }),
    )
    .optional(),
})

export interface AddressParts {
  street: string
  number: string
  neighborhood: string
}

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const TIMEOUT_MS = 4000

export async function geocodeAddress(
  parts: AddressParts,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeResult> {
  // Só rua, número e bairro: o "ponto de referência" é texto livre ("perto do
  // mercado…") e atrapalha a busca.
  const address = `${parts.street}, ${parts.number} - ${parts.neighborhood}, Rio Verde - GO, Brasil`
  const url = new URL(GEOCODE_URL)
  url.searchParams.set('address', address)
  url.searchParams.set('components', 'country:BR|administrative_area:GO|locality:Rio Verde')
  url.searchParams.set('region', 'br')
  url.searchParams.set('language', 'pt-BR')
  url.searchParams.set('key', apiKey)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal })
    if (!response.ok) return { ok: false, reason: 'unavailable' }

    const parsed = googleResponseSchema.safeParse(await response.json())
    if (!parsed.success) return { ok: false, reason: 'unavailable' }

    const { status, results } = parsed.data
    if (status === 'ZERO_RESULTS') return { ok: false, reason: 'not_found' }
    if (status === 'REQUEST_DENIED' || status === 'INVALID_REQUEST') return { ok: false, reason: 'denied' }
    if (status !== 'OK' || !results || results.length === 0) return { ok: false, reason: 'unavailable' }

    const best = results[0]
    return {
      ok: true,
      lat: best.geometry.location.lat,
      lng: best.geometry.location.lng,
      locationType: best.geometry.location_type,
      partialMatch: best.partial_match === true,
      formatted: best.formatted_address ?? address,
    }
  } catch (error) {
    // Nunca loga a URL (tem a chave)
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { ok: false, reason: aborted ? 'timeout' : 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

export type LocationSource = 'geocode' | 'gps' | 'geocode_aproximado'

export interface ResolvedLocation extends Coordinates {
  source: LocationSource
}

// Distância máxima entre o GPS e um endereço só aproximado (rua sem número
// exato) pra considerar que o GPS é a posição mais precisa do mesmo lugar.
const GPS_AGREES_WITH_APPROXIMATE_KM = 2

/**
 * Escolhe a localização do chamado. O endereço digitado é a verdade (é onde o
 * serviço vai acontecer); o GPS só entra quando o endereço não foi localizado
 * com precisão.
 *  1. Endereço localizado com precisão (fachada ou interpolação, sem "partial
 *     match") dentro da área de atendimento → vale ele.
 *  2. Senão, GPS dentro da área — mas se o endereço foi achado só de forma
 *     aproximada e o GPS está longe dele (>2 km), o GPS provavelmente é onde o
 *     cliente está agora, não onde o serviço será feito: vale o endereço.
 *  3. Senão, endereço aproximado dentro da área.
 *  4. Senão, nada: quem chama deve pedir pro cliente conferir o endereço.
 */
export function resolveCallLocation(input: {
  gps?: Coordinates
  geocode?: GeocodeResult
}): ResolvedLocation | null {
  const geocode = input.geocode && input.geocode.ok ? input.geocode : null
  const geocodeInside = geocode && isInsideServiceArea(geocode) ? geocode : null
  const gps = input.gps && isInsideServiceArea(input.gps) ? input.gps : null

  const precise =
    geocodeInside &&
    !geocodeInside.partialMatch &&
    (geocodeInside.locationType === 'ROOFTOP' || geocodeInside.locationType === 'RANGE_INTERPOLATED')
  if (geocodeInside && precise) {
    return { lat: geocodeInside.lat, lng: geocodeInside.lng, source: 'geocode' }
  }

  if (gps) {
    if (!geocodeInside || distanceKm(gps, geocodeInside) <= GPS_AGREES_WITH_APPROXIMATE_KM) {
      return { lat: gps.lat, lng: gps.lng, source: 'gps' }
    }
    return { lat: geocodeInside.lat, lng: geocodeInside.lng, source: 'geocode_aproximado' }
  }

  if (geocodeInside) {
    return { lat: geocodeInside.lat, lng: geocodeInside.lng, source: 'geocode_aproximado' }
  }

  return null
}
