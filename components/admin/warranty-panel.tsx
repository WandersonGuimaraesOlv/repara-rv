'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldAlert, Loader2, MessageCircle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { getWarrantyClaimsAction, resolveWarrantyClaimAction, type WarrantyClaimRow } from '@/app/actions/admin-users'
import { whatsAppLink } from '@/lib/whatsapp-link'

// Garantias de 7 dias acionadas pelos clientes no app (lib/warranty.ts): a
// equipe combina o retorno do técnico e encerra aqui. Enquanto a garantia
// está aberta, o repasse do chamado fica suspenso (lib/payouts.ts).

const STATUS_LABEL: Record<WarrantyClaimRow['status'], string> = {
  open: 'Aberta',
  resolved: 'Resolvida',
  rejected: 'Recusada',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function WarrantyPanel() {
  const [rows, setRows] = useState<WarrantyClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState<{ id: string; outcome: 'resolved' | 'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getWarrantyClaimsAction().catch(() => null)
    if (res?.success && res.data) {
      setRows(res.data)
    } else {
      toast.error(res?.error || 'Erro ao carregar as garantias.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const open = rows.filter((r) => r.status === 'open')
  const closed = rows.filter((r) => r.status !== 'open')

  const handleClose = async () => {
    if (!closing) return
    setBusy(true)
    const res = await resolveWarrantyClaimAction({ claimId: closing.id, outcome: closing.outcome, note }).catch(() => null)
    if (res?.success) {
      toast.success(closing.outcome === 'resolved' ? 'Garantia resolvida. O repasse do chamado foi liberado.' : 'Garantia recusada. O repasse do chamado foi liberado.')
      setClosing(null)
      setNote('')
      await load()
    } else {
      toast.error(res?.error || 'Erro de conexão ao encerrar a garantia.')
    }
    setBusy(false)
  }

  return (
    <section id="admin-warranty" className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldAlert size={16} className="text-amber-400" aria-hidden="true" />
          Garantias
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">{open.length} aberta{open.length === 1 ? '' : 's'}</span>
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Atualizar
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Carregando…</p>
      ) : open.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Nenhuma garantia aberta.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((w) => {
            const shortId = w.callId.slice(0, 8).toUpperCase()
            const clientWa = whatsAppLink(w.clientPhone, `Olá ${w.clientName}, falo da equipe do Repara RV sobre a garantia do chamado #${shortId}.`)
            const providerWa = whatsAppLink(w.providerPhone, `Olá ${w.providerName}, falo da equipe do Repara RV: o cliente acionou a garantia do chamado #${shortId}.`)
            const isClosing = closing?.id === w.id
            return (
              <li key={w.id} className="p-4 rounded-xl bg-[var(--color-surface-alt)] border border-amber-500/30 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    <span className="font-mono text-[var(--color-primary)]">#{shortId}</span> · {w.serviceName}
                  </p>
                  <span className="text-[11px] text-[var(--color-text-muted)]">acionada em {formatDate(w.createdAt)}</span>
                </div>
                <p className="text-xs text-amber-200 whitespace-pre-wrap">“{w.description}”</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
                  <span>
                    Cliente: <strong className="text-white">{w.clientName}</strong>
                    {clientWa && (
                      <a href={clientWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-blue-400 hover:text-blue-300 font-semibold">
                        <MessageCircle size={11} aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                  </span>
                  <span>
                    Técnico: <strong className="text-white">{w.providerName}</strong>
                    {providerWa && (
                      <a href={providerWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-emerald-400 hover:text-emerald-300 font-semibold">
                        <MessageCircle size={11} aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                  </span>
                </div>

                {isClosing ? (
                  <div className="space-y-2">
                    <label htmlFor={`warranty-note-${w.id}`} className="text-[11px] font-semibold text-white block">
                      {closing.outcome === 'resolved' ? 'O que foi feito? (o cliente vê este texto)' : 'Por que foi recusada? (o cliente vê este texto)'}
                    </label>
                    <textarea
                      id={`warranty-note-${w.id}`}
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                      rows={2}
                      placeholder={closing.outcome === 'resolved' ? 'Ex.: técnico voltou e trocou a vedação.' : 'Ex.: a falha é defeito de fábrica da peça, fora da garantia da mão de obra.'}
                      className="w-full text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white p-2 resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleClose()}
                        disabled={busy || note.trim().length < 5}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer ${closing.outcome === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                      >
                        {busy && <Loader2 size={13} className="animate-spin" />}
                        {closing.outcome === 'resolved' ? 'Confirmar: resolvida' : 'Confirmar: recusada'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setClosing(null); setNote('') }}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      id={`btn-warranty-resolve-${w.id}`}
                      onClick={() => { setClosing({ id: w.id, outcome: 'resolved' }); setNote('') }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                    >
                      <CheckCircle2 size={13} aria-hidden="true" /> Marcar como resolvida
                    </button>
                    <button
                      type="button"
                      id={`btn-warranty-reject-${w.id}`}
                      onClick={() => { setClosing({ id: w.id, outcome: 'rejected' }); setNote('') }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 cursor-pointer"
                    >
                      <XCircle size={13} aria-hidden="true" /> Recusar (fora da garantia)
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="text-[11px] text-[var(--color-text-muted)]">
          <summary className="cursor-pointer font-semibold">Encerradas nos últimos 30 dias ({closed.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {closed.map((w) => (
              <li key={w.id}>
                <span className="font-mono text-[var(--color-primary)]">#{w.callId.slice(0, 8).toUpperCase()}</span> · {STATUS_LABEL[w.status]}
                {w.resolvedAt ? ` em ${formatDate(w.resolvedAt)}` : ''}{w.resolutionNote ? ` — ${w.resolutionNote}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
