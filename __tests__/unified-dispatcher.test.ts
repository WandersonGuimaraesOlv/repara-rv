import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocka só as fronteiras de I/O: o cliente Supabase (banco) e os dois
// dispatchers de baixo nível (rede externa). A lógica que este arquivo
// testa de verdade é a ORQUESTRAÇÃO em modules/notifications/services/
// unified-dispatcher.ts: pra qual dispatcher rotear por plataforma, como
// agregar resultados em lote, e quando marcar um token pra remoção.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('../modules/notifications/services/push-dispatcher', () => ({
  sendWebPush: vi.fn(),
}))
vi.mock('../modules/notifications/services/fcm-dispatcher', () => ({
  sendFCM: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { sendWebPush } from '../modules/notifications/services/push-dispatcher'
import { sendFCM } from '../modules/notifications/services/fcm-dispatcher'
import { notifyProvider, notifyProviderBatch } from '../modules/notifications/services/unified-dispatcher'

const env = {
  VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:x@x.com',
  FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
}
const payload = { title: 'Novo chamado', body: 'teste', url: '/painel' }

// Monta um fake do query builder do Supabase suficiente pro que
// unified-dispatcher realmente encadeia: .from().select().eq().eq() pros
// device_tokens, .from().select().eq().eq().single() pra push_subscriptions,
// e .from().update().in() pra marcar tokens expirados como inativos.
function makeSupabaseMock({
  deviceTokens,
  pushSubscription,
}: {
  deviceTokens: Array<{ id: string; token: string; platform: string }>
  pushSubscription?: { endpoint: string; p256dh: string; auth: string } | null
}) {
  const updateIn = vi.fn().mockResolvedValue({ data: null, error: null })

  const from = vi.fn((table: string) => {
    if (table === 'device_tokens') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: deviceTokens, error: null }),
          }),
        }),
        update: () => ({ in: updateIn }),
      }
    }
    if (table === 'push_subscriptions') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: pushSubscription ?? null, error: pushSubscription ? null : { message: 'not found' } }),
            }),
          }),
        }),
      }
    }
    throw new Error(`tabela inesperada no mock: ${table}`)
  })

  return { from, __updateIn: updateIn }
}

describe('notifyProvider (modules/notifications/services/unified-dispatcher)', () => {
  beforeEach(() => {
    vi.mocked(sendWebPush).mockReset()
    vi.mocked(sendFCM).mockReset()
    vi.mocked(createClient).mockReset()
  })

  it('sem nenhum token ativo, retorna zerado e não chama nenhum dispatcher', async () => {
    const supa = makeSupabaseMock({ deviceTokens: [] })
    vi.mocked(createClient).mockResolvedValue(supa as any)

    const result = await notifyProvider('user-1', payload, env)

    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(sendWebPush).not.toHaveBeenCalled()
    expect(sendFCM).not.toHaveBeenCalled()
  })

  it('roteia token platform=web pro sendWebPush, buscando a subscrição completa antes', async () => {
    const subscription = { endpoint: 'https://push.example/ep', p256dh: 'p', auth: 'a' }
    const supa = makeSupabaseMock({
      deviceTokens: [{ id: 'tok-1', token: subscription.endpoint, platform: 'web' }],
      pushSubscription: subscription,
    })
    vi.mocked(createClient).mockResolvedValue(supa as any)
    vi.mocked(sendWebPush).mockResolvedValue({ success: true, shouldRemove: false })

    const result = await notifyProvider('user-1', payload, env)

    expect(sendWebPush).toHaveBeenCalledWith(subscription, payload, env)
    expect(sendFCM).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 1, failed: 0, removed: 0 })
  })

  it('quando a subscrição web não é encontrada em push_subscriptions, conta como falha (não quebra)', async () => {
    const supa = makeSupabaseMock({
      deviceTokens: [{ id: 'tok-1', token: 'https://push.example/ep-orfao', platform: 'web' }],
      pushSubscription: null,
    })
    vi.mocked(createClient).mockResolvedValue(supa as any)

    const result = await notifyProvider('user-1', payload, env)

    expect(sendWebPush).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 1, removed: 0 })
  })

  it.each(['android', 'ios'])('roteia token platform=%s direto pro sendFCM com o token bruto', async (platform) => {
    const supa = makeSupabaseMock({ deviceTokens: [{ id: 'tok-1', token: 'fcm-token-xyz', platform }] })
    vi.mocked(createClient).mockResolvedValue(supa as any)
    vi.mocked(sendFCM).mockResolvedValue({ success: true, shouldRemove: false })

    const result = await notifyProvider('user-1', payload, env)

    expect(sendFCM).toHaveBeenCalledWith('fcm-token-xyz', payload, env)
    expect(sendWebPush).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 1, failed: 0, removed: 0 })
  })

  it('marca pra remoção e chama update(...).in(ids) quando um dispatcher sinaliza shouldRemove', async () => {
    const supa = makeSupabaseMock({ deviceTokens: [{ id: 'tok-expirado', token: 'fcm-token-morto', platform: 'android' }] })
    vi.mocked(createClient).mockResolvedValue(supa as any)
    vi.mocked(sendFCM).mockResolvedValue({ success: false, shouldRemove: true })

    const result = await notifyProvider('user-1', payload, env)

    expect(result).toEqual({ sent: 0, failed: 0, removed: 1 })
    expect(supa.__updateIn).toHaveBeenCalledWith('id', ['tok-expirado'])
  })

  it('trata plataforma desconhecida como falha, sem chamar nenhum dispatcher', async () => {
    const supa = makeSupabaseMock({ deviceTokens: [{ id: 'tok-1', token: 'x', platform: 'windows-phone' }] })
    vi.mocked(createClient).mockResolvedValue(supa as any)

    const result = await notifyProvider('user-1', payload, env)

    expect(sendWebPush).not.toHaveBeenCalled()
    expect(sendFCM).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, failed: 1, removed: 0 })
  })

  it('processa múltiplos tokens do mesmo usuário e agrega sent/failed/removed corretamente', async () => {
    const supa = makeSupabaseMock({
      deviceTokens: [
        { id: 'a', token: 'fcm-ok', platform: 'android' },
        { id: 'b', token: 'fcm-fail', platform: 'ios' },
        { id: 'c', token: 'fcm-morto', platform: 'android' },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(supa as any)
    vi.mocked(sendFCM).mockImplementation(async (token: string) => {
      if (token === 'fcm-ok') return { success: true, shouldRemove: false }
      if (token === 'fcm-fail') return { success: false, shouldRemove: false }
      return { success: false, shouldRemove: true }
    })

    const result = await notifyProvider('user-1', payload, env)

    expect(result).toEqual({ sent: 1, failed: 1, removed: 1 })
    expect(supa.__updateIn).toHaveBeenCalledWith('id', ['c'])
  })
})

describe('notifyProviderBatch (modules/notifications/services/unified-dispatcher)', () => {
  beforeEach(() => {
    vi.mocked(sendFCM).mockReset()
    vi.mocked(createClient).mockReset()
  })

  it('soma os resultados de notifyProvider de cada prestador do lote', async () => {
    vi.mocked(createClient).mockImplementation(async () => {
      // Cada prestador do lote tem exatamente 1 token android que sempre "envia com sucesso".
      return makeSupabaseMock({ deviceTokens: [{ id: 'tok', token: 'fcm-tok', platform: 'android' }] }) as any
    })
    vi.mocked(sendFCM).mockResolvedValue({ success: true, shouldRemove: false })

    const result = await notifyProviderBatch(['provider-1', 'provider-2', 'provider-3'], payload, env)

    expect(result).toEqual({ sent: 3, failed: 0, removed: 0 })
  })

  it('lote vazio retorna zerado sem chamar o banco', async () => {
    const result = await notifyProviderBatch([], payload, env)

    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('um prestador cujo notifyProvider rejeita (exceção) não derruba o lote inteiro — Promise.allSettled', async () => {
    let call = 0
    vi.mocked(createClient).mockImplementation(async () => {
      call++
      if (call === 2) throw new Error('falha de conexão pro prestador 2')
      return makeSupabaseMock({ deviceTokens: [{ id: 'tok', token: 'fcm-tok', platform: 'android' }] }) as any
    })
    vi.mocked(sendFCM).mockResolvedValue({ success: true, shouldRemove: false })

    const result = await notifyProviderBatch(['provider-1', 'provider-2', 'provider-3'], payload, env)

    // provider-2 falhou por completo (rejeitado) e não contribui pro total,
    // mas os outros dois ainda são contabilizados normalmente.
    expect(result).toEqual({ sent: 2, failed: 0, removed: 0 })
  })
})
