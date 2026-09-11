'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SERVICES, getServiceScope } from '@/lib/catalog'
import { QuickService } from '@/lib/types'
import { 
  updateServiceAction, 
  toggleServiceStatusAction,
  createServiceAction,
  deleteServiceAction
} from '@/app/actions/service-admin'
import { 
  Search, 
  X, 
  Edit3, 
  Sliders, 
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  Sparkles
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
  const [editName, setEditName] = useState<string>('')
  const [editCategory, setEditCategory] = useState<string>('')
  const [editPrice, setEditPrice] = useState<string>('')
  const [editPlatformFee, setEditPlatformFee] = useState<string>('12')
  const [editDuration, setEditDuration] = useState<string>('40 min')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [editIncluded, setEditIncluded] = useState<string[]>([])
  const [editNotIncluded, setEditNotIncluded] = useState<string[]>([])
  const [newIncludedInput, setNewIncludedInput] = useState<string>('')
  const [newNotIncludedInput, setNewNotIncludedInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)

  // Estado do Modal de Cadastro
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [createName, setCreateName] = useState<string>('')
  const [createCategory, setCreateCategory] = useState<string>('Elétrica')
  const [createCustomCategory, setCreateCustomCategory] = useState<string>('')
  const [createPrice, setCreatePrice] = useState<string>('')
  const [createPlatformFee, setCreatePlatformFee] = useState<string>('12')
  const [createDuration, setCreateDuration] = useState<string>('40 min')
  const [createDescription, setCreateDescription] = useState<string>('')
  const [createIncluded, setCreateIncluded] = useState<string[]>([])
  const [createNotIncluded, setCreateNotIncluded] = useState<string[]>([])
  const [createIncludedInput, setCreateIncludedInput] = useState<string>('')
  const [createNotIncludedInput, setCreateNotIncludedInput] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  // Estado do Modal de Exclusão
  const [deletingService, setDeletingService] = useState<QuickService | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Carrega serviços do banco com fallback e injeção de escopo padrão
  useEffect(() => {
    async function loadServices() {
      try {
        const { data, error } = await supabase
          .from('quick_services')
          .select('*')
          .order('sort_order', { ascending: true })

        if (!error && data && data.length > 0) {
          // Garante que todo serviço tenha arrays de escopo (do banco ou do catálogo)
          const populated = (data as QuickService[]).map(s => {
            const defaultScope = getServiceScope(s.name, s.category)
            return {
              ...s,
              included: (s.included && s.included.length > 0) ? s.included : defaultScope.included,
              not_included: (s.not_included && s.not_included.length > 0) ? s.not_included : defaultScope.not_included,
              duration_est: s.duration_est || '40 min',
            }
          })
          setServices(populated)
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

  // Categorias disponíveis e contadores
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: services.length }
    services.forEach(s => {
      counts[s.category] = (counts[s.category] || 0) + 1
    })
    return counts
  }, [services])

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    services.forEach(s => {
      if (s.category) set.add(s.category)
    })
    return Array.from(set).sort()
  }, [services])

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
  const inactiveCount = totalCount - activeCount
  const avgPrice = totalCount > 0 
    ? services.reduce((acc, s) => acc + Number(s.fixed_price), 0) / totalCount 
    : 0
  const avgProviderCut = totalCount > 0
    ? services.reduce((acc, s) => acc + Math.max(0, Number(s.fixed_price) - Number(s.platform_fee || 12)), 0) / totalCount
    : 0

  // Abertura do modal de edição com preenchimento de escopo
  const handleOpenEdit = (service: QuickService) => {
    const defaultScope = getServiceScope(service.name, service.category)
    setEditingService(service)
    setEditName(service.name)
    setEditCategory(service.category)
    setEditPrice(String(service.fixed_price))
    setEditPlatformFee(String(service.platform_fee || 12))
    setEditDuration(service.duration_est || '40 min')
    setEditDescription(service.description || '')
    setEditIsActive(service.is_active)
    setEditIncluded((service.included && service.included.length > 0) ? service.included : defaultScope.included)
    setEditNotIncluded((service.not_included && service.not_included.length > 0) ? service.not_included : defaultScope.not_included)
    setNewIncludedInput('')
    setNewNotIncludedInput('')
  }

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
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, is_active: service.is_active } : s))
      )
      toast.error(result.error || 'Falha ao alterar status do serviço.')
    } else {
      toast.success(
        `Serviço "${service.name}" ${newStatus ? 'ativado no catálogo' : 'pausado (oculto para clientes)'}.`
      )
    }
  }

  // Adição e remoção de tags de escopo no Modal de Edição
  const handleAddEditIncluded = () => {
    const val = newIncludedInput.trim()
    if (!val) return
    if (editIncluded.includes(val)) {
      toast.info('Item já adicionado.')
      return
    }
    setEditIncluded(prev => [...prev, val])
    setNewIncludedInput('')
  }

  const handleRemoveEditIncluded = (index: number) => {
    setEditIncluded(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddEditNotIncluded = () => {
    const val = newNotIncludedInput.trim()
    if (!val) return
    if (editNotIncluded.includes(val)) {
      toast.info('Item já adicionado.')
      return
    }
    setEditNotIncluded(prev => [...prev, val])
    setNewNotIncludedInput('')
  }

  const handleRemoveEditNotIncluded = (index: number) => {
    setEditNotIncluded(prev => prev.filter((_, i) => i !== index))
  }

  // Adição e remoção de tags de escopo no Modal de Cadastro
  const handleAddCreateIncluded = () => {
    const val = createIncludedInput.trim()
    if (!val) return
    if (createIncluded.includes(val)) {
      toast.info('Item já adicionado.')
      return
    }
    setCreateIncluded(prev => [...prev, val])
    setCreateIncludedInput('')
  }

  const handleRemoveCreateIncluded = (index: number) => {
    setCreateIncluded(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddCreateNotIncluded = () => {
    const val = createNotIncludedInput.trim()
    if (!val) return
    if (createNotIncluded.includes(val)) {
      toast.info('Item já adicionado.')
      return
    }
    setCreateNotIncluded(prev => [...prev, val])
    setCreateNotIncludedInput('')
  }

  const handleRemoveCreateNotIncluded = (index: number) => {
    setCreateNotIncluded(prev => prev.filter((_, i) => i !== index))
  }

  // Submissão da edição de serviço
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService) return

    const priceNum = parseFloat(editPrice.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < 20) {
      toast.error('O preço mínimo para qualquer serviço é de R$ 20,00.')
      return
    }

    const feeNum = parseFloat(editPlatformFee.replace(',', '.')) || 12.0
    if (feeNum >= priceNum) {
      toast.error('A taxa da plataforma não pode ser maior ou igual ao preço total do serviço.')
      return
    }

    if (!editName.trim()) {
      toast.error('O nome do serviço é obrigatório.')
      return
    }

    setIsSaving(true)

    const result = await updateServiceAction({
      id: editingService.id,
      name: editName.trim(),
      category: editCategory.trim(),
      fixed_price: priceNum,
      platform_fee: feeNum,
      description: editDescription.trim(),
      is_active: editIsActive,
      included: editIncluded,
      not_included: editNotIncluded,
      duration_est: editDuration.trim() || '40 min',
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
              name: editName.trim(),
              category: editCategory.trim(),
              fixed_price: priceNum,
              platform_fee: feeNum,
              description: editDescription.trim(),
              is_active: editIsActive,
              included: editIncluded,
              not_included: editNotIncluded,
              duration_est: editDuration.trim() || '40 min',
            }
          : s
      )
    )

    toast.success(`Serviço "${editName.trim()}" atualizado com sucesso!`)
    handleCloseEdit()
  }

  // Submissão do cadastro de novo serviço
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()

    const priceNum = parseFloat(createPrice.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < 20) {
      toast.error('O preço mínimo para qualquer serviço é de R$ 20,00.')
      return
    }

    const feeNum = parseFloat(createPlatformFee.replace(',', '.')) || 12.0
    if (feeNum >= priceNum) {
      toast.error('A taxa da plataforma não pode ser maior ou igual ao preço total do serviço.')
      return
    }

    const finalCategory = createCategory === 'Outra' ? createCustomCategory.trim() : createCategory
    if (!finalCategory) {
      toast.error('Informe a categoria do serviço.')
      return
    }

    if (!createName.trim()) {
      toast.error('Informe o nome do serviço.')
      return
    }

    setIsCreating(true)

    const result = await createServiceAction({
      name: createName.trim(),
      category: finalCategory,
      description: createDescription.trim(),
      fixed_price: priceNum,
      platform_fee: feeNum,
      is_active: true,
      included: createIncluded,
      not_included: createNotIncluded,
      duration_est: createDuration.trim() || '40 min',
    })

    setIsCreating(false)

    if (!result.success || !result.data) {
      toast.error(result.error || 'Não foi possível cadastrar o serviço.')
      return
    }

    const newService: QuickService = {
      ...(result.data as QuickService),
      included: createIncluded,
      not_included: createNotIncluded,
      duration_est: createDuration.trim() || '40 min',
    }

    setServices(prev => [...prev, newService])
    toast.success(`Serviço "${createName.trim()}" cadastrado com sucesso!`)
    setIsCreateOpen(false)
    setCreateName('')
    setCreatePrice('')
    setCreatePlatformFee('12')
    setCreateDescription('')
    setCreateCustomCategory('')
    setCreateIncluded([])
    setCreateNotIncluded([])
  }

  // Confirmação de exclusão do serviço
  const handleConfirmDelete = async () => {
    if (!deletingService) return

    setIsDeleting(true)
    const result = await deleteServiceAction({ id: deletingService.id })
    setIsDeleting(false)

    if (!result.success) {
      toast.error(result.error || 'Não foi possível excluir o serviço.')
      return
    }

    if (result.deactivatedOnly) {
      toast.info(result.message)
      setServices(prev =>
        prev.map(s => (s.id === deletingService.id ? { ...s, is_active: false } : s))
      )
    } else {
      toast.success(result.message || 'Serviço excluído do catálogo com sucesso!')
      setServices(prev => prev.filter(s => s.id !== deletingService.id))
    }

    setDeletingService(null)
  }

  // Cálculos dinâmicos em tempo real para o modal de edição
  const parsedEditPrice = parseFloat(editPrice.replace(',', '.')) || 0
  const parsedEditFee = parseFloat(editPlatformFee.replace(',', '.')) || 0
  const editProviderCut = Math.max(0, parsedEditPrice - parsedEditFee)
  const isEditCutBelowFloor = editProviderCut > 0 && editProviderCut < 50

  // Cálculos dinâmicos em tempo real para o modal de criação
  const parsedCreatePrice = parseFloat(createPrice.replace(',', '.')) || 0
  const parsedCreateFee = parseFloat(createPlatformFee.replace(',', '.')) || 0
  const createProviderCut = Math.max(0, parsedCreatePrice - parsedCreateFee)
  const isCreateCutBelowFloor = createProviderCut > 0 && createProviderCut < 50

  return (
    <div className="space-y-8">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
              <Sparkles size={12} />
              Gestão de Catálogo & Precificação
            </span>
            <span className="text-xs text-slate-500 font-medium">Rio Verde - GO</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5 mt-1.5">
            <Sliders className="text-orange-500" size={26} />
            Catálogo, Escopo & Margens
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Altere preços, pause ou ative itens instantaneamente e defina o que está incluso em cada reparo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreateOpen(true)
            setCreateIncluded([
              'Mão de obra técnica especializada com ferramentas completas',
              'Testes de funcionamento e vedação no local',
              'Limpeza básica do local e descarte dos materiais substituídos'
            ])
            setCreateNotIncluded([
              'O produto, aparelho ou peça nova a ser instalada (fornecidos pelo cliente)',
              'Materiais pesados de alvenaria, quebra de paredes ou reformas estruturais'
            ])
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          Cadastrar Novo Serviço
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Itens</span>
            <div className="p-2 bg-slate-800 rounded-xl text-slate-300">
              <Sliders size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalCount}</div>
          <div className="text-xs text-slate-500">Serviços catalogados</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Disponíveis</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">{activeCount}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            {inactiveCount > 0 ? (
              <span className="text-amber-400 font-semibold">{inactiveCount} pausado{inactiveCount > 1 ? 's' : ''}</span>
            ) : (
              <span className="text-emerald-400/90 font-medium">100% ativos na Home</span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Preço Médio</span>
            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400">{formatCurrency(avgPrice)}</div>
          <div className="text-xs text-slate-500">Valor ao cliente</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Média Repasse</span>
            <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{formatCurrency(avgProviderCut)}</div>
          <div className="text-xs text-emerald-400 font-semibold">Líquido ao profissional</div>
        </div>
      </div>

      {/* Barra de Filtros por Categoria com Contadores e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Filtro por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todas ({categoryCounts.all || 0})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input
            type="text"
            placeholder="Buscar por serviço ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Tabela de Serviços */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-orange-500" size={32} />
            <p className="text-sm font-medium">Carregando catálogo de serviços...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <AlertCircle className="mx-auto mb-2 text-slate-500" size={32} />
            <p className="text-sm font-medium">Nenhum serviço encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Serviço & Escopo</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4 text-right">Preço Cliente</th>
                  <th className="py-3.5 px-4 text-right">Taxa Repara RV</th>
                  <th className="py-3.5 px-4 text-right">Repasse Líquido</th>
                  <th className="py-3.5 px-4 text-center">Disponibilidade (On/Off)</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredServices.map((service) => {
                  const totalPrice = Number(service.fixed_price)
                  const platformFee = Number(service.platform_fee || 12.0)
                  const providerCut = Math.max(0, totalPrice - platformFee)
                  const catStyle = CATEGORY_COLORS[service.category] || {
                    bg: 'bg-slate-800',
                    text: 'text-slate-300',
                    border: 'border-slate-700',
                  }
                  const isBelowFloor = providerCut < 50
                  const includedCount = service.included?.length || 0
                  const notIncludedCount = service.not_included?.length || 0

                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !service.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Nome, Descrição e Chips de Escopo */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-bold text-white text-xs sm:text-sm">
                          {service.name}
                        </div>
                        {service.description && (
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {service.description}
                          </div>
                        )}
                        {/* Indicadores de Escopo */}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
                            🟢 {includedCount} incluso{includedCount === 1 ? '' : 's'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 font-semibold">
                            🔴 {notIncludedCount} não incluso{notIncludedCount === 1 ? '' : 's'}
                          </span>
                          {service.duration_est && (
                            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              <Clock size={10} /> {service.duration_est}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {service.category}
                        </span>
                      </td>

                      {/* Preço ao Cliente */}
                      <td className="py-3.5 px-4 text-right font-bold text-white text-sm">
                        {formatCurrency(totalPrice)}
                      </td>

                      {/* Taxa Retida */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-orange-400 text-xs bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          {formatCurrency(platformFee)}
                        </span>
                      </td>

                      {/* Repasse Líquido ao Prestador */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-black text-sm ${isBelowFloor ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {formatCurrency(providerCut)}
                        </div>
                        {isBelowFloor && (
                          <div className="text-[10px] text-amber-400/90 font-medium flex items-center justify-end gap-1 mt-0.5">
                            <AlertTriangle size={10} /> Abaixo de R$ 50
                          </div>
                        )}
                      </td>

                      {/* Switch On/Off Instantâneo */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
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
                          <span className={`text-[10px] font-bold ${service.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {service.is_active ? 'Ativo' : 'Pausado'}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(service)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 bg-slate-800 hover:bg-orange-500 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                            title="Editar preço e escopo"
                          >
                            <Edit3 size={13} />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingService(service)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white transition-colors border border-red-500/30 cursor-pointer"
                            title="Excluir ou desativar"
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* ============================================================ */}
      {/* MODAL DE EDIÇÃO DE SERVIÇO (CALCULADORA + EDITOR DE TAGS) */}
      {/* ============================================================ */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 animate-scale-up">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Editar Serviço & Precificação
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {editingService.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveService} className="space-y-4">
              {/* Nome e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Categoria *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Elétrica">Elétrica</option>
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Montagem">Montagem</option>
                    <option value="Chaveiro">Chaveiro</option>
                    <option value="Instalação">Instalação</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>
              </div>

              {/* CALCULADORA DE REPASSE EM TEMPO REAL */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} /> Calculadora de Repasse em Tempo Real
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preço Fixo ao Cliente */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Preço ao Cliente (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="20"
                      max="2000"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Taxa da Plataforma */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Taxa Repara RV (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="5"
                      max="200"
                      value={editPlatformFee}
                      onChange={(e) => setEditPlatformFee(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-orange-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Duração Estimada */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Duração Estimada
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 40 min, 1h"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Resultado Dinâmico do Repasse */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Repasse Líquido ao Prestador = <strong className="text-white">R$ {parsedEditPrice.toFixed(2)}</strong> - <strong className="text-orange-400">R$ {parsedEditFee.toFixed(2)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-400">
                      = {formatCurrency(editProviderCut)}
                    </span>
                  </div>
                </div>

                {/* Alerta de Piso R$ 50 */}
                {isEditCutBelowFloor && (
                  <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Atenção:</strong> Repasse líquido inferior a R$ 50,00 pode causar desinteresse dos técnicos e rejeição de chamados em Rio Verde.
                    </div>
                  </div>
                )}
              </div>

              {/* EDITOR DE TAGS DE ESCOPO: O QUE ESTÁ INCLUSO */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  🟢 O que ESTÁ Incluso (Mão de Obra e Testes)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Mão de obra técnica, teste de vedação..."
                    value={newIncludedInput}
                    onChange={(e) => setNewIncludedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEditIncluded()
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditIncluded}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Chips Inclusos */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {editIncluded.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic">Nenhum item incluso adicionado.</span>
                  ) : (
                    editIncluded.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditIncluded(idx)}
                          className="hover:text-white p-0.5 rounded cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* EDITOR DE TAGS DE ESCOPO: O QUE NÃO ESTÁ INCLUSO */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-red-400 uppercase tracking-wider">
                  🔴 O que NÃO Está Incluso (Peças e Produtos Novos)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: O aparelho novo, torneira, chuveiro, quebra de paredes..."
                    value={newNotIncludedInput}
                    onChange={(e) => setNewNotIncludedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEditNotIncluded()
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditNotIncluded}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Chips Não Inclusos */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {editNotIncluded.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic">Nenhum item não-incluso adicionado.</span>
                  ) : (
                    editNotIncluded.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/30"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditNotIncluded(idx)}
                          className="hover:text-white p-0.5 rounded cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Descrição Geral do Serviço (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Explique o que cobre este serviço para cliente e prestador..."
                />
              </div>

              {/* Status Ativo / Inativo */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">Disponibilidade no Catálogo</div>
                  <div className="text-[11px] text-slate-400">
                    {editIsActive ? 'Visível para clientes em Rio Verde' : 'Pausado (Oculto na Home)'}
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || parsedEditFee >= parsedEditPrice}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
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

      {/* ============================================================ */}
      {/* MODAL DE CADASTRO DE NOVO SERVIÇO */}
      {/* ============================================================ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 animate-scale-up">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Novo Item de Mão de Obra
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Cadastrar Novo Serviço
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Instalação de Torneira Gourmet"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                    Categoria *
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="Elétrica">Elétrica</option>
                    <option value="Hidráulica">Hidráulica</option>
                    <option value="Montagem">Montagem</option>
                    <option value="Chaveiro">Chaveiro</option>
                    <option value="Instalação">Instalação</option>
                    <option value="Geral">Geral</option>
                    <option value="Outra">Outra...</option>
                  </select>

                  {createCategory === 'Outra' && (
                    <input
                      type="text"
                      placeholder="Digite a nova categoria..."
                      value={createCustomCategory}
                      onChange={(e) => setCreateCustomCategory(e.target.value)}
                      required
                      className="w-full mt-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  )}
                </div>
              </div>

              {/* CALCULADORA DE REPASSE */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} /> Calculadora de Repasse em Tempo Real
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Preço ao Cliente (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="20"
                      max="2000"
                      placeholder="80,00"
                      value={createPrice}
                      onChange={(e) => setCreatePrice(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Taxa Repara RV (R$)
                    </label>
                    <input
                      type="number"
                      step="1.00"
                      min="5"
                      max="200"
                      value={createPlatformFee}
                      onChange={(e) => setCreatePlatformFee(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-orange-400 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Duração Estimada
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 40 min"
                      value={createDuration}
                      onChange={(e) => setCreateDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Repasse Líquido = <strong className="text-white">R$ {parsedCreatePrice.toFixed(2)}</strong> - <strong className="text-orange-400">R$ {parsedCreateFee.toFixed(2)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-400">
                      = {formatCurrency(createProviderCut)}
                    </span>
                  </div>
                </div>

                {isCreateCutBelowFloor && (
                  <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Atenção:</strong> Repasse líquido inferior a R$ 50,00 pode causar desinteresse dos prestadores em Rio Verde.
                    </div>
                  </div>
                )}
              </div>

              {/* TAGS INCLUSAS */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  🟢 O que ESTÁ Incluso
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar item incluso..."
                    value={createIncludedInput}
                    onChange={(e) => setCreateIncludedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCreateIncluded()
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCreateIncluded}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {createIncluded.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveCreateIncluded(idx)}
                        className="hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* TAGS NÃO INCLUSAS */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-red-400 uppercase tracking-wider">
                  🔴 O que NÃO Está Incluso
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar item NÃO incluso..."
                    value={createNotIncludedInput}
                    onChange={(e) => setCreateNotIncludedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCreateNotIncluded()
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCreateNotIncluded}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                  {createNotIncluded.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/30"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => handleRemoveCreateNotIncluded(idx)}
                        className="hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Instalação e teste de funcionamento em ponto existente..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || parsedCreateFee >= parsedCreatePrice}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar Serviço'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir do Catálogo?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Esta ação afetará a exibição para clientes em Rio Verde.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja remover o serviço <strong className="text-white">&ldquo;{deletingService.name}&rdquo;</strong>?
              Se houver atendimentos já realizados com este serviço, o sistema irá pausá-lo para preservar os relatórios.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingService(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar Exclusão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
