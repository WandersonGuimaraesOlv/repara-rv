'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ServiceCall } from '@/lib/types'
import { CallAlertModal } from '@/components/call-alert-modal'
import { useGeolocation } from '@/hooks/useGeolocation'
import { Power, Loader2, MapPin, CreditCard, Zap, Lock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/provider/panel-header'

export default function PainelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [pendingCall, setPendingCall] = useState<ServiceCall | null>(null)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const [totalToday, setTotalToday] = useState(0)
  const [pendingToday, setPendingToday] = useState(0)
  const [providerPixKey, setProviderPixKey] = useState('')
  const [recipientGatewayId, setRecipientGatewayId] = useState<string | null>(null)
  const [connectingMp, setConnectingMp] = useState(false)
  const [queuedCalls, setQueuedCalls] = useState<ServiceCall[]>([])
  const [claimingCallId, setClaimingCallId] = useState<string | null>(null)

  const { lat, lng, error: geoError, getPosition } = useGeolocation(true)

  // Dispara pedido de permissão de GPS logo na entrada do painel
  useEffect(() => {
    getPosition()
  }, [getPosition])

  // Busca perfil oficial do prestador
  useEffect(() => {
    const load = async () => {
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
              .select('is_online, pix_key, recipient_gateway_id')
              .eq('provider_id', user.id)
              .maybeSingle()

            const hasMp = Boolean(status?.recipient_gateway_id)
            setRecipientGatewayId(status?.recipient_gateway_id ?? null)

            // Regra estrita: prestador sem subconta conectada NÃO pode estar online
            if (!hasMp && status?.is_online) {
              setIsOnline(false)
              await supabase
                .from('provider_status')
                .update({ is_online: false, updated_at: new Date().toISOString() })
                .eq('provider_id', user.id)
            } else {
              setIsOnline(hasMp && Boolean(status?.is_online))
            }

            if (status?.pix_key) {
              setProviderPixKey(status.pix_key)
            }

            const today = new Date().toISOString().split('T')[0]
            const { data: calls } = await supabase
              .from('service_calls')
              .select('provider_cut, payment_status')
              .eq('provider_id', user.id)
              .eq('status', 'completed')
              .gte('completed_at', today)

            const paidCalls = calls?.filter(c => c.payment_status === 'paid') || []
            const pendingCalls = calls?.filter(c => c.payment_status !== 'paid') || []

            setTotalToday(paidCalls.reduce((sum, c) => sum + (c.provider_cut ?? 0), 0))
            setPendingToday(pendingCalls.length)
            return
          }

          if (prof && prof.role === 'client') {
            toast.info('Cadastre sua chave Pix para começar a receber chamados como prestador!')
            router.replace('/onboarding?role=provider')
            return
          }
        }
      } catch (err) {
        console.error('Erro ao carregar perfil do prestador:', err)
      }

      router.replace('/login')
    }
    load()
  }, [router, supabase])

  // Monitora retorno da autorização do Mercado Pago
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mp_connected') === 'true') {
        toast.success('Conta Mercado Pago conectada com sucesso! Split automático ativado ⚡')
        const url = new URL(window.location.href)
        url.searchParams.delete('mp_connected')
        window.history.replaceState({}, '', url.toString())
      } else if (params.get('mp_error')) {
        toast.error(`Falha na autorização Mercado Pago: ${params.get('mp_error')}`)
        const url = new URL(window.location.href)
        url.searchParams.delete('mp_error')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [])

  const handleConnectMercadoPago = async () => {
    setConnectingMp(true)
    try {
      const res = await fetch('/api/mercadopago/oauth/url')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Erro ao iniciar conexão com Mercado Pago.')
        setConnectingMp(false)
      }
    } catch {
      toast.error('Erro de conexão com o servidor.')
      setConnectingMp(false)
    }
  }

  const handleDisconnectMercadoPago = async () => {
    try {
      const res = await fetch('/api/mercadopago/oauth/disconnect', { method: 'POST' })
      if (res.ok) {
        setRecipientGatewayId(null)
        setIsOnline(false)
        toast.success('Conta Mercado Pago desconectada. Você foi colocado offline.')
      } else {
        toast.error('Erro ao desconectar.')
      }
    } catch {
      toast.error('Falha de conexão.')
    }
  }

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
  }, [lat, lng, isOnline, profile, supabase])

  // Toggle online/offline com obtenção ativa de GPS e trava obrigatória do Mercado Pago
  const handleToggleOnline = async () => {
    if (!profile) return

    if (!recipientGatewayId) {
      toast.error('Para receber chamados e garantir seus repasses automáticos via Pix, conecte sua conta do Mercado Pago acima.')
      return
    }

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

  // Supabase Realtime + Polling — escuta novos chamados searching para este prestador
  useEffect(() => {
    if (!profile || !isOnline) return

    // 1. Busca ativa e polling de 3 segundos para garantir alerta em tempo real
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
      } else if (!calls || calls.length === 0) {
        setPendingCall(prev => (prev?.status === 'searching' ? null : prev))
      }
    }

    checkActiveCalls()
    const pollInterval = setInterval(checkActiveCalls, 3000)

    // 2. Realtime WebSocket do Supabase
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
                .maybeSingle()
              callData.service = srv as any
            }
            setPendingCall(callData)
          } else if (callData && callData.status !== 'searching') {
            setPendingCall(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [profile, isOnline, supabase])

  const handleAcceptCall = useCallback(async () => {
    if (!pendingCall) return
    const callId = pendingCall.id
    setPendingCall(null)

    await supabase
      .from('service_calls')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', callId)

    router.push(`/chamado/${callId}`)
  }, [pendingCall, router, supabase])

  const handleRejectCall = useCallback(async () => {
    if (!pendingCall) return
    await fetch('/api/calls/skip-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: pendingCall.id, rejected_provider_id: profile?.id }),
    })
    setPendingCall(null)
    toast.info('Chamado recusado. Buscando próximo prestador...')
  }, [pendingCall, profile])

  const handleTimeoutCall = useCallback(async () => {
    if (!pendingCall) return
    await fetch('/api/calls/skip-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: pendingCall.id, rejected_provider_id: profile?.id }),
    })
    setPendingCall(null)
    toast.warning('Tempo esgotado! Chamado foi para o próximo prestador.')
  }, [pendingCall, profile])

  // Monitora chamados na fila prioritária
  useEffect(() => {
    if (!profile) return

    const loadQueued = async () => {
      const { data } = await supabase
        .from('service_calls')
        .select('*, service:quick_services(*)')
        .eq('status', 'queued')
        .order('created_at', { ascending: false })
        .limit(5)

      setQueuedCalls((data as ServiceCall[]) || [])
    }

    loadQueued()
    const interval = setInterval(loadQueued, 4000)

    // Escuta alterações na tabela de chamados via Supabase Realtime
    const channel = supabase
      .channel('service_calls_queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_calls' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE') {
            // Se o chamado que estava na fila mudou de status (ex: 'accepted'),
            // remove o card da tela de todos os outros prestadores na hora (<300ms)
            if (payload.new && payload.new.status !== 'queued') {
              setQueuedCalls(prev => prev.filter(c => c.id !== payload.new.id))
            } else if (payload.new && payload.new.status === 'queued') {
              loadQueued()
            }
          } else if (payload.eventType === 'INSERT') {
            if (payload.new && payload.new.status === 'queued') {
              loadQueued()
            }
          } else if (payload.eventType === 'DELETE') {
            if (payload.old && payload.old.id) {
              setQueuedCalls(prev => prev.filter(c => c.id !== payload.old.id))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [profile, supabase])

  const handleClaimQueued = async (callId: string) => {
    if (!profile) return
    if (!recipientGatewayId) {
      toast.error('Para atender chamados e garantir seus repasses via Pix, conecte sua conta do Mercado Pago acima.')
      return
    }

    setClaimingCallId(callId)
    try {
      const res = await fetch('/api/calls/claim-queued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, providerId: profile.id, call_id: callId, provider_id: profile.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Chamado assumido com sucesso! Abrindo atendimento... 🚗⚡')
        router.push(`/chamado/${callId}`)
      } else if (res.status === 409 || data.code === 'CALL_ALREADY_CLAIMED') {
        // Alerta amigável e acolhedor para o Prestador B (que perdeu no milissegundo)
        toast.info('⚡ Chamado já assumido!', {
          description: 'Outro prestador foi mais rápido e pegou este serviço. Continue online no painel para receber os próximos chamados.',
          duration: 6000,
        })
        setQueuedCalls(prev => prev.filter(c => c.id !== callId))
      } else {
        toast.error(data.message || data.error || 'Não foi possível assumir este chamado.')
        setQueuedCalls(prev => prev.filter(c => c.id !== callId))
      }
    } catch {
      toast.error('Erro de conexão ao assumir chamado.')
    } finally {
      setClaimingCallId(null)
    }
  }

  if (!profile) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
      </div>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'Profissional'

  return (
    <div className="page-container p-4">
      {/* Header com Navegação Segura e Status */}
      <PanelHeader isOnline={isOnline} />


      {/* Saudação e Saldo */}
      <section className="mb-6 animate-slide-up">
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Olá,</p>
        <h2 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
          {firstName} 👋
        </h2>
        {totalToday > 0 && (
          <div className="mt-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">
                Ganhos de hoje (liquidado)
              </span>
              <span className="text-base font-black text-emerald-300">
                R$ {totalToday.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1.5 leading-snug">
              ✨ Saldo acumulado na plataforma para repasse via Pix.
              {providerPixKey && (
                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Chave Pix de repasse:</span>
                  <strong className="font-mono text-emerald-300 font-semibold">{providerPixKey}</strong>
                </div>
              )}
            </div>
          </div>
        )}
        {pendingToday > 0 && (
          <p className="text-xs mt-2 font-medium text-amber-500">
            ⏳ {pendingToday} serviço(s) finalizado(s) — aguardando confirmação do pagamento do cliente via Pix/Cartão
          </p>
        )}
      </section>

      {/* Conexão Mercado Pago Split */}
      <section className="mb-6 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm animate-slide-up">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Split Automático Mercado Pago
            </h3>
          </div>
          {recipientGatewayId ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Conectado ✅
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Pendente
            </span>
          )}
        </div>

        {recipientGatewayId ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-300">
              <p>Sua subconta do Mercado Pago está ativa (ID: <strong className="font-mono text-cyan-300">{recipientGatewayId}</strong>).</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seus recebimentos de serviços são depositados automaticamente na sua conta MP.</p>
            </div>
            <button
              type="button"
              onClick={handleDisconnectMercadoPago}
              className="text-[11px] font-bold text-red-400 hover:text-red-300 py-1.5 px-3 rounded-xl border border-red-500/30 hover:bg-red-500/10 transition-colors shrink-0"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="pt-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Vincule sua conta do Mercado Pago para receber sua parte de cada atendimento no exato momento da aprovação, sem depender de repasse manual.
            </p>
            <button
              type="button"
              onClick={handleConnectMercadoPago}
              disabled={connectingMp}
              id="btn-connect-mercadopago"
              className="mt-3 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {connectingMp ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Conectando ao Mercado Pago...</span>
                </>
              ) : (
                <>
                  <Zap size={14} className="text-yellow-300" />
                  <span>Conectar Conta Mercado Pago ⚡</span>
                </>
              )}
            </button>
          </div>
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

      {/* Oportunidades na Fila de Espera Prioritária */}
      {queuedCalls.length > 0 && (
        <section className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-slide-up shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Fila Prioritária ({queuedCalls.length} cliente{queuedCalls.length > 1 ? 's' : ''} aguardando)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ⚡ Ao vivo
            </span>
          </div>

          <div className="space-y-2.5">
            {queuedCalls.map(qCall => (
              <div
                key={qCall.id}
                className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {(qCall.service as { name?: string })?.name || 'Serviço residencial'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    📍 {qCall.neighborhood || 'Rio Verde (GO)'} — {qCall.client_address}
                  </p>
                  <p className="text-xs font-semibold text-emerald-400 mt-1">
                    Ganhos: R$ {Number(qCall.provider_cut || 0).toFixed(2).replace('.', ',')} (Total: R$ {Number(qCall.total_price || 0).toFixed(2).replace('.', ',')})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleClaimQueued(qCall.id)}
                  disabled={claimingCallId === qCall.id}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {claimingCallId === qCall.id ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Assumindo...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={13} className="text-yellow-300" />
                      <span>Atender Chamado Agora</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerta de Obrigatoriedade Mercado Pago */}
      {!recipientGatewayId && (
        <div className="w-full max-w-md mx-auto mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3 animate-slide-up shadow-lg">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block font-bold text-amber-200 text-sm mb-1">
              Vínculo do Mercado Pago Obrigatório
            </strong>
            Para receber chamados e garantir seus repasses automáticos via Pix, conecte sua conta do Mercado Pago acima.
          </div>
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
            disabled={togglingOnline || !recipientGatewayId}
            aria-disabled={!recipientGatewayId}
            className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all ${
              !recipientGatewayId
                ? 'opacity-60 cursor-not-allowed'
                : 'active:scale-95 cursor-pointer'
            }`}
            style={{
              background: !recipientGatewayId
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))'
                : isOnline
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, var(--color-surface-alt), var(--color-surface))',
              border: `3px solid ${
                !recipientGatewayId
                  ? '#F59E0B'
                  : isOnline
                  ? '#10B981'
                  : 'var(--color-border)'
              }`,
              boxShadow: !recipientGatewayId
                ? '0 0 16px rgba(245, 158, 11, 0.2)'
                : isOnline
                ? '0 0 32px rgba(16,185,129,0.4)'
                : 'var(--shadow-card)',
            }}
          >
            {togglingOnline ? (
              <Loader2 size={32} className="animate-spin" color="white" />
            ) : !recipientGatewayId ? (
              <Lock size={34} className="text-amber-400" />
            ) : (
              <Power size={36} color={isOnline ? 'white' : 'var(--color-text-subtle)'} />
            )}
            <span
              className="text-xs font-bold"
              style={{
                color: !recipientGatewayId
                  ? '#FCD34D'
                  : isOnline
                  ? 'white'
                  : 'var(--color-text-subtle)',
              }}
            >
              {!recipientGatewayId ? 'BLOQUEADO' : isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </button>
        </div>

        <p className="text-center text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          {!recipientGatewayId ? (
            <span className="text-amber-400 text-xs font-semibold block">
              🔒 Conecte sua conta do Mercado Pago acima para desbloquear sua disponibilidade.
            </span>
          ) : isOnline ? (
            '🟢 Você está visível para clientes próximos.\nMantendo GPS ativo...'
          ) : (
            'Toque para ficar disponível\ne receber chamados.'
          )}
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
