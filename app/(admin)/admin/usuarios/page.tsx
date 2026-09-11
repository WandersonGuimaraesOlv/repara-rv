'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Users, 
  UserCheck, 
  Wrench, 
  Shield, 
  Search, 
  RefreshCw, 
  MessageCircle, 
  CreditCard, 
  CheckCircle2, 
  XCircle,
  Phone,
  Calendar,
  Award,
  AlertCircle,
  AlertTriangle,
  Star,
  Copy,
  Check,
  Ban,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { 
  getAdminUsersListAction, 
  updateUserRoleAction, 
  updateBackgroundCheckStatusAction,
  toggleUserBlockedAction,
  AdminUserListItem 
} from '@/app/actions/admin-users'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'provider' | 'admin'>('all')
  const [mpFilter, setMpFilter] = useState<'all' | 'connected' | 'pending'>('all')
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'blocked'>('all')
  
  // Estado para Edição de Papel
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'client' | 'provider' | 'admin'>('client')
  const [savingRole, setSavingRole] = useState<boolean>(false)

  // Estado para Confirmação de Bloqueio/Desbloqueio
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null)
  const [blockTargetUser, setBlockTargetUser] = useState<AdminUserListItem | null>(null)

  // Feedback de Cópia de Link do Mercado Pago
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Carregamento inicial de usuários
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminUsersListAction()
      if (res.success && res.data) {
        setUsers(res.data)
      } else {
        toast.error(res.error || 'Erro ao carregar lista de usuários.')
      }
    } catch {
      toast.error('Erro de conexão ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Métricas Consolidadas de Auditoria
  const metrics = useMemo(() => {
    const total = users.length
    const clients = users.filter((u) => u.role === 'client')
    const providers = users.filter((u) => u.role === 'provider')
    const admins = users.filter((u) => u.role === 'admin')
    const onlineProviders = providers.filter((p) => p.provider_status?.is_online)
    const mpConnectedProviders = providers.filter((p) => p.mercado_pago_connected)
    const mpPendingProviders = providers.filter((p) => !p.mercado_pago_connected)
    const approvedCompliance = providers.filter((p) => p.background_check_status === 'approved')
    const blockedCount = users.filter((u) => u.is_blocked).length

    return {
      total,
      clientsCount: clients.length,
      providersCount: providers.length,
      onlineProvidersCount: onlineProviders.length,
      mpConnectedCount: mpConnectedProviders.length,
      mpPendingCount: mpPendingProviders.length,
      approvedComplianceCount: approvedCompliance.length,
      adminsCount: admins.length,
      blockedCount,
    }
  }, [users])

  // Filtragem e Busca em Tempo Real
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      // Filtro de Papel
      if (roleFilter !== 'all' && u.role !== roleFilter) {
        return false
      }

      // Filtro de Mercado Pago (relevante principalmente para prestadores)
      if (mpFilter === 'connected' && !u.mercado_pago_connected) return false
      if (mpFilter === 'pending' && u.mercado_pago_connected) return false

      // Filtro de Compliance / Bloqueio
      if (complianceFilter === 'blocked' && !u.is_blocked) return false
      if (complianceFilter === 'approved' && u.background_check_status !== 'approved') return false
      if (complianceFilter === 'pending' && u.background_check_status !== 'pending') return false
      if (complianceFilter === 'rejected' && u.background_check_status !== 'rejected') return false

      if (!query) return true

      const nameMatch = u.full_name.toLowerCase().includes(query)
      const phoneMatch = u.phone.includes(query)
      const cpfMatch = u.cpf_or_cnpj.toLowerCase().includes(query)
      const pixMatch = u.provider_status?.pix_key.toLowerCase().includes(query)
      const idMatch = u.id.toLowerCase().includes(query)

      return nameMatch || phoneMatch || cpfMatch || pixMatch || idMatch
    })
  }, [users, roleFilter, mpFilter, complianceFilter, searchQuery])

  // Higienizador Seguro de Telefone para Rio Verde (DDI 55 + DDD 64)
  const getSanitizedPhone = (rawPhone: string) => {
    let digits = rawPhone.replace(/\D/g, '')
    if (digits.startsWith('0')) digits = digits.slice(1)
    if (!digits.startsWith('55')) {
      if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`
      }
    }
    return digits
  }

  // Gera Link WhatsApp com Apoio Administrativo
  const getWhatsAppAdministrativeUrl = (user: AdminUserListItem) => {
    const phone = getSanitizedPhone(user.phone)
    const msg = encodeURIComponent(
      `Olá ${user.full_name}, aqui é da administração da Repara RV em Rio Verde...`
    )
    return `https://wa.me/${phone}?text=${msg}`
  }

  // Gera Link de Cobrança de Conexão Mercado Pago via WhatsApp
  const getWhatsAppMercadoPagoUrl = (user: AdminUserListItem) => {
    const phone = getSanitizedPhone(user.phone)
    const msg = encodeURIComponent(
      `Olá ${user.full_name}, aqui é da equipe de gestão do Repara RV! Identificamos que sua conta Mercado Pago ainda não está conectada para o split automático de pagamentos Pix. Sem ela, nosso sistema não pode despachar chamados para você em Rio Verde.\n\nConecte sua conta em menos de 1 minuto pelo link seguro:\nhttps://repararv.com/painel/configuracoes/mercado-pago`
    )
    return `https://wa.me/${phone}?text=${msg}`
  }

  // Copia Link Oficial de Vinculação do Mercado Pago
  const handleCopyMpLink = (user: AdminUserListItem) => {
    const mpLink = 'https://repararv.com/painel/configuracoes/mercado-pago'
    navigator.clipboard.writeText(mpLink)
    setCopiedId(user.id)
    toast.success(`Link de conexão Mercado Pago copiado para ${user.full_name.split(' ')[0]}!`)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Alteração de Papel (Role)
  const handleSaveRole = async (userId: string) => {
    setSavingRole(true)
    try {
      const res = await updateUserRoleAction({ userId, role: selectedRole })
      if (res.success) {
        toast.success('Papel do usuário atualizado com sucesso!')
        setEditingUserId(null)
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: selectedRole } : u))
        )
      } else {
        toast.error(res.error || 'Falha ao alterar papel do usuário.')
      }
    } catch {
      toast.error('Erro inesperado ao alterar papel.')
    } finally {
      setSavingRole(false)
    }
  }

  // Alteração de Status de Compliance / Antecedentes Criminais
  const handleChangeCompliance = async (
    userId: string,
    newStatus: 'approved' | 'pending' | 'rejected'
  ) => {
    // Atualização otimista
    const oldUsers = [...users]
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, background_check_status: newStatus } : u
      )
    )

    try {
      const res = await updateBackgroundCheckStatusAction({ userId, status: newStatus })
      if (res.success) {
        const label =
          newStatus === 'approved'
            ? 'Aprovado (Segurança Verificada)'
            : newStatus === 'pending'
            ? 'Pendente de Verificação'
            : 'Reprovado / Bloqueado'
        toast.success(`Compliance atualizado: ${label}`)
      } else {
        // Reverte se falhou
        setUsers(oldUsers)
        toast.error(res.error || 'Falha ao atualizar compliance do prestador.')
      }
    } catch {
      setUsers(oldUsers)
      toast.error('Erro de comunicação ao atualizar compliance.')
    }
  }

  // Abertura do Modal de Bloqueio Emergencial
  const handleConfirmToggleBlock = async () => {
    if (!blockTargetUser) return
    const userId = blockTargetUser.id
    const targetBlockedState = !blockTargetUser.is_blocked
    setBlockingUserId(userId)

    // Atualização otimista
    const oldUsers = [...users]
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_blocked: targetBlockedState } : u))
    )

    try {
      const res = await toggleUserBlockedAction({
        userId,
        isBlocked: targetBlockedState,
      })
      if (res.success) {
        toast.success(
          targetBlockedState
            ? `Conta de ${blockTargetUser.full_name} foi suspensa preventivamente.`
            : `Conta de ${blockTargetUser.full_name} reativada com sucesso.`
        )
        setBlockTargetUser(null)
      } else {
        setUsers(oldUsers)
        toast.error(res.error || 'Falha ao alterar status de suspensão.')
      }
    } catch {
      setUsers(oldUsers)
      toast.error('Erro ao conectar ao servidor para alterar suspensão.')
    } finally {
      setBlockingUserId(null)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <ShieldCheck className="text-orange-500" size={28} />
            Central de Auditoria, Compliance & Split
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Fiscalização de pagamentos, divisão automática de Pix (Mercado Pago) e homologação de segurança em Rio Verde.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : 'text-slate-400'} />
          Atualizar Lista
        </button>
      </div>

      {/* Grid de KPIs de Auditoria e Split */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Geral */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Contas</span>
            <div className="p-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{metrics.total}</div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>{metrics.clientsCount} clientes</span>
            <span>•</span>
            <span className="text-orange-400 font-semibold">{metrics.providersCount} prestadores</span>
          </div>
        </div>

        {/* Split Mercado Pago Conectado */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Split Mercado Pago</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {metrics.mpConnectedCount}{' '}
            <span className="text-sm font-medium text-slate-400">/ {metrics.providersCount}</span>
          </div>
          <div className="text-xs flex items-center gap-1.5">
            {metrics.mpPendingCount > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle size={12} /> {metrics.mpPendingCount} prestador{metrics.mpPendingCount > 1 ? 'es' : ''} com MP pendente
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> 100% dos técnicos conectados
              </span>
            )}
          </div>
        </div>

        {/* Compliance / Antecedentes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Homologados</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-400">
            {metrics.approvedComplianceCount}
          </div>
          <div className="text-xs text-slate-500">
            Segurança verificada em Rio Verde
          </div>
        </div>

        {/* Bloqueios Preventivos */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Suspensões</span>
            <div className={`p-2 rounded-xl border ${
              metrics.blockedCount > 0 
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Ban size={18} />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-black ${metrics.blockedCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {metrics.blockedCount}
          </div>
          <div className="text-xs text-slate-500">
            {metrics.blockedCount > 0 ? 'Contas bloqueadas preventivamente' : 'Nenhuma conta suspensa'}
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos & Abas Segmentadas */}
      <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Abas de filtro por papel */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Todos ({metrics.total})
            </button>
            <button
              onClick={() => setRoleFilter('provider')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === 'provider'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Wrench size={13} />
              Prestadores ({metrics.providersCount})
            </button>
            <button
              onClick={() => setRoleFilter('client')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === 'client'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserCheck size={13} />
              Clientes ({metrics.clientsCount})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === 'admin'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Shield size={13} />
              Admins ({metrics.adminsCount})
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Buscar nome, telefone, CPF ou Pix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Sub-Filtros de Auditoria (Split Mercado Pago e Compliance) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Split MP:</span>
            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                onClick={() => setMpFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  mpFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setMpFilter('connected')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors flex items-center gap-1 ${
                  mpFilter === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Conectados
              </button>
              <button
                onClick={() => setMpFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors flex items-center gap-1 ${
                  mpFilter === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Pendentes
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Compliance:</span>
            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                onClick={() => setComplianceFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  complianceFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setComplianceFilter('approved')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-blue-400 ${
                  complianceFilter === 'approved' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-blue-300'
                }`}
              >
                Aprovados
              </button>
              <button
                onClick={() => setComplianceFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-amber-400 ${
                  complianceFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setComplianceFilter('blocked')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-red-400 ${
                  complianceFilter === 'blocked' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:text-red-300'
                }`}
              >
                Suspensos ({metrics.blockedCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista / Tabela de Usuários com Auditoria */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-orange-500" size={30} />
            <p className="text-sm font-medium">Carregando usuários e auditorias...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="mx-auto mb-3 text-slate-600" size={36} />
            <p className="text-base font-semibold text-slate-300">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Tente alterar os termos de busca ou os filtros aplicados acima.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuário & Segurança</th>
                  <th className="py-3.5 px-4">WhatsApp & Contato</th>
                  <th className="py-3.5 px-4">Split Mercado Pago</th>
                  <th className="py-3.5 px-4">Compliance / Antecedentes</th>
                  <th className="py-3.5 px-4">Performance & Ganhos</th>
                  <th className="py-3.5 px-4 text-right">Controle Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isProvider = user.role === 'provider'
                  const isClient = user.role === 'client'
                  const isAdmin = user.role === 'admin'
                  const isOnline = Boolean(user.provider_status?.is_online)
                  const hasMp = user.mercado_pago_connected
                  const isBlocked = user.is_blocked
                  const adminWaUrl = getWhatsAppAdministrativeUrl(user)
                  const mpWaUrl = getWhatsAppMercadoPagoUrl(user)

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isBlocked ? 'bg-red-950/10' : ''
                      }`}
                    >
                      {/* Coluna 1: Usuário, Foto/Inicial, CPF, Status de Bloqueio */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 ${
                            isBlocked
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : isAdmin
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              : isProvider
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}>
                            {user.full_name.charAt(0).toUpperCase() || 'U'}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs sm:text-sm">
                                {user.full_name}
                              </span>
                              {isBlocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                                  <Ban size={10} /> SUSPENSO
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Badge de Papel */}
                              {isAdmin && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                  <Shield size={10} /> ADMIN
                                </span>
                              )}
                              {isProvider && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Wrench size={10} /> PRESTADOR
                                </span>
                              )}
                              {isClient && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                  <UserCheck size={10} /> CLIENTE
                                </span>
                              )}

                              {/* Indicador Online para prestador */}
                              {isProvider && (
                                <span>
                                  {isOnline ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                      Online
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                      Offline
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            {user.cpf_or_cnpj ? (
                              <div className="text-[11px] text-slate-400">
                                CPF/CNPJ: <span className="font-mono text-slate-300">{user.cpf_or_cnpj}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic">
                                CPF não informado
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Calendar size={10} />
                              Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: WhatsApp & Contato Direto */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="text-xs text-slate-200 font-mono flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            {user.phone}
                          </div>

                          <a
                            href={adminWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition-all shadow-sm group"
                            title="Conversar com este usuário via WhatsApp"
                          >
                            <MessageCircle size={13} className="text-emerald-400 group-hover:text-slate-950" />
                            Conversar (wa.me)
                          </a>
                        </div>
                      </td>

                      {/* Coluna 3: Auditoria de Split Mercado Pago */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-2">
                            {hasMp ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 size={13} />
                                  MP Conectado
                                </span>
                                {user.recipient_gateway_id && (
                                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                                    Subconta: {user.recipient_gateway_id}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                  <AlertTriangle size={13} />
                                  MP Pendente
                                </span>
                                
                                <div className="flex flex-col gap-1 pt-0.5">
                                  {/* Botão Copiar Link */}
                                  <button
                                    onClick={() => handleCopyMpLink(user)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors w-fit"
                                    title="Copiar link de autorização Mercado Pago"
                                  >
                                    {copiedId === user.id ? (
                                      <>
                                        <Check size={11} className="text-emerald-400" />
                                        <span className="text-emerald-400 font-bold">Copiado!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={11} className="text-slate-400" />
                                        <span>Copiar Link MP</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Botão Cobrar no WhatsApp */}
                                  <a
                                    href={mpWaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 transition-colors w-fit"
                                    title="Enviar lembrete via WhatsApp para conectar o Mercado Pago"
                                  >
                                    <MessageCircle size={11} />
                                    Cobrar Conexão
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Chave Pix Cadastrada */}
                            {user.provider_status?.pix_key && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <CreditCard size={10} className="text-slate-400" />
                                Pix: <span className="font-mono text-slate-300">{user.provider_status.pix_key}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">
                            Não se aplica (Cliente)
                          </div>
                        )}
                      </td>

                      {/* Coluna 4: Auditoria de Compliance & Antecedentes */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-1.5">
                            <div className="relative inline-block text-left">
                              <select
                                value={user.background_check_status}
                                onChange={(e) =>
                                  handleChangeCompliance(
                                    user.id,
                                    e.target.value as 'approved' | 'pending' | 'rejected'
                                  )
                                }
                                className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors ${
                                  user.background_check_status === 'approved'
                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                                    : user.background_check_status === 'pending'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                    : 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
                                }`}
                              >
                                <option value="approved" className="bg-slate-900 text-blue-400">
                                  🟢 Aprovado (Verificado)
                                </option>
                                <option value="pending" className="bg-slate-900 text-amber-400">
                                  🟡 Pendente (Aguardando Docs)
                                </option>
                                <option value="rejected" className="bg-slate-900 text-red-400">
                                  🔴 Reprovado (Bloqueado)
                                </option>
                              </select>
                              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                            </div>

                            {user.background_check_status === 'approved' ? (
                              <div className="text-[10px] text-blue-400 flex items-center gap-1 font-semibold">
                                <ShieldCheck size={11} /> Segurança Verificada
                              </div>
                            ) : user.background_check_status === 'rejected' ? (
                              <div className="text-[10px] text-red-400 flex items-center gap-1 font-semibold">
                                <ShieldAlert size={11} /> Bloqueado no radar
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-400/80 flex items-center gap-1">
                                <AlertCircle size={11} /> Certidão pendente
                              </div>
                            )}

                            {/* Termo e Declaração */}
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5">
                              {user.terms_accepted_at ? (
                                <span className="text-emerald-400/80 flex items-center gap-0.5">
                                  <CheckCircle2 size={9} /> Termo OK
                                </span>
                              ) : (
                                <span className="text-slate-500 flex items-center gap-0.5">
                                  <XCircle size={9} /> Sem termo
                                </span>
                              )}
                              {user.self_declaration_signed && (
                                <span className="text-cyan-400/80 flex items-center gap-0.5">
                                  <CheckCircle2 size={9} /> Declaração
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            Consumidor regular
                          </div>
                        )}
                      </td>

                      {/* Coluna 5: Métricas de Performance & Ganhos */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-1">
                            {/* Nota Média */}
                            <div className="flex items-center gap-1.5">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs">
                                <Star size={12} className="fill-amber-400 text-amber-400" />
                                {Number(user.rating_avg).toFixed(1)}
                              </div>
                              <span className="text-xs font-semibold text-slate-300">
                                {user.completed_calls_as_provider} atendimentos
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-300">
                              Recebido: <strong className="text-white">{formatCurrency(user.total_earned_as_provider)}</strong>
                            </div>

                            {user.pending_earnings_as_provider > 0 && (
                              <div className="text-[10px] text-amber-400 font-semibold">
                                + {formatCurrency(user.pending_earnings_as_provider)} pendente
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-200">
                              {user.total_calls_as_client} {user.total_calls_as_client === 1 ? 'chamado' : 'chamados'}
                            </div>
                            {user.unpaid_calls_as_client > 0 ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <AlertTriangle size={10} /> {user.unpaid_calls_as_client} pendente Pix
                              </div>
                            ) : (
                              <div className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                                <CheckCircle2 size={10} /> Pagamentos em dia
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Coluna 6: Ações de Controle Operacional */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {/* Botão de Bloqueio Emergencial / Desbloqueio */}
                          <button
                            onClick={() => setBlockTargetUser(user)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isBlocked
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/40'
                                : 'bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30'
                            }`}
                            title={isBlocked ? 'Reativar conta' : 'Suspender conta preventivamente'}
                          >
                            <Ban size={12} />
                            {isBlocked ? 'Reativar Conta' : 'Suspender'}
                          </button>

                          {/* Edição de Papel */}
                          {editingUserId === user.id ? (
                            <div className="inline-flex flex-col items-end gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-700 shadow-xl">
                              <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as 'client' | 'provider' | 'admin')}
                                className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-white px-2 py-1 focus:outline-none focus:border-orange-500"
                              >
                                <option value="client">Cliente</option>
                                <option value="provider">Prestador</option>
                                <option value="admin">Administrador</option>
                              </select>
                              <div className="flex items-center gap-1.5 mt-1">
                                <button
                                  onClick={() => handleSaveRole(user.id)}
                                  disabled={savingRole}
                                  className="px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                                >
                                  {savingRole ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  disabled={savingRole}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingUserId(user.id)
                                setSelectedRole(user.role)
                              }}
                              className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 transition-colors"
                            >
                              Editar Cargo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Bloqueio / Reativação de Conta */}
      {blockTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                blockTargetUser.is_blocked
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                <Ban size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {blockTargetUser.is_blocked ? 'Reativar Usuário?' : 'Suspender Conta de Usuário?'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Usuário: <strong className="text-white">{blockTargetUser.full_name}</strong> ({blockTargetUser.phone})
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 text-xs text-slate-300 space-y-2">
              {blockTargetUser.is_blocked ? (
                <p>
                  Ao reativar, o usuário poderá fazer login normalmente e, caso seja prestador com Mercado Pago conectado, voltará a poder ficar online para aceitar ordens de serviço.
                </p>
              ) : (
                <p>
                  ⚠️ <strong>Ação de Segurança Imediata:</strong> O usuário será desconectado e impedido de aceitar ordens de serviço ou ficar online no radar de Rio Verde até que a administração libere seu cadastro.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBlockTargetUser(null)}
                disabled={Boolean(blockingUserId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmToggleBlock}
                disabled={Boolean(blockingUserId)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg disabled:opacity-50 ${
                  blockTargetUser.is_blocked
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                }`}
              >
                {blockingUserId ? 'Processando...' : blockTargetUser.is_blocked ? 'Sim, Reativar Conta' : 'Sim, Suspender Conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
