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
  AlertTriangle,
  Star,
  Copy,
  Check,
  Ban,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  KeyRound,
  UserX
} from 'lucide-react'
import {
  getAdminUsersListAction,
  updateUserRoleAction,
  updateBackgroundCheckStatusAction,
  toggleUserBlockedAction,
  resetUserPinAction,
  AdminUserListItem
} from '@/app/actions/admin-users'
import { isWeakPin } from '@/lib/validations/br-documents'
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

  // Estado para reprovação da verificação de identidade (com motivo)
  const [rejectTargetUser, setRejectTargetUser] = useState<AdminUserListItem | null>(null)
  const [rejectReasonInput, setRejectReasonInput] = useState('')
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null)

  // Estado para Reset de PIN de Acesso
  const [pinTargetUser, setPinTargetUser] = useState<AdminUserListItem | null>(null)
  const [newPinValue, setNewPinValue] = useState('')
  const [resettingPin, setResettingPin] = useState(false)

  // Feedback de Cópia
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null)
  const handleCopyPix = (pixKey: string, userId: string) => {
    if (!pixKey) return
    navigator.clipboard.writeText(pixKey)
    setCopiedPixId(userId)
    toast.success('Chave Pix copiada com sucesso!')
    setTimeout(() => setCopiedPixId(null), 2500)
  }

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
    const mpConnectedProviders = providers.filter((p) => Boolean(p.provider_status?.pix_key && p.provider_status.pix_key.trim().length > 0))
    const mpPendingProviders = providers.filter((p) => !p.provider_status?.pix_key || !p.provider_status.pix_key.trim())
    const approvedCompliance = providers.filter((p) => p.background_check_status === 'approved')
    const pendingCompliance = providers.filter((p) => p.background_check_status === 'pending')
    const blockedCount = users.filter((u) => u.is_blocked).length

    return {
      total,
      clientsCount: clients.length,
      providersCount: providers.length,
      onlineProvidersCount: onlineProviders.length,
      mpConnectedCount: mpConnectedProviders.length,
      mpPendingCount: mpPendingProviders.length,
      approvedComplianceCount: approvedCompliance.length,
      pendingComplianceCount: pendingCompliance.length,
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

      // Filtro de Chave Pix (prestadores)
      const hasPix = Boolean(u.provider_status?.pix_key && u.provider_status.pix_key.trim().length > 0)
      if (mpFilter === 'connected' && !hasPix) return false
      if (mpFilter === 'pending' && hasPix) return false

      // Filtro de Compliance / Bloqueio
      if (complianceFilter === 'blocked' && !u.is_blocked && u.background_check_status !== 'rejected') return false
      if (complianceFilter === 'approved' && (u.background_check_status === 'rejected' || u.is_blocked)) return false
      if (complianceFilter === 'rejected' && u.background_check_status !== 'rejected') return false
      if (complianceFilter === 'pending' && u.background_check_status !== 'pending') return false

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

  // Alteração de status de liberação operacional do prestador
  const handleChangeCompliance = async (
    userId: string,
    newStatus: 'approved' | 'pending' | 'rejected',
    rejectionReason?: string
  ) => {
    // Atualização otimista
    const oldUsers = [...users]
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, background_check_status: newStatus, rejection_reason: rejectionReason ?? null }
          : u
      )
    )

    try {
      const res = await updateBackgroundCheckStatusAction({ userId, status: newStatus, rejectionReason })
      if (res.success) {
        const label =
          newStatus === 'approved'
            ? 'Aprovado (Liberado)'
            : newStatus === 'rejected'
            ? 'Reprovado / Bloqueado'
            : 'Pendente de análise'
        toast.success(`Status atualizado: ${label}`)
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

  // Confirmação da reprovação da verificação de identidade (com motivo opcional)
  const handleConfirmReject = async () => {
    if (!rejectTargetUser) return
    setRejectingUserId(rejectTargetUser.id)
    await handleChangeCompliance(rejectTargetUser.id, 'rejected', rejectReasonInput.trim() || undefined)
    setRejectingUserId(null)
    setRejectTargetUser(null)
    setRejectReasonInput('')
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

  // Reset de PIN de acesso (não existe "esqueci minha senha" self-service —
  // login é celular + PIN, sem e-mail real por trás, então só o admin reseta)
  const handleConfirmResetPin = async () => {
    if (!pinTargetUser) return

    if (!/^\d{4,8}$/.test(newPinValue)) {
      toast.error('O PIN deve conter entre 4 e 8 dígitos numéricos')
      return
    }
    if (isWeakPin(newPinValue)) {
      toast.error('PIN muito fácil de adivinhar (sequência ou dígitos repetidos). Escolha outro.')
      return
    }

    setResettingPin(true)
    try {
      const res = await resetUserPinAction({ userId: pinTargetUser.id, newPin: newPinValue })
      if (res.success) {
        toast.success(`PIN de ${pinTargetUser.full_name} atualizado com sucesso.`)
        setPinTargetUser(null)
        setNewPinValue('')
      } else {
        toast.error(res.error || 'Falha ao resetar PIN.')
      }
    } catch {
      toast.error('Erro ao conectar ao servidor para resetar PIN.')
    } finally {
      setResettingPin(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <ShieldCheck className="text-[var(--color-primary)]" size={28} />
            Central de Auditoria, Compliance & Split
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Fiscalização de pagamentos, divisão automática de Pix (Mercado Pago) e homologação de segurança em Rio Verde.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)] text-[var(--color-text)] border border-[var(--color-border)] transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
          Atualizar Lista
        </button>
      </div>

      {/* Grid de KPIs de Auditoria e Split */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Geral */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Contas</span>
            <div className="p-2 bg-[var(--color-surface-alt)] rounded-xl text-[var(--color-text-muted)] border border-[var(--color-border-strong)]">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{metrics.total}</div>
          <div className="text-xs text-[var(--color-text-subtle)] flex items-center gap-2">
            <span>{metrics.clientsCount} clientes</span>
            <span>•</span>
            <span className="text-[var(--color-primary)] font-semibold">{metrics.providersCount} prestadores</span>
          </div>
        </div>

        {/* Chave Pix Cadastrada */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Pix para Repasse</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {metrics.mpConnectedCount} <span className="text-sm font-normal text-[var(--color-text-muted)]">/ {metrics.providersCount}</span>
          </div>
          <div className="text-xs text-[var(--color-text-subtle)]">
            Técnicos com chave Pix cadastrada
          </div>
        </div>

        {/* Homologados / Liberados */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Técnicos Aptos</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-400">
            {metrics.approvedComplianceCount}
          </div>
          <div className="text-xs text-[var(--color-text-subtle)]">
            Liberados via autodeclaração
          </div>
        </div>

        {/* Bloqueios Preventivos */}
        <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Suspensões</span>
            <div className={`p-2 rounded-xl border ${
              metrics.blockedCount > 0 
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border-[var(--color-border-strong)]'
            }`}>
              <Ban size={18} />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-black ${metrics.blockedCount > 0 ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
            {metrics.blockedCount}
          </div>
          <div className="text-xs text-[var(--color-text-subtle)]">
            {metrics.blockedCount > 0 ? 'Contas bloqueadas preventivamente' : 'Nenhuma conta suspensa'}
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos & Abas Segmentadas */}
      <div className="space-y-3 bg-[var(--color-surface)]/60 p-4 rounded-2xl border border-[var(--color-border)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Abas de filtro por papel */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                roleFilter === 'all'
                  ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)]'
              }`}
            >
              Todos ({metrics.total})
            </button>
            <button
              onClick={() => setRoleFilter('provider')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === 'provider'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)]'
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
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)]'
              }`}
            >
              <UserCheck size={13} />
              Clientes ({metrics.clientsCount})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                roleFilter === 'admin'
                  ? 'bg-[var(--color-primary-hover)] text-white shadow-md shadow-[var(--color-primary-hover)]/20'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-alt)]'
              }`}
            >
              <Shield size={13} />
              Admins ({metrics.adminsCount})
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" size={16} />
            <input
              type="text"
              placeholder="Buscar nome, telefone, CPF ou Pix..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg)]/80 border border-[var(--color-border)] rounded-xl text-xs text-white placeholder-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        </div>

        {/* Sub-Filtros de Auditoria (Chave Pix e Compliance) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--color-border)]/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)] font-medium">Chave Pix:</span>
            <div className="inline-flex rounded-lg bg-[var(--color-bg)] p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setMpFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  mpFilter === 'all' ? 'bg-[var(--color-surface-alt)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setMpFilter('connected')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors flex items-center gap-1 ${
                  mpFilter === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'text-[var(--color-text-muted)] hover:text-emerald-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Pix Ativo
              </button>
              <button
                onClick={() => setMpFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors flex items-center gap-1 ${
                  mpFilter === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'text-[var(--color-text-muted)] hover:text-amber-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Sem Pix
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)] font-medium">Compliance:</span>
            <div className="inline-flex rounded-lg bg-[var(--color-bg)] p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setComplianceFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                  complianceFilter === 'all' ? 'bg-[var(--color-surface-alt)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setComplianceFilter('approved')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-blue-400 ${
                  complianceFilter === 'approved' ? 'bg-blue-500/20 text-blue-300' : 'text-[var(--color-text-muted)] hover:text-blue-300'
                }`}
              >
                Liberados ({metrics.approvedComplianceCount})
              </button>
              <button
                onClick={() => setComplianceFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-amber-400 ${
                  complianceFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-[var(--color-text-muted)] hover:text-amber-300'
                }`}
              >
                Em Análise ({metrics.pendingComplianceCount})
              </button>
              <button
                onClick={() => setComplianceFilter('blocked')}
                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors text-red-400 ${
                  complianceFilter === 'blocked' ? 'bg-red-500/20 text-red-300' : 'text-[var(--color-text-muted)] hover:text-red-300'
                }`}
              >
                Suspensos ({metrics.blockedCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista / Tabela de Usuários com Auditoria */}
      <div className="bg-[var(--color-surface)]/90 border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-[var(--color-text-muted)] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-[var(--color-primary)]" size={30} />
            <p className="text-sm font-medium">Carregando usuários e auditorias...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-[var(--color-text-muted)]">
            <Users className="mx-auto mb-3 text-[var(--color-text-subtle)]" size={36} />
            <p className="text-base font-semibold text-[var(--color-text-muted)]">Nenhum usuário encontrado</p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Tente alterar os termos de busca ou os filtros aplicados acima.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuário & Segurança</th>
                  <th className="py-3.5 px-4">WhatsApp & Contato</th>
                  <th className="py-3.5 px-4">Chave Pix & Repasse</th>
                  <th className="py-3.5 px-4">Status & Liberação</th>
                  <th className="py-3.5 px-4">Performance & Ganhos</th>
                  <th className="py-3.5 px-4 text-right">Controle Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/60">
                {filteredUsers.map((user) => {
                  const isProvider = user.role === 'provider'
                  const isClient = user.role === 'client'
                  const isAdmin = user.role === 'admin'
                  const isOnline = Boolean(user.provider_status?.is_online)
                  const isBlocked = user.is_blocked
                  const adminWaUrl = getWhatsAppAdministrativeUrl(user)

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-[var(--color-surface-alt)]/40 transition-colors ${
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
                              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30'
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
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
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border-strong)]">
                                      Offline
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            {user.cpf_or_cnpj ? (
                              <div className="text-[11px] text-[var(--color-text-muted)]">
                                CPF/CNPJ: <span className="font-mono text-[var(--color-text-muted)]">{user.cpf_or_cnpj}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[var(--color-text-subtle)] italic">
                                CPF não informado
                              </div>
                            )}

                            <div className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-1">
                              <Calendar size={10} />
                              Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: WhatsApp & Contato Direto */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="text-xs text-[var(--color-text)] font-mono flex items-center gap-1.5">
                            <Phone size={12} className="text-[var(--color-text-muted)]" />
                            {user.phone}
                          </div>

                          <a
                            href={adminWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-[var(--color-bg)] border border-emerald-500/30 transition-all shadow-sm group"
                            title="Conversar com este usuário via WhatsApp"
                          >
                            <MessageCircle size={13} className="text-emerald-400 group-hover:text-[var(--color-bg)]" />
                            Conversar (wa.me)
                          </a>
                        </div>
                      </td>

                      {/* Coluna 3: Chave Pix & Repasse */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-1.5">
                            {user.provider_status?.pix_key ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 size={11} />
                                  Pix Ativo
                                </span>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="font-mono text-xs font-bold text-[var(--color-text)] bg-[var(--color-bg)] px-2 py-1 rounded-lg border border-[var(--color-border)]">
                                    {user.provider_status.pix_key}
                                  </span>
                                  <button
                                    onClick={() => handleCopyPix(user.provider_status?.pix_key || '', user.id)}
                                    className="p-1 rounded-lg bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border-strong)] transition-colors cursor-pointer"
                                    title="Copiar Chave Pix"
                                  >
                                    {copiedPixId === user.id ? (
                                      <Check size={12} className="text-emerald-400" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <AlertTriangle size={11} />
                                  Sem Pix
                                </span>
                                <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">Chave não informada</p>
                              </div>
                            )}

                            {user.recipient_gateway_id && (
                              <div className="text-[10px] font-mono text-[var(--color-text-subtle)]">
                                Subconta MP: {user.recipient_gateway_id}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--color-text-subtle)] italic">
                            Não se aplica (Cliente)
                          </div>
                        )}
                      </td>

                      {/* Coluna 4: Auditoria de Compliance & Liberação */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-1.5">
                            {/* Selfie de verificação (pode não existir ainda) */}
                            <div className="flex items-center gap-2">
                              {user.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={user.avatar_url}
                                  alt={`Selfie de ${user.full_name}`}
                                  className="w-9 h-9 rounded-lg object-cover border border-[var(--color-border)] shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-subtle)]">
                                  <UserX size={15} />
                                </div>
                              )}
                              <div className="relative inline-block text-left">
                                <select
                                  value={user.background_check_status}
                                  onChange={(e) => {
                                    const newStatus = e.target.value as 'approved' | 'pending' | 'rejected'
                                    if (newStatus === 'rejected') {
                                      setRejectReasonInput('')
                                      setRejectTargetUser(user)
                                      return
                                    }
                                    handleChangeCompliance(user.id, newStatus)
                                  }}
                                  className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border appearance-none pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-colors ${
                                    user.background_check_status === 'rejected'
                                      ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
                                      : user.background_check_status === 'pending'
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                                  }`}
                                >
                                  <option value="pending" className="bg-[var(--color-surface)] text-amber-400">
                                    🟡 Em Análise
                                  </option>
                                  <option value="approved" className="bg-[var(--color-surface)] text-blue-400">
                                    🟢 Aprovado (Liberado)
                                  </option>
                                  <option value="rejected" className="bg-[var(--color-surface)] text-red-400">
                                    🔴 Reprovado (Bloqueado)
                                  </option>
                                </select>
                                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]" />
                              </div>
                            </div>

                            {user.background_check_status === 'rejected' ? (
                              <div className="text-[10px] text-red-400 flex items-center gap-1 font-semibold" title={user.rejection_reason ?? undefined}>
                                <ShieldAlert size={11} /> Bloqueado no radar
                              </div>
                            ) : user.background_check_status === 'pending' ? (
                              <div className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
                                <ShieldAlert size={11} /> Aguardando aprovação
                              </div>
                            ) : (
                              <div className="text-[10px] text-blue-400 flex items-center gap-1 font-semibold">
                                <ShieldCheck size={11} /> Liberado (Sem pendências)
                              </div>
                            )}

                            {/* Termo e Declaração */}
                            <div className="text-[10px] text-[var(--color-text-subtle)] flex items-center gap-2 pt-0.5">
                              {user.terms_accepted_at ? (
                                <span className="text-emerald-400/80 flex items-center gap-0.5">
                                  <CheckCircle2 size={9} /> Termo OK
                                </span>
                              ) : (
                                <span className="text-[var(--color-text-subtle)] flex items-center gap-0.5">
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
                          <div className="text-xs text-[var(--color-text-muted)]">
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
                              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                                {user.completed_calls_as_provider} atendimentos
                              </span>
                            </div>

                            <div className="text-[11px] text-[var(--color-text-muted)]">
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
                            <div className="text-xs font-semibold text-[var(--color-text)]">
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
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-[var(--color-bg)] border border-emerald-500/40'
                                : 'bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30'
                            }`}
                            title={isBlocked ? 'Reativar conta' : 'Suspender conta preventivamente'}
                          >
                            <Ban size={12} />
                            {isBlocked ? 'Reativar Conta' : 'Suspender'}
                          </button>

                          {/* Reset de PIN de Acesso */}
                          <button
                            onClick={() => { setPinTargetUser(user); setNewPinValue('') }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:bg-[var(--color-border-strong)] hover:text-white border border-[var(--color-border)]"
                            title="Resetar PIN de acesso"
                          >
                            <KeyRound size={12} />
                            Resetar PIN
                          </button>

                          {/* Edição de Papel */}
                          {editingUserId === user.id ? (
                            <div className="inline-flex flex-col items-end gap-1.5 bg-[var(--color-bg)] p-2.5 rounded-xl border border-[var(--color-border-strong)] shadow-xl">
                              <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as 'client' | 'provider' | 'admin')}
                                className="bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-lg text-xs text-white px-2 py-1 focus:outline-none focus:border-[var(--color-primary)]"
                              >
                                <option value="client">Cliente</option>
                                <option value="provider">Prestador</option>
                                <option value="admin">Administrador</option>
                              </select>
                              <div className="flex items-center gap-1.5 mt-1">
                                <button
                                  onClick={() => handleSaveRole(user.id)}
                                  disabled={savingRole}
                                  className="px-2.5 py-1 rounded bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                                >
                                  {savingRole ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  disabled={savingRole}
                                  className="px-2 py-1 rounded bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] text-[11px] transition-colors"
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
                              className="text-[11px] text-[var(--color-text-muted)] hover:text-white underline underline-offset-2 transition-colors"
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
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
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
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Usuário: <strong className="text-white">{blockTargetUser.full_name}</strong> ({blockTargetUser.phone})
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-bg)]/80 rounded-2xl p-4 border border-[var(--color-border)]/80 text-xs text-[var(--color-text-muted)] space-y-2">
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] transition-colors"
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

      {/* Modal de Reprovação da Verificação de Identidade (com motivo) */}
      {rejectTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl shrink-0 bg-red-500/10 text-red-400 border border-red-500/30">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reprovar Verificação de Identidade?</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Prestador: <strong className="text-white">{rejectTargetUser.full_name}</strong> ({rejectTargetUser.phone})
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-bg)]/80 rounded-2xl p-4 border border-[var(--color-border)]/80 text-xs text-[var(--color-text-muted)] space-y-3">
              <p>
                ⚠️ O prestador será impedido de ficar online e aceitar chamados até que o cadastro seja reaprovado.
              </p>
              <div>
                <label htmlFor="reject-reason" className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                  Motivo (opcional, visível para o prestador)
                </label>
                <textarea
                  id="reject-reason"
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex: selfie ilegível, tente novamente com boa iluminação."
                  className="w-full rounded-xl px-3 py-2 text-xs bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setRejectTargetUser(null); setRejectReasonInput('') }}
                disabled={Boolean(rejectingUserId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={Boolean(rejectingUserId)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg disabled:opacity-50 bg-red-600 hover:bg-red-500 shadow-red-600/20"
              >
                {rejectingUserId ? 'Processando...' : 'Sim, Reprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reset de PIN de Acesso */}
      {pinTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl shrink-0 bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-border)]">
                <KeyRound size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Resetar PIN de Acesso</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Usuário: <strong className="text-white">{pinTargetUser.full_name}</strong> ({pinTargetUser.phone})
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-bg)]/80 rounded-2xl p-4 border border-[var(--color-border)]/80 text-xs text-[var(--color-text-muted)]">
              O usuário não tem como recuperar o PIN sozinho (login é feito com celular + PIN, sem e-mail real). Defina um PIN novo e avise a pessoa pelo WhatsApp — ela poderá trocá-lo depois de entrar.
            </div>

            <div>
              <label htmlFor="new-pin-input" className="block text-xs font-semibold mb-1.5 text-[var(--color-text-muted)]">
                Novo PIN (4 a 8 dígitos)
              </label>
              <input
                id="new-pin-input"
                type="text"
                inputMode="numeric"
                value={newPinValue}
                onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Ex: 4827"
                maxLength={8}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-white tracking-widest font-mono focus:outline-none focus:border-[var(--color-primary)]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setPinTargetUser(null); setNewPinValue('') }}
                disabled={resettingPin}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-surface-alt)] hover:bg-[var(--color-border-strong)] text-[var(--color-text-muted)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResetPin}
                disabled={resettingPin}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg disabled:opacity-50 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
              >
                {resettingPin ? 'Salvando...' : 'Confirmar Novo PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
