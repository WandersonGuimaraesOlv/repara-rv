import { describe, it, expect } from 'vitest'
import { classifyOfferEnd, OFFER_TIMEOUT_MS } from '../lib/missed-offers'

describe('classifyOfferEnd — offline automático de quem não responde (app/api/calls/skip-provider)', () => {
  const vencida = OFFER_TIMEOUT_MS + 1_000
  const cedo = 10_000

  it('técnico tocou em Recusar: estava presente, zera o contador (mesmo cedo)', () => {
    expect(classifyOfferEnd({ callerIsProvider: true, reason: 'rejected', offerAgeMs: cedo })).toBe('rejected')
    expect(classifyOfferEnd({ callerIsProvider: true, reason: 'rejected', offerAgeMs: vencida })).toBe('rejected')
  })

  it('painel antigo sem reason conta como recusa — nunca pune por engano', () => {
    expect(classifyOfferEnd({ callerIsProvider: true, reason: undefined, offerAgeMs: vencida })).toBe('rejected')
  })

  it('contador do painel do técnico venceu: conta como oferta perdida', () => {
    expect(classifyOfferEnd({ callerIsProvider: true, reason: 'timeout', offerAgeMs: vencida })).toBe('missed')
  })

  it('watchdog do cliente depois dos 30 s (pelo relógio do servidor): conta', () => {
    expect(classifyOfferEnd({ callerIsProvider: false, reason: 'timeout', offerAgeMs: vencida })).toBe('missed')
    expect(classifyOfferEnd({ callerIsProvider: false, reason: undefined, offerAgeMs: vencida })).toBe('missed')
  })

  it('achado de 23/09/2026: cliente pulando antes dos 30 s não pula nem derruba o técnico', () => {
    expect(classifyOfferEnd({ callerIsProvider: false, reason: 'timeout', offerAgeMs: 19_000 })).toBe('early')
    expect(classifyOfferEnd({ callerIsProvider: false, reason: 'timeout', offerAgeMs: 0 })).toBe('early')
  })

  it('aceita até 2 s de diferença de relógio no limite dos 30 s', () => {
    expect(classifyOfferEnd({ callerIsProvider: false, reason: 'timeout', offerAgeMs: OFFER_TIMEOUT_MS - 1_500 })).toBe('missed')
    expect(classifyOfferEnd({ callerIsProvider: false, reason: 'timeout', offerAgeMs: OFFER_TIMEOUT_MS - 3_000 })).toBe('early')
  })

  it('contador do técnico antes da hora pula (é ele mesmo abrindo mão), mas não conta', () => {
    expect(classifyOfferEnd({ callerIsProvider: true, reason: 'timeout', offerAgeMs: cedo })).toBe('none')
  })
})
