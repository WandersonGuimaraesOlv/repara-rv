'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { PixPaymentModal } from '@/components/pix-payment-modal'
import { formatCurrency } from '@/lib/utils'
import { NO_SHOW_FEE_AMOUNT } from '@/lib/pending-payments'
import type { PendingPayment } from '@/hooks/usePendingPayment'

interface PendingPaymentReminderProps {
  pending: PendingPayment
  // Abre o Pix sozinho uma vez (ao entrar no app — pedido do dono, 23/09/2026).
  autoOpen?: boolean
  // 'block': aparece no lugar do formulário de pedir serviço.
  variant?: 'banner' | 'block'
  onClosed?: () => void
}

// Lembrete de pagamento pendente com o Pix pronto pra pagar
// (lib/pending-payments.ts decide o que conta como pendente).
export function PendingPaymentReminder({ pending, autoOpen = false, variant = 'banner', onClosed }: PendingPaymentReminderProps) {
  // Só é montado quando já existe pendência, então o Pix pode nascer aberto.
  const [showPix, setShowPix] = useState(autoOpen)

  const isFee = pending.kind === 'no_show_fee'
  const amount = isFee ? NO_SHOW_FEE_AMOUNT : pending.totalPrice
  const when = pending.completedAt
    ? new Date(pending.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  return (
    <>
      <div
        id="pending-payment-reminder"
        role="alert"
        className="card p-4 mb-4 animate-slide-up"
        style={{ background: 'rgba(237, 198, 107, 0.08)', borderColor: 'rgba(237, 198, 107, 0.35)' }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
              Pagamento pendente · {formatCurrency(amount)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {isFee
                ? 'Há uma taxa de deslocamento pendente: o técnico foi até o local e não foi atendido.'
                : `O serviço ${pending.serviceName}${when ? `, concluído em ${when},` : ''} ainda não foi pago.`}
              {variant === 'block' && ' Para pedir um novo serviço, faça o pagamento primeiro.'}
            </p>
            <button
              id="btn-pay-pending"
              onClick={() => setShowPix(true)}
              className="btn-primary mt-3 py-2.5 text-xs"
            >
              <CreditCard size={15} strokeWidth={2} aria-hidden="true" /> Pagar agora
            </button>
          </div>
        </div>
      </div>

      {showPix && (
        <PixPaymentModal
          mode={isFee ? 'no_show_fee' : 'service'}
          amount={amount}
          providerCut={isFee ? 0 : pending.providerCut}
          pixQrCode={isFee ? pending.noShowFeePixQrCode : pending.pixQrCode}
          pixCopyPaste={isFee ? pending.noShowFeePixCopyPaste : pending.pixCopyPaste}
          checkoutUrl={isFee ? null : pending.checkoutUrl}
          callId={pending.callId}
          onClose={() => {
            setShowPix(false)
            onClosed?.()
          }}
        />
      )}
    </>
  )
}
