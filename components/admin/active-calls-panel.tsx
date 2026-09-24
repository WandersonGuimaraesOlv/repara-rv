'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Activity, ClipboardCheck, Loader2, MessageCircle, XCircle, AlertTriangle } from 'lucide-react'
import { approveCompletionAsAdminAction, cancelCallAsAdminAction } from '@/app/actions/admin-users'
import { ADMIN_CANCELLABLE_STATUSES, canAdminCancel } from '@/lib/completion-review'

// Chamados que ainda não terminaram, com as saídas da equipe pros impasses
// (plano de contingência, 24/09/2026): cancelar um chamado travado (técnico
// sumiu depois do aceite — cliente e admin não tinham como) e aprovar a
// conclusão pelo cliente (conferência antes do Pix — lib/completion-review.ts).

export interface ActiveCallRow {
  id: string
  status: string
  created_at: string
  neighborhood: string | null
  completion_issue?: string | null
  completion_issue_count?: number | null
  service?: { name: string } | null
  client?: { full_name: string; phone: string } | null
  provider?: { full_name: string; phone: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  searching: 'Buscando técnico',
  queued: 'Na fila',
  no_providers_available: 'Sem técnico',
  accepted: 'Técnico a caminho',
  on_the_way: 'Técnico a caminho',
  in_progress: 'Em atendimento',
  awaiting_approval: 'Aguardando conferência',
}

function waLink(phone: string | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`
}

function minutesSince(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `há ${hours} h ${minutes % 60} min`
}

// Lista inicial curta: a conferência e os mais recentes vêm primeiro
const INITIAL_VISIBLE = 10

// Conferência com problema primeiro, depois conferência, depois o resto
function priority(call: ActiveCallRow): number {
  if (call.status === 'awaiting_approval') return 0
  if (call.status === 'in_progress' && call.completion_issue) return 1
  return 2
}

export function ActiveCallsPanel({ calls, now, onChanged }: { calls: ActiveCallRow[]; now: number; onChanged: () => void }) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const active = calls
    .filter(c => (ADMIN_CANCELLABLE_STATUSES as readonly string[]).includes(c.status))
    .sort((a, b) => priority(a) - priority(b) || b.created_at.localeCompare(a.created_at))
  const visible = showAll ? active : active.slice(0, INITIAL_VISIBLE)

  const handleCancel = async (callId: string) => {
    setBusyId(callId)
    try {
      const res = await cancelCallAsAdminAction({ callId, reason: cancelReason })
      if (res.success) {
        toast.success('Chamado cancelado. Cliente e técnico veem o cancelamento no app.')
        setCancellingId(null)
        setCancelReason('')
        onChanged()
      } else {
        toast.error(res.error || 'Não foi possível cancelar.')
      }
    } catch {
      toast.error('Erro de conexão ao cancelar.')
    } finally {
      setBusyId(null)
    }
  }

  const handleApprove = async (callId: string) => {
    setBusyId(callId)
    try {
      const res = await approveCompletionAsAdminAction({ callId })
      if (res.success) {
        toast.success('Conclusão aprovada. O Pix já aparece para o cliente.')
        setApprovingId(null)
        onChanged()
      } else {
        toast.error(res.error || 'Não foi possível aprovar.')
      }
    } catch {
      toast.error('Erro de conexão ao aprovar.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section id="admin-active-calls" className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
          Chamados em andamento
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">{active.length}</span>
        </h2>
      </div>

      {active.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Nenhum chamado em andamento agora.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map(call => {
            const shortId = call.id.slice(0, 8).toUpperCase()
            const clientWa = waLink(call.client?.phone, `Olá ${call.client?.full_name ?? ''}, falo da equipe do Repara RV sobre o chamado #${shortId}.`)
            const providerWa = waLink(call.provider?.phone, `Olá ${call.provider?.full_name ?? ''}, falo da equipe do Repara RV sobre o chamado #${shortId}.`)
            const isAwaiting = call.status === 'awaiting_approval'
            const busy = busyId === call.id

            return (
              <li key={call.id} className="p-4 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">
                      <span className="font-mono text-[var(--color-primary)]">#{shortId}</span> · {call.service?.name ?? 'Serviço'}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {call.neighborhood ?? 'Bairro não informado'} · aberto {minutesSince(call.created_at, now)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isAwaiting
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                    }`}
                  >
                    {STATUS_LABELS[call.status] ?? call.status}
                  </span>
                </div>

                {call.completion_issue && (
                  <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Cliente apontou{call.completion_issue_count && call.completion_issue_count > 1 ? ` (${call.completion_issue_count}×)` : ''}: “{call.completion_issue}”
                    </span>
                  </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-[var(--color-text-muted)]">
                    Cliente: <strong className="text-white">{call.client?.full_name ?? '—'}</strong>
                    {clientWa && (
                      <a href={clientWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-blue-400 hover:text-blue-300 font-semibold">
                        <MessageCircle size={11} aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    Técnico: <strong className="text-white">{call.provider?.full_name ?? '—'}</strong>
                    {providerWa && (
                      <a href={providerWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-emerald-400 hover:text-emerald-300 font-semibold">
                        <MessageCircle size={11} aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                  </span>
                </div>

                {cancellingId === call.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`admin-cancel-reason-${call.id}`} className="text-[11px] font-semibold text-white block">
                      Motivo do cancelamento (fica registrado)
                    </label>
                    <textarea
                      id={`admin-cancel-reason-${call.id}`}
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value.slice(0, 500))}
                      rows={2}
                      placeholder="Ex.: técnico não responde e não chegou ao local."
                      className="w-full text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white p-2 resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancel(call.id)}
                        disabled={busy || cancelReason.trim().length < 5}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 cursor-pointer"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} aria-hidden="true" />} Confirmar cancelamento
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCancellingId(null); setCancelReason('') }}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : approvingId === call.id ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-white">
                      Aprovar a conclusão pelo cliente? O chamado vira concluído e o Pix aparece para ele pagar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(call.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} aria-hidden="true" />} Sim, aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => setApprovingId(null)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {isAwaiting && (
                      <button
                        type="button"
                        id={`btn-admin-approve-${call.id}`}
                        onClick={() => setApprovingId(call.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                      >
                        <ClipboardCheck size={13} aria-hidden="true" /> Aprovar pelo cliente
                      </button>
                    )}
                    {canAdminCancel(call.status) && (
                      <button
                        type="button"
                        id={`btn-admin-cancel-${call.id}`}
                        onClick={() => { setCancellingId(call.id); setApprovingId(null) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 cursor-pointer"
                      >
                        <XCircle size={13} aria-hidden="true" /> Cancelar chamado
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {active.length > INITIAL_VISIBLE && (
        <button
          type="button"
          id="btn-admin-active-calls-toggle"
          onClick={() => setShowAll(v => !v)}
          className="text-xs font-semibold text-[var(--color-primary)] cursor-pointer"
        >
          {showAll ? 'Mostrar menos' : `Mostrar todos (${active.length})`}
        </button>
      )}
    </section>
  )
}
