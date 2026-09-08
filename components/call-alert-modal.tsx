'use client'

import { useCallAlert } from '@/hooks/useCallAlert'
import { useAcceptTimer } from '@/hooks/useAcceptTimer'
import { ServiceCall } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, X, Clock, MapPin } from 'lucide-react'
import { useEffect } from 'react'

interface CallAlertModalProps {
  call: ServiceCall
  serviceName: string
  clientAddress: string
  totalPrice: number
  providerCut: number
  onAccept: () => void
  onReject: () => void
  onTimeout: () => void
}

export function CallAlertModal({
  call,
  serviceName,
  clientAddress,
  totalPrice,
  providerCut,
  onAccept,
  onReject,
  onTimeout,
}: CallAlertModalProps) {
  const { startAlert, stopAlert } = useCallAlert()
  const { secondsLeft, progress, start } = useAcceptTimer({
    onTimeout: () => {
      stopAlert()
      onTimeout()
    },
  })

  useEffect(() => {
    startAlert()
    start()
    return () => stopAlert()
  }, [startAlert, stopAlert, start])

  const handleAccept = () => {
    stopAlert()
    onAccept()
  }

  const handleReject = () => {
    stopAlert()
    onReject()
  }

  const circumference = 2 * Math.PI * 28 // raio 28
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      id="call-alert-modal"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-slide-up"
        style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-brand)',
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        {/* Cabeçalho com timer circular */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-brand-light)' }}>
              🔔 Novo Chamado!
            </p>
            <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              {serviceName}
            </h3>
          </div>

          {/* Timer circular SVG */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg width="64" height="64" className="-rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-brand)'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center font-bold text-lg"
              style={{ color: secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-text)' }}
            >
              {secondsLeft}
            </span>
          </div>
        </div>

        {/* Endereço */}
        <div
          className="flex items-start gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-cta)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {clientAddress}
          </p>
        </div>

        {/* Valor */}
        <div className="text-center mb-6">
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-subtle)' }}>
            Você recebe ao concluir
          </p>
          <p className="text-3xl font-black" style={{ color: 'var(--color-cta)' }}>
            {formatCurrency(providerCut)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
            (Total do cliente: {formatCurrency(totalPrice)})
          </p>
        </div>

        {/* Aviso de timer */}
        <div className="flex items-center gap-2 mb-5 justify-center">
          <Clock size={14} style={{ color: secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-text-muted)' }} />
          <p className="text-xs" style={{ color: secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
            {secondsLeft <= 10
              ? 'Chamado expirando!'
              : 'Chamado vai para o próximo prestador se não aceito'}
          </p>
        </div>

        {/* Botões */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleReject}
            id="btn-reject-call"
            className="btn-danger"
          >
            <X size={18} />
            Recusar
          </button>
          <button
            onClick={handleAccept}
            id="btn-accept-call"
            className="btn-primary"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <CheckCircle size={18} />
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
