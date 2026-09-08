'use client'

import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Zap, Droplets, Package, AlertTriangle, Wind, Tv2, Waves, Plug, Ambulance } from 'lucide-react'
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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Elétrica:   { bg: 'rgba(99, 102, 241, 0.12)',  text: '#818CF8', border: 'rgba(99, 102, 241, 0.3)'  },
  Hidráulica: { bg: 'rgba(6, 182, 212, 0.12)',   text: '#22D3EE', border: 'rgba(6, 182, 212, 0.3)'   },
  Montagem:   { bg: 'rgba(245, 158, 11, 0.12)',  text: '#FCD34D', border: 'rgba(245, 158, 11, 0.3)'  },
  Emergência: { bg: 'rgba(239, 68, 68, 0.12)',   text: '#FCA5A5', border: 'rgba(239, 68, 68, 0.3)'   },
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
              <p className="font-bold text-lg" style={{ color: 'var(--color-cta)' }}>
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
          </div>
        </div>
      </div>

      {/* Aviso de peças — inline compacto */}
      <div className="banner-warning mt-3">
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
        <p className="text-xs" style={{ color: '#FCD34D' }}>
          <strong>Apenas mão de obra.</strong> Peças e materiais são combinados à parte.
        </p>
      </div>
    </Link>
  )
}
