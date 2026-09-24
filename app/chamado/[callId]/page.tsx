'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceCall, CancelReason } from '@/lib/types'
import { NavigationButtons } from '@/components/navigation-buttons'
import { EmergencySosButton } from '@/components/emergency-sos-button'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, XCircle, Loader2, ArrowLeft, Wrench, MapPin, DollarSign, KeyRound, AlertTriangle, Map as MapIcon } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { CallChat } from '@/components/chat/call-chat'
import { ProviderTrackingMap } from '@/components/provider-tracking-map'
import { useGeolocation } from '@/hooks/useGeolocation'
import { fetchCallParty, type CallPartyCard } from '@/lib/call-party'

// Intervalo de envio da posição durante o trajeto (o mapa do cliente busca
// no mesmo ritmo — components/provider-tracking-map.tsx).
const POSITION_SEND_MS = 15_000

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
  const [clientCard, setClientCard] = useState<CallPartyCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [showStartPin, setShowStartPin] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [starting, setStarting] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState<CancelReason>('provider_absent')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const loadCall = useCallback(async () => {
    if (!callId) return
    // O cliente vem de call_party_profiles (só nome, depois do aceite) — o
    // perfil dele não é mais legível direto (achado A5).
    const { data, error } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(*)')
      .eq('id', callId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar chamado:', error)
    }

    if (data) {
      setCall(data as ServiceCall)
      setClientCard(await fetchCallParty(supabase, callId, 'client'))
      if (data.status === 'accepted') {
        // Transições do prestador passam pelo servidor — ver app/api/calls/advance.
        const res = await fetch('/api/calls/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId, action: 'on_the_way' }),
        }).catch(() => null)
        if (res?.ok) {
          setCall(prev => (prev ? { ...prev, status: 'on_the_way' } : prev))
        }
      }
    }
    setLoading(false)
  }, [callId, supabase])

  // Posição do técnico durante o trajeto (aceito → a caminho), para o mapa do
  // cliente em app/acompanhar. Para ao iniciar o atendimento. Parado, reenvia
  // a mesma posição a cada POSITION_SEND_MS pra mostrar que o app está aberto.
  const isTrip = call?.status === 'accepted' || call?.status === 'on_the_way'
  const providerId = call?.provider_id ?? null
  const { lat: myLat, lng: myLng, errorCode: geoErrorCode, permission: geoPermission } = useGeolocation(isTrip)
  const lastSentAtRef = useRef(0)

  const sendPosition = useCallback((lat: number, lng: number) => {
    if (!providerId) return
    lastSentAtRef.current = Date.now()
    supabase
      .from('provider_status')
      .update({ current_location: `SRID=4326;POINT(${lng} ${lat})`, updated_at: new Date().toISOString() })
      .eq('provider_id', providerId)
      .then(() => {})
  }, [providerId, supabase])

  useEffect(() => {
    if (!isTrip || myLat === null || myLng === null) return
    if (Date.now() - lastSentAtRef.current >= POSITION_SEND_MS) sendPosition(myLat, myLng)
    const interval = setInterval(() => sendPosition(myLat, myLng), POSITION_SEND_MS)
    return () => clearInterval(interval)
  }, [isTrip, myLat, myLng, sendPosition])

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

  // PIN de chegada (call_arrival_pins, gerado pelo servidor no aceite — ver
  // app/api/calls/advance e app/api/calls/claim-queued): só o cliente vê o
  // código, e o prestador digita o que o cliente falar. Achado de auditoria
  // (16/09/2026): a comparação rodava inteira no navegador — movida pra POST
  // /api/calls/verify-arrival-pin (exige sessão do prestador vinculado ao
  // chamado e trava o chamado depois de 5 erros). A transição pra
  // in_progress só acontece se a rota confirmar o PIN.
  const handleStartService = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/calls/verify-arrival-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, pin: pinInput }),
      })
      const data = await res.json().catch(() => ({}))
      setStarting(false)

      if (!res.ok) {
        toast.error(data.error || 'Erro ao iniciar atendimento. Tente novamente.')
        return
      }

      toast.success('Atendimento iniciado!')
      setShowStartPin(false)
      setPinInput('')
    } catch {
      setStarting(false)
      toast.error('Falha de conexão. Tente novamente.')
    }
  }

  const handleComplete = async () => {
    setCompleting(true)

    // Cria cobrança Pix e Cartão no Mercado Pago
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

    // Marca como completed pelo servidor (payment_status continua pending até
    // o cliente pagar) — só vale a partir de in_progress, ou seja, depois do PIN.
    try {
      const res = await fetch('/api/calls/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, action: 'complete' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCompleting(false)
        toast.error(data.error || 'Não foi possível concluir o serviço. Tente novamente.')
        return
      }
    } catch {
      setCompleting(false)
      toast.error('Falha de conexão ao concluir. Tente novamente.')
      return
    }

    setCompleting(false)
    toast.success('Serviço concluído! O QR Code Pix e opção de Cartão foram gerados para o cliente.')
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
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (!call) {
    return (
      <div className="page-container items-center justify-center p-6 text-center">
        <p className="text-base font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Chamado não encontrado</p>
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

      {/* Ir até o cliente: no topo durante o trajeto (Waze/Maps instalado,
          já navegando — components/navigation-buttons.tsx) */}
      {isTrip && lat !== undefined && lng !== undefined && lat !== null && lng !== null && (
        <div id="navigate-to-client" className="card p-4 mb-4 animate-slide-up" style={{ borderColor: 'var(--color-border-strong)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            <MapIcon size={15} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1.5" aria-hidden="true" />Ir até o cliente
          </p>
          <NavigationButtons lat={lat} lng={lng} address={call.client_address} />
        </div>
      )}

      {/* Card do serviço */}
      <div className="card p-4 mb-4 animate-slide-up" style={{ borderColor: 'var(--color-border-strong)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-soft)', border: '1px solid var(--color-border)' }}>
            <Wrench size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              {(call.service as { name?: string })?.name ?? 'Serviço'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Cliente: {clientCard?.full_name ?? 'Cliente'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
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
        <AlertTriangle size={16} strokeWidth={2} className="flex-shrink-0" style={{ color: '#F59E0B' }} aria-hidden="true" />
        <p className="text-xs" style={{ color: '#FCD34D' }}>
          <strong>Lembre o cliente:</strong> peças e materiais são cobrados à parte, conforme combinado.
        </p>
      </div>

      {/* Trajeto no mapa (o cliente vê a mesma posição até o PIN) */}
      {isTrip && (geoPermission === 'denied' || geoErrorCode === 1) && (
        <div id="tracking-gps-blocked" className="banner-warning mb-4">
          <AlertTriangle size={16} strokeWidth={2} className="flex-shrink-0" style={{ color: '#F59E0B' }} aria-hidden="true" />
          <p className="text-xs" style={{ color: '#FCD34D' }}>
            Sua localização está bloqueada: o cliente não consegue ver você chegando. Libere a localização do site nas configurações do navegador.
          </p>
        </div>
      )}
      {isTrip && <ProviderTrackingMap callId={callId} viewer="provider" />}

      {/* Chat em Tempo Real com Alinhamento de Materiais e Peças */}
      {(call.status === 'accepted' || call.status === 'on_the_way' || call.status === 'in_progress' || call.status === 'completed') && (
        <CallChat
          callId={callId}
          currentUserId={call.provider_id || ''}
          userRole="provider"
        />
      )}

      {/* Ação de concluir */}

      {!showCancel && (
        <div className="space-y-3 mt-4 animate-slide-up" style={{ animationDelay: '160ms' }}>
          {call.status === 'on_the_way' && !showStartPin && (
            <button
              id="btn-open-start-service"
              onClick={() => setShowStartPin(true)}
              className="btn-primary"
            >
              <KeyRound size={18} /> Iniciar Atendimento
            </button>
          )}

          {call.status === 'on_the_way' && showStartPin && (
            <div className="card p-4" style={{ borderColor: 'var(--color-border-strong)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Confirme o PIN de chegada
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Peça ao cliente o código de 4 dígitos exibido na tela de acompanhamento dele.
              </p>
              <input
                id="input-arrival-pin"
                type="text"
                inputMode="numeric"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                autoFocus
                className="input text-center tracking-[0.5em] font-mono text-xl mb-3"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="btn-cancel-start-pin"
                  onClick={() => { setShowStartPin(false); setPinInput('') }}
                  className="btn-secondary"
                >
                  Voltar
                </button>
                <button
                  id="btn-confirm-start-service"
                  onClick={handleStartService}
                  disabled={starting || pinInput.length !== 4}
                  className="btn-primary"
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar e Iniciar'}
                </button>
              </div>
            </div>
          )}

          {call.status === 'in_progress' && (
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
          )}

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
