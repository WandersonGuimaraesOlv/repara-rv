import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  buildGoogleMapsUrl,
  buildWazeUrl,
  getStatusLabel,
  getStatusColor,
  cn,
} from '../lib/utils'

describe('SQA Metrics & Quality: lib/utils.ts', () => {
  describe('formatCurrency', () => {
    it('formats numbers into Brazilian Real (BRL) representation', () => {
      const formatted = formatCurrency(85)
      // Normaliza espaços para compatibilidade entre locales
      expect(formatted.replace(/\u00a0/g, ' ')).toMatch(/R\$\s*85,00/)
    })

    it('formats decimals correctly', () => {
      const formatted = formatCurrency(120.5)
      expect(formatted.replace(/\u00a0/g, ' ')).toMatch(/R\$\s*120,50/)
    })
  })

  describe('buildGoogleMapsUrl', () => {
    it('generates Google Maps navigation URL with address and Rio Verde context', () => {
      const url = buildGoogleMapsUrl(null, null, 'Rua das Flores, 123, Bairro Popular')
      expect(url).toContain('https://www.google.com/maps/dir/?api=1')
      expect(url).toContain(encodeURIComponent('Rua das Flores, 123, Bairro Popular, Rio Verde - GO'))
    })

    it('handles coordinates when lat/lng are provided', () => {
      const url = buildGoogleMapsUrl(-17.7944, -50.9234)
      expect(url).toContain('destination=-17.7944,-50.9234')
    })
  })

  describe('buildWazeUrl', () => {
    it('generates Waze deep link with navigate=yes parameter', () => {
      const url = buildWazeUrl(null, null, 'Av Presidente Vargas, 500')
      expect(url).toContain('https://waze.com/ul?')
      expect(url).toContain('navigate=yes')
      expect(url).toContain(encodeURIComponent('Av Presidente Vargas, 500, Rio Verde, GO'))
    })

    it('uses coordinates when available for accurate moto navigation', () => {
      const url = buildWazeUrl(-17.7944, -50.9234)
      expect(url).toContain('ll=-17.7944,-50.9234')
      expect(url).toContain('navigate=yes')
    })
  })

  describe('getStatusLabel & getStatusColor', () => {
    it('returns human-readable Portuguese labels for each status', () => {
      expect(getStatusLabel('searching')).toBe('Buscando prestador...')
      expect(getStatusLabel('accepted')).toBe('Prestador a caminho')
      expect(getStatusLabel('in_progress')).toBe('Serviço em andamento')
      expect(getStatusLabel('completed')).toBe('Concluído')
      expect(getStatusLabel('cancelled_by_client')).toBe('Cancelado pelo cliente')
      expect(getStatusLabel('no_providers_available')).toBe('Nenhum prestador disponível')
    })

    it('returns consistent color classes for status indicators', () => {
      expect(getStatusColor('completed')).toContain('emerald')
      expect(getStatusColor('searching')).toContain('amber')
      expect(getStatusColor('cancelled_by_client')).toContain('red')
    })
  })

  describe('cn (Classnames Merger)', () => {
    it('merges tailwind classes cleanly without duplicates', () => {
      const result = cn('p-4 text-sm', 'text-base', 'bg-black')
      expect(result).toContain('p-4')
      expect(result).toContain('text-base')
      expect(result).toContain('bg-black')
      expect(result).not.toContain('text-sm')
    })
  })
})
