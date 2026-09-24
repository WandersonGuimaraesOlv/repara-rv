'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { resolveSosAlertAction } from '@/app/actions/admin-users'

// Encerrar um SOS no painel (lacuna do plano de contingência, 24/09/2026):
// antes a lista só mostrava os alertas, sem registro do que a equipe fez.
export function SosResolve({
  alertId,
  resolved,
  resolvedNotes,
  resolvedAt,
  onResolved,
}: {
  alertId: string
  resolved: boolean | null
  resolvedNotes: string | null
  resolvedAt: string | null
  onResolved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  if (resolved) {
    return (
      <p className="text-xs text-emerald-400 flex items-start gap-1.5">
        <CheckCircle2 size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Resolvido{resolvedAt ? ` em ${new Date(resolvedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : ''}
          {resolvedNotes ? ` — ${resolvedNotes}` : ''}
        </span>
      </p>
    )
  }

  const submit = async () => {
    setBusy(true)
    const res = await resolveSosAlertAction({ alertId, notes }).catch(() => null)
    if (res?.success) {
      toast.success('SOS marcado como resolvido.')
      setOpen(false)
      setNotes('')
      onResolved()
    } else {
      toast.error(res?.error || 'Erro de conexão ao resolver o SOS.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        id={`btn-sos-resolve-${alertId}`}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer"
      >
        <CheckCircle2 size={13} aria-hidden="true" /> Marcar como resolvido
      </button>
    )
  }

  return (
    <div className="space-y-2 w-full">
      <label htmlFor={`sos-notes-${alertId}`} className="text-[11px] font-semibold text-white block">
        O que foi feito?
      </label>
      <textarea
        id={`sos-notes-${alertId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder="Ex.: liguei para o cliente, era engano; técnico seguiu o atendimento."
        className="w-full text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white p-2 resize-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || notes.trim().length < 5}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
        >
          {busy && <Loader2 size={13} className="animate-spin" />} Confirmar
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setNotes('') }}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)] cursor-pointer"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
