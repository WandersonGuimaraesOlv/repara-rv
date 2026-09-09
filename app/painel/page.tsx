'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ServiceCall } from '@/lib/types'
import { CallAlertModal } from '@/components/call-alert-modal'
import { useGeolocation } from '@/hooks/useGeolocation'
import { Power, Wifi, WifiOff, Wrench, Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'

export default function PainelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [pendingCall, setPendingCall] = useState<ServiceCall | null>(null)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const [totalToday, setTotalToday] = useState(0)

  const { lat, lng, error: geoError, getPosition } = useGeolocation(true)

  // Dispara pedido de permissão de GPS logo na entrada do painel
  useEffect(() => {
    getPosition()
  }, [getPosition])

  // Busca perfil do prestador
  useEffect(() => {
    const load = async () => {
      const isDemo = typeof document !== 'undefined' && document.cookie.includes('repara_demo_role=provider')

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (prof && prof.role === 'provider') {
            setProfile(prof as Profile)
            const { data: status } = await supabase
              .from('provider_status')
              .select('is_online')
              .eq('provider_id', user.id)
              .single()
            setIsOnline(status?.is_online ?? false)

            const today = new Date().toISOString().split('T')[0]
            const { data: calls } = await supabase
              .from('service_calls')
              .select('provider_cut')
              .eq('provider_id', user.id)
              .eq('status', 'completed')
              .gte('completed_at', today)
            setTotalToday(calls?.reduce((sum, c) => sum + (c.provider_cut ?? 0), 0) ?? 0)
            return
          }

          if (prof && prof.role === 'client') {
            toast.info('Cadastre sua chave Pix para começar a receber chamados como prestador!')
            router.replace('/onboarding?role=provider')
            return
          }
        }
      } catch {
        // Fallback para modo demo se Supabase offline
      }

      if (isDemo) {
        setProfile({
          id: 'demo-provider-rv',
          phone: '64999998888',
          full_name: 'Carlos Eletricista (Rio Verde)',
          role: 'provider',
          pix_key: '64999998888',
          pix_key_type: 'phone',
          is_active: true,
          created_at: new Date().toISOString(),
        })
        setIsOnline(true)
        setTotalToday(140.0)
        return
      }

      router.replace('/login')
    }
    load()
  }, [])

  // Atualiza localização quando muda (GPS watch)
  useEffect(() => {
    if (!isOnline || !lat || !lng || !profile) return
    supabase
      .from('provider_status')
      .update({
        current_location: `SRID=4326;POINT(${lng} ${lat})`,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', profile.id)
      .then(() => {})
  }, [lat, lng, isOnline, profile])

  // Toggle online/offline com obtenção ativa de GPS e fallback de segurança
  const handleToggleOnline = async () => {
    if (!profile) return
    setTogglingOnline(true)

    const newOnline = !isOnline
    let currentLat = lat
    let currentLng = lng

    if (newOnline && (!currentLat || !currentLng)) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof window === 'undefined' || !('geolocation' in navigator)) {
            reject(new Error('GPS indisponível'))
            return
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 30000,
          })
        })
        currentLat = pos.coords.latitude
        currentLng = pos.coords.longitude
      } catch (err) {
        console.warn('GPS não obtido diretamente pelo navegador, usando centro de Rio Verde:', err)
        // Coordenadas padrão de Rio Verde (GO) - Setor Central (-17.7915, -50.9192)
        currentLat = -17.7915
        currentLng = -50.9192
        toast.info('Localização aproximada definida no Setor Central de Rio Verde.')
      }
    }

    const locationPoint = newOnline && currentLat && currentLng
      ? `SRID=4326;POINT(${currentLng} ${currentLat})`
      : null

    await supabase
      .from('provider_status')
      .update({
        is_online: newOnline,
        current_location: locationPoint,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', profile.id)

    setIsOnline(newOnline)
    setTogglingOnline(false)
    toast.success(newOnline ? '✅ Você está online! Aguardando chamados.' : '🔴 Você está offline.')
  }

  // Supabase Realtime — escuta novos chamados searching para este prestador
  useEffect(() => {
    if (!profile || !isOnline) return

    // 1. Busca inicial se já houver chamado searching aguardando
    const checkActiveCalls = async () => {
      const { data: calls } = await supabase
        .from('service_calls')
        .select('*, service:quick_services(*)')
        .eq('provider_id', profile.id)
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(1)

      if (calls && calls.length > 0) {
        setPendingCall(calls[0] as ServiceCall)
      }
    }
    checkActiveCalls()

    // 2. Escuta tanto INSERT quanto UPDATE em tempo real
    const channel = supabase
      .channel(`provider-calls-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_calls',
          filter: `provider_id=eq.${profile.id}`,
        },
        async payload => {
          const callData = payload.new as ServiceCall
          if (callData && callData.status === 'searching') {
            if (!callData.service && callData.service_id) {
              const { data: srv } = await supabase
                .from('quick_services')
                .select('*')
                .eq('id', callData.service_id)
                .single()
              callData.service = srv as any
            }
            setPendingCall(callData)
          } else if (callData && callData.status !== 'searching') {
            setPendingCall(null)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile, isOnline])

  const handleAcceptCall = useCallback(async () => {
    if (!pendingCall) return
    const callId = pendingCall.id
    setPendingCall(null)

    if (!callId.startsWith('demo-')) {
      await supabase
        .from('service_calls')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', callId)
    }

    router.push(`/chamado/${callId}`)
  }, [pendingCall, router, supabase])

  const handleRejectCall = useCallback(async () => {
    if (!pendingCall) return
    if (!pendingCall.id.startsWith('demo-')) {
      await fetch('/api/calls/skip-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: pendingCall.id, rejected_provider_id: profile?.id }),
      })
    }
    setPendingCall(null)
    toast.info('Chamado recusado. Buscando próximo prestador...')
  }, [pendingCall, profile])

  const handleTimeoutCall = useCallback(async () => {
    if (!pendingCall) return
    if (!pendingCall.id.startsWith('demo-')) {
      await fetch('/api/calls/skip-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: pendingCall.id, rejected_provider_id: profile?.id }),
      })
    }
    setPendingCall(null)
    toast.warning('Tempo esgotado! Chamado foi para o próximo prestador.')
  }, [pendingCall, profile])

  if (!profile) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
      </div>
    )
  }

  return (
    <div className="page-container p-4">
      {/* Header */}
      <header className="py-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))' }}
          >
            <Wrench size={16} color="white" />
          </div>
          <div>
            <h1 className="text-base font-black" style={{ color: 'var(--color-text)' }}>
              Repara<span style={{ color: 'var(--color-cta)' }}>RV</span>
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Painel do Prestador</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: isOnline ? 'rgba(16,185,129,0.15)' : 'var(--color-surface)', border: `1px solid ${isOnline ? '#10B981' : 'var(--color-border)'}` }}
        >
          {isOnline ? <Wifi size={14} style={{ color: '#10B981' }} /> : <WifiOff size={14} style={{ color: 'var(--color-text-subtle)' }} />}
          <span className="text-xs font-semibold" style={{ color: isOnline ? '#10B981' : 'var(--color-text-subtle)' }}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Saudação */}
      <section className="mb-6 animate-slide-up">
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Olá,</p>
        <h2 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
          {profile.full_name.split(' ')[0]} 👋
        </h2>
        {totalToday > 0 && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-success)' }}>
            Você ganhou <strong>R$ {totalToday.toFixed(2).replace('.', ',')}</strong> hoje ✨
          </p>
        )}
      </section>

      {/* GPS Warning */}
      {geoError && isOnline && (
        <div className="banner-warning mb-4 animate-slide-up">
          <MapPin size={16} style={{ color: '#F59E0B' }} className="flex-shrink-0" />
          <p className="text-xs" style={{ color: '#FCD34D' }}>
            <strong>GPS inativo.</strong> {geoError} Clientes próximos não serão encontrados corretamente.
          </p>
        </div>
      )}

      {/* Toggle Online/Offline */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <div className="relative mb-8">
          {isOnline && (
            <span className="animate-pulse-ring absolute inset-0 rounded-full" />
          )}
          <button
            id="btn-toggle-online"
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className="relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: isOnline
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, var(--color-surface-alt), var(--color-surface))',
              border: `3px solid ${isOnline ? '#10B981' : 'var(--color-border)'}`,
              boxShadow: isOnline ? '0 0 32px rgba(16,185,129,0.4)' : 'var(--shadow-card)',
            }}
          >
            {togglingOnline ? (
              <Loader2 size={32} className="animate-spin" color="white" />
            ) : (
              <Power size={36} color={isOnline ? 'white' : 'var(--color-text-subtle)'} />
            )}
            <span
              className="text-xs font-bold"
              style={{ color: isOnline ? 'white' : 'var(--color-text-subtle)' }}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </button>
        </div>

        <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {isOnline
            ? '🟢 Você está visível para clientes próximos.\nMantendo GPS ativo...'
            : 'Toque para ficar disponível\ne receber chamados.'}
        </p>

        {lat && lng && isOnline && (
          <div className="flex items-center gap-1.5 mt-3">
            <MapPin size={12} style={{ color: 'var(--color-success)' }} />
            <p className="text-xs" style={{ color: 'var(--color-success)' }}>
              GPS ativo — {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          </div>
        )}
      </div>

      {/* Instruções */}
      {!isOnline && (
        <div
          className="card p-4 mt-4 animate-slide-up"
          style={{ animationDelay: '200ms' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Como funciona
          </h3>
          <div className="space-y-3">
            {[
              ['1', 'Fique online para aparecer no radar dos clientes'],
              ['2', 'Quando um chamado chegar, você terá até 30 segundos para aceitar'],
              ['3', 'Após aceitar, abra o Waze ou Maps para ir ao local'],
              ['4', 'O cliente paga via Pix ao final — você recebe direto na conta'],
            ].map(([n, text]) => (
              <div key={n} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--color-brand-glow)', color: 'var(--color-brand-light)' }}
                >
                  {n}
                </span>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de alerta de chamado com som, vibração e timer */}
      {pendingCall && (
        <CallAlertModal
          call={pendingCall}
          serviceName={(pendingCall.service as { name?: string })?.name ?? 'Serviço Solicitado'}
          clientAddress={pendingCall.client_address}
          totalPrice={pendingCall.total_price}
          providerCut={pendingCall.provider_cut}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onTimeout={handleTimeoutCall}
        />
      )}
    </div>
  )
}
