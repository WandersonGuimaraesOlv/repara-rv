'use client'

import { RideStatus } from '@/lib/types'
import { getStatusColor, getStatusLabel } from '@/lib/utils'
import {
  Search, CheckCircle, Car, Wrench, Star, XCircle, AlertCircle
} from 'lucide-react'

const STATUS_ICONS: Record<RideStatus, React.ElementType> = {
  searching:              Search,
  accepted:               CheckCircle,
  on_the_way:             Car,
  in_progress:            Wrench,
  completed:              Star,
  cancelled:              XCircle,
  no_providers_available: AlertCircle,
}

const STATUS_STEPS: RideStatus[] = [
  'searching',
  'accepted',
  'on_the_way',
  'in_progress',
  'completed',
]

interface CallStatusTrackerProps {
  status: RideStatus
  providerName?: string
  estimatedMinutes?: number
}

export function CallStatusTracker({
  status,
  providerName,
  estimatedMinutes,
}: CallStatusTrackerProps) {
  const Icon = STATUS_ICONS[status] ?? Search
  const isFinal = status === 'completed' || status === 'cancelled' || status === 'no_providers_available'
  const isSearching = status === 'searching'
  const currentStepIdx = STATUS_STEPS.indexOf(status)

  return (
    <div className="text-center animate-slide-up">
      {/* Ícone central animado */}
      <div className="relative inline-flex items-center justify-center mb-6">
        {isSearching && (
          <>
            <span className="animate-pulse-ring absolute inset-0 rounded-full" />
          </>
        )}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center relative z-10 transition-all"
          style={{
            background: isSearching
              ? 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))'
              : status === 'completed'
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : status === 'cancelled' || status === 'no_providers_available'
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'linear-gradient(135deg, var(--color-cta), var(--color-cta-dark))',
            boxShadow: isSearching ? 'var(--shadow-brand)' : '0 0 24px rgba(249,115,22,0.4)',
          }}
        >
          <Icon size={32} color="white" className={isSearching ? 'animate-pulse' : ''} />
        </div>
      </div>

      {/* Label de status */}
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
        {getStatusLabel(status)}
      </h2>

      {providerName && status !== 'cancelled' && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Prestador: <strong style={{ color: 'var(--color-brand-light)' }}>{providerName}</strong>
        </p>
      )}

      {estimatedMinutes && status === 'on_the_way' && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ⏱ Chegada estimada em <strong>{estimatedMinutes} min</strong>
        </p>
      )}

      {isSearching && (
        <p className="text-sm animate-pulse mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Conectando ao profissional mais próximo...
        </p>
      )}

      {/* Stepper de progresso */}
      {!isFinal && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {STATUS_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full transition-all duration-500"
                style={{
                  background:
                    idx <= currentStepIdx
                      ? 'var(--color-brand)'
                      : 'var(--color-border)',
                  transform: idx === currentStepIdx ? 'scale(1.4)' : 'scale(1)',
                  boxShadow: idx === currentStepIdx ? 'var(--shadow-brand)' : 'none',
                }}
              />
              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className="w-6 h-px transition-all duration-500"
                  style={{
                    background: idx < currentStepIdx ? 'var(--color-brand)' : 'var(--color-border)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
