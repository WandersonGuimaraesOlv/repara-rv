'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  MapPin,
  User,
  Filter,
  Activity,
  Award,
  History,
  MessageCircle,
  Search,
  Wrench,
  Calendar,
  X,
  AlertTriangle,
  Check,
  CreditCard,
  Copy,
  Send,
  Radio,
  Zap,
  Clock
} from 'lucide-react'
import { updateCallPaymentStatusAction } from '@/app/actions/admin-users'
import { toast } from 'sonner'

interface ServiceCallRecord {
  id: string
  status: string
  payment_status?: 'paid' | 'pending' | 'refunded' | null
  total_price: number
  platform_fee: number
  provider_cut: number
  neighborhood: string
  client_address: string
  cancel_reason?: string | null
  cancel_note?: string | null
  cancel_by?: string | null
  cancellation_reason?: string | null
  cancellation_stage?: string | null
  cancelled_by?: string | null
  cancelled_by_role?: string | null
  arrived_at?: string | null
  created_at: string
  accepted_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  expires_at?: string | null
  service?: { name: string; category: string } | null
  client?: { full_name: string; phone: string } | null
  provider?: { full_name: string; phone: string } | null
}

interface AuditLogRecord {
  id: string
  call_id: string
  action: string
  previous_status?: string | null
  new_status: string
  changed_by?: string | null
  cancellation_reason?: string | null
  cancellation_stage?: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

interface EmergencyAlertRecord {
  id: string
  call_id: string
  user_role: string
  resolved: boolean
  latitude?: number | null
  longitude?: number | null
  created_at: string
  caller?: { full_name: string; phone: string } | null
}

interface ProviderContact {
  id: string
  full_name: string
  phone: string
  mercado_pago_connected?: boolean | null
  provider_status?: {
    is_online?: boolean | null
    recipient_gateway_id?: string | null
  } | {
    is_online?: boolean | null
    recipient_gateway_id?: string | null
  }[] | null
}

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [calls, setCalls] = useState<ServiceCallRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlertRecord[]>([])
  const [providersList, setProvidersList] = useState<ProviderContact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  
  // Ticker de tempo em tempo real para recalcular estagnação na fila
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now())
  
  // Modal de Despacho Rápido via WhatsApp
  const [dispatchCall, setDispatchCall] = useState<ServiceCallRecord | null>(null)
  const [dispatchSearch, setDispatchSearch] = useState<string>('')
  const [copiedClaimId, setCopiedClaimId] = useState<string | null>(null)

  // Abas de navegação
  const [activeTab, setActiveTab] = useState<'overview' | 'completed' | 'cancellations' | 'audit' | 'sos'>('overview')
  const [cancelFilter, setCancelFilter] = useState<'all' | 'arrived' | 'allocated' | 'searching'>('all')
  const [completedSearchQuery, setCompletedSearchQuery] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null)

  // Timer de 30 segundos no cliente para atualizar estagnação da fila (> 5 min)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const handleTogglePaymentStatus = async (callId: string, currentStatus?: string | null) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid'
    setUpdatingPaymentId(callId)
    try {
      const res = await updateCallPaymentStatusAction({ callId, paymentStatus: newStatus })
      if (res.success) {
        toast.success(
          newStatus === 'paid'
            ? 'Pagamento Pix confirmado com sucesso!'
            : 'Pagamento marcado como pendente.'
        )
        setCalls(prev =>
          prev.map(c => (c.id === callId ? { ...c, payment_status: newStatus } : c))
        )
      } else {
        toast.error(res.error || 'Erro ao atualizar status de pagamento.')
      }
    } catch {
      toast.error('Erro de conexão ao atualizar status de pagamento.')
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Busca chamados com relacionamentos incluindo payment_status e expires_at
      const { data: callsData, error: callsError } = await supabase
        .from('service_calls')
        .select(`
          id,
          status,
          payment_status,
          total_price,
          platform_fee,
          provider_cut,
          neighborhood,
          client_address,
          cancel_reason,
          cancel_note,
          cancel_by,
          cancellation_reason,
          cancellation_stage,
          cancelled_by,
          cancelled_by_role,
          arrived_at,
          created_at,
          accepted_at,
          completed_at,
          cancelled_at,
          expires_at,
          service:quick_services(name, category),
          client:profiles!client_id(full_name, phone),
          provider:profiles!provider_id(full_name, phone)
        `)
        .order('created_at', { ascending: false })

      if (!callsError && callsData) {
        setCalls(callsData as unknown as ServiceCallRecord[])
      }

      // 2. Busca prestadores cadastrados para o despacho emergencial via WhatsApp
      const { data: provsData } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          mercado_pago_connected,
          provider_status(is_online, recipient_gateway_id)
        `)
        .eq('role', 'provider')
        .order('full_name', { ascending: true })

      if (provsData) {
        setProvidersList(provsData as unknown as ProviderContact[])
      }

      // 3. Busca histórico imutável de auditoria
      const { data: auditData, error: auditError } = await supabase
        .from('service_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!auditError && auditData) {
        setAuditLogs(auditData as unknown as AuditLogRecord[])
      }

      // 4. Busca incidentes do botão SOS
      const { data: alertData, error: alertError } = await supabase
        .from('emergency_alerts')
        .select('*, caller:profiles!triggered_by(full_name, phone)')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!alertError && alertData) {
        setEmergencyAlerts(alertData as unknown as EmergencyAlertRecord[])
      }
    } catch (err) {
      console.error('[Dashboard fetch error]', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Inscrição Realtime com Cleanup Seguro no retorno do useEffect
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_calls' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchData])

  // Chamados na Fila de Espera ('queued') e Estagnados (> 5 min)
  const allQueuedCalls = useMemo(() => {
    return calls.filter(c => c.status === 'queued')
  }, [calls])

  const stuckQueuedCalls = useMemo(() => {
    return calls.filter(c => {
      if (c.status !== 'queued') return false
      const createdAt = new Date(c.created_at).getTime()
      const elapsedMinutes = (currentTime - createdAt) / (1000 * 60)
      return elapsedMinutes >= 5
    })
  }, [calls, currentTime])

  // Métricas Financeiras Rigorosamente Segregadas (GMV vs. Take Rate vs. Repasse Prestadores)
  const metrics = useMemo(() => {
    const total = calls.length
    const completed = calls.filter(c => c.status === 'completed')
    const paidCompleted = completed.filter(c => c.payment_status === 'paid')
    const pendingCompleted = completed.filter(c => c.payment_status !== 'paid')
    const cancelled = calls.filter(c => c.status === 'cancelled' || c.status === 'no_providers_available')
    const inProgress = calls.filter(c => ['accepted', 'on_the_way', 'in_progress'].includes(c.status))
    const queuedCount = allQueuedCalls.length

    // 1. GMV Total (Volume Bruto Transacionado pelos Clientes)
    const gmvPaid = paidCompleted.reduce((acc, c) => acc + Number(c.total_price || 0), 0)
    const gmvPending = pendingCompleted.reduce((acc, c) => acc + Number(c.total_price || 0), 0)
    const gmvTotal = gmvPaid + gmvPending

    // 2. Receita da Plataforma (Take Rate retido)
    const platformRevenueRealized = paidCompleted.reduce((acc, c) => acc + Number(c.platform_fee || 12.0), 0)
    const platformRevenuePending = pendingCompleted.reduce((acc, c) => acc + Number(c.platform_fee || 12.0), 0)
    const platformRevenueTotal = platformRevenueRealized + platformRevenuePending

    // 3. Repasse Líquido dos Técnicos (mão de obra pura após split)
    const providerPayoutRealized = paidCompleted.reduce(
      (acc, c) => acc + Number(c.provider_cut || (Number(c.total_price) - 12)),
      0
    )
    const providerPayoutPending = pendingCompleted.reduce(
      (acc, c) => acc + Number(c.provider_cut || (Number(c.total_price) - 12)),
      0
    )
    const providerPayoutTotal = providerPayoutRealized + providerPayoutPending

    // Proteção contra divisão por zero
    const cancellationRate = total > 0 ? (cancelled.length / total) * 100 : 0

    return {
      total,
      completedCount: completed.length,
      paidCount: paidCompleted.length,
      pendingPaymentCount: pendingCompleted.length,
      cancelledCount: cancelled.length,
      inProgressCount: inProgress.length,
      queuedCount,
      stuckQueuedCount: stuckQueuedCalls.length,
      gmvTotal,
      gmvPaid,
      gmvPending,
      platformRevenueTotal,
      platformRevenueRealized,
      platformRevenuePending,
      providerPayoutTotal,
      providerPayoutRealized,
      providerPayoutPending,
      cancellationRate,
      sosCount: emergencyAlerts.length,
    }
  }, [calls, allQueuedCalls, stuckQueuedCalls, emergencyAlerts])

  // Diagnóstico Analítico dos Motivos de Cancelamento
  const cancellationReasonAnalysis = useMemo(() => {
    const cancelled = calls.filter(c => c.status === 'cancelled' || c.status === 'no_providers_available')
    const total = cancelled.length

    let demoraCount = 0
    let valorAltoCount = 0
    let resolveuSozinhoCount = 0
    let enderecoCount = 0
    let outrosCount = 0

    cancelled.forEach(c => {
      const reason = `${c.cancellation_reason || ''} ${c.cancel_reason || ''} ${c.cancel_note || ''}`.toLowerCase()
      if (
        c.status === 'no_providers_available' || 
        reason.includes('demor') || 
        reason.includes('tempo') || 
        reason.includes('prestador') ||
        c.cancellation_stage === 'no_providers_available'
      ) {
        demoraCount++
      } else if (reason.includes('valor') || reason.includes('preço') || reason.includes('caro') || reason.includes('alto')) {
        valorAltoCount++
      } else if (reason.includes('sozinho') || reason.includes('desist') || reason.includes('outro modo') || reason.includes('cliente')) {
        resolveuSozinhoCount++
      } else if (reason.includes('endereço') || reason.includes('local') || reason.includes('bairro')) {
        enderecoCount++
      } else {
        outrosCount++
      }
    })

    // Proteção rigorosa contra divisão por zero (NaN%)
    const safePct = (count: number) => (total > 0 ? (count / total) * 100 : 0)

    const demoraPct = safePct(demoraCount)
    const isDemoraCritical = demoraPct >= 40 && total >= 2

    return {
      total,
      isDemoraCritical,
      demoraPct,
      reasons: [
        { label: 'Demora para encontrar prestador', count: demoraCount, pct: demoraPct, color: 'bg-red-500', text: 'text-red-400' },
        { label: 'Achou o valor do serviço alto', count: valorAltoCount, pct: safePct(valorAltoCount), color: 'bg-amber-500', text: 'text-amber-400' },
        { label: 'Resolveu o reparo sozinho / Desistiu', count: resolveuSozinhoCount, pct: safePct(resolveuSozinhoCount), color: 'bg-blue-500', text: 'text-blue-400' },
        { label: 'Endereço incorreto / Fora de Rio Verde', count: enderecoCount, pct: safePct(enderecoCount), color: 'bg-purple-500', text: 'text-purple-400' },
        { label: 'Outros motivos / Não informado', count: outrosCount, pct: safePct(outrosCount), color: 'bg-[var(--color-text-subtle)]', text: 'text-[var(--color-text-muted)]' },
      ],
    }
  }, [calls])

  // Ranking de Bairros de Rio Verde com Proteção contra Divisão por Zero
  const neighborhoodRanking = useMemo(() => {
    const map: Record<string, number> = {}
    const totalCalls = calls.length
    calls.forEach(c => {
      const hood = c.neighborhood || 'Setor Central'
      map[hood] = (map[hood] || 0) + 1
    })

    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        pct: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [calls])

  // Ranking de Prestadores com métricas de recebimento
  const providerRanking = useMemo(() => {
    const completed = calls.filter(c => c.status === 'completed' && c.provider)
    const map: Record<
      string,
      {
        name: string
        phone: string
        count: number
        paidCount: number
        pendingCount: number
        earningsPaid: number
        earningsPending: number
      }
    > = {}

    completed.forEach(c => {
      const provObj = Array.isArray(c.provider) ? c.provider[0] : c.provider
      const name = provObj?.full_name || 'Profissional'
      if (!map[name]) {
        map[name] = {
          name,
          phone: provObj?.phone || '',
          count: 0,
          paidCount: 0,
          pendingCount: 0,
          earningsPaid: 0,
          earningsPending: 0,
        }
      }
      map[name].count += 1
      const cut = Number(c.provider_cut || (Number(c.total_price) - 12))
      if (c.payment_status === 'paid') {
        map[name].paidCount += 1
        map[name].earningsPaid += cut
      } else {
        map[name].pendingCount += 1
        map[name].earningsPending += cut
      }
    })

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [calls])

  // Filtro de técnicos no Modal de Despacho Emergencial
  const filteredDispatchProviders = useMemo(() => {
    const q = dispatchSearch.trim().toLowerCase()
    return providersList.filter(p => {
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.phone.includes(q)
      )
    })
  }, [providersList, dispatchSearch])

  // Chamados Concluídos Filtrados com Suporte a Status Financeiro (Pago / Pendente)
  const completedCalls = useMemo(() => {
    const base = calls.filter(c => c.status === 'completed')
    return base.filter(c => {
      const provObj = Array.isArray(c.provider) ? c.provider[0] : c.provider
      const clientObj = Array.isArray(c.client) ? c.client[0] : c.client
      const serviceObj = Array.isArray(c.service) ? c.service[0] : c.service

      const provName = provObj?.full_name || ''
      const clientName = clientObj?.full_name || ''
      const serviceName = serviceObj?.name || ''
      const serviceCategory = serviceObj?.category || ''
      const neighborhood = c.neighborhood || ''

      if (paymentFilter === 'paid' && c.payment_status !== 'paid') return false
      if (paymentFilter === 'pending' && c.payment_status === 'paid') return false

      if (completedSearchQuery.trim()) {
        const q = completedSearchQuery.toLowerCase()
        const match =
          provName.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          serviceName.toLowerCase().includes(q) ||
          serviceCategory.toLowerCase().includes(q) ||
          neighborhood.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [calls, paymentFilter, completedSearchQuery])

  // Chamados Cancelados com Filtros
  const cancelledCalls = useMemo(() => {
    const base = calls.filter(c => c.status === 'cancelled' || c.status === 'no_providers_available')
    if (cancelFilter === 'arrived') {
      return base.filter(c => c.arrived_at !== null || c.cancellation_stage === 'arrived')
    }
    if (cancelFilter === 'allocated') {
      return base.filter(c => c.provider !== null || c.cancellation_stage === 'allocated')
    }
    if (cancelFilter === 'searching') {
      return base.filter(c => !c.provider || c.cancellation_stage === 'searching')
    }
    return base
  }, [calls, cancelFilter])

  return (
    <div className="space-y-8">
      {/* Cabeçalho da Torre de Controle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Torre de Controle Operacional
            </span>
            <span className="text-xs text-[var(--color-text-subtle)] font-medium">Rio Verde - GO</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5 mt-1.5">
            <Radio className="text-[var(--color-primary)]" size={26} />
            Radar de Despacho & Performance
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Monitoramento em tempo real de chamados na fila, despacho rápido no WhatsApp e métricas financeiras.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border)] transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
          Atualizar Dados
        </button>
      </div>

      {/* ============================================================ */}
      {/* ALERTA CRÍTICO: CHAMADOS ESTAGNADOS NA FILA DE ESPERA (> 5 MIN) */}
      {/* ============================================================ */}
      {stuckQueuedCalls.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-[var(--color-surface)] border-2 border-red-500/80 shadow-2xl shadow-red-950/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-lg motion-safe:animate-pulse">
                <AlertTriangle size={24} strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  ALERTA CRÍTICO: {stuckQueuedCalls.length} chamado{stuckQueuedCalls.length > 1 ? 's' : ''} aguardando técnico há mais de 5 minutos!
                </h2>
                <p className="text-xs text-red-200 mt-0.5">
                  Alto risco de desistência do morador. Acione os prestadores manualmente via WhatsApp antes do cancelamento.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {stuckQueuedCalls.map((call) => {
              const elapsedMinutes = Math.floor((currentTime - new Date(call.created_at).getTime()) / 60000)
              const serviceName = call.service?.name || 'Serviço sob demanda'
              const clientName = call.client?.full_name || 'Morador'
              const neighborhood = call.neighborhood || 'Setor Central'
              const providerCut = Number(call.provider_cut || (Number(call.total_price) - 12))

              return (
                <div
                  key={call.id}
                  className="p-3.5 rounded-xl bg-[var(--color-bg)]/80 border border-red-500/40 hover:border-red-400 transition-all flex flex-col justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-red-500 text-white uppercase tracking-wider">
                        <Clock size={11} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                        {elapsedMinutes} min na fila
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        R$ {providerCut.toFixed(2)} (Líquido)
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-white line-clamp-1">{serviceName}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-red-400 shrink-0" />
                        <span className="font-semibold">{neighborhood}</span> · {clientName}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDispatchCall(call)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    <Send size={13} aria-hidden="true" />
                    Acionar Prestadores no WhatsApp
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GRID DE KPIs PRINCIPAIS (GMV vs. TAKE RATE vs. REPASSE TÉCNICOS) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Volume Bruto Transacionado (GMV) */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">GMV Transacionado</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {formatCurrency(metrics.gmvTotal)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
            <div className="text-emerald-400 font-semibold">
              <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />{formatCurrency(metrics.gmvPaid)} liquidado (pago)
            </div>
            {metrics.gmvPending > 0 && (
              <div className="text-amber-400 font-medium">
                <Clock size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />+ {formatCurrency(metrics.gmvPending)} aguardando Pix
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Receita Própria da Plataforma (Take Rate) */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Receita Repara RV</span>
            <div className="p-2 bg-[var(--color-primary)]/10 rounded-xl text-[var(--color-primary)] border border-[var(--color-primary)]/20">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[var(--color-primary)]">
            {formatCurrency(metrics.platformRevenueTotal)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
            <div className="text-emerald-400 font-semibold">
              <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />{formatCurrency(metrics.platformRevenueRealized)} realizada
            </div>
            {metrics.platformRevenuePending > 0 && (
              <div className="text-amber-400 font-medium">
                <Clock size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />+ {formatCurrency(metrics.platformRevenuePending)} a receber
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Repasse Líquido dos Prestadores */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Repasse Técnicos</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Wrench size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {formatCurrency(metrics.providerPayoutTotal)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
            <div className="text-emerald-400 font-semibold">
              <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />{formatCurrency(metrics.providerPayoutRealized)} transferido
            </div>
            {metrics.providerPayoutPending > 0 && (
              <div className="text-amber-400 font-medium">
                <Clock size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />+ {formatCurrency(metrics.providerPayoutPending)} pendente Pix
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Fila Ativa & Concluídos */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Fila & Concluídos</span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <Zap size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 text-2xl sm:text-3xl font-black text-white">
            <span>{metrics.completedCount}</span>
            <span className="text-xs font-bold text-[var(--color-text-muted)]">concluídos</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
              {metrics.queuedCount} na fila agora
            </span>
            {metrics.stuckQueuedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500 text-white motion-safe:animate-pulse">
                <AlertTriangle size={10} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                {metrics.stuckQueuedCount} estagnado{metrics.stuckQueuedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navegação entre Módulos do Dashboard */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[var(--color-primary)] text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)]'
          }`}
        >
          <Activity size={15} />
          Visão Geral & Rankings
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)]'
          }`}
        >
          <CheckCircle2 size={15} />
          Serviços Efetuados ({metrics.completedCount})
          {metrics.pendingPaymentCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-[var(--color-bg)] ml-1 animate-pulse">
              {metrics.pendingPaymentCount} pend.
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cancellations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'cancellations'
              ? 'bg-[var(--color-primary)] text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)]'
          }`}
        >
          <Filter size={15} />
          Radar de Cancelamentos ({metrics.cancelledCount})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[var(--color-primary)] text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface)]'
          }`}
        >
          <History size={15} />
          Logs de Auditoria ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'sos'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-surface)]'
          }`}
        >
          <ShieldAlert size={15} />
          Alertas SOS ({metrics.sosCount})
        </button>
      </div>

      {/* ============================================================ */}
      {/* ABA 1: VISÃO GERAL, MOTIVOS DE CANCELAMENTO & RANKINGS */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Linha Superior: Diagnóstico de Cancelamentos e Concentração de Bairros */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card: Diagnóstico dos Motivos de Cancelamento */}
            <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <XCircle className="text-red-400" size={18} />
                  Diagnóstico dos Motivos de Cancelamento
                </h3>
                <span className="text-xs font-bold text-[var(--color-text-muted)]">
                  {cancellationReasonAnalysis.total} cancelamento{cancellationReasonAnalysis.total === 1 ? '' : 's'}
                </span>
              </div>

              {cancellationReasonAnalysis.isDemoraCritical && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-red-400 font-bold block">Alerta de Capacidade Operacional em Rio Verde:</strong>
                    Mais de {cancellationReasonAnalysis.demoraPct.toFixed(0)}% dos cancelamentos são causados por tempo de espera excessivo. Priorize o credenciamento de prestadores nessas categorias.
                  </div>
                </div>
              )}

              {cancellationReasonAnalysis.total === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)] py-6 text-center">
                  Nenhum chamado cancelado registrado até o momento. Excelente retenção!
                </p>
              ) : (
                <div className="space-y-3">
                  {cancellationReasonAnalysis.reasons.map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)] font-medium">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${item.text}`}>{item.pct.toFixed(0)}%</span>
                          <span className="text-[var(--color-text-subtle)] text-[11px]">({item.count})</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card: Bairros Mais Demandados de Rio Verde */}
            <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="text-cyan-400" size={18} />
                  Ranking de Demanda por Bairros (Rio Verde)
                </h3>
                <span className="text-xs font-bold text-[var(--color-text-muted)]">
                  {neighborhoodRanking.length} bairros ativos
                </span>
              </div>

              {neighborhoodRanking.length === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)] py-6 text-center">
                  Nenhum chamado registrado por geolocalização até o momento.
                </p>
              ) : (
                <div className="space-y-3">
                  {neighborhoodRanking.map((hood, index) => (
                    <div key={hood.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <span className="w-5 h-5 rounded-md bg-[var(--color-surface-alt)] text-cyan-400 font-bold text-[11px] flex items-center justify-center">
                            #{index + 1}
                          </span>
                          {hood.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400">{hood.pct.toFixed(0)}%</span>
                          <span className="text-[var(--color-text-subtle)] text-[11px]">({hood.count} chamados)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, hood.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Linha Inferior: Top Prestadores em Rio Verde */}
          <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="text-amber-400" size={18} />
              Top Técnicos em Rio Verde (Por Conclusão de Serviços)
            </h3>

            {providerRanking.length === 0 ? (
              <p className="text-xs text-[var(--color-text-subtle)] py-6 text-center">
                Ainda não há dados suficientes de chamados concluídos para gerar o ranking.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {providerRanking.map((prov, index) => (
                  <div
                    key={prov.name}
                    className="p-4 rounded-xl bg-[var(--color-bg)]/60 border border-[var(--color-border)]/80 hover:border-[var(--color-border-strong)] transition-colors flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-primary)] font-bold text-xs flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {prov.paidCount} pago{prov.paidCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white mt-2">{prov.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{prov.phone}</div>
                    </div>

                    <div className="pt-2 border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text-subtle)] text-[11px]">
                        {prov.count} concluído{prov.count === 1 ? '' : 's'}
                      </span>
                      <span className="font-bold text-white">
                        {formatCurrency(prov.earningsPaid)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA: SERVIÇOS CONCLUÍDOS / HISTÓRICO DE SERVIÇOS EFETUADOS */}
      {/* ============================================================ */}
      {activeTab === 'completed' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 bg-[var(--color-surface)]/60 p-4 rounded-2xl border border-[var(--color-border)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <span className="text-xs text-[var(--color-text-muted)] font-semibold whitespace-nowrap flex items-center gap-1.5 mr-1">
                  <CreditCard size={13} /> Pagamento:
                </span>
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    paymentFilter === 'all'
                      ? 'bg-[var(--color-text)] text-[var(--color-bg)] shadow-sm'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                >
                  Todos ({metrics.completedCount})
                </button>
                <button
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    paymentFilter === 'paid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                >
                  <Check size={12} strokeWidth={2.5} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />Pagos ({metrics.paidCount})
                </button>
                <button
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    paymentFilter === 'pending'
                      ? 'bg-amber-500 text-[var(--color-bg)] shadow-sm'
                      : metrics.pendingPaymentCount > 0
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
                  }`}
                >
                  <Clock size={12} strokeWidth={2} className="inline-block -mt-0.5 mr-1 shrink-0" aria-hidden="true" />Aguardando Pix ({metrics.pendingPaymentCount})
                </button>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" size={15} />
                <input
                  type="text"
                  placeholder="Buscar por serviço, cliente, técnico ou bairro..."
                  value={completedSearchQuery}
                  onChange={(e) => setCompletedSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg)]/80 border border-[var(--color-border)] rounded-xl text-xs text-white placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
            {completedCalls.length === 0 ? (
              <div className="p-16 text-center text-[var(--color-text-muted)]">
                <CheckCircle2 className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={36} />
                <p className="text-base font-semibold text-[var(--color-text-muted)]">Nenhum serviço efetuado encontrado</p>
                <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                  Tente alterar os filtros de status de pagamento ou limpar a busca.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/70 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Chamado & Status</th>
                      <th className="py-3.5 px-4">Serviço Efetuado</th>
                      <th className="py-3.5 px-4">Prestador Responsável</th>
                      <th className="py-3.5 px-4">Cliente Atendido</th>
                      <th className="py-3.5 px-4">Localização</th>
                      <th className="py-3.5 px-4 text-right">Divisão Financeira (Split)</th>
                      <th className="py-3.5 px-4 text-center">Gestão de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/60">
                    {completedCalls.map((call) => {
                      const provObj = Array.isArray(call.provider) ? call.provider[0] : call.provider
                      const clientObj = Array.isArray(call.client) ? call.client[0] : call.client
                      const serviceObj = Array.isArray(call.service) ? call.service[0] : call.service

                      const provName = provObj?.full_name || 'Profissional'
                      const provPhone = provObj?.phone || ''
                      const clientName = clientObj?.full_name || 'Cliente'
                      const clientPhone = clientObj?.phone || ''
                      const serviceName = serviceObj?.name || 'Serviço sob demanda'
                      const serviceCategory = serviceObj?.category || 'Geral'

                      const cleanProvPhone = provPhone.replace(/\D/g, '')
                      const cleanClientPhone = clientPhone.replace(/\D/g, '')
                      const provWaUrl = `https://wa.me/55${cleanProvPhone}?text=Ol%C3%A1%20${encodeURIComponent(provName)}%2C%20referente%20ao%20servi%C3%A7o%20conclu%C3%ADdo%20%23${call.id.slice(0, 8)}.`
                      const clientWaUrl = `https://wa.me/55${cleanClientPhone}?text=Ol%C3%A1%20${encodeURIComponent(clientName)}%2C%20falo%20da%20administra%C3%A7%C3%A3o%20do%20Repara%20RV.`

                      const totalPrice = Number(call.total_price || 0)
                      const fee = Number(call.platform_fee || 12.0)
                      const providerCut = Number(call.provider_cut || (totalPrice - fee))
                      const dateStr = call.completed_at || call.created_at
                      const isPaid = call.payment_status === 'paid'

                      return (
                        <tr key={call.id} className="hover:bg-[var(--color-surface-alt)]/40 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-mono text-xs font-bold text-[var(--color-primary)]">
                              #{call.id.slice(0, 8)}
                            </div>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                                <CheckCircle2 size={10} /> Concluído & Pago
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 mt-1">
                                <AlertTriangle size={10} className="text-amber-400" aria-hidden="true" /> Aguardando Pix
                              </span>
                            )}
                            <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
                              <Calendar size={11} className="text-[var(--color-text-subtle)]" />
                              {new Date(dateStr).toLocaleString('pt-BR')}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-white text-xs sm:text-sm">
                              {serviceName}
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border-strong)] mt-1">
                              <Wrench size={10} /> {serviceCategory}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-white text-xs">
                              {provName}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
                              {provPhone}
                            </div>
                            {cleanProvPhone && (
                              <div className="flex flex-col gap-1 mt-1">
                                <a
                                  href={provWaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                                >
                                  <MessageCircle size={11} /> WhatsApp do Técnico
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(cleanProvPhone)
                                    toast.success(`Chave Pix copiada: ${cleanProvPhone} (Repassar ${formatCurrency(providerCut)})`)
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer text-left"
                                >
                                  <Copy size={11} /> Copiar Pix: {cleanProvPhone}
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-white text-xs">
                              {clientName}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
                              {clientPhone}
                            </div>
                            {cleanClientPhone && (
                              <a
                                href={clientWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-semibold mt-1 transition-colors"
                              >
                                <MessageCircle size={11} /> WhatsApp do Cliente
                              </a>
                            )}
                          </td>

                          <td className="py-4 px-4 max-w-[200px]">
                            <div className="text-xs font-semibold text-white flex items-center gap-1">
                              <MapPin size={12} className="text-cyan-400 shrink-0" />
                              <span className="truncate">{call.neighborhood || 'Setor Central'}</span>
                            </div>
                            {call.client_address && (
                              <div className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-0.5">
                                {call.client_address}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="text-xs font-bold text-white">
                              Total: <span className="text-sm font-black">{formatCurrency(totalPrice)}</span>
                            </div>
                            {isPaid ? (
                              <>
                                <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                                  Técnico: +{formatCurrency(providerCut)} (Repassar via Pix)
                                </div>
                                <div className="text-[10px] text-[var(--color-primary)] font-medium">
                                  Taxa Repara RV: {formatCurrency(fee)} (Na conta MP)
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                                  Técnico: {formatCurrency(providerCut)} (Aguardando Pix)
                                </div>
                                <div className="text-[10px] text-amber-400/80 font-medium">
                                  Taxa Repara RV: {formatCurrency(fee)} (A receber)
                                </div>
                              </>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            {!isPaid ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  onClick={() => handleTogglePaymentStatus(call.id, call.payment_status)}
                                  disabled={updatingPaymentId === call.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                >
                                  {updatingPaymentId === call.id ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Confirmar Pix Manual
                                </button>
                                {cleanClientPhone && (
                                  <a
                                    href={`https://wa.me/55${cleanClientPhone}?text=Ol%C3%A1%20${encodeURIComponent(clientName)}%2C%20tudo%20bem%3F%20Falo%20da%20administra%C3%A7%C3%A3o%20do%20Repara%20RV.%20Consta%20como%20pendente%20o%20pagamento%20via%20Pix%20do%20servi%C3%A7o%20%23${call.id.slice(0, 8)}%20(${encodeURIComponent(serviceName)})%20no%20valor%20de%20R%24%20${totalPrice.toFixed(2)}.%20Segue%20a%20chave%20Pix%3A%2064993139075.%20Poderia%20nos%20enviar%20o%20comprovante%3F`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold transition-colors whitespace-nowrap"
                                  >
                                    <MessageCircle size={11} /> Cobrar via WhatsApp
                                  </a>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                  <CheckCircle2 size={12} /> Pix Liquidado
                                </span>
                                <button
                                  onClick={() => handleTogglePaymentStatus(call.id, call.payment_status)}
                                  disabled={updatingPaymentId === call.id}
                                  className="text-[10px] text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] underline transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Desmarcar Pix
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 2: RADAR DE CANCELAMENTOS */}
      {/* ============================================================ */}
      {activeTab === 'cancellations' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCancelFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                cancelFilter === 'all'
                  ? 'bg-[var(--color-text)] text-[var(--color-bg)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}
            >
              Todos ({metrics.cancelledCount})
            </button>
            <button
              onClick={() => setCancelFilter('arrived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                cancelFilter === 'arrived'
                  ? 'bg-red-500 text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}
            >
              Técnico Chegou & Cancelou (arrived_at)
            </button>
            <button
              onClick={() => setCancelFilter('allocated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                cancelFilter === 'allocated'
                  ? 'bg-amber-500 text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}
            >
              Cancelado Pós-Alocação
            </button>
            <button
              onClick={() => setCancelFilter('searching')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                cancelFilter === 'searching'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)]'
              }`}
            >
              Cancelado na Busca / Sem Prestador
            </button>
          </div>

          <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
            {cancelledCalls.length === 0 ? (
              <div className="p-12 text-center text-[var(--color-text-muted)]">
                <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={32} />
                <p className="text-sm font-medium">Nenhum cancelamento encontrado para o filtro selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      <th className="py-3 px-4">Chamado & Data</th>
                      <th className="py-3 px-4">Serviço & Bairro</th>
                      <th className="py-3 px-4">Quem Cancelou</th>
                      <th className="py-3 px-4">Estágio</th>
                      <th className="py-3 px-4">Motivo / Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/60">
                    {cancelledCalls.map((call) => {
                      const reason =
                        call.cancellation_reason ||
                        call.cancel_note ||
                        call.cancel_reason ||
                        'Sem motivo informado'
                      const cancelledRole =
                        call.cancelled_by_role || call.cancel_by || (call.provider ? 'prestador/cliente' : 'cliente')
                      const isArrived = !!call.arrived_at

                      return (
                        <tr key={call.id} className="hover:bg-[var(--color-surface-alt)]/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs text-[var(--color-primary)] font-bold">
                              #{call.id.slice(0, 8)}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-subtle)] mt-0.5">
                              {new Date(call.cancelled_at || call.created_at).toLocaleString('pt-BR')}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-white text-xs">
                              {call.service?.name || 'Serviço sob demanda'}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                              <MapPin size={11} className="text-[var(--color-text-subtle)]" />
                              {call.neighborhood}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border-strong)]">
                              <User size={11} />
                              {cancelledRole}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {isArrived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                <AlertTriangle size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                Técnico no Local
                              </span>
                            ) : call.provider ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Pós-Aceite
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border-strong)]">
                                Na Busca
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-xs text-[var(--color-text-muted)] italic line-clamp-2">
                              &ldquo;{reason}&rdquo;
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 3: LOGS DE AUDITORIA UNIVERSAL */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History size={14} className="text-[var(--color-primary)]" />
              Eventos Imutáveis Registrados por Trigger (service_audit_logs)
            </span>
            <span className="text-[11px] text-[var(--color-text-subtle)]">Últimos 50 eventos</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">
              <History className="mx-auto mb-2 text-[var(--color-text-subtle)]" size={32} />
              <p className="text-sm">Nenhum evento de auditoria gravado no banco ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]/60 font-mono text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 hover:bg-[var(--color-surface-alt)]/40 transition-colors flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        log.action === 'INSERT' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-[var(--color-text-muted)] text-xs">
                        Chamado #{log.call_id.slice(0, 8)}
                      </span>
                      <span className="text-[var(--color-text-subtle)] text-[11px]">
                        {log.previous_status ? `${log.previous_status} ➔ ` : ''}
                        <strong className="text-white">{log.new_status}</strong>
                      </span>
                    </div>

                    {log.cancellation_reason && (
                      <div className="text-red-400 text-[11px]">
                        Motivo: {log.cancellation_reason} {log.cancellation_stage ? `(${log.cancellation_stage})` : ''}
                      </div>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-[var(--color-text-subtle)] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* ABA 4: CENTRAL DE SEGURANÇA SOS */}
      {/* ============================================================ */}
      {activeTab === 'sos' && (
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert size={18} />
              Registro de Incidentes de Segurança (emergency_alerts)
            </h3>
            <span className="text-xs text-[var(--color-text-muted)]">Total: {emergencyAlerts.length}</span>
          </div>

          {emergencyAlerts.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)]">
              <ShieldAlert className="mx-auto mb-2 text-[var(--color-text-subtle)]" size={32} />
              <p className="text-sm font-medium">Nenhum acionamento do botão SOS registrado. Todos os chamados operando em segurança.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencyAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                        SOS POLÍCIA 190
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-semibold">
                        Chamado #{alert.call_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        por {alert.caller?.full_name || alert.user_role}
                      </span>
                    </div>

                    {alert.latitude && alert.longitude && (
                      <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                        <MapPin size={12} className="text-red-400" />
                        GPS no momento: {alert.latitude}, {alert.longitude}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DESPACHO EMERGENCIAL VIA WHATSAPP (ESTAGNAÇÃO NA FILA) */}
      {/* ============================================================ */}
      {dispatchCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-lg">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Despacho Emergencial no WhatsApp
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Acione um dos prestadores cadastrados para assumir este chamado na fila.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDispatchCall(null)}
                className="text-[var(--color-text-muted)] hover:text-white p-1 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Resumo do Chamado */}
            <div className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-primary)] font-mono">
                  #{dispatchCall.id.slice(0, 8)}
                </span>
                <span className="text-xs font-black text-emerald-400">
                  Mão de Obra: {formatCurrency(Number(dispatchCall.provider_cut || (dispatchCall.total_price - 12)))}
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {dispatchCall.service?.name || 'Serviço sob demanda'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                <MapPin size={13} className="text-red-400 shrink-0" />
                <span><strong>{dispatchCall.neighborhood || 'Setor Central'}</strong> · {dispatchCall.client_address || 'Endereço residencial'}</span>
              </div>
              <div className="pt-1.5 border-t border-[var(--color-border)]/80 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>Cliente: <strong className="text-white">{dispatchCall.client?.full_name || 'Morador'}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    const claimUrl = `https://repararv.com/painel?claim=${dispatchCall.id}`
                    navigator.clipboard.writeText(claimUrl)
                    setCopiedClaimId(dispatchCall.id)
                    toast.success('Link de aceite copiado para a área de transferência!')
                    setTimeout(() => setCopiedClaimId(null), 3000)
                  }}
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:text-[var(--color-primary)] font-bold transition-colors cursor-pointer"
                >
                  <Copy size={12} />
                  {copiedClaimId === dispatchCall.id ? 'Link Copiado!' : 'Copiar Link de Aceite'}
                </button>
              </div>
            </div>

            {/* Busca de Prestadores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Técnicos Cadastrados em Rio Verde ({filteredDispatchProviders.length})
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" size={14} />
                <input
                  type="text"
                  placeholder="Filtrar prestador por nome ou fone..."
                  value={dispatchSearch}
                  onChange={(e) => setDispatchSearch(e.target.value)}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* Lista com Scroll */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-[var(--color-border)]/50">
                {filteredDispatchProviders.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-subtle)] py-6 text-center">
                    Nenhum prestador encontrado com o termo pesquisado.
                  </p>
                ) : (
                  filteredDispatchProviders.map((prov) => {
                    const cleanPhone = prov.phone.replace(/\D/g, '')
                    const providerCut = Number(dispatchCall.provider_cut || (dispatchCall.total_price - 12))
                    
                    // Codificação segura do link WhatsApp com encodeURIComponent
                    const msg = encodeURIComponent(
                      `Olá ${prov.full_name}, temos um chamado urgente aguardando no bairro ${dispatchCall.neighborhood || 'Setor Central'} para ${dispatchCall.service?.name || 'Serviço residencial'} (Mão de obra líquida: R$ ${providerCut.toFixed(2)}). Aceite agora pelo link: https://repararv.com/painel?claim=${dispatchCall.id}`
                    )
                    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${msg}`

                    const statusObj = Array.isArray(prov.provider_status)
                      ? prov.provider_status[0]
                      : prov.provider_status
                    const isOnline = Boolean(statusObj?.is_online)
                    const hasMp = Boolean(prov.mercado_pago_connected || statusObj?.recipient_gateway_id)

                    return (
                      <div
                        key={prov.id}
                        className="pt-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {prov.full_name}
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">
                                Online
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--color-text-subtle)] font-normal">Offline</span>
                            )}
                            {hasMp ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold" title="Mercado Pago Conectado">
                                <CheckCircle2 size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                MP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-bold" title="Mercado Pago Pendente">
                                <XCircle size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                                MP Pendente
                              </span>
                            )}
                          </div>
                          <div className="text-[var(--color-text-muted)] text-[11px] font-mono">{prov.phone}</div>
                        </div>

                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all shadow-sm whitespace-nowrap cursor-pointer"
                        >
                          <MessageCircle size={13} />
                          Enviar Chamado
                        </a>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[var(--color-border)] flex justify-end">
              <button
                type="button"
                onClick={() => setDispatchCall(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
