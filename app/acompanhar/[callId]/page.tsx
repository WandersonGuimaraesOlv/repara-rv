'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceCall } from '@/lib/types'
import { CallStatusTracker } from '@/components/call-status-tracker'
import { PixPaymentModal } from '@/components/pix-payment-modal'
import { EmergencySosButton } from '@/components/emergency-sos-button'
import { formatCurrency, getStatusLabel } from '@/lib/utils'
import { XCircle, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'


export default function AcompanharPage() {
  const { callId } = useParams<{ callId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [call, setCall] = useState<ServiceCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPix, setShowPix] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)

  useEffect(() => {
    if (callId.startsWith('demo-')) {
      setCall({
        id: callId,
        client_id: 'demo-client-1',
        provider_id: 'demo-provider-rv',
        service_id: '1',
        service: {
          id: '1',
          name: 'Troca de Chuveiro / Resistência',
          category: 'Elétrica',
          description: 'Substituição de chuveiro ou resistência',
          fixed_price: 70,
          platform_fee: 10,
          icon: 'zap',
          color: '#6366F1',
          sort_order: 1,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        provider: {
          id: 'demo-provider-rv',
          phone: '64999998888',
          full_name: 'Carlos Eletricista (Rio Verde)',
          role: 'provider',
          is_active: true,
          created_at: new Date().toISOString(),
        },
        total_price: 70,
        platform_fee: 10,
        provider_cut: 60,
        status: 'searching',
        client_address: 'Rua das Flores, 142 - Bairro Popular, Rio Verde (GO)',
        client_location: { type: 'Point', coordinates: [-50.9264, -17.8014] } as unknown as any,
        created_at: new Date().toISOString(),
      })
      setLoading(false)
      return
    }

    // Busca inicial
    supabase
      .from('service_calls')
      .select('*, service:quick_services(*), provider:profiles!provider_id(*)')
      .eq('id', callId)
      .single()
      .then(({ data }) => {
        setCall(data as ServiceCall)
        setLoading(false)
        if (data?.status === 'completed') setShowPix(true)
      })

    // Realtime
    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_calls', filter: `id=eq.${callId}` },
        payload => {
          setCall(prev => ({ ...prev, ...payload.new } as ServiceCall))
          if (payload.new.status === 'completed') {
            toast.success('Serviço concluído! Realize o pagamento via Pix 🎉')
            setShowPix(true)
          }
          if (payload.new.status === 'accepted' || payload.new.status === 'on_the_way') {
            toast.info('Prestador a caminho! 🚗')
          }
          if (payload.new.status === 'no_providers_available') {
            toast.error('Nenhum prestador disponível no momento.')
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [callId])

  const handleCancel = async () => {
    if (!call || call.status !== 'searching') return
    setCancelling(true)

    if (callId.startsWith('demo-')) {
      setTimeout(() => {
        setCancelling(false)
        toast.info('Chamado cancelado com sucesso.')
        router.replace('/')
      }, 500)
      return
    }

    const response = await fetch('/api/calls/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, reason: 'client_request' }),
    })
    setCancelling(false)
    if (response.ok) {
      toast.info('Chamado cancelado.')
      router.replace('/')
    } else {
      toast.error('Erro ao cancelar. Tente novamente.')
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
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
      </div>
    )
  }

  if (!call) {
    return (
      <div className="page-container items-center justify-center p-6 text-center">
        <p style={{ color: 'var(--color-text-muted)' }}>Chamado não encontrado.</p>
        <Link href="/" className="btn-primary mt-4">Voltar ao início</Link>
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
          <span className="text-xs px-3 py-1 rounded-full font-mono" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-subtle)' }}>
            #{callId.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </header>

      {/* Tracker central */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <CallStatusTracker
          status={call.status}
          providerName={(call.provider as { full_name?: string })?.full_name}
        />
      </div>

      {/* Info do serviço */}
      <div
        className="card p-4 mb-4"
        style={{ borderColor: 'rgba(99,102,241,0.3)' }}
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
            <p className="font-bold" style={{ color: 'var(--color-cta)' }}>
              {formatCurrency(call.total_price)}
            </p>
          </div>
        </div>
      </div>

      {/* Avaliação (após concluído) */}
      {call.status === 'completed' && (
        <div
          className="card p-4 mb-4 text-center animate-slide-up"
          style={{ borderColor: 'rgba(245,158,11,0.4)' }}
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
                  fill={star <= rating ? '#F59E0B' : 'none'}
                  style={{ color: star <= rating ? '#F59E0B' : 'var(--color-border)' }}
                />
              </button>
            ))}
          </div>
          {rated && <p className="text-xs mt-2" style={{ color: 'var(--color-success)' }}>Avaliação enviada! Obrigado ⭐</p>}
        </div>
      )}

      {/* Painel de Simulação (Modo Demonstração) */}
      {callId.startsWith('demo-') && (
        <div
          className="card p-3 mb-4 text-center space-y-2 animate-slide-up"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)' }}
        >
          <p className="text-xs font-bold text-indigo-400">🧪 Simular Etapas do Chamado</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {call.status === 'searching' && (
              <button
                type="button"
                id="btn-demo-accept"
                onClick={() => {
                  setCall(prev => prev ? { ...prev, status: 'accepted' } : null)
                  toast.success('🚗 Carlos Eletricista aceitou seu chamado e está a caminho!')
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Simular Prestador Aceitando
              </button>
            )}
            {(call.status === 'accepted' || call.status === 'on_the_way') && (
              <button
                type="button"
                id="btn-demo-complete"
                onClick={() => {
                  setCall(prev => prev ? { ...prev, status: 'completed' } : null)
                  setShowPix(true)
                  toast.success('🎉 Serviço finalizado! Abrindo QR Code Pix.')
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Simular Serviço Concluído
              </button>
            )}
            {call.status === 'completed' && (
              <button
                type="button"
                id="btn-demo-open-pix"
                onClick={() => setShowPix(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-500"
              >
                Ver QR Code Pix
              </button>
            )}
          </div>
        </div>
      )}

      {/* Botão cancelar (só se searching) */}
      {call.status === 'searching' && (
        <div className="pb-6">
          <button
            id="btn-cancel-call"
            onClick={handleCancel}
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

      {/* Voltar ao início (após cancelamento/sem prestador) */}
      {(call.status === 'cancelled' || call.status === 'no_providers_available') && (
        <div className="pb-6">
          <Link href="/" id="btn-go-home" className="btn-primary">
            ← Voltar ao início
          </Link>
        </div>
      )}

      {/* Modal de pagamento Pix */}
      {showPix && (
        <PixPaymentModal
          amount={call.total_price}
          providerCut={call.provider_cut}
          pixQrCode={call.pix_qr_code}
          pixCopyPaste={call.pix_copy_paste}
          callId={callId}
          onClose={() => setShowPix(false)}
        />
      )}
    </div>
  )
}
