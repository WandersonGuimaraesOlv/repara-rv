import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { POST } from '../app/api/push/subscribe/route'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/aparelho-secreto'

const body = { endpoint: ENDPOINT, p256dh: 'chave-p256dh', auth: 'chave-auth', deviceType: 'chrome-android' }

const post = (payload: unknown) =>
  POST(
    new NextRequest('https://repararv.com/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )

function makeAdmin(opts: { subsError?: { message: string } | null; tokenError?: { message: string } | null } = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const from = vi.fn((table: string) => ({
    upsert: vi.fn(async (...args: unknown[]) => {
      calls.push({ table, op: 'upsert', args })
      return { error: table === 'push_subscriptions' ? (opts.subsError ?? null) : (opts.tokenError ?? null) }
    }),
    update: vi.fn((...args: unknown[]) => {
      calls.push({ table, op: 'update', args })
      const chain = {
        eq: vi.fn((...a: unknown[]) => { calls.push({ table, op: 'eq', args: a }); return chain }),
        neq: vi.fn(async (...a: unknown[]) => { calls.push({ table, op: 'neq', args: a }); return { error: null } }),
      }
      return chain
    }),
  }))
  return { admin: { from }, calls }
}

const asUser = (user: { id: string } | null) =>
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: user ? null : { message: 'sem sessão' } })) },
  } as never)

describe('POST /api/push/subscribe — o aparelho passa a ser de quem está logado', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(createServiceClient).mockReset()
  })

  it('sem sessão devolve 401 e não escreve nada', async () => {
    asUser(null)
    const res = await post(body)
    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('corpo inválido devolve 422 sem escrever', async () => {
    asUser({ id: USER_ID })
    const res = await post({ endpoint: 'nao-e-url', p256dh: '', auth: '' })
    expect(res.status).toBe(422)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('grava a assinatura para o usuário logado (upsert por endpoint) e o token do aparelho', async () => {
    asUser({ id: USER_ID })
    const { admin, calls } = makeAdmin()
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post(body)
    expect(res.status).toBe(200)

    const subs = calls.find((c) => c.table === 'push_subscriptions' && c.op === 'upsert')!
    expect(subs.args[0]).toMatchObject({ user_id: USER_ID, endpoint: ENDPOINT, p256dh: 'chave-p256dh', auth: 'chave-auth', device_type: 'chrome-android' })
    expect(subs.args[1]).toEqual({ onConflict: 'endpoint' })

    const token = calls.find((c) => c.table === 'device_tokens' && c.op === 'upsert')!
    expect(token.args[0]).toEqual({ user_id: USER_ID, token: ENDPOINT, platform: 'web', is_active: true })
    expect(token.args[1]).toEqual({ onConflict: 'user_id,token' })
  })

  it('desativa o mesmo aparelho para OUTROS usuários (celular compartilhado / conta antiga)', async () => {
    asUser({ id: USER_ID })
    const { admin, calls } = makeAdmin()
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    await post(body)

    const update = calls.find((c) => c.table === 'device_tokens' && c.op === 'update')!
    expect(update.args[0]).toEqual({ is_active: false })
    expect(calls.find((c) => c.op === 'eq' && c.args[0] === 'token')!.args[1]).toBe(ENDPOINT)
    expect(calls.find((c) => c.op === 'neq')!.args).toEqual(['user_id', USER_ID])
  })

  it('falha ao gravar a assinatura devolve 500 e não registra o token', async () => {
    asUser({ id: USER_ID })
    const { admin, calls } = makeAdmin({ subsError: { message: 'erro interno do banco' } })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post(body)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('erro interno')
    expect(calls.some((c) => c.table === 'device_tokens')).toBe(false)
  })

  it('falha ao gravar o token também devolve 500 (a tela não pode dizer "ativado")', async () => {
    asUser({ id: USER_ID })
    const { admin } = makeAdmin({ tokenError: { message: 'x' } })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post(body)
    expect(res.status).toBe(500)
  })
})
