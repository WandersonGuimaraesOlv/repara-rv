import { describe, it, expect } from 'vitest'
import {
  isEmergencySosActive,
  formatEmergencyMessage,
  FormatEmergencyParams,
} from '../lib/utils'

describe('Central de Segurança & Botão SOS', () => {
  describe('isEmergencySosActive (Regras de Visibilidade)', () => {
    it('deve retornar TRUE durante status operacionais ativos (accepted, on_the_way, in_progress)', () => {
      expect(isEmergencySosActive('accepted')).toBe(true)
      expect(isEmergencySosActive('on_the_way')).toBe(true)
      expect(isEmergencySosActive('in_progress')).toBe(true)
    })

    it('deve retornar FALSE durante status em que não há contato presencial ou o serviço já findou', () => {
      expect(isEmergencySosActive('searching')).toBe(false)
      expect(isEmergencySosActive('completed')).toBe(false)
      expect(isEmergencySosActive('cancelled')).toBe(false)
      expect(isEmergencySosActive('no_providers_available')).toBe(false)
    })
  })

  describe('formatEmergencyMessage (Formatação Jurídica e Operacional)', () => {
    it('formata alerta completo acionado pelo cliente com coordenadas GPS', () => {
      const params: FormatEmergencyParams = {
        callerName: 'Maria Silva',
        callerRole: 'client',
        callerPhone: '64999990000',
        otherPartyName: 'João Encanador',
        otherPartyRole: 'provider',
        otherPartyPhone: '64988880000',
        serviceName: 'Desentupimento de Pia',
        address: 'Rua das Flores, 123 - Setor Central, Rio Verde',
        latitude: -17.79,
        longitude: -50.92,
        callId: 'call-abc-12345678',
        timestamp: new Date('2026-09-08T14:32:00Z'),
      }

      const message = formatEmergencyMessage(params)

      expect(message).toContain('🚨 ALERTA SOS ACIONADO NO REPARA RV')
      expect(message).toContain('Quem acionou: Cliente Maria Silva ((64) 99999-0000)')
      expect(message).toContain('Prestador no local: João Encanador ((64) 98888-0000)')
      expect(message).toContain('Serviço: Desentupimento de Pia')
      expect(message).toContain('Endereço: Rua das Flores, 123 - Setor Central, Rio Verde')
      expect(message).toContain('Localização: https://maps.google.com/?q=-17.79,-50.92')
      expect(message).toContain('Chamado: #CALL-ABC')
    })

    it('formata alerta acionado pelo prestador com fallback de endereço quando sem GPS', () => {
      const params: FormatEmergencyParams = {
        callerName: 'Carlos Eletricista',
        callerRole: 'provider',
        callerPhone: '64991112222',
        otherPartyName: 'Dona Antônia',
        otherPartyRole: 'client',
        otherPartyPhone: '64981234567',
        serviceName: 'Troca de Chuveiro',
        address: 'Av Presidente Vargas, 500 - Bairro Popular',
        callId: 'demo-xyz-987654',
      }

      const message = formatEmergencyMessage(params)

      expect(message).toContain('🚨 ALERTA SOS ACIONADO NO REPARA RV')
      expect(message).toContain('Quem acionou: Prestador Carlos Eletricista ((64) 99111-2222)')
      expect(message).toContain('Cliente no local: Dona Antônia ((64) 98123-4567)')
      expect(message).toContain('https://maps.google.com/?q=')
      expect(message).toContain(encodeURIComponent('Av Presidente Vargas, 500 - Bairro Popular, Rio Verde - GO'))
      expect(message).toContain('Chamado: #DEMO-XYZ')
    })

    it('lida graciosamente com ausência de telefone ou nome da outra parte', () => {
      const params: FormatEmergencyParams = {
        callerName: 'Maria Silva',
        callerRole: 'client',
        callerPhone: '64999990000',
        serviceName: 'Visita Técnica',
        address: 'Setor Promissão, Quadra 10',
        callId: 'test-call-id',
      }

      const message = formatEmergencyMessage(params)

      expect(message).toContain('Prestador no local: Não informado (Não informado)')
    })
  })
})
