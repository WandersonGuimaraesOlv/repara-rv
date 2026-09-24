import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('../modules/notifications/services/unified-dispatcher', () => ({
  notifyProviderBatch: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { notifyProviderBatch } from '../modules/notifications/services/unified-dispatcher'
import { pushCallAlert } from '../modules/notifications/services/call-alerts'

type Filter = [string, unknown]

// Mock encadeável do supabase: registra os filtros de cada tabela e resolve
// service_calls (via .single()) e profiles (via await direto) com dados fixos.
function makeSupabase(opts: {
  call?: unknown
  callError?: { message: string } | null
  eligible?: { id: string }[]
  eligibleError?: { message: string } | null
}) {
  const filters: Record<string, Filter[]> = {}
  const from = vi.fn((table: string) => {
    filters[table] = []
    const builder: any = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters[table].push([column, value])
        return builder
      }),
      single: vi.fn(async () => ({ data: opts.call ?? null, error: opts.callError ?? null })),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: opts.eligible ?? [], error: opts.eligibleError ?? null }),
    }
    return builder
  })
  return { supabase: { from }, filters }
}

const call = { neighborhood: 'Setor Central', provider_cut: 92, service: { name: 'Troca de Chuveiro / Resistência' } }
const CALL_ID = '11111111-1111-4111-8111-111111111111'

describe('pushCallAlert (modules/notifications/services/call-alerts)', () => {
  beforeEach(() => {
    vi.mocked(createServiceClient).mockReset()
    vi.mocked(notifyProviderBatch).mockReset()
    vi.mocked(notifyProviderBatch).mockResolvedValue({ sent: 1, failed: 0, removed: 0 })
  })

  it('com providerIds explícitos, avisa só esses e NÃO consulta a lista de prestadores', async () => {
    const { supabase, filters } = makeSupabase({ call })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await pushCallAlert({ callId: CALL_ID, providerIds: ['prov-1'] })

    expect(result).toEqual({ sent: 1, failed: 0, removed: 0 })
    expect(vi.mocked(notifyProviderBatch).mock.calls[0][0]).toEqual(['prov-1'])
    expect(filters.profiles).toBeUndefined()
  })

  it('sem providerIds (fila), avisa todos os prestadores APROVADOS e NÃO bloqueados', async () => {
    const { supabase, filters } = makeSupabase({ call, eligible: [{ id: 'a' }, { id: 'b' }] })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    await pushCallAlert({ callId: CALL_ID })

    expect(filters.profiles).toEqual([
      ['role', 'provider'],
      ['background_check_status', 'approved'],
      ['is_blocked', false],
    ])
    expect(vi.mocked(notifyProviderBatch).mock.calls[0][0]).toEqual(['a', 'b'])
  })

  it('nunca avisa a conta que abriu o chamado — ela não pode atendê-lo (chk_client_ne_provider)', async () => {
    const { supabase } = makeSupabase({ call: { ...call, client_id: 'b' }, eligible: [{ id: 'a' }, { id: 'b' }] })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    await pushCallAlert({ callId: CALL_ID })

    expect(vi.mocked(notifyProviderBatch).mock.calls[0][0]).toEqual(['a'])
  })

  it('o texto do push mostra serviço, bairro e ganho líquido — e nunca o endereço nem o cliente (LGPD)', async () => {
    const { supabase } = makeSupabase({
      call: { ...call, client_address: 'Rua das Flores, 123', client: { full_name: 'Maria', phone: '64999990000' } },
    })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    await pushCallAlert({ callId: CALL_ID, providerIds: ['prov-1'] })

    const payload = vi.mocked(notifyProviderBatch).mock.calls[0][1]
    expect(payload.body).toBe('Troca de Chuveiro / Resistência — Setor Central · Ganhos líquidos R$ 92,00')
    expect(payload.url).toBe('/painel')
    expect(payload.callId).toBe(CALL_ID)
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('Flores')
    expect(serialized).not.toContain('Maria')
    expect(serialized).not.toContain('64999990000')
  })

  it('sem prestadores elegíveis, não chama o dispatcher e devolve zerado', async () => {
    const { supabase } = makeSupabase({ call, eligible: [] })
    vi.mocked(createServiceClient).mockResolvedValue(supabase as any)

    const result = await pushCallAlert({ callId: CALL_ID })

    expect(result).toEqual({ sent: 0, failed: 0, removed: 0 })
    expect(notifyProviderBatch).not.toHaveBeenCalled()
  })

  it('nunca lança: chamado inexistente, erro de banco e falha do dispatcher devolvem null', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const missing = makeSupabase({ call: null, callError: { message: 'not found' } })
    vi.mocked(createServiceClient).mockResolvedValue(missing.supabase as any)
    await expect(pushCallAlert({ callId: CALL_ID, providerIds: ['p'] })).resolves.toBeNull()

    const listFail = makeSupabase({ call, eligibleError: { message: 'db down' } })
    vi.mocked(createServiceClient).mockResolvedValue(listFail.supabase as any)
    await expect(pushCallAlert({ callId: CALL_ID })).resolves.toBeNull()

    const ok = makeSupabase({ call })
    vi.mocked(createServiceClient).mockResolvedValue(ok.supabase as any)
    vi.mocked(notifyProviderBatch).mockRejectedValue(new Error('push service caiu'))
    await expect(pushCallAlert({ callId: CALL_ID, providerIds: ['p'] })).resolves.toBeNull()
  })
})
