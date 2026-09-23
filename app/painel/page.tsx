'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ServiceCall } from '@/lib/types'

// Estado do chamado pendente ANTES do aceite nunca deve carregar endereço
// completo/coordenadas (ver checkActiveCalls e o handler de Realtime abaixo).
type PendingCallPreview = Omit<ServiceCall, 'client_address' | 'client_location'>

// Mesma regra pra fila prioritária — o shape exato que app/api/calls/queue
// devolve (nunca client_address/client_location, ver comentário na rota).
interface QueuedCallPreview {
  id: string
  neighborhood: string | null
  total_price: number
  provider_cut: number
  platform_fee: number
  created_at: string
  service?: { id: string; name: string; category?: string; icon?: string | null; color?: string | null } | null
}
import { CallAlertModal } from '@/components/call-alert-modal'
import { useGeolocation } from '@/hooks/useGeolocation'
import { Power, Loader2, MapPin, CreditCard, Zap, Lock, AlertTriangle, Volume2, LogOut, Camera, Bell, Clock, CheckCircle2, KeyRound, Pencil, RefreshCw, Wallet, Radio, MapPinOff } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/provider/panel-header'
import { audioAlert } from '@/lib/audio-alert'
import { performLogout } from '@/lib/auth-logout'
import { SelfieCaptureModal } from '@/components/selfie-capture-modal'
import { PushNotificationsCard } from '@/components/push-notifications-card'

export default function PainelPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [pendingCall, setPendingCall] = useState<PendingCallPreview | null>(null)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const [totalToday, setTotalToday] = useState(0)
  const [pendingToday, setPendingToday] = useState(0)
  const [providerPixKey, setProviderPixKey] = useState('')
  const [queuedCalls, setQueuedCalls] = useState<QueuedCallPreview[]>([])
  const [claimingCallId, setClaimingCallId] = useState<string | null>(null)
  const [editingPix, setEditingPix] = useState(false)
  const [newPixKeyInput, setNewPixKeyInput] = useState('')
  const [savingPix, setSavingPix] = useState(false)

  const hasPixKey = Boolean(providerPixKey && providerPixKey.trim().length > 0)
  const isApproved = profile?.background_check_status === 'approved'
  const isRejected = profile?.background_check_status === 'rejected'
  const hasSelfie = Boolean(profile?.avatar_url)
  const [showSelfieCapture, setShowSelfieCapture] = useState(false)

  const { lat, lng, error: geoError, errorCode: geoErrorCode, permission: geoPermission, getPosition } = useGeolocation(true)
  // Localização bloqueada pra este site (não é falha passageira de sinal).
  const gpsBlocked = geoPermission === 'denied' || geoErrorCode === 1
  // Botão de ficar online travado; estando online, continua livre pra ficar offline.
  const onlineLocked = !hasPixKey || !isApproved || (!isOnline && gpsBlocked)

  // Dispara pedido de permissão de GPS logo na entrada do painel
  useEffect(() => {
    getPosition()
  }, [getPosition])

  // Busca perfil oficial do prestador
  useEffect(() => {
    const load = async () => {
      try {
        let authUser = null
        const { data: { user } } = await supabase.auth.getUser()
        authUser = user
        if (!authUser) {
          const { data: { session } } = await supabase.auth.getSession()
          authUser = session?.user ?? null
        }

        if (authUser) {
          let { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle()

          // Se não encontrou perfil ou se o usuário veio explicitamente para o painel do prestador
          if (!prof) {
            const { data: createdProf } = await supabase
              .from('profiles')
              .upsert({
                id: authUser.id,
                full_name: authUser.user_metadata?.full_name || 'Profissional Parceiro',
                phone: authUser.phone || authUser.user_metadata?.phone || '',
                role: 'provider',
              })
              .select('*')
              .maybeSingle()
            if (createdProf) prof = createdProf
          } else if (prof.role === 'client') {
            // Cliente vira prestador pelo onboarding, que grava o cadastro como
            // 'pending' pra análise — nunca promovido direto aqui.
            router.replace('/onboarding?role=provider')
            return
          }

          // Achado (16/09/2026): sessões que já estavam logadas antes do
          // e-mail virar obrigatório nunca voltam a passar por /login —
          // gate aqui também, pra pegar quem acessa /painel direto com
          // sessão persistida.
          if (prof && !prof.email) {
            router.replace('/completar-email?role=provider')
            return
          }

          if (prof && (prof.role === 'provider' || prof.role === 'admin')) {
            setProfile(prof as Profile)
            let { data: status } = await supabase
              .from('provider_status')
              .select('is_online, pix_key, recipient_gateway_id')
              .eq('provider_id', authUser.id)
              .maybeSingle()

            if (!status) {
              await supabase
                .from('provider_status')
                .upsert({
                  provider_id: authUser.id,
                  is_online: false,
                  pix_key: prof.pix_key || prof.phone || '',
                  pix_key_type: 'phone',
                })
              status = {
                is_online: false,
                pix_key: prof.pix_key || prof.phone || '',
                recipient_gateway_id: null
              }
            }

            // Prestador com cadastro ativo pode ficar online se desejar
            setIsOnline(Boolean(status?.is_online))

            if (status?.pix_key) {
              setProviderPixKey(status.pix_key)
            } else if (prof.phone) {
              setProviderPixKey(prof.phone)
            }

            const today = new Date().toISOString().split('T')[0]
            const { data: calls } = await supabase
              .from('service_calls')
              .select('provider_cut, payment_status')
              .eq('provider_id', authUser.id)
              .eq('status', 'completed')
              .gte('completed_at', today)

            const paidCalls = calls?.filter(c => c.payment_status === 'paid') || []
            const pendingCalls = calls?.filter(c => c.payment_status !== 'paid') || []

            setTotalToday(paidCalls.reduce((sum, c) => sum + (c.provider_cut ?? 0), 0))
            setPendingToday(pendingCalls.length)
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
        toast.success('Conta Mercado Pago conectada com sucesso! Split automático ativado')
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

  // Localização bloqueada com o prestador online: sai do ar. Sem isso ele
  // continuava recebendo chamados pela última posição, que só envelhece.
  useEffect(() => {
    if (!isOnline || !gpsBlocked || !profile) return
    supabase
      .from('provider_status')
      .update({ is_online: false, current_location: null, updated_at: new Date().toISOString() })
      .eq('provider_id', profile.id)
      .select('is_online')
      .then(({ data, error }) => {
        if (error || !data?.length) return
        setIsOnline(false)
        audioAlert.stopAlarm()
        toast.error('A localização foi desativada e você ficou offline. Ative a localização para voltar a receber chamados.')
      })
  }, [isOnline, gpsBlocked, profile, supabase])

  // Atualização rápida de Chave Pix pelo prestador
  const handleSavePixKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !newPixKeyInput.trim()) return
    setSavingPix(true)
    try {
      const trimmed = newPixKeyInput.trim()
      const { error } = await supabase
        .from('provider_status')
        .upsert({
          provider_id: profile.id,
          pix_key: trimmed,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'provider_id' })

      if (error) {
        toast.error('Erro ao atualizar Chave Pix.')
      } else {
        setProviderPixKey(trimmed)
        setEditingPix(false)
        toast.success('Chave Pix atualizada com sucesso!')
      }
    } catch {
      toast.error('Falha de conexão ao salvar Chave Pix.')
    } finally {
      setSavingPix(false)
    }
  }

  // Toggle online/offline com obtenção ativa de GPS e validação da Chave Pix
  const handleToggleOnline = async () => {
    audioAlert.unlockAudio()
    if (!profile) return

    if (!isApproved) {
      toast.error(
        isRejected
          ? 'Seu cadastro foi reprovado na análise de segurança. Entre em contato com o suporte.'
          : 'Seu cadastro ainda está em análise de segurança. Você poderá ficar online assim que for aprovado.'
      )
      return
    }

    const activePix = providerPixKey || profile.phone || ''
    if (!activePix || !activePix.trim()) {
      toast.error('Cadastre sua Chave Pix abaixo para receber chamados e repasses.')
      return
    }

    const newOnline = !isOnline

    // Sem GPS não fica online: antes o prestador era posto no centro da cidade
    // e recebia chamados que não eram perto dele.
    if (newOnline && gpsBlocked) {
      toast.error('Ative a localização do celular para ficar online. Veja o passo a passo acima do botão.')
      return
    }

    setTogglingOnline(true)

    let currentLat = lat
    let currentLng = lng

    // Sem posição, ou com a posição parada desde o último erro: pede uma nova.
    if (newOnline && (!currentLat || !currentLng || geoError)) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof window === 'undefined' || !('geolocation' in navigator)) {
            reject(new Error('GPS indisponível'))
            return
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          })
        })
        currentLat = pos.coords.latitude
        currentLng = pos.coords.longitude
      } catch {
        setTogglingOnline(false)
        getPosition()
        toast.error('Não conseguimos pegar sua localização. Confira se a Localização do celular está ligada e tente de novo.')
        return
      }
    }

    const locationPoint = newOnline && currentLat && currentLng
      ? `SRID=4326;POINT(${currentLng} ${currentLat})`
      : null

    const { data: toggled, error: toggleError } = await supabase
      .from('provider_status')
      .update({
        is_online: newOnline,
        current_location: locationPoint,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', profile.id)
      .select('is_online')

    setTogglingOnline(false)

    if (toggleError) {
      // O banco pode recusar a escrita (ex: trava de segurança) mesmo com os
      // checks acima passando — sem isso, a tela mostrava "Online" mesmo
      // quando o prestador continuava offline de verdade no banco.
      toast.error(toggleError.message || 'Não foi possível atualizar seu status. Tente novamente.')
      return
    }

    // Sem erro mas sem linha alterada = não existe status de prestador pra
    // esta conta (ou a sessão não é dela). Antes a tela dizia "online" assim mesmo.
    if (!toggled?.length) {
      toast.error('Não foi possível atualizar seu status: seu cadastro de prestador está incompleto. Fale com o suporte.')
      return
    }

    setIsOnline(newOnline)
    toast.success(newOnline ? 'Você está online! Aguardando chamados.' : 'Você está offline.')
  }

  // Supabase Realtime + Polling — escuta novos chamados searching para este prestador
  useEffect(() => {
    if (!profile || !isOnline) return

    // 1. Busca ativa e polling de 3 segundos para garantir alerta em tempo real
    //
    // Achado de segurança (14/09/2026): antes, este SELECT trazia client_address e
    // client_location (coordenadas) — o card de alerta pré-aceite mostrava o
    // endereço completo do cliente ao prestador antes dele decidir aceitar,
    // contrariando a regra de mascaramento do AGENTS.md ("antes do aceite, o
    // radar exibe apenas Bairro, Distância aproximada, Serviço e Valor
    // Líquido"). Corrigido enumerando só as colunas realmente necessárias pra
    // esta tela — o endereço completo só é buscado depois, em app/chamado/
    // [callId], já com o chamado aceito.
    const checkActiveCalls = async () => {
      const { data: calls } = await supabase
        .from('service_calls')
        .select('id, status, service_id, total_price, provider_cut, platform_fee, neighborhood, created_at, client_id, provider_id, service:quick_services(*)')
        .eq('provider_id', profile.id)
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(1)

      if (calls && calls.length > 0) {
        setPendingCall(calls[0] as unknown as PendingCallPreview)
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
            // O payload do Realtime traz a linha inteira do banco (o filtro de
            // colunas do SELECT não se aplica aqui) — descarta endereço completo
            // e coordenadas antes de guardar em estado, pela mesma razão do
            // SELECT explícito em checkActiveCalls logo acima.
            const safeCallData: Record<string, unknown> = { ...callData }
            delete safeCallData.client_address
            delete safeCallData.client_location
            setPendingCall(safeCallData as unknown as PendingCallPreview)
            audioAlert.startAlarm()
          } else if (callData && callData.status !== 'searching') {
            setPendingCall(null)
            audioAlert.stopAlarm()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      audioAlert.stopAlarm()
    }
  }, [profile, isOnline, supabase])

  const handleAcceptCall = useCallback(async () => {
    if (!pendingCall) return
    if (!isApproved) {
      setPendingCall(null)
      audioAlert.stopAlarm()
      toast.error('Seu cadastro ainda está em análise de segurança — não é possível aceitar chamados agora.')
      return
    }
    const callId = pendingCall.id
    setPendingCall(null)
    audioAlert.stopAlarm()

    // Aceite pelo servidor (confere que o chamado ainda é seu e gera o PIN
    // de chegada que só o cliente vê) — ver app/api/calls/advance.
    try {
      const res = await fetch('/api/calls/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, action: 'accept' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Não foi possível aceitar este chamado.')
        return
      }
    } catch {
      toast.error('Falha de conexão ao aceitar o chamado. Tente novamente.')
      return
    }

    router.push(`/chamado/${callId}`)
  }, [pendingCall, isApproved, router])

  const handleRejectCall = useCallback(async () => {
    if (!pendingCall) return
    audioAlert.stopAlarm()
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
    audioAlert.stopAlarm()
    await fetch('/api/calls/skip-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: pendingCall.id, rejected_provider_id: profile?.id }),
    })
    setPendingCall(null)
    toast.warning('Tempo esgotado! Chamado foi para o próximo prestador.')
  }, [pendingCall, profile])

  // Monitora chamados na fila prioritária
  //
  // Achado de segurança/funcional (14/09/2026): nunca existiu política de RLS
  // cobrindo leitura de service_calls com status='queued' — esta seção sempre
  // recebeu 0 linhas em produção, pra qualquer prestador (confirmado com
  // login real). A consulta direta na tabela + o canal Realtime abaixo (sem
  // filtro nenhum, o que já era um problema à parte) nunca funcionaram.
  // Corrigido lendo de app/api/calls/queue (Service Role no servidor, só
  // campos seguros — nunca client_address/client_location). Sem RLS/policy
  // nova no banco não dá pra ter push instantâneo via Realtime pra este caso
  // específico, então o "ao vivo" virou polling de 4s (já existia como rede
  // de segurança; agora é o mecanismo principal). O toque sonoro de "chamado
  // novo" é acionado comparando os ids entre uma rodada de polling e outra.
  const queuedCallIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!profile) return

    const loadQueued = async () => {
      try {
        const res = await fetch('/api/calls/queue')
        if (!res.ok) return
        const { calls } = await res.json()
        const list = (calls as QueuedCallPreview[]) || []

        const previousIds = queuedCallIdsRef.current
        const hasNewCall = list.some(c => !previousIds.has(c.id))
        if (previousIds.size > 0 && hasNewCall) {
          audioAlert.playCallChime()
        }
        queuedCallIdsRef.current = new Set(list.map(c => c.id))

        setQueuedCalls(list)
      } catch (err) {
        console.warn('[painel] Falha ao buscar fila prioritária:', err)
      }
    }

    loadQueued()
    const interval = setInterval(loadQueued, 4000)

    return () => {
      clearInterval(interval)
    }
  }, [profile])

  const handleClaimQueued = useCallback(async (callId: string) => {
    if (!profile) return
    audioAlert.stopAlarm()
    if (!isApproved) {
      toast.error('Seu cadastro ainda está em análise de segurança — não é possível assumir chamados agora.')
      return
    }
    if (!hasPixKey) {
      toast.error('Para atender chamados e receber seus repasses, cadastre sua Chave Pix acima.')
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
        toast.success('Chamado assumido com sucesso! Abrindo atendimento...')
        router.push(`/chamado/${callId}`)
      } else if (res.status === 409 || data.code === 'CALL_ALREADY_CLAIMED') {
        // Alerta amigável e acolhedor para o Prestador B (que perdeu no milissegundo)
        toast.info('Chamado já assumido!', {
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
  }, [profile, hasPixKey, isApproved, router])

  // Ativa automaticamente o aceite se o prestador acessou via deep link do WhatsApp (?claim=ID)
  useEffect(() => {
    if (typeof window === 'undefined' || !profile || !hasPixKey || !isApproved) return
    const params = new URLSearchParams(window.location.search)
    const claimId = params.get('claim')
    if (claimId && !claimingCallId) {
      console.log('⚡ [Deep Link] Assumindo chamado via link direto do WhatsApp:', claimId)
      // Remove o parâmetro da URL antes de disparar — sem isso, uma falha (409, erro de
      // rede etc.) devolve claimingCallId a null e o efeito dispara a mesma tentativa de
      // novo em loop, já que o ?claim=ID nunca era limpo.
      const url = new URL(window.location.href)
      url.searchParams.delete('claim')
      window.history.replaceState({}, '', url.toString())
      handleClaimQueued(claimId)
    }
  }, [profile, hasPixKey, isApproved, claimingCallId, handleClaimQueued])

  if (!profile) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'Profissional'

  return (
    <div className="page-container p-4">
      {/* Header com Navegação Segura e Status */}
      <PanelHeader isOnline={isOnline} />

      {/* Indicador de Alerta Sonoro */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span
          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
          style={{ background: 'rgba(94, 211, 164, 0.12)', color: 'var(--color-success)', border: '1px solid rgba(94, 211, 164, 0.2)' }}
        >
          <Volume2 size={13} style={{ color: 'var(--color-success)' }} />
          Alerta sonoro ativo
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await audioAlert.unlockAudio()
              await audioAlert.playCallChime()
              toast.success('Som de alerta reproduzido!', {
                description: 'Dica: aumente o volume de mídia do celular e certifique-se de que o modo silencioso (no iPhone) está desativado.',
                duration: 5000,
              })
            } catch {
              toast.error('Erro ao acionar som de alerta.')
            }
          }}
          className="text-[11px] font-bold hover:underline cursor-pointer flex items-center gap-1 transition-colors"
          style={{ color: 'var(--color-primary)' }}
        >
          Testar som
          <Bell size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
        </button>
      </div>


      {/* Saudação e Saldo */}
      <section className="mb-6 animate-slide-up">
        <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Olá,</p>
        <h2 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
          {firstName}
        </h2>
        {totalToday > 0 && (
          <div
            className="mt-2.5 p-3.5 rounded-2xl"
            style={{ background: 'rgba(94, 211, 164, 0.1)', border: '1px solid rgba(94, 211, 164, 0.2)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>
                Ganhos de hoje (liquidado)
              </span>
              <span className="text-base font-black" style={{ color: 'var(--color-success)' }}>
                R$ {totalToday.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              <Wallet size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />Saldo acumulado na plataforma para repasse via Pix.
              {providerPixKey && (
                <div className="mt-1.5 pt-1.5 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid rgba(94, 211, 164, 0.2)' }}>
                  <span style={{ color: 'var(--color-text-subtle)' }}>Chave Pix de repasse:</span>
                  <strong className="font-mono font-semibold" style={{ color: 'var(--color-success)' }}>{providerPixKey}</strong>
                </div>
              )}
            </div>
          </div>
        )}
        {pendingToday > 0 && (
          <p className="text-xs mt-2 font-medium" style={{ color: 'var(--color-warning)' }}>
            <Clock size={13} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />{pendingToday} serviço(s) finalizado(s) — aguardando confirmação do pagamento do cliente via Pix/Cartão
          </p>
        )}
      </section>

      {/* Card Chave Pix */}
      <section
        className="mb-6 p-4 rounded-2xl animate-slide-up space-y-3"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
              Chave Pix de Recebimento
            </h3>
          </div>
          {providerPixKey ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(94, 211, 164, 0.12)', color: 'var(--color-success)', border: '1px solid rgba(94, 211, 164, 0.25)' }}
            >
              Pix Ativo
              <CheckCircle2 size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(237, 198, 107, 0.12)', color: 'var(--color-warning)', border: '1px solid rgba(237, 198, 107, 0.25)' }}
            >
              Chave Pix Obrigatória
              <AlertTriangle size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            </span>
          )}
        </div>

        {editingPix ? (
          <form onSubmit={handleSavePixKey} className="space-y-3 pt-1">
            <div>
              <label className="label">Informe sua Chave Pix (CPF, Celular, E-mail ou Aleatória):</label>
              <input
                type="text"
                value={newPixKeyInput}
                onChange={(e) => setNewPixKeyInput(e.target.value)}
                placeholder="Ex: 64999999999 ou seu CPF"
                className="input font-mono"
                autoFocus
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingPix}
                className="btn-primary py-2 text-xs disabled:opacity-50"
              >
                {savingPix ? 'Salvando...' : 'Salvar Chave Pix'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPix(false)}
                disabled={savingPix}
                className="btn-secondary py-2 text-xs"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {providerPixKey ? (
                <>
                  <p>
                    <KeyRound size={14} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1.5" aria-hidden="true" /><strong>Chave Pix cadastrada:</strong>{' '}
                    <span className="font-mono font-bold px-2 py-0.5 rounded ml-1" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-success)', border: '1px solid var(--color-border)' }}>{providerPixKey}</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                    Seus repasses líquidos de R$ 50 a R$ 110 por serviço serão transferidos diretamente para esta chave.
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--color-warning)' }}>
                  Cadastre sua chave Pix para poder ficar Online e receber chamados em Rio Verde.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setNewPixKeyInput(providerPixKey)
                setEditingPix(true)
              }}
              className="btn-secondary inline-flex items-center gap-1.5 py-1.5 text-[11px] shrink-0"
            >
              <Pencil size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              Alterar Chave
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
        <section
          className="mb-6 p-4 rounded-2xl animate-slide-up shadow-md"
          style={{ background: 'rgba(94, 211, 164, 0.06)', border: '1px solid rgba(94, 211, 164, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--color-primary)' }}></span>
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--color-primary)' }}></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                Fila Prioritária ({queuedCalls.length} cliente{queuedCalls.length > 1 ? 's' : ''} aguardando)
              </h3>
            </div>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
            >
              <RefreshCw size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              Atualização automática
            </span>
          </div>

          <div className="space-y-2.5">
            {queuedCalls.map(qCall => (
              <div
                key={qCall.id}
                className="p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                    {(qCall.service as { name?: string })?.name || 'Serviço residencial'}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                    <MapPin size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />{qCall.neighborhood || 'Rio Verde (GO)'}
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
                    Ganhos: R$ {Number(qCall.provider_cut || 0).toFixed(2).replace('.', ',')} (Total: R$ {Number(qCall.total_price || 0).toFixed(2).replace('.', ',')})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleClaimQueued(qCall.id)}
                  disabled={claimingCallId === qCall.id}
                  className="btn-primary w-full sm:w-auto text-xs py-2 shrink-0 disabled:opacity-50"
                >
                  {claimingCallId === qCall.id ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Assumindo...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      <span>Atender Chamado Agora</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerta de cadastro em análise / reprovado na verificação de identidade */}
      {!isApproved && (
        <div
          className="w-full max-w-md mx-auto mb-6 p-4 rounded-2xl flex items-start gap-3 animate-slide-up"
          style={{
            background: isRejected ? 'rgba(239, 68, 68, 0.08)' : 'rgba(237, 198, 107, 0.08)',
            border: `1px solid ${isRejected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(237, 198, 107, 0.25)'}`,
          }}
        >
          <Lock size={20} className="shrink-0 mt-0.5" style={{ color: isRejected ? '#EF4444' : 'var(--color-warning)' }} />
          <div className="text-xs leading-relaxed flex-1">
            <strong className="block font-bold text-sm mb-1" style={{ color: isRejected ? '#EF4444' : 'var(--color-warning)' }}>
              {isRejected ? 'Cadastro Reprovado' : 'Cadastro em Análise de Segurança'}
            </strong>
            {isRejected ? (
              profile?.rejection_reason || 'Seu cadastro foi reprovado na verificação de identidade. Reenvie sua selfie ou entre em contato com o suporte.'
            ) : hasSelfie ? (
              'Sua selfie foi recebida e está sendo analisada pela nossa equipe antes de você poder ficar disponível para receber chamados. Isso costuma ser rápido.'
            ) : (
              'Envie uma selfie pra começarmos a análise de segurança do seu cadastro.'
            )}
            {(isRejected || !hasSelfie) && (
              <button
                type="button"
                id="btn-open-selfie-capture"
                onClick={() => setShowSelfieCapture(true)}
                className="btn-primary mt-3 py-2 text-xs"
              >
                <Camera size={14} /> {isRejected ? 'Reenviar Selfie' : 'Enviar Selfie'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alerta de Obrigatoriedade da Chave Pix */}
      {isApproved && !hasPixKey && (
        <div
          className="w-full max-w-md mx-auto mb-6 p-4 rounded-2xl flex items-start gap-3 animate-slide-up"
          style={{ background: 'rgba(237, 198, 107, 0.08)', border: '1px solid rgba(237, 198, 107, 0.25)', color: 'var(--color-warning)' }}
        >
          <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
          <div className="text-xs leading-relaxed">
            <strong className="block font-bold text-sm mb-1" style={{ color: 'var(--color-warning)' }}>
              Chave Pix Obrigatória
            </strong>
            Cadastre sua Chave Pix acima para desbloquear sua disponibilidade e receber seus repasses diretamente na sua conta.
          </div>
        </div>
      )}

      {/* Notificações push de novos chamados (só faz sentido pra quem já pode receber chamados) */}
      {isApproved && <PushNotificationsCard />}

      {/* Localização bloqueada: sem GPS não dá pra ficar online */}
      {gpsBlocked && !isOnline && isApproved && hasPixKey && (
        <div id="gps-required-card" className="banner-warning mb-4 animate-slide-up items-start">
          <MapPinOff size={18} strokeWidth={2} style={{ color: '#F59E0B' }} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs space-y-2" style={{ color: '#FCD34D' }}>
            <p>
              <strong>Ative a localização para ficar online.</strong> O Repara RV usa o GPS para te mandar
              chamados perto de você.
            </p>
            <p>
              <strong>Android (Chrome):</strong> toque no ícone ao lado de repararv.com na barra de endereço →
              Permissões → Localização → Permitir. Se estiver usando o app instalado, faça isso abrindo
              repararv.com no Chrome. Confira também se a Localização do celular está ligada.
            </p>
            <p>
              <strong>iPhone:</strong> Ajustes → Privacidade e Segurança → Serviços de Localização (ligado) →
              Sites do Safari → Durante o Uso do App.
            </p>
            <button
              type="button"
              id="btn-retry-gps"
              onClick={getPosition}
              className="btn-secondary py-2 px-4 text-xs mt-1"
            >
              <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
              Já ativei — tentar de novo
            </button>
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
            disabled={togglingOnline || onlineLocked}
            aria-disabled={onlineLocked}
            className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all ${
              onlineLocked
                ? 'opacity-60 cursor-not-allowed'
                : 'active:scale-95 cursor-pointer hover:scale-105'
            }`}
            style={{
              background: onlineLocked
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))'
                : isOnline
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, var(--color-surface-alt), var(--color-surface))',
              border: `3px solid ${
                onlineLocked
                  ? '#F59E0B'
                  : isOnline
                  ? '#10B981'
                  : 'var(--color-border)'
              }`,
              boxShadow: onlineLocked
                ? '0 0 16px rgba(245, 158, 11, 0.2)'
                : isOnline
                ? '0 0 32px rgba(16,185,129,0.4)'
                : 'var(--shadow-card)',
            }}
          >
            {togglingOnline ? (
              <Loader2 size={32} className="animate-spin" color="white" />
            ) : !hasPixKey || !isApproved ? (
              <Lock size={34} className="text-amber-400" />
            ) : onlineLocked ? (
              <MapPinOff size={34} className="text-amber-400" aria-hidden="true" />
            ) : (
              <Power size={36} color={isOnline ? 'white' : 'var(--color-text-subtle)'} />
            )}
            <span
              className="text-xs font-bold"
              style={{
                color: onlineLocked
                  ? '#FCD34D'
                  : isOnline
                  ? 'white'
                  : 'var(--color-text-subtle)',
              }}
            >
              {!hasPixKey || !isApproved ? 'BLOQUEADO' : onlineLocked ? 'SEM GPS' : isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </button>
        </div>

        <p className="text-center text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          {!isApproved ? (
            <span className="text-amber-400 text-xs font-semibold block">
              <Lock size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />{isRejected ? 'Cadastro reprovado na verificação.' : 'Cadastro em análise de segurança.'}
            </span>
          ) : !hasPixKey ? (
            <span className="text-amber-400 text-xs font-semibold block">
              <Lock size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />Cadastre sua Chave Pix acima para desbloquear sua disponibilidade.
            </span>
          ) : gpsBlocked && !isOnline ? (
            <span className="text-amber-400 text-xs font-semibold block">
              <MapPinOff size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />
              Localização desativada: veja acima como ativar para ficar online.
            </span>
          ) : isOnline && geoError ? (
            <span className="text-amber-400 text-xs font-semibold block">
              <MapPinOff size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />
              Online sem GPS: sua posição pode estar desatualizada e chamados perto de você podem não chegar.
            </span>
          ) : isOnline ? (
            <>
              <Radio size={13} strokeWidth={2} className="inline-block -mt-0.5 mr-1 shrink-0" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
              Você está visível para clientes próximos. GPS ativo.
            </>
          ) : (
            'Toque para ficar disponível\ne receber chamados.'
          )}
        </p>

        {lat && lng && isOnline && (
          <div className="flex items-center gap-1.5 mt-3">
            {/* Com erro de GPS o hook mantém a última posição recebida — ela não é mais "ao vivo". */}
            <MapPin size={12} style={{ color: geoError ? 'var(--color-warning)' : 'var(--color-success)' }} aria-hidden="true" />
            <p className="text-xs" style={{ color: geoError ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {geoError ? 'Última posição conhecida' : 'GPS ativo'} — {lat.toFixed(4)}, {lng.toFixed(4)}
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
                  style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                >
                  {n}
                </span>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão Sair da Conta no Painel */}
      <div
        className="mt-8 mb-6 pt-4 text-center"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <button
          type="button"
          onClick={async () => {
            toast.success('Desconectando da conta...')
            await performLogout('/login')
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          style={{ color: 'var(--color-danger)', background: 'rgba(244, 124, 124, 0.08)', border: '1px solid rgba(244, 124, 124, 0.2)' }}
        >
          <LogOut size={16} />
          <span>Encerrar Turno & Sair da Conta</span>
        </button>
      </div>

      {/* Modal de alerta de chamado com som, vibração e timer */}
      {pendingCall && (
        <CallAlertModal
          call={pendingCall}
          serviceName={(pendingCall.service as { name?: string })?.name ?? 'Serviço Solicitado'}
          neighborhood={pendingCall.neighborhood || 'Rio Verde (GO)'}
          totalPrice={pendingCall.total_price}
          providerCut={pendingCall.provider_cut}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onTimeout={handleTimeoutCall}
        />
      )}

      {showSelfieCapture && (
        <SelfieCaptureModal
          onClose={() => setShowSelfieCapture(false)}
          onSuccess={(avatarUrl) => {
            setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl, background_check_status: prev.background_check_status === 'rejected' ? 'pending' : prev.background_check_status } : prev)
            setShowSelfieCapture(false)
          }}
        />
      )}
    </div>
  )
}
