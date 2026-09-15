'use client'

import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Zap, Droplets, Package, AlertCircle, Wind, Tv2, Waves, Plug, Ambulance, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const ICON_MAP: Record<string, React.ElementType> = {
  zap: Zap,
  plug: Plug,
  wind: Wind,
  droplets: Droplets,
  waves: Waves,
  'tv-2': Tv2,
  package: Package,
  ambulance: Ambulance,
}

// Updated to use green-based palette consistent with the new design system
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Elétrica:   { bg: 'rgba(10, 155, 112, 0.14)',  text: '#0db982', border: 'rgba(10, 155, 112, 0.3)'  },
  Hidráulica: { bg: 'rgba(96, 200, 232, 0.12)',  text: '#60c8e8', border: 'rgba(96, 200, 232, 0.28)' },
  Montagem:   { bg: 'rgba(184, 239, 117, 0.12)', text: '#b8ef75', border: 'rgba(184, 239, 117, 0.28)'},
  Chaveiro:   { bg: 'rgba(94, 211, 164, 0.12)',  text: '#5ed3a4', border: 'rgba(94, 211, 164, 0.28)' },
  Instalação: { bg: 'rgba(184, 239, 117, 0.1)',  text: '#b8ef75', border: 'rgba(184, 239, 117, 0.22)'},
  Emergência: { bg: 'rgba(244, 124, 124, 0.12)', text: '#f47c7c', border: 'rgba(244, 124, 124, 0.28)'},
}

interface ServiceCardProps {
  service: QuickService
  index?: number
}

export function ServiceCard({ service, index = 0 }: ServiceCardProps) {
  const IconComponent = ICON_MAP[service.icon ?? ''] ?? Zap
  const catColor = CATEGORY_COLORS[service.category] ?? CATEGORY_COLORS['Elétrica']
  const providerCut = service.fixed_price - service.platform_fee

  return (
    <Link
      href={`/chamar/${service.id}`}
      className="card block p-4 group cursor-pointer"
      style={{ animationDelay: `${index * 60}ms` }}
      id={`service-card-${service.id}`}
    >
      <div className="flex items-start gap-4">
        {/* Ícone */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: catColor.bg, border: `1px solid ${catColor.border}` }}
        >
          <IconComponent size={22} style={{ color: catColor.text }} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
              {service.name}
            </h3>
            <span
              className="badge flex-shrink-0"
              style={{ background: catColor.bg, color: catColor.text, border: `1px solid ${catColor.border}` }}
            >
              {service.category}
            </span>
          </div>

          {service.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
              {service.description}
            </p>
          )}

          {/* Preços */}
          <div className="flex items-center gap-3 mt-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Você paga</p>
              <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(service.fixed_price)}
              </p>
            </div>
            <div className="w-px h-8" style={{ background: 'var(--color-border)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Prestador recebe</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {formatCurrency(providerCut)}
              </p>
            </div>
            <div className="ml-auto">
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all group-hover:opacity-90"
                style={{ background: 'var(--color-primary)', boxShadow: 'var(--shadow-primary)' }}
              >
                <span>Solicitar</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de peças — inline compacto */}
      <div className="banner-warning mt-3">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
          <strong>Apenas mão de obra.</strong> Peças e materiais são combinados à parte.
        </p>
      </div>
    </Link>
  )
}
