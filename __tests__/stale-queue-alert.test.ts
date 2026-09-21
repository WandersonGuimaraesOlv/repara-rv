import { describe, it, expect } from 'vitest'
import {
  selectJustCrossed,
  buildStaleQueueEmail,
  waitingSeconds,
  STALE_THRESHOLD_SECONDS,
  CRON_TICK_SECONDS,
} from '../modules/notifications/services/stale-queue-alert'

const NOW = Date.parse('2026-09-21T15:00:00.000Z')
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString()

describe('selectJustCrossed (janela de 1 tick do cron)', () => {
  it('pega só quem cruzou os 5 min no último minuto', () => {
    const calls = [
      { id: 'novo', created_at: ago(120) },
      { id: 'antes-do-limiar', created_at: ago(STALE_THRESHOLD_SECONDS - 1) },
      { id: 'no-limiar', created_at: ago(STALE_THRESHOLD_SECONDS) },
      { id: 'quase-fim-da-janela', created_at: ago(STALE_THRESHOLD_SECONDS + CRON_TICK_SECONDS - 1) },
      { id: 'ja-alertado', created_at: ago(STALE_THRESHOLD_SECONDS + CRON_TICK_SECONDS) },
      { id: 'muito-antigo', created_at: ago(3600) },
    ]
    expect(selectJustCrossed(calls, NOW).map((c) => c.id)).toEqual(['no-limiar', 'quase-fim-da-janela'])
  })

  it('cada chamado cai em exatamente uma rodada do cron (sem alerta repetido)', () => {
    const call = { created_at: ago(0) }
    let hits = 0
    for (let tick = 0; tick < 30; tick++) {
      const now = NOW + tick * CRON_TICK_SECONDS * 1000
      hits += selectJustCrossed([call], now).length
    }
    expect(hits).toBe(1)
  })

  it('lista vazia devolve vazio', () => {
    expect(selectJustCrossed([], NOW)).toEqual([])
  })
})

describe('waitingSeconds', () => {
  it('conta em segundos inteiros', () => {
    expect(waitingSeconds(ago(330), NOW)).toBe(330)
  })
})

describe('buildStaleQueueEmail', () => {
  const base = { id: 'c1', neighborhood: 'Setor Central', provider_cut: 92, created_at: ago(330), minutes_waiting: 5 }

  it('assunto e corpo no singular', () => {
    const { subject, html } = buildStaleQueueEmail([base], 'https://repararv.com')
    expect(subject).toBe('⏱️ Repara RV: 1 chamado parado na fila')
    expect(html).toContain('1 chamado está na fila há mais de 5 minutos')
    expect(html).toContain('Setor Central — ganho líquido R$ 92,00 — 5 min parado')
    expect(html).toContain('href="https://repararv.com/admin/dashboard"')
  })

  it('assunto e corpo no plural', () => {
    const { subject, html } = buildStaleQueueEmail([base, { ...base, id: 'c2', neighborhood: null }], 'https://repararv.com')
    expect(subject).toBe('⏱️ Repara RV: 2 chamados parados na fila')
    expect(html).toContain('2 chamados estão na fila')
    expect(html).toContain('Bairro não informado')
  })

  it('escapa HTML do bairro (texto vindo do cadastro do cliente)', () => {
    const { html } = buildStaleQueueEmail(
      [{ ...base, neighborhood: '<img src=x onerror=alert(1)> & "Cia"' }],
      'https://repararv.com',
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Cia&quot;')
  })

  it('não expõe o id do chamado no e-mail', () => {
    const { html } = buildStaleQueueEmail([{ ...base, id: 'id-secreto-123' }], 'https://repararv.com')
    expect(html).not.toContain('id-secreto-123')
  })
})
