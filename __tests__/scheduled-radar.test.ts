import { describe, it, expect } from 'vitest'
import { buildRadarRequest } from '../lib/scheduled-radar'

describe('buildRadarRequest (Cron Trigger → rota do radar)', () => {
  it('sem CRON_SECRET_TOKEN não monta a requisição', () => {
    expect(buildRadarRequest({})).toBeNull()
    expect(buildRadarRequest({ CRON_SECRET_TOKEN: '' })).toBeNull()
  })

  it('monta POST autenticado na rota do radar', () => {
    const request = buildRadarRequest({ CRON_SECRET_TOKEN: 'segredo', NEXT_PUBLIC_APP_URL: 'https://repararv.com' })
    expect(request).not.toBeNull()
    expect(request!.method).toBe('POST')
    expect(request!.url).toBe('https://repararv.com/api/cron/stale-calls-radar')
    expect(request!.headers.get('Authorization')).toBe('Bearer segredo')
  })

  it('usa o domínio oficial quando a URL do app não está configurada', () => {
    const request = buildRadarRequest({ CRON_SECRET_TOKEN: 'segredo' })
    expect(request!.url).toBe('https://repararv.com/api/cron/stale-calls-radar')
  })

  it('ignora URL sem https (ex: http://localhost) e não vaza o token pra fora', () => {
    const request = buildRadarRequest({ CRON_SECRET_TOKEN: 'segredo', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })
    expect(new URL(request!.url).origin).toBe('https://repararv.com')
  })

  it('aceita a URL com barra no final', () => {
    const request = buildRadarRequest({ CRON_SECRET_TOKEN: 'segredo', NEXT_PUBLIC_APP_URL: 'https://repararv.com/' })
    expect(request!.url).toBe('https://repararv.com/api/cron/stale-calls-radar')
  })
})
