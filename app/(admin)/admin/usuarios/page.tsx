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
  AlertCircle
} from 'lucide-react'
import { getAdminUsersListAction, updateUserRoleAction, AdminUserListItem } from '@/app/actions/admin-users'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'provider' | 'admin'>('all')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'client' | 'provider' | 'admin'>('client')
  const [savingRole, setSavingRole] = useState<boolean>(false)

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

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const total = users.length
    const clients = users.filter((u) => u.role === 'client')
    const providers = users.filter((u) => u.role === 'provider')
    const admins = users.filter((u) => u.role === 'admin')
    const onlineProviders = providers.filter((p) => p.provider_status?.is_online)

    return {
      total,
      clientsCount: clients.length,
      providersCount: providers.length,
      onlineProvidersCount: onlineProviders.length,
      adminsCount: admins.length,
    }
  }, [users])

  // Filtragem e Busca
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) {
        return false
      }
      if (!query) return true

      const nameMatch = u.full_name.toLowerCase().includes(query)
      const phoneMatch = u.phone.includes(query)
      const cpfMatch = u.cpf_or_cnpj.toLowerCase().includes(query)
      const pixMatch = u.provider_status?.pix_key.toLowerCase().includes(query)

      return nameMatch || phoneMatch || cpfMatch || pixMatch
    })
  }, [users, roleFilter, searchQuery])

  // Handler de Alteração de Cargo/Role
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

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Users className="text-orange-500" size={26} />
            Gestão de Usuários & Base Cadastrada
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle unificado de clientes, prestadores de serviços credenciados e administradores em Rio Verde.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : 'text-slate-400'} />
          Atualizar Lista
        </button>
      </div>

      {/* Grid de KPIs de Usuários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Geral */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Geral</span>
            <div className="p-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{metrics.total}</div>
          <div className="text-xs text-slate-500">Contas registradas no Supabase</div>
        </div>

        {/* Clientes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Clientes</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-400">{metrics.clientsCount}</div>
          <div className="text-xs text-slate-500">Consumidores de serviços</div>
        </div>

        {/* Prestadores */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Prestadores</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Wrench size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">{metrics.providersCount}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <strong className="text-emerald-300">{metrics.onlineProvidersCount}</strong> online agora
          </div>
        </div>

        {/* Administradores */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Administradores</span>
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20">
              <Shield size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-orange-400">{metrics.adminsCount}</div>
          <div className="text-xs text-slate-500">Acesso total ao painel</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Abas de filtro por papel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todos ({metrics.total})
          </button>
          <button
            onClick={() => setRoleFilter('client')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              roleFilter === 'client'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Clientes ({metrics.clientsCount})
          </button>
          <button
            onClick={() => setRoleFilter('provider')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              roleFilter === 'provider'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Prestadores ({metrics.providersCount})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              roleFilter === 'admin'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Admins ({metrics.adminsCount})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome, fone, CPF ou Pix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Lista / Tabela de Usuários */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-orange-500" size={30} />
            <p className="text-sm font-medium">Carregando usuários cadastrados...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="mx-auto mb-3 text-slate-600" size={36} />
            <p className="text-base font-semibold text-slate-300">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Tente alterar os filtros ou o termo de busca pesquisado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuário</th>
                  <th className="py-3.5 px-4">Contato & WhatsApp</th>
                  <th className="py-3.5 px-4">Perfil / Papel</th>
                  <th className="py-3.5 px-4">Dados Operacionais / Pix</th>
                  <th className="py-3.5 px-4">Histórico & Faturamento</th>
                  <th className="py-3.5 px-4 text-right">Gerenciar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const cleanPhone = user.phone.replace(/\D/g, '')
                  const waUrl = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(user.full_name)}%2C%20falo%20da%20equipe%20de%20gest%C3%A3o%20do%20Repara%20RV.`
                  const isProvider = user.role === 'provider'
                  const isClient = user.role === 'client'
                  const isAdmin = user.role === 'admin'
                  const isOnline = Boolean(user.provider_status?.is_online)

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Usuário: Nome, CPF, Cadastro */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border ${
                            isAdmin
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                              : isProvider
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}>
                            {user.full_name.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm">
                              {user.full_name}
                            </div>
                            {user.cpf_or_cnpj ? (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                CPF/CNPJ: <span className="font-mono text-slate-300">{user.cpf_or_cnpj}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic mt-0.5">
                                CPF não informado
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} />
                              Cadastrado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contato & WhatsApp */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="text-xs text-slate-200 font-mono flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            {user.phone}
                          </div>

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 transition-colors"
                          >
                            <MessageCircle size={12} />
                            Conversar via WhatsApp
                          </a>
                        </div>
                      </td>

                      {/* Papel / Role */}
                      <td className="py-4 px-4">
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                            <Shield size={12} />
                            ADMINISTRADOR
                          </span>
                        )}
                        {isProvider && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              <Wrench size={12} />
                              PRESTADOR
                            </span>
                            <div>
                              {isOnline ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-600/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  Online / Disponível
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  Offline
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {isClient && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                            <UserCheck size={12} />
                            CLIENTE
                          </span>
                        )}
                      </td>

                      {/* Dados Operacionais / Pix / Termos */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-1">
                            {user.provider_status?.pix_key ? (
                              <div className="text-xs">
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <CreditCard size={11} className="text-emerald-400" />
                                  Chave Pix ({user.provider_status.pix_key_type || 'Geral'}):
                                </div>
                                <div className="font-mono text-emerald-300 font-semibold text-xs mt-0.5">
                                  {user.provider_status.pix_key}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-400 flex items-center gap-1">
                                <AlertCircle size={11} />
                                Chave Pix não cadastrada
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5">
                              {user.terms_accepted_at ? (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <CheckCircle2 size={10} /> Termo aceito
                                </span>
                              ) : (
                                <span className="text-slate-500 flex items-center gap-0.5">
                                  <XCircle size={10} /> Sem termo
                                </span>
                              )}
                              {user.self_declaration_signed && (
                                <span className="text-cyan-400 flex items-center gap-0.5">
                                  <CheckCircle2 size={10} /> Declaração assinada
                                </span>
                              )}
                            </div>
                          </div>
                        ) : isClient ? (
                          <div className="text-xs text-slate-400">
                            Cliente residencial em Rio Verde.
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            Gestor do sistema com permissões globais.
                          </div>
                        )}
                      </td>

                      {/* Histórico & Faturamento */}
                      <td className="py-4 px-4">
                        {isProvider ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <Award size={13} />
                              {user.completed_calls_as_provider} {user.completed_calls_as_provider === 1 ? 'concluído' : 'concluídos'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Total repassado: <strong className="text-white">{formatCurrency(user.total_earned_as_provider)}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-200">
                              {user.total_calls_as_client} {user.total_calls_as_client === 1 ? 'chamado feito' : 'chamados feitos'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Histórico na plataforma
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Ações / Alterar Papel */}
                      <td className="py-4 px-4 text-right">
                        {editingUserId === user.id ? (
                          <div className="inline-flex flex-col items-end gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-700">
                            <div className="text-[11px] font-semibold text-slate-300">
                              Alterar para:
                            </div>
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors"
                          >
                            Editar Papel
                          </button>
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
  )
}
