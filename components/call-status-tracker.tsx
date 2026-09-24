'use client'

import { RideStatus } from '@/lib/types'
import { getStatusLabel } from '@/lib/utils'
import {
  Search, CheckCircle, Car, Wrench, Star, XCircle, AlertCircle, Clock, ClipboardCheck
} from 'lucide-react'

const STATUS_ICONS: Record<RideStatus, React.ElementType> = {
  searching:              Search,
  queued:                 Clock,
  accepted:               CheckCircle,
  on_the_way:             Car,
  in_progress:            Wrench,
  awaiting_approval:      ClipboardCheck,
  completed:              Star,
  cancelled:              XCircle,
  no_providers_available: AlertCircle,
  expired:                Clock,
}

const STATUS_STEPS: RideStatus[] = [
  'searching',
  'accepted',
  'on_the_way',
  'in_progress',
  'awaiting_approval',
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
  const isFinal = status === 'completed' || status === 'cancelled' || status === 'no_providers_available' || status === 'expired'
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
              ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-soft))'
              : status === 'completed'
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : status === 'cancelled' || status === 'no_providers_available'
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : status === 'expired'
              ? 'linear-gradient(135deg, #64748B, #475569)'
              : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            boxShadow: isSearching ? 'var(--shadow-primary)' : '0 0 24px rgba(10,155,112,0.4)',
          }}
        >
          <Icon size={32} color="white" className={isSearching ? 'animate-pulse' : ''} />
        </div>
      </div>

      {/* Label de status */}
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
        {getStatusLabel(status)}
      </h2>

      {providerName && status !== 'cancelled' && status !== 'searching' && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Prestador: <strong style={{ color: 'var(--color-accent)' }}>{providerName}</strong>
        </p>
      )}

      {estimatedMinutes && status === 'on_the_way' && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          <Clock size={14} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />Chegada estimada em <strong>{estimatedMinutes} min</strong>
        </p>
      )}

      {isSearching && (
        <div className="space-y-1 mb-4">
          <p className="text-sm font-semibold animate-pulse" style={{ color: 'var(--color-accent)' }}>
            Conectando ao profissional mais próximo...
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Aguardando resposta do técnico no radar (até 30 segundos)
          </p>
        </div>
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
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                  transform: idx === currentStepIdx ? 'scale(1.4)' : 'scale(1)',
                  boxShadow: idx === currentStepIdx ? 'var(--shadow-primary)' : 'none',
                }}
              />
              {idx < STATUS_STEPS.length - 1 && (
                <div
                  className="w-6 h-px transition-all duration-500"
                  style={{
                    background: idx < currentStepIdx ? 'var(--color-primary)' : 'var(--color-border)',
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
