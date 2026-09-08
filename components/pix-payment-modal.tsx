'use client'

import { useState } from 'react'
import { Copy, CheckCheck, QrCode } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface PixPaymentModalProps {
  amount: number
  providerCut: number
  pixQrCode?: string | null
  pixCopyPaste?: string | null
  callId: string
  onClose?: () => void
}

export function PixPaymentModal({
  amount,
  providerCut,
  pixQrCode,
  pixCopyPaste,
  callId,
  onClose,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      setCopied(true)
      toast.success('Código Pix copiado!')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      id="pix-payment-modal"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-slide-up"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <QrCode size={28} style={{ color: 'var(--color-brand-light)' }} />
          </div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Pague via Pix
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Serviço concluído 🎉 Realize o pagamento para finalizar.
          </p>
        </div>

        {/* Valores */}
        <div
          className="rounded-xl p-4 mb-5 space-y-2"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--color-text-muted)' }}>Total do serviço</span>
            <span className="font-bold" style={{ color: 'var(--color-cta)' }}>
              {formatCurrency(amount)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--color-text-subtle)' }}>Repara RV (taxa)</span>
            <span style={{ color: 'var(--color-text-subtle)' }}>
              {formatCurrency(amount - providerCut)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--color-text-subtle)' }}>Prestador recebe</span>
            <span style={{ color: 'var(--color-text-subtle)' }}>{formatCurrency(providerCut)}</span>
          </div>
        </div>

        {/* QR Code placeholder */}
        {pixQrCode ? (
          <div className="flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code Pix"
              className="w-48 h-48 rounded-xl"
              style={{ border: '4px solid white' }}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-40 rounded-xl mb-5"
            style={{ background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)' }}
          >
            <QrCode size={40} style={{ color: 'var(--color-text-subtle)' }} />
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-subtle)' }}>
              QR Code será gerado após configurar Mercado Pago
            </p>
          </div>
        )}

        {/* Copia e Cola */}
        {pixCopyPaste && (
          <button
            onClick={handleCopy}
            id="btn-copy-pix"
            className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all mb-4"
            style={{
              background: copied ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-alt)',
              border: `1.5px solid ${copied ? '#10B981' : 'var(--color-border)'}`,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Pix Copia e Cola</p>
              <p
                className="text-xs font-mono truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {pixCopyPaste}
              </p>
            </div>
            {copied ? (
              <CheckCheck size={18} style={{ color: '#10B981' }} className="flex-shrink-0" />
            ) : (
              <Copy size={18} style={{ color: 'var(--color-brand-light)' }} className="flex-shrink-0" />
            )}
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            id="btn-close-pix-modal"
            className="btn-secondary mt-2"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  )
}
