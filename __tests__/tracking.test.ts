import { describe, it, expect } from 'vitest'
import {
  decodePolyline,
  formatAge,
  isPositionStale,
  isTrackingStatus,
  parseDurationSeconds,
  parseGeoJsonPoint,
  remainingMinutes,
  shouldRecomputeRoute,
  TRACKING_STALE_AFTER_MS,
  type CachedRoute,
} from '../lib/tracking'

describe('rota pelas ruas (Google Routes API) — quando recalcular, cada cálculo é cobrado', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')
  const cache = (secondsAgo: number, over: Partial<CachedRoute> = {}): CachedRoute => ({
    origin_lat: -17.8, origin_lng: -50.93, encoded_polyline: 'abc', duration_seconds: 600, distance_meters: 3000,
    computed_at: new Date(now.getTime() - secondsAgo * 1000).toISOString(), ...over,
  })

  it('sem rota guardada: calcula', () => {
    expect(shouldRecomputeRoute(null, Infinity, now)).toBe(true)
  })

  it('rota recente e técnico parado: usa a guardada', () => {
    expect(shouldRecomputeRoute(cache(30), 0, now)).toBe(false)
    expect(shouldRecomputeRoute(cache(150), 100, now)).toBe(false)
  })

  it('andou 300 m ou mais: recalcula, mas no máximo 1 vez por minuto', () => {
    expect(shouldRecomputeRoute(cache(30), 800, now)).toBe(false)
    expect(shouldRecomputeRoute(cache(61), 300, now)).toBe(true)
  })

  it('3 minutos sem recalcular: recalcula mesmo parado', () => {
    expect(shouldRecomputeRoute(cache(180), 0, now)).toBe(true)
  })

  it('última tentativa falhou: espera 5 minutos antes de tentar de novo', () => {
    expect(shouldRecomputeRoute(cache(200, { encoded_polyline: null }), 5000, now)).toBe(false)
    expect(shouldRecomputeRoute(cache(300, { encoded_polyline: null }), 0, now)).toBe(true)
  })

  it('lê a duração da Routes API ("342s")', () => {
    expect(parseDurationSeconds('342s')).toBe(342)
    expect(parseDurationSeconds('12.5s')).toBe(13)
    expect(parseDurationSeconds('342')).toBeNull()
    expect(parseDurationSeconds(undefined)).toBeNull()
  })

  it('tempo que falta desconta o tempo desde o cálculo, nunca menos de 1 min', () => {
    expect(remainingMinutes(600, '2026-09-23T11:58:00.000Z', now)).toBe(8)
    expect(remainingMinutes(60, '2026-09-23T11:50:00.000Z', now)).toBe(1)
  })

  it('decodifica a polilinha do Google (exemplo da documentação)', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })
})

describe('isTrackingStatus — quando a posição do técnico aparece pro cliente (app/api/calls/tracking)', () => {
  it('só entre o aceite e o início do atendimento', () => {
    expect(isTrackingStatus('accepted')).toBe(true)
    expect(isTrackingStatus('on_the_way')).toBe(true)
  })

  it('nunca antes do aceite nem depois do PIN / encerramento', () => {
    for (const status of ['searching', 'queued', 'in_progress', 'completed', 'cancelled', 'expired', 'no_providers_available']) {
      expect(isTrackingStatus(status)).toBe(false)
    }
  })
})

describe('isPositionStale — "ao vivo" x "última posição há X min"', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('posição recente não está parada', () => {
    expect(isPositionStale('2026-09-23T11:59:30.000Z', now)).toBe(false)
  })

  it(`passou de ${TRACKING_STALE_AFTER_MS / 60_000} min sem posição nova: parada`, () => {
    expect(isPositionStale('2026-09-23T11:57:59.000Z', now)).toBe(true)
  })

  it('sem data de atualização conta como parada', () => {
    expect(isPositionStale(null, now)).toBe(true)
  })
})

describe('parseGeoJsonPoint — coluna geography que o PostgREST devolve', () => {
  it('lê { type: Point, coordinates: [lng, lat] }', () => {
    expect(parseGeoJsonPoint({ type: 'Point', coordinates: [-50.9264, -17.7943] })).toEqual({ lat: -17.7943, lng: -50.9264 })
  })

  it('devolve null pra valor ausente ou em outro formato', () => {
    expect(parseGeoJsonPoint(null)).toBeNull()
    expect(parseGeoJsonPoint('SRID=4326;POINT(-50.9 -17.7)')).toBeNull()
    expect(parseGeoJsonPoint({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toBeNull()
    expect(parseGeoJsonPoint({ type: 'Point', coordinates: ['a', 'b'] })).toBeNull()
  })
})

describe('formatAge', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('escreve o tempo desde a última posição', () => {
    expect(formatAge('2026-09-23T11:59:40.000Z', now)).toBe('agora')
    expect(formatAge('2026-09-23T11:59:00.000Z', now)).toBe('há 1 min')
    expect(formatAge('2026-09-23T11:48:00.000Z', now)).toBe('há 12 min')
    expect(formatAge('2026-09-23T10:30:00.000Z', now)).toBe('há 1 hora')
    expect(formatAge('2026-09-23T09:00:00.000Z', now)).toBe('há 3 horas')
  })
})
