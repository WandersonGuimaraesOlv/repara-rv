'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceCall } from '@/lib/types'
import { CallStatusTracker } from '@/components/call-status-tracker'
import { PixPaymentModal } from '@/components/pix-payment-modal'
import { EmergencySosButton } from '@/components/emergency-sos-button'
import { formatCurrency } from '@/lib/utils'
import { XCircle, Loader2, Star, ArrowLeft, CheckCircle2, AlertTriangle, CreditCard, FileText } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { CallChat } from '@/components/chat/call-chat'
import { ChamadoEmFila } from '@/components/chamado-em-fila'
import { CancelCallModal } from '@/components/cancel-call-modal'
import { ComprovanteManutencaoModal } from '@/components/comprovante-manutencao-modal'
import { ProviderIdentityCard } from '@/components/provider-identity-card'

export default function AcompanharPage() {
  const { callId } = useParams<{ callId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [call, setCall] = useState<ServiceCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPix, setShowPix] = useState(false)
  const [showNoShowFeePix, setShowNoShowFeePix] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showComprovante, setShowComprovante] = useState(false)
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)
  const hasAutoOpenedPixRef = useRef(false)

  // Função para buscar o estado atual do chamado oficial no banco
  const fetchCall = useCallback(async () => {
    if (!callId) return
    const { data, error } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(*), provider:profiles!provider_id(*), client:profiles!client_id(*)')
      .eq('id', callId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar chamado:', error)
    }

    if (data) {
      setCall(data as ServiceCall)
      if (data.status === 'completed' && data.payment_status !== 'paid' && !hasAutoOpenedPixRef.current) {
        hasAutoOpenedPixRef.current = true
        setShowPix(true)
      }
    }
    setLoading(false)
  }, [callId, supabase])

  useEffect(() => {
    fetchCall()

    // Realtime do Supabase
    const channel = supabase
      .channel(`call-realtime-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_calls', filter: `id=eq.${callId}` },
        payload => {
          fetchCall()
          if (payload.new.status === 'completed') {
            if (payload.new.payment_status !== 'paid') {
              toast.info('Serviço concluído pelo técnico! Realize o pagamento via Pix.')
              setShowPix(true)
            } else {
              toast.success('🎉 Pagamento confirmado com sucesso!')
              setShowPix(false)
            }
          }
          if (payload.new.status === 'accepted' || payload.new.status === 'on_the_way') {
            toast.success('🎉 Um profissional aceitou seu chamado e já está a caminho! 🚗⚡')
          }
          if (payload.new.status === 'queued') {
            toast.info('Seu chamado está na fila prioritária. Avisaremos no seu WhatsApp!')
          }
        }
      )
      .subscribe()

    // Polling ativo a cada 3s como redundância para garantir atualização no celular
    const pollInterval = setInterval(() => {
      fetchCall()
    }, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [callId, fetchCall, supabase])

  // Timeout automático de 30 segundos no status 'searching':
  // Se o prestador no radar não responder dentro de 30s, pula automaticamente para o próximo profissional
  const isSkippingRef = useRef(false)
  useEffect(() => {
    if (!call || call.status !== 'searching' || !call.provider_id) return

    const checkSearchingTimeout = async () => {
      const referenceTime = new Date(call.updated_at || call.created_at).getTime()
      const elapsedSeconds = Math.floor((Date.now() - referenceTime) / 1000)

      if (elapsedSeconds >= 30 && !isSkippingRef.current) {
        isSkippingRef.current = true
        console.log(`⏱ [Timeout 30s] Prestador ${call.provider_id} não atendeu (${elapsedSeconds}s). Buscando próximo...`)
        try {
          const res = await fetch('/api/calls/skip-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              call_id: call.id,
              rejected_provider_id: call.provider_id,
            }),
          })
          const data = await res.json()
          if (data.status === 'queued') {
            toast.info('Nenhum prestador atendeu no momento. Chamado enviado para a fila prioritária!')
          } else if (data.status === 'searching') {
            toast.info('Buscando o próximo profissional disponível...')
          }
          await fetchCall()
        } catch (err) {
          console.error('Falha ao repassar chamado por timeout:', err)
        } finally {
          setTimeout(() => {
            isSkippingRef.current = false
          }, 4000)
        }
      }
    }

    const timeoutInterval = setInterval(checkSearchingTimeout, 2000)
    checkSearchingTimeout()

    return () => clearInterval(timeoutInterval)
  }, [call, fetchCall])

  const handleConfirmCancel = async (reason: string, note?: string) => {
    if (!call) return
    setCancelling(true)

    try {
      const response = await fetch('/api/calls/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          reason,
          cancellation_reason: reason,
          note,
        }),
      })
      setCancelling(false)
      setShowCancelModal(false)
      if (response.ok) {
        toast.info('Chamado cancelado com sucesso.')
        router.replace('/')
      } else {
        const json = await response.json().catch(() => ({}))
        toast.error(json.error || 'Erro ao cancelar chamado.')
      }
    } catch {
      setCancelling(false)
      toast.error('Erro de conexão ao cancelar chamado.')
    }
  }

  const handleRate = async (stars: number) => {
    if (rated) return
    setRating(stars)
    await supabase.from('service_ratings').insert({ call_id: callId, rating: stars })
    setRated(true)
    toast.success('Obrigado pela avaliação! ⭐')
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
        <p className="text-xs mb-6" style={{ color: 'var(--color-text-muted)' }}>Este chamado não existe ou já foi finalizado.</p>
        <Link href="/" className="btn-primary">
          <ArrowLeft size={16} /> Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container p-4">
      {/* Header */}
      <header className="py-4 mb-6 flex items-center justify-between gap-2">
        <h1 className="font-bold" style={{ color: 'var(--color-text)' }}>
          Acompanhar Chamado
        </h1>
        <div className="flex items-center gap-2">
          <EmergencySosButton
            callId={callId}
            userRole="client"
            status={call.status}
            clientAddress={call.client_address}
            clientLocation={call.client_location}
          />
          <span
            className="text-xs px-3 py-1 rounded-full font-mono font-semibold"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            #{callId.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </header>

      {/* Se o chamado estiver na fila de espera prioritária */}
      {(call.status === 'queued' || call.status === 'no_providers_available') ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <ChamadoEmFila
            call={{
              id: call.id,
              service_name: (call.service as { name?: string })?.name ?? 'Serviço residencial',
              address: call.client_address,
              price: call.total_price,
              client_phone: (call.client as { phone?: string })?.phone,
            }}
            onCancel={() => setShowCancelModal(true)}
          />
        </div>
      ) : (
        <>
          {/* Tracker central */}
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <CallStatusTracker
              status={call.status}
              providerName={(call.provider as { full_name?: string })?.full_name}
            />
          </div>

          {/* Card de identificação do prestador + PIN de chegada */}
          {call.provider && (call.status === 'accepted' || call.status === 'on_the_way' || call.status === 'in_progress') && (
            <ProviderIdentityCard
              callId={callId}
              providerName={(call.provider as { full_name?: string })?.full_name}
              avatarUrl={(call.provider as { avatar_url?: string | null })?.avatar_url}
              isVerified={(call.provider as { background_check_status?: string })?.background_check_status === 'approved'}
              arrivalPin={call.arrival_pin}
            />
          )}

          {/* Info do serviço */}
          <div
            className="card p-4 mb-4"
            style={{ borderColor: 'var(--color-border-strong)' }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Serviço solicitado</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                  {(call.service as { name?: string })?.name ?? 'Serviço'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  📍 {call.client_address}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Total</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(call.total_price)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Chat em Tempo Real com Alinhamento de Materiais e Peças */}
      {(call.status === 'accepted' || call.status === 'on_the_way' || call.status === 'in_progress' || call.status === 'completed') && (
        <CallChat
          callId={callId}
          currentUserId={call.client_id}
          userRole="client"
        />
      )}

      {/* Status de Pagamento (quando concluído) */}

      {call.status === 'completed' && (
        call.payment_status === 'paid' ? (
          <div className="card p-4 mb-4 flex items-center gap-3" style={{ background: 'rgba(94, 211, 164, 0.1)', borderColor: 'rgba(94, 211, 164, 0.25)' }}>
            <CheckCircle2 size={24} className="shrink-0" style={{ color: 'var(--color-success)' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>Pagamento Confirmado!</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Serviço concluído e quitado via Pix. Obrigado pela preferência!</p>
            </div>
          </div>
        ) : (
          <div className="card p-4 mb-4" style={{ background: 'rgba(237, 198, 107, 0.08)', borderColor: 'rgba(237, 198, 107, 0.25)' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>Pagamento Pendente</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  O técnico finalizou o serviço. Conclua o pagamento de <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(call.total_price)}</strong> para obter a quitação.
                </p>
                <button
                  onClick={() => setShowPix(true)}
                  className="btn-primary mt-3 py-2.5 text-xs"
                >
                  <CreditCard size={15} /> Pagar agora via Pix / Cartão
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Avaliação (após concluído) */}
      {call.status === 'completed' && (
        <>
          <div
            className="card p-4 mb-4 text-center animate-slide-up"
            style={{ borderColor: 'var(--color-border-strong)' }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Como foi o serviço?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  id={`btn-rate-${star}`}
                  onClick={() => handleRate(star)}
                  disabled={rated}
                  className="transition-transform hover:scale-125 active:scale-95"
                >
                  <Star
                    size={32}
                    fill={star <= rating ? 'var(--color-accent)' : 'none'}
                    style={{ color: star <= rating ? 'var(--color-accent)' : 'var(--color-border)' }}
                  />
                </button>
              ))}
            </div>
            {rated && <p className="text-xs mt-2" style={{ color: 'var(--color-success)' }}>Avaliação enviada! Obrigado ⭐</p>}
          </div>

          {/* Comprovante Oficial para Imobiliária / Inquilino */}
          <div
            className="card p-4 mb-4 animate-slide-up text-left"
            style={{ background: 'var(--color-primary-soft)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ background: 'var(--color-surface)', color: 'var(--color-primary)' }}>
                <FileText size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>Mora de aluguel ou precisa de recibo?</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  Gere o comprovante oficial timbrado do Repara RV para abater no aluguel ou comprovação junto à imobiliária em Rio Verde.
                </p>
                <button
                  type="button"
                  onClick={() => setShowComprovante(true)}
                  className="btn-primary mt-2.5 py-2 text-xs"
                >
                  <FileText size={14} />
                  <span>Baixar Comprovante de Manutenção (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Botão cancelar (só se searching) */}
      {call.status === 'searching' && (
        <div className="pb-6">
          <button
            id="btn-cancel-call"
            onClick={() => setShowCancelModal(true)}
            disabled={cancelling}
            className="btn-danger"
          >
            {cancelling ? (
              <><Loader2 size={16} className="animate-spin" /> Cancelando...</>
            ) : (
              <><XCircle size={16} /> Cancelar chamado</>
            )}
          </button>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-subtle)' }}>
            Cancelamento gratuito enquanto busca prestador
          </p>
        </div>
      )}

      {/* Taxa de deslocamento pendente (no-show — prestador cancelou por cliente ausente) */}
      {call.status === 'cancelled' && call.cancel_reason === 'provider_absent' && call.no_show_fee_status && (
        <div
          className="card p-4 mb-4"
          style={{ background: 'rgba(237, 198, 107, 0.08)', borderColor: 'rgba(237, 198, 107, 0.25)' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
                {call.no_show_fee_status === 'paid' ? 'Taxa de Deslocamento Quitada' : 'Taxa de Deslocamento Pendente'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {call.no_show_fee_status === 'paid' ? (
                  <>A taxa de <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(25)}</strong> por ausência no local foi paga. Obrigado.</>
                ) : (
                  <>O técnico esperou no local e você não atendeu. Conforme os <Link href="/termos" target="_blank" className="underline">Termos de Uso</Link>, aplica-se uma taxa de deslocamento de <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(25)}</strong>.</>
                )}
              </p>
              {call.no_show_fee_status === 'pending' && (
                <button
                  id="btn-pay-no-show-fee"
                  onClick={() => setShowNoShowFeePix(true)}
                  className="btn-primary mt-3 py-2.5 text-xs"
                >
                  <CreditCard size={15} /> Pagar via Pix
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voltar ao início (apenas após cancelamento explícito) */}
      {call.status === 'cancelled' && (
        <div className="pb-6">
          <Link href="/" id="btn-go-home" className="btn-primary">
            ← Voltar ao início
          </Link>
        </div>
      )}

      {/* Modal de confirmação e motivo de cancelamento */}
      <CancelCallModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={handleConfirmCancel}
        isLoading={cancelling}
      />

      {/* Modal de comprovante oficial para imobiliária */}
      {showComprovante && (
        <ComprovanteManutencaoModal
          isOpen={showComprovante}
          onClose={() => setShowComprovante(false)}
          call={{
            id: call.id,
            service_name: (call.service as { name?: string })?.name ?? 'Serviço Residencial',
            total_price: call.total_price,
            client_address: call.client_address,
            client_name: (call.client as { full_name?: string })?.full_name,
            client_phone: (call.client as { phone?: string })?.phone,
            provider_name: (call.provider as { full_name?: string })?.full_name,
            completed_at: call.completed_at ?? undefined,
            created_at: call.created_at,
          }}
        />
      )}

      {/* Modal de pagamento Pix / Cartão */}
      {showPix && (
        <PixPaymentModal
          amount={call.total_price}
          providerCut={call.provider_cut}
          pixQrCode={call.pix_qr_code}
          pixCopyPaste={call.pix_copy_paste}
          checkoutUrl={call.cancel_note}
          callId={callId}
          onClose={() => setShowPix(false)}
        />
      )}

      {/* Modal de pagamento da taxa de deslocamento (no-show, R$25 — só Pix) */}
      {showNoShowFeePix && (
        <PixPaymentModal
          mode="no_show_fee"
          amount={25}
          providerCut={0}
          pixQrCode={call.no_show_fee_pix_qr_code}
          pixCopyPaste={call.no_show_fee_pix_copy_paste}
          callId={callId}
          onClose={() => setShowNoShowFeePix(false)}
        />
      )}
    </div>
  )
}
