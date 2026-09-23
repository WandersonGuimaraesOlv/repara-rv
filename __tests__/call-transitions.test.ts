import { describe, it, expect } from 'vitest'
import {
  canActAsProvider,
  evaluateProviderTransition,
  isPinLocked,
  pinAttemptPatch,
  PIN_LOCK_MINUTES,
  PIN_MAX_FAILED_ATTEMPTS,
  type ProviderAction,
} from '../lib/call-transitions'

describe('evaluateProviderTransition — transições do prestador (app/api/calls/advance e verify-arrival-pin)', () => {
  const call = (status: string) => ({ provider_id: 'provider-1', status })

  it('bloqueia requisição sem usuário autenticado — 401', () => {
    const result = evaluateProviderTransition({ userId: null, call: call('searching'), action: 'accept' })
    expect(result).toMatchObject({ allowed: false, status: 401 })
  })

  it('bloqueia prestador que não é o do chamado, e chamado sem prestador — 403', () => {
    expect(evaluateProviderTransition({ userId: 'provider-2', call: call('searching'), action: 'accept' }))
      .toMatchObject({ allowed: false, status: 403 })
    expect(evaluateProviderTransition({ userId: 'provider-1', call: { provider_id: null, status: 'queued' }, action: 'accept' }))
      .toMatchObject({ allowed: false, status: 403 })
  })

  it('segue a ordem aceitar → a caminho → iniciar (PIN) → concluir', () => {
    const expected: [ProviderAction, string, string][] = [
      ['accept', 'searching', 'accepted'],
      ['on_the_way', 'accepted', 'on_the_way'],
      ['start', 'accepted', 'in_progress'],
      ['start', 'on_the_way', 'in_progress'],
      ['complete', 'in_progress', 'completed'],
    ]
    for (const [action, from, to] of expected) {
      const result = evaluateProviderTransition({ userId: 'provider-1', call: call(from), action })
      expect(result).toMatchObject({ allowed: true, to })
    }
  })

  it('achado de 23/09/2026: não conclui sem ter iniciado com o PIN (on_the_way → completed) — 409', () => {
    for (const status of ['searching', 'accepted', 'on_the_way']) {
      const result = evaluateProviderTransition({ userId: 'provider-1', call: call(status), action: 'complete' })
      expect(result).toMatchObject({ allowed: false, status: 409 })
    }
  })

  it('não aceita chamado que já saiu de searching (cancelado, aceito, na fila) — 409', () => {
    for (const status of ['accepted', 'cancelled', 'queued', 'expired', 'completed']) {
      const result = evaluateProviderTransition({ userId: 'provider-1', call: call(status), action: 'accept' })
      expect(result).toMatchObject({ allowed: false, status: 409 })
    }
  })

  it('não mexe em chamado encerrado', () => {
    for (const action of ['accept', 'on_the_way', 'start', 'complete'] as const) {
      for (const status of ['completed', 'cancelled', 'expired']) {
        const result = evaluateProviderTransition({ userId: 'provider-1', call: call(status), action })
        expect(result.allowed).toBe(false)
      }
    }
  })
})

describe('canActAsProvider — quem aceita/assume chamado', () => {
  it('prestador e a conta admin (que o radar também encontra) podem', () => {
    expect(canActAsProvider('provider')).toBe(true)
    expect(canActAsProvider('admin')).toBe(true)
  })

  it('cliente e perfil sem papel não podem', () => {
    expect(canActAsProvider('client')).toBe(false)
    expect(canActAsProvider(null)).toBe(false)
    expect(canActAsProvider(undefined)).toBe(false)
  })
})

describe('PIN de chegada — trava por tentativas erradas (app/api/calls/verify-arrival-pin)', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('trava só enquanto locked_until está no futuro', () => {
    expect(isPinLocked(null, now)).toBe(false)
    expect(isPinLocked('2026-09-23T12:05:00.000Z', now)).toBe(true)
    expect(isPinLocked('2026-09-23T11:59:59.000Z', now)).toBe(false)
  })

  it('tentativas antes da última só sobem o contador (e limpam uma trava já vencida)', () => {
    for (let attempt = 1; attempt < PIN_MAX_FAILED_ATTEMPTS; attempt++) {
      expect(pinAttemptPatch(attempt, now)).toEqual({ failed_attempts: attempt, locked_until: null })
    }
  })

  it(`a ${PIN_MAX_FAILED_ATTEMPTS}ª tentativa já grava a trava de ${PIN_LOCK_MINUTES} min e zera o contador`, () => {
    expect(pinAttemptPatch(PIN_MAX_FAILED_ATTEMPTS, now)).toEqual({
      failed_attempts: 0,
      locked_until: '2026-09-23T12:10:00.000Z',
    })
  })
})
