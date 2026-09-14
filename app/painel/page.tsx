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
import { Power, Loader2, MapPin, CreditCard, Zap, Lock, AlertTriangle, Volume2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/provider/panel-header'
import { audioAlert } from '@/lib/audio-alert'
import { performLogout } from '@/lib/auth-logout'

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

  const { lat, lng, error: geoError, getPosition } = useGeolocation(true)

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
            // Habilita role de prestador para acesso imediato e transparente
            await supabase
              .from('profiles')
              .update({ role: 'provider' })
              .eq('id', authUser.id)
            prof.role = 'provider'
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

    const activePix = providerPixKey || profile.phone || ''
    if (!activePix || !activePix.trim()) {
      toast.error('Cadastre sua Chave Pix abaixo para receber chamados e repasses.')
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
    const callId = pendingCall.id
    setPendingCall(null)
    audioAlert.stopAlarm()

    await supabase
      .from('service_calls')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', callId)

    // Dispara WhatsApp confirmando que o técnico está a caminho
    void fetch('/api/calls/notify-accepted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, provider_id: profile?.id }),
    }).catch(() => {})

    router.push(`/chamado/${callId}`)
  }, [pendingCall, profile, router, supabase])

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
  }, [profile, hasPixKey, router])

  // Ativa automaticamente o aceite se o prestador acessou via deep link do WhatsApp (?claim=ID)
  useEffect(() => {
    if (typeof window === 'undefined' || !profile || !hasPixKey) return
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
  }, [profile, hasPixKey, claimingCallId, handleClaimQueued])

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

      {/* Indicador de Alerta Sonoro */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm">
          <Volume2 size={13} className="text-emerald-600" />
          Alerta sonoro ativo
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await audioAlert.unlockAudio()
              await audioAlert.playCallChime()
              toast.success('🔊 Som de alerta reproduzido!', {
                description: 'Dica: aumente o volume de mídia do celular e certifique-se de que o modo silencioso (no iPhone) está desativado.',
                duration: 5000,
              })
            } catch {
              toast.error('Erro ao acionar som de alerta.')
            }
          }}
          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 underline cursor-pointer flex items-center gap-1 transition-colors"
        >
          Testar som 🔔
        </button>
      </div>


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

      {/* Card Chave Pix para Recebimento */}
      <section className="mb-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm animate-slide-up space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Chave Pix de Recebimento
            </h3>
          </div>
          {providerPixKey ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Pix Ativo ✅
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Chave Pix Obrigatória ⚠️
            </span>
          )}
        </div>

        {editingPix ? (
          <form onSubmit={handleSavePixKey} className="space-y-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Informe sua Chave Pix (CPF, Celular, E-mail ou Aleatória):
              </label>
              <input
                type="text"
                value={newPixKeyInput}
                onChange={(e) => setNewPixKeyInput(e.target.value)}
                placeholder="Ex: 64999999999 ou seu CPF"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:border-emerald-500 outline-none font-mono"
                autoFocus
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingPix}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingPix ? 'Salvando...' : 'Salvar Chave Pix'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPix(false)}
                disabled={savingPix}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-300">
              {providerPixKey ? (
                <>
                  <p>
                    💰 <strong>Chave Pix cadastrada:</strong> <span className="font-mono text-emerald-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 ml-1">{providerPixKey}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Seus repasses líquidos de R$ 50 a R$ 110 por serviço serão transferidos diretamente para esta chave.
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-300">
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
              className="text-[11px] font-bold text-slate-200 hover:text-white py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shrink-0 cursor-pointer"
            >
              ✏️ Alterar Chave
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
              🔄 Atualização automática
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
                    📍 {qCall.neighborhood || 'Rio Verde (GO)'}
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

      {/* Alerta de Obrigatoriedade da Chave Pix */}
      {!hasPixKey && (
        <div className="w-full max-w-md mx-auto mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3 animate-slide-up shadow-lg">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="block font-bold text-amber-200 text-sm mb-1">
              Chave Pix Obrigatória
            </strong>
            Cadastre sua Chave Pix acima para desbloquear sua disponibilidade e receber seus repasses diretamente na sua conta.
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
            disabled={togglingOnline || !hasPixKey}
            aria-disabled={!hasPixKey}
            className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all ${
              !hasPixKey
                ? 'opacity-60 cursor-not-allowed'
                : 'active:scale-95 cursor-pointer hover:scale-105'
            }`}
            style={{
              background: !hasPixKey
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))'
                : isOnline
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, var(--color-surface-alt), var(--color-surface))',
              border: `3px solid ${
                !hasPixKey
                  ? '#F59E0B'
                  : isOnline
                  ? '#10B981'
                  : 'var(--color-border)'
              }`,
              boxShadow: !hasPixKey
                ? '0 0 16px rgba(245, 158, 11, 0.2)'
                : isOnline
                ? '0 0 32px rgba(16,185,129,0.4)'
                : 'var(--shadow-card)',
            }}
          >
            {togglingOnline ? (
              <Loader2 size={32} className="animate-spin" color="white" />
            ) : !hasPixKey ? (
              <Lock size={34} className="text-amber-400" />
            ) : (
              <Power size={36} color={isOnline ? 'white' : 'var(--color-text-subtle)'} />
            )}
            <span
              className="text-xs font-bold"
              style={{
                color: !hasPixKey
                  ? '#FCD34D'
                  : isOnline
                  ? 'white'
                  : 'var(--color-text-subtle)',
              }}
            >
              {!hasPixKey ? 'BLOQUEADO' : isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </button>
        </div>

        <p className="text-center text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
          {!hasPixKey ? (
            <span className="text-amber-400 text-xs font-semibold block">
              🔒 Cadastre sua Chave Pix acima para desbloquear sua disponibilidade.
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

      {/* Botão Sair da Conta no Painel */}
      <div className="mt-8 mb-6 pt-4 border-t border-slate-800 text-center">
        <button
          type="button"
          onClick={async () => {
            toast.success('Desconectando da conta...')
            await performLogout('/login')
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-900/60 transition-all cursor-pointer active:scale-95 shadow-sm"
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
    </div>
  )
}
