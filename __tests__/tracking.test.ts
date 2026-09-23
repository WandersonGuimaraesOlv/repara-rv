import { describe, it, expect } from 'vitest'
import { formatAge, isPositionStale, isTrackingStatus, parseGeoJsonPoint, TRACKING_STALE_AFTER_MS } from '../lib/tracking'

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
