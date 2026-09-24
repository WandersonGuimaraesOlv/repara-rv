import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('../modules/notifications/services/email-dispatcher', () => ({
  sendEmail: vi.fn(),
  FROM_ADDRESS: 'Repara RV <noreply@repararv.com>',
}))

import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '../modules/notifications/services/email-dispatcher'
import { POST } from '../app/api/cron/stale-calls-radar/route'

const NOW = Date.parse('2026-09-21T15:00:00.000Z')
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString()

type Update = { patch: unknown; filters: [string, string, unknown][] }

// Cada from() é uma consulta: a que chama .update() é a expiração da fila
// (resolve com `expire`), a outra é a busca dos chamados parados (`rows`).
function makeSupabase(
  rows: unknown[],
  error: { message: string } | null = null,
  expire: { data?: unknown[]; error?: { message: string } | null } = {}
) {
  const updates: Update[] = []
  const from = vi.fn(() => {
    let update: Update | null = null
    const builder: any = {
      update: vi.fn((patch: unknown) => {
        update = { patch, filters: [] }
        updates.push(update)
        return builder
      }),
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        update?.filters.push(['eq', column, value])
        return builder
      }),
      lte: vi.fn((column: string, value: unknown) => {
        update?.filters.push(['lte', column, value])
        return builder
      }),
      lt: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (resolve: (v: unknown) => unknown) =>
        resolve(update ? { data: expire.data ?? [], error: expire.error ?? null } : { data: rows, error }),
    }
    return builder
  })
  return { from, updates }
}

const row = (id: string, secondsAgo: number) => ({
  id,
  neighborhood: 'Setor Central',
  provider_cut: 92,
  created_at: ago(secondsAgo),
  service_id: 'svc',
})

const req = (token?: string) =>
  new NextRequest('https://repararv.com/api/cron/stale-calls-radar', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

describe('POST /api/cron/stale-calls-radar — alerta por e-mail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubEnv('CRON_SECRET_TOKEN', 'segredo')
    vi.stubEnv('OPS_ALERT_EMAIL', 'ops@exemplo.com')
    vi.stubEnv('RESEND_API_KEY', 're_teste')
    vi.stubEnv('OPS_ALERT_WEBHOOK_URL', '')
    vi.stubEnv('EMERGENCY_WEBHOOK_URL', '')
    vi.mocked(createServiceClient).mockReset()
    vi.mocked(sendEmail).mockReset().mockResolvedValue({ success: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('sem o token secreto devolve 401 e não consulta o banco', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('manda 1 e-mail quando um chamado acabou de cruzar os 5 min', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabase([row('a', 330)]) as never)
    const res = await POST(req('segredo'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alert_sent).toBe(true)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [payload, apiKey] = vi.mocked(sendEmail).mock.calls[0]
    expect(payload.to).toBe('ops@exemplo.com')
    expect(payload.subject).toContain('1 chamado parado')
    expect(apiKey).toBe('re_teste')
  })

  it('não repete o e-mail de chamado que já estava parado antes desta rodada', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabase([row('velho', 900)]) as never)
    const body = await (await POST(req('segredo'))).json()

    expect(body.stale_count).toBe(1)
    expect(body.alert_sent).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sem OPS_ALERT_EMAIL não envia e-mail (e não quebra)', async () => {
    vi.stubEnv('OPS_ALERT_EMAIL', '')
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabase([row('a', 330)]) as never)
    const res = await POST(req('segredo'))

    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('falha no envio do e-mail não derruba a rota', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ success: false, error: 'Resend retornou 500' })
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabase([row('a', 330)]) as never)
    const res = await POST(req('segredo'))

    expect(res.status).toBe(200)
    expect((await res.json()).alert_sent).toBe(true)
  })

  it('encerra (expired) só os chamados que ainda estão na fila e passaram do prazo de 2h', async () => {
    const supabase = makeSupabase([], null, { data: [{ id: 'x' }, { id: 'y' }] })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)
    const body = await (await POST(req('segredo'))).json()

    expect(supabase.updates).toHaveLength(1)
    expect(supabase.updates[0].patch).toMatchObject({ status: 'expired' })
    expect(supabase.updates[0].filters).toEqual([
      ['eq', 'status', 'queued'],
      ['lte', 'expires_at', new Date(NOW).toISOString()],
    ])
    expect(body.expired_count).toBe(2)
  })

  it('falha ao expirar não derruba o radar nem o alerta', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = makeSupabase([row('a', 330)], null, { error: { message: 'db down' } })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never)
    const res = await POST(req('segredo'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alert_sent).toBe(true)
    expect(body.expired_count).toBe(0)
  })

  it('erro de consulta devolve 500 sem vazar a mensagem do banco', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabase([], { message: 'relation "x" does not exist' }) as never)
    const res = await POST(req('segredo'))

    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('relation')
  })
})
