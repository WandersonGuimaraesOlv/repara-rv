import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}))

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { runInBackground } from '../lib/background'

describe('runInBackground (lib/background)', () => {
  beforeEach(() => {
    vi.mocked(getCloudflareContext).mockReset()
    vi.restoreAllMocks()
  })

  it('no Workers, entrega a tarefa ao waitUntil pra ela não ser cancelada quando a resposta termina', () => {
    const waitUntil = vi.fn()
    vi.mocked(getCloudflareContext).mockReturnValue({ ctx: { waitUntil } } as any)

    runInBackground(Promise.resolve('ok'))

    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise)
  })

  it('fora do Workers (sem contexto), não lança e a tarefa roda normalmente', async () => {
    vi.mocked(getCloudflareContext).mockImplementation(() => {
      throw new Error('sem contexto do Cloudflare')
    })
    let done = false

    expect(() => runInBackground(Promise.resolve().then(() => { done = true }))).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    expect(done).toBe(true)
  })

  it('uma tarefa que falha só é logada — a promessa entregue ao waitUntil nunca rejeita', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const waitUntil = vi.fn()
    vi.mocked(getCloudflareContext).mockReturnValue({ ctx: { waitUntil } } as any)

    runInBackground(Promise.reject(new Error('falhou')))

    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })
})
