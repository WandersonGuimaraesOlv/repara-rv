'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WARRANTY_DAYS, WARRANTY_DESCRIPTION_MAX, WARRANTY_DESCRIPTION_MIN, warrantyDeadline } from '@/lib/warranty'

// Garantia de 7 dias acionada pelo cliente (lib/warranty.ts): mostra o prazo,
// o botão "Acionar garantia" e, depois, o andamento que a equipe registrou.

interface ClaimRow {
  id: string
  status: 'open' | 'resolved' | 'rejected'
  resolution_note: string | null
  created_at: string
}

function formatDay(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
}

export function WarrantyCard({ callId, completedAt }: { callId: string; completedAt: string }) {
  const [claim, setClaim] = useState<ClaimRow | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [now] = useState(() => Date.now())

  const deadline = warrantyDeadline(completedAt)
  const expired = deadline.getTime() < now

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('warranty_claims')
      .select('id, status, resolution_note, created_at')
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setClaim((data as ClaimRow | null) ?? null)
    setLoaded(true)
  }, [callId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/calls/warranty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, description: description.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Não foi possível acionar a garantia agora. Tente de novo.')
        return
      }
      toast.success('Garantia acionada. A equipe vai entrar em contato para combinar o retorno do técnico.')
      setShowForm(false)
      setDescription('')
      await load()
    } catch {
      toast.error('Falha de conexão. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  if (!loaded) return null

  if (claim?.status === 'open') {
    return (
      <div id="warranty-open" className="card p-4 mb-4 flex items-start gap-3" style={{ borderColor: 'var(--color-warning)' }}>
        <ShieldAlert size={20} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <strong className="block mb-1" style={{ color: 'var(--color-text)' }}>Garantia acionada em {formatDay(claim.created_at)}</strong>
          A equipe do Repara RV vai entrar em contato para combinar o retorno do técnico, sem custo se a falha for da mão de obra.
        </p>
      </div>
    )
  }

  // Aqui a garantia, se existe, já foi encerrada (a aberta retornou acima)
  const closedNote = claim && (
    <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
      Garantia {claim.status === 'resolved' ? 'resolvida' : 'recusada'}{claim.resolution_note ? `: ${claim.resolution_note}` : '.'}
    </p>
  )

  if (expired) {
    return (
      <div id="warranty-expired" className="card p-4 mb-4 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
        {closedNote}
        A garantia de {WARRANTY_DAYS} dias deste serviço terminou em {formatDay(deadline)}.
      </div>
    )
  }

  return (
    <div id="warranty-card" className="card p-4 mb-4 space-y-3" style={{ borderColor: 'var(--color-border-strong)' }}>
      {closedNote}
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <strong className="block mb-1" style={{ color: 'var(--color-text)' }}>Garantia de {WARRANTY_DAYS} dias até {formatDay(deadline)}</strong>
          Se o reparo apresentar falha, vazamento ou desregulagem por causa da mão de obra, o técnico volta sem custo. Defeito da peça ou mau uso não entram.
        </p>
      </div>

      {!showForm ? (
        <button id="btn-open-warranty" type="button" onClick={() => setShowForm(true)} className="btn-secondary">
          <ShieldAlert size={16} strokeWidth={2} aria-hidden="true" /> Acionar garantia
        </button>
      ) : (
        <div className="space-y-2">
          <label htmlFor="input-warranty-description" className="text-xs font-semibold block" style={{ color: 'var(--color-text)' }}>
            O que aconteceu?
          </label>
          <textarea
            id="input-warranty-description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, WARRANTY_DESCRIPTION_MAX))}
            placeholder="Ex.: o registro voltou a pingar dois dias depois do conserto."
            className="input resize-none"
            rows={3}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setShowForm(false); setDescription('') }} disabled={sending} className="btn-secondary">
              Voltar
            </button>
            <button
              id="btn-send-warranty"
              type="button"
              onClick={() => void submit()}
              disabled={sending || description.trim().length < WARRANTY_DESCRIPTION_MIN}
              className="btn-primary"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
