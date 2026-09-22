import { describe, it, expect, vi } from 'vitest'
import {
  geocodeAddress,
  resolveCallLocation,
  distanceKm,
  isInsideServiceArea,
  RIO_VERDE_CENTER,
  type GeocodeResult,
} from '../lib/geocoding'

const CENTRO = { lat: -17.7915, lng: -50.9192 }
// ~1 km ao norte do centro (0,009° de latitude ≈ 1 km)
const PERTO = { lat: -17.7825, lng: -50.9192 }
// ~7 km do centro, ainda em Rio Verde
const OUTRO_BAIRRO = { lat: -17.855, lng: -50.9192 }
// Goiânia: fora da área de atendimento
const GOIANIA = { lat: -16.6869, lng: -49.2648 }

const ok = (over: Partial<Extract<GeocodeResult, { ok: true }>> = {}): GeocodeResult => ({
  ok: true,
  lat: CENTRO.lat,
  lng: CENTRO.lng,
  locationType: 'ROOFTOP',
  partialMatch: false,
  formatted: 'Rua Teste, 100 - Setor Central, Rio Verde - GO',
  ...over,
})

const googleOk = (over: Record<string, unknown> = {}) => ({
  status: 'OK',
  results: [
    {
      formatted_address: 'Rua Teste, 100 - Setor Central, Rio Verde - GO, 75901-000, Brasil',
      geometry: { location: { lat: CENTRO.lat, lng: CENTRO.lng }, location_type: 'ROOFTOP' },
      ...over,
    },
  ],
})

const fakeFetch = (body: unknown, init: { ok?: boolean } = {}) =>
  vi.fn(async () => ({ ok: init.ok ?? true, json: async () => body })) as unknown as typeof fetch

const PARTES = { street: 'Rua Teste', number: '100', neighborhood: 'Setor Central' }

describe('distanceKm e área de atendimento', () => {
  it('mede distâncias conhecidas com precisão razoável', () => {
    expect(distanceKm(CENTRO, CENTRO)).toBe(0)
    expect(distanceKm(CENTRO, PERTO)).toBeCloseTo(1, 0)
    // Rio Verde → Goiânia: ~200 km em linha reta
    expect(distanceKm(CENTRO, GOIANIA)).toBeGreaterThan(180)
    expect(distanceKm(CENTRO, GOIANIA)).toBeLessThan(230)
  })

  it('aceita endereços de Rio Verde e recusa de outra cidade', () => {
    expect(isInsideServiceArea(CENTRO)).toBe(true)
    expect(isInsideServiceArea(OUTRO_BAIRRO)).toBe(true)
    expect(isInsideServiceArea(GOIANIA)).toBe(false)
  })
})

describe('geocodeAddress', () => {
  it('monta a busca com o endereço e trava a cidade, sem vazar a chave no endereço buscado', async () => {
    const fetchImpl = fakeFetch(googleOk())
    await geocodeAddress(PARTES, 'CHAVE-SECRETA', fetchImpl)

    const url = new URL(vi.mocked(fetchImpl).mock.calls[0][0] as string)
    expect(url.searchParams.get('address')).toBe('Rua Teste, 100 - Setor Central, Rio Verde - GO, Brasil')
    expect(url.searchParams.get('components')).toContain('locality:Rio Verde')
    expect(url.searchParams.get('key')).toBe('CHAVE-SECRETA')
  })

  it('devolve as coordenadas e a precisão do primeiro resultado', async () => {
    const res = await geocodeAddress(PARTES, 'k', fakeFetch(googleOk()))
    expect(res).toEqual({
      ok: true,
      lat: CENTRO.lat,
      lng: CENTRO.lng,
      locationType: 'ROOFTOP',
      partialMatch: false,
      formatted: 'Rua Teste, 100 - Setor Central, Rio Verde - GO, 75901-000, Brasil',
    })
  })

  it('marca partial_match quando o Google só achou algo parecido', async () => {
    const res = await geocodeAddress(PARTES, 'k', fakeFetch(googleOk({ partial_match: true })))
    expect(res.ok && res.partialMatch).toBe(true)
  })

  it('endereço inexistente vira not_found', async () => {
    const res = await geocodeAddress(PARTES, 'k', fakeFetch({ status: 'ZERO_RESULTS', results: [] }))
    expect(res).toEqual({ ok: false, reason: 'not_found' })
  })

  it('chave inválida ou sem permissão vira denied', async () => {
    const res = await geocodeAddress(PARTES, 'k', fakeFetch({ status: 'REQUEST_DENIED' }))
    expect(res).toEqual({ ok: false, reason: 'denied' })
  })

  it('erro HTTP, resposta fora do formato ou limite estourado viram unavailable', async () => {
    expect(await geocodeAddress(PARTES, 'k', fakeFetch({}, { ok: false }))).toEqual({ ok: false, reason: 'unavailable' })
    expect(await geocodeAddress(PARTES, 'k', fakeFetch({ status: 'OK', results: [{ geometry: {} }] }))).toEqual({ ok: false, reason: 'unavailable' })
    expect(await geocodeAddress(PARTES, 'k', fakeFetch({ status: 'OVER_QUERY_LIMIT' }))).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('rede fora do ar não lança exceção', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('rede caiu') }) as unknown as typeof fetch
    expect(await geocodeAddress(PARTES, 'k', fetchImpl)).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('demora demais vira timeout', async () => {
    const fetchImpl = vi.fn(async () => { const e = new Error('abortado'); e.name = 'AbortError'; throw e }) as unknown as typeof fetch
    expect(await geocodeAddress(PARTES, 'k', fetchImpl)).toEqual({ ok: false, reason: 'timeout' })
  })
})

describe('resolveCallLocation — o endereço do serviço manda, o GPS completa', () => {
  it('endereço preciso vence o GPS (cliente pedindo de outro lugar)', () => {
    const r = resolveCallLocation({ gps: OUTRO_BAIRRO, geocode: ok() })
    expect(r).toEqual({ lat: CENTRO.lat, lng: CENTRO.lng, source: 'geocode' })
  })

  it('sem GPS, usa o endereço preciso', () => {
    expect(resolveCallLocation({ geocode: ok() })?.source).toBe('geocode')
  })

  it('sem endereço localizado, usa o GPS', () => {
    const r = resolveCallLocation({ gps: PERTO, geocode: { ok: false, reason: 'not_found' } })
    expect(r).toEqual({ lat: PERTO.lat, lng: PERTO.lng, source: 'gps' })
  })

  it('endereço aproximado + GPS por perto: o GPS é mais preciso', () => {
    const r = resolveCallLocation({ gps: PERTO, geocode: ok({ locationType: 'GEOMETRIC_CENTER' }) })
    expect(r?.source).toBe('gps')
  })

  it('endereço aproximado + GPS longe: vale o endereço (GPS é onde o cliente está agora)', () => {
    const r = resolveCallLocation({ gps: OUTRO_BAIRRO, geocode: ok({ locationType: 'APPROXIMATE' }) })
    expect(r).toEqual({ lat: CENTRO.lat, lng: CENTRO.lng, source: 'geocode_aproximado' })
  })

  it('partial_match não conta como preciso', () => {
    const r = resolveCallLocation({ gps: PERTO, geocode: ok({ partialMatch: true }) })
    expect(r?.source).toBe('gps')
  })

  it('endereço fora da área de atendimento é descartado', () => {
    const fora = ok({ lat: GOIANIA.lat, lng: GOIANIA.lng })
    expect(resolveCallLocation({ geocode: fora })).toBeNull()
    // com GPS válido em Rio Verde, o GPS assume
    expect(resolveCallLocation({ gps: PERTO, geocode: fora })?.source).toBe('gps')
  })

  it('GPS fora da área de atendimento é descartado', () => {
    expect(resolveCallLocation({ gps: GOIANIA, geocode: { ok: false, reason: 'not_found' } })).toBeNull()
  })

  it('sem GPS e sem endereço localizado, devolve null (nunca o centro da cidade)', () => {
    expect(resolveCallLocation({})).toBeNull()
    expect(resolveCallLocation({ geocode: { ok: false, reason: 'unavailable' } })).toBeNull()
  })

  it('o ponto padrão antigo do centro continua dentro da área (não quebra chamados antigos)', () => {
    expect(isInsideServiceArea(RIO_VERDE_CENTER)).toBe(true)
  })
})
