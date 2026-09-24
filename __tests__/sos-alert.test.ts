import { describe, it, expect } from 'vitest'
import { buildSosEmail } from '../modules/notifications/services/sos-alert'
import { formatEmergencyMessage } from '../lib/utils'

describe('buildSosEmail — e-mail de SOS pra equipe (app/api/emergency/notify)', () => {
  const message = formatEmergencyMessage({
    callerName: 'Ana <script>',
    callerRole: 'client',
    callerPhone: '64981155550',
    otherPartyName: 'João',
    otherPartyRole: 'provider',
    otherPartyPhone: '64999990000',
    serviceName: 'Troca de Chuveiro',
    address: 'Rua A, 10',
    latitude: -17.79,
    longitude: -50.92,
    callId: '9804049d-74e6-4db9-991a-2e05edce11b0',
    timestamp: '2026-09-24T12:00:00.000Z',
  })
  const email = buildSosEmail({ callId: '9804049d-74e6-4db9-991a-2e05edce11b0', callerRole: 'client', message, appUrl: 'https://repararv.com' })

  it('assunto diz quem acionou e o chamado', () => {
    expect(email.subject).toBe('🚨 SOS — Cliente no chamado #9804049D — Repara RV')
  })

  it('leva telefones, endereço e o link do mapa clicável', () => {
    expect(email.html).toContain('(64) 98115-5550')
    expect(email.html).toContain('Rua A, 10')
    expect(email.html).toContain('<a href="https://maps.google.com/?q=-17.79,-50.92">')
    expect(email.html).toContain('https://repararv.com/admin/dashboard')
  })

  it('escapa HTML vindo do nome do usuário', () => {
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('Ana &lt;script&gt;')
  })
})
