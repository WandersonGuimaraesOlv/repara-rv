'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceCall, CancelReason } from '@/lib/types'
import { NavigationButtons } from '@/components/navigation-buttons'
import { EmergencySosButton } from '@/components/emergency-sos-button'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, XCircle, Loader2, ArrowLeft, Wrench, MapPin, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: 'provider_absent', label: 'Cliente ausente após 10 min' },
  { value: 'wrong_address', label: 'Endereço incorreto / não encontrado' },
  { value: 'technical_issue', label: 'Problema técnico / falta de material' },
  { value: 'other', label: 'Outro motivo' },
]

export default function ChamadoProviderPage() {
  const { callId } = useParams<{ callId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [call, setCall] = useState<ServiceCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState<CancelReason>('provider_absent')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const loadCall = useCallback(async () => {
    if (!callId) return
    const { data, error } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(*), client:profiles!client_id(*)')
      .eq('id', callId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar chamado:', error)
    }

    if (data) {
      setCall(data as ServiceCall)
      if (data.status === 'accepted') {
        await supabase
          .from('service_calls')
          .update({ status: 'on_the_way' })
          .eq('id', callId)
      }
    }
    setLoading(false)
  }, [callId, supabase])

  useEffect(() => {
    loadCall()

    // Realtime do Supabase
    const channel = supabase
      .channel(`provider-call-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_calls', filter: `id=eq.${callId}` },
        payload => setCall(prev => ({ ...prev, ...payload.new } as ServiceCall))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callId, loadCall, supabase])

  const handleComplete = async () => {
    setCompleting(true)

    const { error } = await supabase
      .from('service_calls')
      .update({
        status: 'in_progress',
        completed_at: new Date().toISOString(),
      })
      .eq('id', callId)

    if (error) {
      setCompleting(false)
      toast.error('Erro ao atualizar chamado. Tente novamente.')
      return
    }

    // Cria cobrança Pix
    try {
      await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          amount: call?.total_price,
          description: `Repara RV - ${(call?.service as { name?: string })?.name ?? 'Serviço'}`,
        }),
      })
    } catch (pixErr) {
      console.error('Erro ao chamar /api/pix/create:', pixErr)
    }

    // Marca como completed
    await supabase
      .from('service_calls')
      .update({ status: 'completed' })
      .eq('id', callId)

    setCompleting(false)
    toast.success('Serviço concluído! O cliente receberá o Pix para pagamento.')
    router.replace('/painel')
  }

  const handleCancel = async () => {
    setCancelling(true)

    try {
      const response = await fetch('/api/calls/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          reason: cancelReason,
          note: cancelNote,
        }),
      })
      setCancelling(false)
      if (response.ok) {
        toast.success('Chamado cancelado.')
        router.replace('/painel')
      } else {
        const json = await response.json().catch(() => ({}))
        toast.error(json.error || 'Erro ao cancelar. Tente novamente.')
      }
    } catch {
      setCancelling(false)
      toast.error('Erro de conexão ao cancelar.')
    }
  }

  if (loading) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
      </div>
    )
  }

  if (!call) {
    return (
      <div className="page-container items-center justify-center p-6 text-center">
        <p className="text-base font-semibold text-slate-800 mb-2">Chamado não encontrado</p>
        <Link href="/painel" className="btn-primary">
          <ArrowLeft size={16} /> Voltar ao Painel
        </Link>
      </div>
    )
  }

  const lat = call.client_location?.coordinates?.[1]
  const lng = call.client_location?.coordinates?.[0]

  return (
    <div className="page-container p-4">
      {/* Header */}
      <header className="py-4 mb-4 flex items-center gap-3">
        <Link href="/painel" id="btn-back-to-painel" className="p-2 rounded-full" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <ArrowLeft size={18} style={{ color: 'var(--color-text)' }} />
        </Link>
        <h1 className="font-bold" style={{ color: 'var(--color-text)' }}>Chamado Aceito</h1>
        <div className="ml-auto flex items-center gap-2">
          <EmergencySosButton
            callId={callId}
            userRole="provider"
            status={call.status}
            clientAddress={call.client_address}
            clientLocation={call.client_location}
          />
          <span className="text-xs px-2 py-1 rounded-full font-mono" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid #10B981' }}>
            ● Em andamento
          </span>
        </div>
      </header>

      {/* Card do serviço */}
      <div className="card p-4 mb-4 animate-slide-up" style={{ borderColor: 'rgba(99,102,241,0.4)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <Wrench size={18} style={{ color: 'var(--color-brand-light)' }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              {(call.service as { name?: string })?.name ?? 'Serviço'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Cliente: {(call.client as { full_name?: string })?.full_name ?? 'Cliente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <MapPin size={14} style={{ color: 'var(--color-cta)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {call.client_address}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DollarSign size={14} style={{ color: 'var(--color-success)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
            Você recebe: {formatCurrency(call.provider_cut)}
          </p>
        </div>
      </div>

      {/* Aviso de peças */}
      <div className="banner-warning mb-4 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <span className="text-sm flex-shrink-0">⚠️</span>
        <p className="text-xs" style={{ color: '#FCD34D' }}>
          <strong>Lembre o cliente:</strong> peças e materiais são cobrados à parte, conforme combinado.
        </p>
      </div>

      {/* Botões de navegação */}
      {lat !== undefined && lng !== undefined && lat !== null && lng !== null && (
        <div className="card p-4 mb-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            🗺️ Navegar até o local
          </p>
          <NavigationButtons lat={lat} lng={lng} address={call.client_address} />
        </div>
      )}

      {/* Ação de concluir */}
      {!showCancel && (
        <div className="space-y-3 mt-4 animate-slide-up" style={{ animationDelay: '160ms' }}>
          <button
            id="btn-complete-service"
            onClick={handleComplete}
            disabled={completing}
            className="btn-primary"
          >
            {completing ? (
              <><Loader2 size={18} className="animate-spin" /> Finalizando...</>
            ) : (
              <><CheckCircle size={18} /> Serviço concluído — gerar Pix</>
            )}
          </button>

          <button
            id="btn-show-cancel"
            onClick={() => setShowCancel(true)}
            className="btn-danger"
          >
            <XCircle size={16} />
            Não consigo atender
          </button>
        </div>
      )}

      {/* Formulário de cancelamento */}
      {showCancel && (
        <div
          className="card p-4 mt-4 animate-slide-up"
          style={{ borderColor: 'rgba(239,68,68,0.4)' }}
        >
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-danger)' }}>
            Motivo do cancelamento
          </h3>
          <div className="space-y-2 mb-4">
            {CANCEL_REASONS.map(({ value, label }) => (
              <label
                key={value}
                id={`cancel-reason-${value}`}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: cancelReason === value ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-alt)',
                  border: `1.5px solid ${cancelReason === value ? 'var(--color-danger)' : 'var(--color-border)'}`,
                }}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={value}
                  checked={cancelReason === value}
                  onChange={() => setCancelReason(value)}
                  className="accent-red-500"
                />
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</span>
              </label>
            ))}
          </div>

          <textarea
            id="input-cancel-note"
            value={cancelNote}
            onChange={e => setCancelNote(e.target.value)}
            placeholder="Observação adicional (opcional)"
            className="input resize-none mb-4"
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              id="btn-cancel-back"
              onClick={() => setShowCancel(false)}
              className="btn-secondary"
            >
              Voltar
            </button>
            <button
              id="btn-confirm-cancel"
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-danger"
            >
              {cancelling ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
