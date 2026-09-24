'use client'

import { useState } from 'react'
import { ShieldCheck, KeyRound, AlertOctagon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface ProviderIdentityCardProps {
  callId: string
  providerName?: string
  avatarUrl?: string | null
  isVerified: boolean
  arrivalPin?: string | null
}

// Card de identificação do prestador + PIN de chegada, visível pro cliente a
// partir de status 'accepted' — parte da verificação de identidade (ver
// supabase/migrations/20260918_provider_identity_verification.sql). O botão
// "Não é a pessoa da foto" cancela o chamado na hora (sem taxa pro cliente,
// reaproveitando a rota de cancelamento existente) e registra uma denúncia
// pendente de revisão do admin — nunca suspende o prestador
// automaticamente.
export function ProviderIdentityCard({ callId, providerName, avatarUrl, isVerified, arrivalPin }: ProviderIdentityCardProps) {
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  const handleReport = async () => {
    setReporting(true)
    try {
      const res = await fetch('/api/calls/report-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, reason: reportReason }),
      })
      const data = await res.json().catch(() => ({}))
      setReporting(false)
      if (!res.ok) {
        toast.error(data.error || 'Erro ao registrar denúncia. Tente novamente.')
        return
      }
      toast.success('Chamado cancelado e denúncia registrada. Nossa equipe vai revisar.')
      setShowReportModal(false)
    } catch {
      setReporting(false)
      toast.error('Falha de conexão. Tente novamente.')
    }
  }

  return (
    <>
      <div className="card p-4 mb-4 animate-slide-up" style={{ borderColor: 'var(--color-border-strong)' }}>
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`Foto de ${providerName || 'prestador'}`}
              className="w-14 h-14 rounded-2xl object-cover border shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {(providerName || 'P').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
              {providerName || 'Técnico Repara RV'}
            </p>
            {isVerified && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide mt-0.5 px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-hover)' }}
              >
                <ShieldCheck size={11} /> Cadastro Verificado
              </span>
            )}
          </div>
        </div>

        {arrivalPin && (
          <div
            className="mt-3 rounded-2xl p-3 flex items-center justify-between"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <KeyRound size={16} style={{ color: 'var(--color-accent)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                PIN de chegada
              </span>
            </div>
            <span id="arrival-pin-code" className="font-mono font-black text-xl tracking-[0.3em]" style={{ color: 'var(--color-accent)' }}>
              {arrivalPin}
            </span>
          </div>
        )}
        {arrivalPin && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-subtle)' }}>
            Informe este código ao técnico só quando ele chegar — é como ele confirma que é o profissional certo.
          </p>
        )}

        <button
          type="button"
          id="btn-report-identity"
          onClick={() => setShowReportModal(true)}
          className="w-full mt-3 py-2 text-xs font-semibold text-center transition"
          style={{ color: 'var(--color-danger)' }}
        >
          <AlertOctagon size={13} className="inline mr-1 -mt-0.5" />
          Não é a pessoa da foto?
        </button>
      </div>

      {showReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(7, 16, 15, 0.85)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div
                  className="p-2.5 rounded-2xl shrink-0"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}
                >
                  <AlertOctagon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>
                    Não é a pessoa da foto?
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    O chamado será cancelado agora, sem custo pra você, e nossa equipe vai revisar o caso.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowReportModal(false)} style={{ color: 'var(--color-text-subtle)' }}>
                <X size={18} />
              </button>
            </div>

            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Descreva o que aconteceu (opcional)"
              rows={3}
              maxLength={500}
              className="input resize-none mb-4"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                disabled={reporting}
                className="btn-secondary"
              >
                Voltar
              </button>
              <button
                type="button"
                id="btn-confirm-report-identity"
                onClick={handleReport}
                disabled={reporting}
                className="btn-danger"
              >
                {reporting ? <Loader2 size={16} className="animate-spin" /> : 'Cancelar e Denunciar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
