'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { 
  BarChart3, 
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
  CreditCard
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

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [calls, setCalls] = useState<ServiceCallRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlertRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'completed' | 'cancellations' | 'audit' | 'sos'>('overview')
  const [cancelFilter, setCancelFilter] = useState<'all' | 'arrived' | 'allocated' | 'searching'>('all')
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>('')
  const [completedSearchQuery, setCompletedSearchQuery] = useState<string>('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null)

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
      // 1. Busca chamados com relacionamentos incluindo payment_status
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
          service:quick_services(name, category),
          client:profiles!client_id(full_name, phone),
          provider:profiles!provider_id(full_name, phone)
        `)
        .order('created_at', { ascending: false })

      if (!callsError && callsData) {
        setCalls(callsData as unknown as ServiceCallRecord[])
      }

      // 2. Busca histórico imutável de auditoria
      const { data: auditData, error: auditError } = await supabase
        .from('service_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!auditError && auditData) {
        setAuditLogs(auditData as unknown as AuditLogRecord[])
      }

      // 3. Busca incidentes do botão SOS
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

  // Métricas Calculadas com separação rigorosa de Pago vs Pendente
  const metrics = useMemo(() => {
    const total = calls.length
    const completed = calls.filter(c => c.status === 'completed')
    const paidCompleted = completed.filter(c => c.payment_status === 'paid')
    const pendingCompleted = completed.filter(c => c.payment_status !== 'paid')
    const cancelled = calls.filter(c => c.status === 'cancelled' || c.status === 'no_providers_available')
    const inProgress = calls.filter(c => ['accepted', 'on_the_way', 'in_progress'].includes(c.status))
    const searching = calls.filter(c => c.status === 'searching')

    // Volume GMV Liquidado (pago) vs Pendente de Pix
    const gmvPaid = paidCompleted.reduce((acc, c) => acc + Number(c.total_price || 0), 0)
    const gmvPending = pendingCompleted.reduce((acc, c) => acc + Number(c.total_price || 0), 0)

    // Regra inegociável: platform_fee fixa de R$ 12,00 por serviço concluído
    const platformRevenueRealized = paidCompleted.length * 12.0
    const platformRevenuePending = pendingCompleted.length * 12.0

    // Repasse aos técnicos: liquidado vs pendente
    const providerPayoutRealized = paidCompleted.reduce(
      (acc, c) => acc + Number(c.provider_cut || (Number(c.total_price) - 12)),
      0
    )
    const providerPayoutPending = pendingCompleted.reduce(
      (acc, c) => acc + Number(c.provider_cut || (Number(c.total_price) - 12)),
      0
    )
    const cancellationRate = total > 0 ? (cancelled.length / total) * 100 : 0

    return {
      total,
      completedCount: completed.length,
      paidCount: paidCompleted.length,
      pendingPaymentCount: pendingCompleted.length,
      cancelledCount: cancelled.length,
      inProgressCount: inProgress.length,
      searchingCount: searching.length,
      gmvPaid,
      gmvPending,
      platformRevenueRealized,
      platformRevenuePending,
      providerPayoutRealized,
      providerPayoutPending,
      cancellationRate,
      sosCount: emergencyAlerts.length,
    }
  }, [calls, emergencyAlerts])

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

    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [calls])

  // Lista de técnicos com chamados concluídos (para filtro em chips)
  const completedProvidersList = useMemo(() => {
    const set = new Set<string>()
    calls.filter(c => c.status === 'completed').forEach(c => {
      const provObj = Array.isArray(c.provider) ? c.provider[0] : c.provider
      if (provObj?.full_name) set.add(provObj.full_name)
    })
    return Array.from(set).sort()
  }, [calls])

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

      // Filtro de pagamento
      if (paymentFilter === 'paid' && c.payment_status !== 'paid') {
        return false
      }
      if (paymentFilter === 'pending' && c.payment_status === 'paid') {
        return false
      }

      if (selectedProviderFilter && provName.toLowerCase() !== selectedProviderFilter.toLowerCase()) {
        return false
      }

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
  }, [calls, paymentFilter, selectedProviderFilter, completedSearchQuery])

  // Ranking de Bairros Atendidos
  const neighborhoodRanking = useMemo(() => {
    const map: Record<string, number> = {}
    calls.forEach(c => {
      const hood = c.neighborhood || 'Setor Central'
      map[hood] = (map[hood] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [calls])

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
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <BarChart3 className="text-orange-500" size={26} />
            Analytics & Central de Auditoria
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Métricas em tempo real de transações, performance de técnicos e radar forense de cancelamentos.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : 'text-slate-400'} />
          Atualizar Dados
        </button>
      </div>

      {/* Grid de KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chamados Concluídos */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Concluídos</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {metrics.completedCount}
          </div>
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{metrics.paidCount} pagos</span>
            {metrics.pendingPaymentCount > 0 ? (
              <span className="text-amber-400 font-semibold">
                · {metrics.pendingPaymentCount} pendente{metrics.pendingPaymentCount > 1 ? 's' : ''} Pix ⚠️
              </span>
            ) : (
              <span className="text-slate-500">· 100% quitados</span>
            )}
          </div>
        </div>

        {/* Volume Transacionado (GMV) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">GMV Liquidado</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {formatCurrency(metrics.gmvPaid)}
          </div>
          <div className="text-xs text-slate-400 space-y-0.5">
            {metrics.gmvPending > 0 && (
              <div className="text-amber-400 font-medium">
                + {formatCurrency(metrics.gmvPending)} pendente Pix ⚠️
              </div>
            )}
            <div className="text-slate-500">
              Repassado aos técnicos: <strong className="text-slate-300">{formatCurrency(metrics.providerPayoutRealized)}</strong>
            </div>
          </div>
        </div>

        {/* Receita Líquida da Plataforma */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Receita Líquida</span>
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-orange-400">
            {formatCurrency(metrics.platformRevenueRealized)}
          </div>
          <div className="text-xs text-slate-400 space-y-0.5">
            {metrics.platformRevenuePending > 0 && (
              <div className="text-amber-400 font-medium">
                + {formatCurrency(metrics.platformRevenuePending)} a receber ({metrics.pendingPaymentCount} pend.)
              </div>
            )}
            <div className="text-slate-500">
              Taxa fixa <strong className="text-slate-300">R$ 12,00</strong> / serviço liquidado
            </div>
          </div>
        </div>

        {/* Taxa de Cancelamento */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Cancelamentos</span>
            <div className="p-2 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
              <XCircle size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {metrics.cancelledCount}
          </div>
          <div className="text-xs text-slate-500">
            Taxa global: <strong className={metrics.cancellationRate > 20 ? 'text-red-400' : 'text-slate-300'}>{metrics.cancellationRate.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      {/* Navegação entre Módulos do Dashboard */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity size={15} />
          Visão Geral & Rankings
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CheckCircle2 size={15} />
          Serviços Efetuados ({metrics.completedCount})
          {metrics.pendingPaymentCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-slate-950 ml-1 animate-pulse">
              {metrics.pendingPaymentCount} pend.
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cancellations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'cancellations'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Filter size={15} />
          Radar de Cancelamentos ({metrics.cancelledCount})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <History size={15} />
          Logs de Auditoria ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'sos'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-red-400 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert size={15} />
          Alertas SOS ({metrics.sosCount})
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL & RANKINGS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Prestadores */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="text-amber-400" size={18} />
              Top Técnicos em Rio Verde (Por Conclusão)
            </h3>

            {providerRanking.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Ainda não há dados suficientes de chamados concluídos para gerar o ranking.
              </p>
            ) : (
              <div className="space-y-3">
                {providerRanking.map((prov, index) => (
                  <div
                    key={prov.name}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-orange-400 font-bold text-xs flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white">{prov.name}</div>
                          <div className="text-[11px] text-slate-400">{prov.phone}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400">
                          {prov.paidCount} {prov.paidCount === 1 ? 'pago' : 'pagos'}
                        </span>
                        {prov.pendingCount > 0 && (
                          <span className="text-[11px] font-bold text-amber-400 ml-1.5">
                            ({prov.pendingCount} pendente{prov.pendingCount > 1 ? 's' : ''})
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {formatCurrency(prov.earningsPaid)} recebido
                          {prov.pendingCount > 0 && (
                            <span className="text-amber-400/90 block font-medium">
                              + {formatCurrency(prov.earningsPending)} a receber
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        {prov.count} atendimento{prov.count > 1 ? 's' : ''} concluído{prov.count > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedProviderFilter(prov.name)
                          setActiveTab('completed')
                        }}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1 transition-colors"
                      >
                        Ver serviços efetuados ➔
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Bairros com Maior Demanda */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="text-cyan-400" size={18} />
              Concentração por Bairro em Rio Verde
            </h3>

            {neighborhoodRanking.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Nenhum chamado registrado por geolocalização até o momento.
              </p>
            ) : (
              <div className="space-y-3">
                {neighborhoodRanking.map((hood, index) => (
                  <div
                    key={hood.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span className="text-slate-500 text-xs">0{index + 1}.</span>
                      {hood.name}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {hood.count} chamados
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA: SERVIÇOS CONCLUÍDOS / HISTÓRICO DE SERVIÇOS EFETUADOS */}
      {activeTab === 'completed' && (
        <div className="space-y-6">
          {/* Header da aba com filtros rápidos */}
          <div className="flex flex-col gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            {/* Linha superior: Filtros por status financeiro e busca */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filtro por Status Financeiro (Pago vs Pendente Pix) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <span className="text-xs text-slate-400 font-semibold whitespace-nowrap flex items-center gap-1.5 mr-1">
                  <CreditCard size={13} /> Pagamento:
                </span>
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    paymentFilter === 'all'
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todos ({metrics.completedCount})
                </button>
                <button
                  onClick={() => setPaymentFilter('paid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    paymentFilter === 'paid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ✔ Pagos ({metrics.paidCount})
                </button>
                <button
                  onClick={() => setPaymentFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    paymentFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : metrics.pendingPaymentCount > 0
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 hover:bg-amber-500/25'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ⏳ Aguardando Pix ({metrics.pendingPaymentCount})
                </button>
              </div>

              {/* Input de Busca */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  type="text"
                  placeholder="Buscar por serviço, cliente, técnico ou bairro..."
                  value={completedSearchQuery}
                  onChange={(e) => setCompletedSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Linha inferior: Chips de Técnicos */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-800/60 pb-1 md:pb-0">
              <span className="text-xs text-slate-400 font-semibold whitespace-nowrap flex items-center gap-1.5 mr-1">
                <Filter size={13} /> Filtrar Técnico:
              </span>
              <button
                onClick={() => setSelectedProviderFilter('')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  !selectedProviderFilter
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos
              </button>
              {completedProvidersList.map((provName) => (
                <button
                  key={provName}
                  onClick={() => setSelectedProviderFilter(provName)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedProviderFilter === provName
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {provName}
                </button>
              ))}
            </div>
          </div>

          {/* Tag de filtro ativo se selecionado */}
          {selectedProviderFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filtrando atendimentos executados por:</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                {selectedProviderFilter}
                <button
                  onClick={() => setSelectedProviderFilter('')}
                  className="hover:text-white ml-1"
                  title="Remover filtro"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
          )}

          {/* Cards ou Tabela de Chamados Concluídos */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {completedCalls.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <CheckCircle2 className="mx-auto mb-3 text-slate-600" size={36} />
                <p className="text-base font-semibold text-slate-300">Nenhum serviço efetuado encontrado</p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedProviderFilter || completedSearchQuery || paymentFilter !== 'all'
                    ? 'Tente alterar os filtros de status de pagamento ou limpar a busca.'
                    : 'Ainda não há registros de atendimentos concluídos no sistema.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Chamado & Status</th>
                      <th className="py-3.5 px-4">Serviço Efetuado</th>
                      <th className="py-3.5 px-4">Prestador Responsável</th>
                      <th className="py-3.5 px-4">Cliente Atendido</th>
                      <th className="py-3.5 px-4">Localização</th>
                      <th className="py-3.5 px-4 text-right">Divisão Financeira (Split)</th>
                      <th className="py-3.5 px-4 text-center">Gestão de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
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
                      const fee = 12.0 // Regra inegociável R$ 12,00
                      const providerCut = Number(call.provider_cut || (totalPrice - 12))
                      const dateStr = call.completed_at || call.created_at
                      const isPaid = call.payment_status === 'paid'

                      return (
                        <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* ID do Chamado & Status do Pagamento */}
                          <td className="py-4 px-4">
                            <div className="font-mono text-xs font-bold text-orange-400">
                              #{call.id.slice(0, 8)}
                            </div>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                                <CheckCircle2 size={10} /> Concluído & Pago
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 mt-1">
                                <AlertTriangle size={10} className="text-amber-400" /> Não Pago / Pendente Pix ⚠️
                              </span>
                            )}
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                              <Calendar size={11} className="text-slate-500" />
                              {new Date(dateStr).toLocaleString('pt-BR')}
                            </div>
                          </td>

                          {/* Serviço Efetuado & Categoria */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-white text-xs sm:text-sm">
                              {serviceName}
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 mt-1">
                              <Wrench size={10} /> {serviceCategory}
                            </span>
                          </td>

                          {/* Prestador */}
                          <td className="py-4 px-4">
                            <div className="font-semibold text-white text-xs">
                              {provName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {provPhone}
                            </div>
                            {cleanProvPhone && (
                              <a
                                href={provWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold mt-1 transition-colors"
                              >
                                <MessageCircle size={11} /> WhatsApp do Técnico
                              </a>
                            )}
                          </td>

                          {/* Cliente */}
                          <td className="py-4 px-4">
                            <div className="font-semibold text-white text-xs">
                              {clientName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
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

                          {/* Localização */}
                          <td className="py-4 px-4 max-w-[200px]">
                            <div className="text-xs font-semibold text-white flex items-center gap-1">
                              <MapPin size={12} className="text-cyan-400 shrink-0" />
                              <span className="truncate">{call.neighborhood || 'Setor Central'}</span>
                            </div>
                            {call.client_address && (
                              <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                                {call.client_address}
                              </div>
                            )}
                          </td>

                          {/* Divisão Financeira (Split) */}
                          <td className="py-4 px-4 text-right">
                            <div className="text-xs font-bold text-white">
                              Total: <span className="text-sm font-black">{formatCurrency(totalPrice)}</span>
                            </div>
                            {isPaid ? (
                              <>
                                <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                                  Técnico: +{formatCurrency(providerCut)} (Liquidado)
                                </div>
                                <div className="text-[10px] text-orange-400 font-medium">
                                  Taxa Repara RV: {formatCurrency(fee)}
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

                          {/* Gestão de Pagamento & Confirmação */}
                          <td className="py-4 px-4 text-center">
                            {!isPaid ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  onClick={() => handleTogglePaymentStatus(call.id, call.payment_status)}
                                  disabled={updatingPaymentId === call.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
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
                                  className="text-[10px] text-slate-500 hover:text-slate-400 underline transition-colors disabled:opacity-50"
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

      {/* ABA 2: RADAR DE CANCELAMENTOS */}
      {activeTab === 'cancellations' && (
        <div className="space-y-4">
          {/* Sub-filtros Operacionais */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCancelFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                cancelFilter === 'all'
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({metrics.cancelledCount})
            </button>
            <button
              onClick={() => setCancelFilter('arrived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                cancelFilter === 'arrived'
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Técnico Chegou & Cancelou (arrived_at)
            </button>
            <button
              onClick={() => setCancelFilter('allocated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                cancelFilter === 'allocated'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Cancelado Pós-Alocação
            </button>
            <button
              onClick={() => setCancelFilter('searching')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                cancelFilter === 'searching'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Cancelado na Busca / Sem Prestador
            </button>
          </div>

          {/* Lista de Cancelamentos */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {cancelledCalls.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={32} />
                <p className="text-sm font-medium">Nenhum cancelamento encontrado para o filtro selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Chamado & Data</th>
                      <th className="py-3 px-4">Serviço & Bairro</th>
                      <th className="py-3 px-4">Quem Cancelou</th>
                      <th className="py-3 px-4">Estágio</th>
                      <th className="py-3 px-4">Motivo / Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
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
                        <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs text-orange-400 font-bold">
                              #{call.id.slice(0, 8)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(call.cancelled_at || call.created_at).toLocaleString('pt-BR')}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-white text-xs">
                              {call.service?.name || 'Serviço sob demanda'}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin size={11} className="text-slate-500" />
                              {call.neighborhood}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                              <User size={11} />
                              {cancelledRole}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {isArrived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                Técnico no Local ⚠️
                              </span>
                            ) : call.provider ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Pós-Aceite
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                Na Busca
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-xs text-slate-300 italic line-clamp-2">
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

      {/* ABA 3: LOGS DE AUDITORIA UNIVERSAL (TRIGGER) */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History size={14} className="text-orange-500" />
              Eventos Imutáveis Registrados por Trigger (service_audit_logs)
            </span>
            <span className="text-[11px] text-slate-500">Últimos 50 eventos</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <History className="mx-auto mb-2 text-slate-600" size={32} />
              <p className="text-sm">Nenhum evento de auditoria gravado no banco ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 font-mono text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        log.action === 'INSERT' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-xs">
                        Chamado #{log.call_id.slice(0, 8)}
                      </span>
                      <span className="text-slate-500 text-[11px]">
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

                  <div className="text-right text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 4: CENTRAL DE SEGURANÇA & BOTÃO SOS */}
      {activeTab === 'sos' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert size={18} />
              Registro de Incidentes de Segurança (emergency_alerts)
            </h3>
            <span className="text-xs text-slate-400">Total: {emergencyAlerts.length}</span>
          </div>

          {emergencyAlerts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShieldAlert className="mx-auto mb-2 text-slate-600" size={32} />
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
                      <span className="text-xs text-slate-300 font-semibold">
                        Chamado #{alert.call_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-slate-400">
                        por {alert.caller?.full_name || alert.user_role}
                      </span>
                    </div>

                    {alert.latitude && alert.longitude && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin size={12} className="text-red-400" />
                        GPS no momento: {alert.latitude}, {alert.longitude}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
