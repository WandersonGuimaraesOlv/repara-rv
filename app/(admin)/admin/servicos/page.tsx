'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SERVICES } from '@/lib/catalog'
import { QuickService } from '@/lib/types'
import { updateServiceAction, toggleServiceStatusAction } from '@/app/actions/service-admin'
import { 
  Search, 
  X, 
  Edit3, 
  Sliders, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Elétrica': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Hidráulica': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Montagem': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Chaveiro': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Instalação': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
}

export default function AdminServicesPage() {
  const supabase = createClient()
  const [services, setServices] = useState<QuickService[]>(DEFAULT_SERVICES)
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Estado do Modal de Edição
  const [editingService, setEditingService] = useState<QuickService | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Carrega serviços do banco com fallback
  useEffect(() => {
    async function loadServices() {
      try {
        const { data, error } = await supabase
          .from('quick_services')
          .select('*')
          .order('sort_order', { ascending: true })

        if (!error && data && data.length > 0) {
          setServices(data as QuickService[])
        } else {
          setServices(DEFAULT_SERVICES)
        }
      } catch {
        setServices(DEFAULT_SERVICES)
      } finally {
        setLoading(false)
      }
    }

    loadServices()
  }, [supabase])

  // Filtragem
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesCategory =
        selectedCategory === 'all' || service.category === selectedCategory
      const matchesSearch =
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [services, selectedCategory, searchQuery])

  // Métricas rápidas
  const totalCount = services.length
  const activeCount = services.filter(s => s.is_active).length
  const avgPrice = totalCount > 0 
    ? services.reduce((acc, s) => acc + Number(s.fixed_price), 0) / totalCount 
    : 0

  // Abertura do modal de edição
  const handleOpenEdit = (service: QuickService) => {
    setEditingService(service)
    setEditPrice(String(service.fixed_price))
    setEditDescription(service.description || '')
    setEditIsActive(service.is_active)
  }

  // Fechamento do modal
  const handleCloseEdit = () => {
    setEditingService(null)
    setIsSaving(false)
  }

  // Toggle rápido de Ativo / Inativo
  const handleToggleStatus = async (service: QuickService) => {
    const newStatus = !service.is_active

    // Atualização otimista imediata na UI
    setServices(prev =>
      prev.map(s => (s.id === service.id ? { ...s, is_active: newStatus } : s))
    )

    const result = await toggleServiceStatusAction({
      id: service.id,
      is_active: newStatus,
    })

    if (!result.success) {
      // Reverte em caso de falha
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, is_active: service.is_active } : s))
      )
      toast.error(result.error || 'Falha ao alterar status.')
    } else {
      toast.success(
        `Serviço "${service.name}" ${newStatus ? 'ativado' : 'pausado'} com sucesso.`
      )
    }
  }

  // Submissão da edição de preço
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService) return

    const priceNum = parseFloat(editPrice.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < 20) {
      toast.error('O preço mínimo para qualquer serviço é de R$ 20,00.')
      return
    }

    setIsSaving(true)

    const result = await updateServiceAction({
      id: editingService.id,
      fixed_price: priceNum,
      description: editDescription.trim(),
      is_active: editIsActive,
    })

    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error || 'Não foi possível atualizar o serviço.')
      return
    }

    // Atualiza estado local
    setServices(prev =>
      prev.map(s =>
        s.id === editingService.id
          ? {
              ...s,
              fixed_price: priceNum,
              description: editDescription.trim(),
              is_active: editIsActive,
            }
          : s
      )
    )

    toast.success(`Serviço "${editingService.name}" atualizado com sucesso!`)
    handleCloseEdit()
  }

  // Preço digitado no modal para cálculo dinâmico de repasse
  const parsedModalPrice = parseFloat(editPrice.replace(',', '.')) || 0
  const modalPlatformFee = 12.0
  const modalProviderCut = Math.max(0, parsedModalPrice - modalPlatformFee)

  return (
    <div className="space-y-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <Sliders className="text-orange-500" size={26} />
            Gestão de Catálogo de Serviços
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure preços fixos, ative/desative serviços e confira a divisão de split de cada mão de obra.
          </p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Serviços</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-white">{totalCount}</span>
            <span className="text-xs text-slate-500">tabelados</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Serviços Ativos</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-400">{activeCount}</span>
            <span className="text-xs text-emerald-500/80">disponíveis</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Retenção Plataforma</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-orange-400">R$ 12,00</span>
            <span className="text-xs text-orange-400/80">por chamado</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preço Médio Tabelado</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-cyan-400">{formatCurrency(avgPrice)}</span>
            <span className="text-xs text-slate-500">mão de obra</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Filtro por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'Elétrica', 'Hidráulica', 'Montagem', 'Chaveiro', 'Instalação'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'Todas as Categorias' : cat}
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome do serviço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Tabela de Serviços (Desktop) e Lista de Cards (Mobile) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <p className="text-sm">Carregando catálogo de serviços...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <AlertCircle className="mx-auto mb-2 text-slate-500" size={32} />
            <p className="text-sm font-medium">Nenhum serviço encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Serviço</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4 text-right">Preço ao Cliente</th>
                  <th className="py-3.5 px-4 text-right">Taxa Repara RV</th>
                  <th className="py-3.5 px-4 text-right">Repasse Prestador</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredServices.map((service) => {
                  const totalPrice = Number(service.fixed_price)
                  const platformFee = 12.0 // Regra inegociável
                  const providerCut = Math.max(0, totalPrice - platformFee)
                  const catStyle = CATEGORY_COLORS[service.category] || {
                    bg: 'bg-slate-800',
                    text: 'text-slate-300',
                    border: 'border-slate-700',
                  }

                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !service.is_active ? 'opacity-55' : ''
                      }`}
                    >
                      {/* Nome e Descrição */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{service.name}</div>
                        {service.description && (
                          <div className="text-xs text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                            {service.description}
                          </div>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {service.category}
                        </span>
                      </td>

                      {/* Preço ao Cliente */}
                      <td className="py-3 px-4 text-right font-bold text-white">
                        {formatCurrency(totalPrice)}
                      </td>

                      {/* Taxa Retida da Plataforma */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          {formatCurrency(platformFee)}
                        </span>
                      </td>

                      {/* Repasse Líquido ao Prestador */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {formatCurrency(providerCut)}
                      </td>

                      {/* Switch Ativo/Inativo */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(service)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            service.is_active ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              service.is_active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Botão de Edição */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(service)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-orange-500 hover:text-white transition-colors border border-slate-700"
                        >
                          <Edit3 size={13} />
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Preço e Dados do Serviço */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  {editingService.category}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Editar: {editingService.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveService} className="space-y-4">
              {/* Input de Preço Fixo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Preço Fixo ao Cliente (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    min="20"
                    max="2000"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Breakdown de Split Dinâmico em Tempo Real */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Cobrado do Cliente:</span>
                  <span className="font-semibold text-white">{formatCurrency(parsedModalPrice)}</span>
                </div>
                <div className="flex justify-between text-xs text-orange-400">
                  <span>Taxa Retida Repara RV (Fixa):</span>
                  <span className="font-semibold">- {formatCurrency(modalPlatformFee)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-emerald-400">
                  <span>Repasse Líquido ao Prestador:</span>
                  <span>{formatCurrency(modalProviderCut)}</span>
                </div>
              </div>

              {/* Descrição do Serviço */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Descrição dos Serviços Inclusos
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Explique o que cobre este serviço para cliente e prestador..."
                />
              </div>

              {/* Status Ativo/Inativo */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">Disponibilidade no Aplicativo</div>
                  <div className="text-xs text-slate-400">
                    {editIsActive ? 'Visível para todos os clientes' : 'Oculto temporariamente'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    editIsActive ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
