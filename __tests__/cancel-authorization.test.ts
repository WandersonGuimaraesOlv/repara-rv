import { describe, it, expect } from 'vitest'
import { evaluateCancelAuthorization, resolveCancelReasonEnum, shouldChargeNoShowFee } from '../lib/cancel-authorization'

describe('evaluateCancelAuthorization — autorização de cancelamento (app/api/calls/cancel)', () => {
  const baseCall = { client_id: 'client-1', provider_id: 'provider-1', status: 'searching' }

  it('bloqueia requisição sem usuário autenticado — 401', () => {
    const result = evaluateCancelAuthorization({ userId: null, call: baseCall })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.status).toBe(401)
  })

  it('bloqueia usuário autenticado que não é cliente nem prestador deste chamado — 403 (achado original: antes disso o cancelamento passava)', () => {
    const result = evaluateCancelAuthorization({ userId: 'stranger-99', call: baseCall })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.status).toBe(403)
  })

  it('permite o cliente cancelar enquanto o chamado está searching, queued ou no_providers_available', () => {
    for (const status of ['searching', 'queued', 'no_providers_available']) {
      const result = evaluateCancelAuthorization({ userId: 'client-1', call: { ...baseCall, status } })
      expect(result.allowed).toBe(true)
    }
  })

  it('bloqueia o cliente de cancelar depois que já existe prestador comprometido — 400', () => {
    for (const status of ['accepted', 'on_the_way', 'in_progress']) {
      const result = evaluateCancelAuthorization({ userId: 'client-1', call: { ...baseCall, status } })
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.status).toBe(400)
    }
  })

  it('permite o prestador vinculado cancelar mesmo depois de accepted/on_the_way/in_progress', () => {
    for (const status of ['accepted', 'on_the_way', 'in_progress']) {
      const result = evaluateCancelAuthorization({ userId: 'provider-1', call: { ...baseCall, status } })
      expect(result.allowed).toBe(true)
      if (result.allowed) expect(result.isProvider).toBe(true)
    }
  })

  it('não deixa um provider_id nulo (chamado ainda na fila) casar com um userId qualquer por acidente', () => {
    const result = evaluateCancelAuthorization({
      userId: 'someone',
      call: { client_id: 'client-1', provider_id: null, status: 'queued' },
    })
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.status).toBe(403)
  })

  it('devolve isClient/isProvider corretos quando autorizado', () => {
    const asClient = evaluateCancelAuthorization({ userId: 'client-1', call: baseCall })
    expect(asClient).toMatchObject({ allowed: true, isClient: true, isProvider: false })

    const asProvider = evaluateCancelAuthorization({
      userId: 'provider-1',
      call: { ...baseCall, status: 'accepted' },
    })
    expect(asProvider).toMatchObject({ allowed: true, isClient: false, isProvider: true })
  })
})

describe('resolveCancelReasonEnum — deriva o valor da coluna ENUM cancel_reason (app/api/calls/cancel)', () => {
  it('achado real em produção: rótulo livre do cliente (não é um valor do enum) nunca quebra o INSERT/UPDATE — cai em client_request', () => {
    expect(resolveCancelReasonEnum('Demorou muito para encontrar prestador', true)).toBe('client_request')
    expect(resolveCancelReasonEnum('Resolvi o problema sozinho', true)).toBe('client_request')
    expect(resolveCancelReasonEnum('Outro motivo', true)).toBe('client_request')
  })

  it('reason ausente (undefined) do cliente cai em client_request', () => {
    expect(resolveCancelReasonEnum(undefined, true)).toBe('client_request')
  })

  it('reason livre/ausente do prestador cai em other, não em client_request', () => {
    expect(resolveCancelReasonEnum('Cliente não atendia o telefone', false)).toBe('other')
    expect(resolveCancelReasonEnum(undefined, false)).toBe('other')
  })

  it('usa o valor estruturado direto quando reason já é um membro válido do enum (caminho normal do prestador)', () => {
    for (const value of ['provider_absent', 'wrong_address', 'technical_issue', 'no_provider_found', 'other', 'client_request']) {
      expect(resolveCancelReasonEnum(value, false)).toBe(value)
      expect(resolveCancelReasonEnum(value, true)).toBe(value)
    }
  })
})

describe('shouldChargeNoShowFee — gatilho da taxa de deslocamento de R$25 (já prometida em /termos)', () => {
  it('cobra quando o prestador cancela com motivo provider_absent', () => {
    expect(shouldChargeNoShowFee('provider_absent', true)).toBe(true)
  })

  it('não cobra quando o prestador cancela por qualquer outro motivo', () => {
    for (const reason of ['wrong_address', 'technical_issue', 'no_provider_found', 'other', 'client_request'] as const) {
      expect(shouldChargeNoShowFee(reason, true)).toBe(false)
    }
  })

  it('nunca cobra quando é o cliente quem cancela, mesmo que o motivo (por acaso) seja provider_absent', () => {
    expect(shouldChargeNoShowFee('provider_absent', false)).toBe(false)
  })
})
