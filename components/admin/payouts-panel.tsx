'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Banknote, Copy, Loader2, RefreshCw, Undo2, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react'
import { getPayoutsAction, markPayoutDoneAction, undoPayoutAction, type PayoutRow } from '@/app/actions/admin-users'
import { payoutDeadline, payoutState, type PayoutState } from '@/lib/payouts'
import { formatCurrency } from '@/lib/utils'

// Repasse manual ao técnico (lib/payouts.ts): o que falta pagar, com a chave
// Pix cadastrada pelo técnico e o prazo de 48 h do Contrato, e o registro de
// quando foi feito — evita pagar duas vezes ou esquecer alguém.

const STATE_ORDER: Record<PayoutState, number> = { overdue: 0, pending: 1, suspended: 2, not_due: 3, done: 4 }

function hoursBetween(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / 3600_000))
}

function deadlineText(row: PayoutRow, state: PayoutState, now: number): string {
  if (state === 'suspended') return 'Suspenso: garantia aberta'
  if (!row.paidAt) return 'Pago (sem data registrada)'
  const deadline = payoutDeadline(row.paidAt).getTime()
  return state === 'overdue'
    ? `Atrasado há ${hoursBetween(deadline, now)} h`
    : `Vence em ${hoursBetween(now, deadline)} h`
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Chave Pix copiada.')
  } catch {
    toast.error('Não deu pra copiar. Selecione a chave e copie manualmente.')
  }
}

export function PayoutsPanel({ now }: { now: number }) {
  const [rows, setRows] = useState<PayoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getPayoutsAction().catch(() => null)
    if (res?.success && res.data) {
      setRows(res.data)
    } else {
      toast.error(res?.error || 'Erro ao carregar os repasses.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const withState = rows.map((row) => ({
    row,
    state: payoutState(
      { status: 'completed', payment_status: 'paid', paid_at: row.paidAt, payout_at: row.payoutAt },
      row.hasOpenWarranty,
      now
    ),
  }))
  const pending = withState
    .filter((r) => r.state !== 'done')
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.row.paidAt ?? '').localeCompare(b.row.paidAt ?? ''))
  const done = withState.filter((r) => r.state === 'done').sort((a, b) => (b.row.payoutAt ?? '').localeCompare(a.row.payoutAt ?? ''))
  const payable = pending.filter((r) => r.state !== 'suspended')
  const totalPayable = payable.reduce((sum, r) => sum + r.row.amount, 0)
  const overdueCount = pending.filter((r) => r.state === 'overdue').length
  const suspendedCount = pending.filter((r) => r.state === 'suspended').length

  const handleMark = async (callId: string) => {
    setBusyId(callId)
    const res = await markPayoutDoneAction({ callId, reference: reference.trim() || undefined }).catch(() => null)
    if (res?.success) {
      toast.success('Repasse registrado.')
      setConfirmingId(null)
      setReference('')
      await load()
    } else {
      toast.error(res?.error || 'Erro de conexão ao registrar o repasse.')
    }
    setBusyId(null)
  }

  const handleUndo = async (callId: string) => {
    setBusyId(callId)
    const res = await undoPayoutAction({ callId }).catch(() => null)
    if (res?.success) {
      toast.success('Repasse desfeito. O chamado voltou para a lista de pendentes.')
      setConfirmingId(null)
      await load()
    } else {
      toast.error(res?.error || 'Erro de conexão ao desfazer o repasse.')
    }
    setBusyId(null)
  }

  return (
    <section id="admin-payouts" className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Banknote size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
          Repasses aos técnicos
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

      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          A repassar: {formatCurrency(totalPayable)} ({payable.length})
        </span>
        {overdueCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
            Atrasados (mais de 48 h): {overdueCount}
          </span>
        )}
        {suspendedCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Suspensos por garantia: {suspendedCount}
          </span>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Carregando…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Nenhum repasse pendente.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map(({ row, state }) => {
            const busy = busyId === row.callId
            const tone =
              state === 'overdue' ? 'text-red-400' : state === 'suspended' ? 'text-amber-400' : 'text-[var(--color-text-muted)]'
            return (
              <li key={row.callId} className="p-4 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{row.providerName}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      <span className="font-mono text-[var(--color-primary)]">#{row.callId.slice(0, 8).toUpperCase()}</span> · {row.serviceName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(row.amount)}</p>
                    <p className={`text-[11px] font-semibold ${tone}`}>{deadlineText(row, state, now)}</p>
                  </div>
                </div>

                {row.pixKey ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-[var(--color-text-muted)]">Chave Pix{row.pixKeyType ? ` (${row.pixKeyType})` : ''}:</span>
                    <span className="font-mono text-white select-all break-all">{row.pixKey}</span>
                    <button
                      type="button"
                      onClick={() => void copyText(row.pixKey ?? '')}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      <Copy size={11} aria-hidden="true" /> Copiar
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle size={12} aria-hidden="true" /> Técnico sem chave Pix cadastrada: peça pelo WhatsApp antes de repassar.
                  </p>
                )}

                {state !== 'suspended' && (
                  confirmingId === row.callId ? (
                    <div className="space-y-2">
                      <label htmlFor={`payout-ref-${row.callId}`} className="text-[11px] font-semibold text-white block">
                        Referência do Pix (opcional): ID da transação ou observação
                      </label>
                      <input
                        id={`payout-ref-${row.callId}`}
                        value={reference}
                        onChange={(e) => setReference(e.target.value.slice(0, 200))}
                        className="w-full text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white p-2"
                        placeholder="Ex.: E1234567820260924…"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleMark(row.callId)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                          Confirmar: já fiz o Pix de {formatCurrency(row.amount)}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmingId(null); setReference('') }}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id={`btn-payout-${row.callId}`}
                      onClick={() => { setConfirmingId(row.callId); setReference('') }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                    >
                      <CheckCircle2 size={13} aria-hidden="true" /> Marcar repasse feito
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] cursor-pointer"
          >
            <ChevronDown size={13} className={showDone ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" />
            Repasses feitos nos últimos 30 dias ({done.length})
          </button>
          {showDone && (
            <ul className="space-y-2">
              {done.map(({ row }) => (
                <li key={row.callId} className="p-3 rounded-xl border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-[var(--color-text-muted)]">
                    <strong className="text-white">{row.providerName}</strong> · {formatCurrency(row.payoutAmount ?? row.amount)} ·{' '}
                    {row.payoutAt ? new Date(row.payoutAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : ''}
                    {row.payoutReference ? ` · ref. ${row.payoutReference}` : ''}
                  </span>
                  {confirmingId === `undo-${row.callId}` ? (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUndo(row.callId)}
                        disabled={busyId === row.callId}
                        className="px-2 py-1 rounded-lg font-bold bg-red-600 text-white disabled:opacity-50 cursor-pointer"
                      >
                        Sim, desfazer
                      </button>
                      <button type="button" onClick={() => setConfirmingId(null)} className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-pointer">
                        Voltar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(`undo-${row.callId}`)}
                      className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-white font-semibold cursor-pointer"
                    >
                      <Undo2 size={11} aria-hidden="true" /> Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
