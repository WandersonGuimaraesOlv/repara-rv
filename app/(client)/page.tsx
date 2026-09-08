'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Wrench,
  Search,
  MapPin,
  ChevronDown,
  Zap,
  Droplets,
  Hammer,
  Armchair,
  Paintbrush,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Clock,
  Star,
  Home,
  ClipboardList,
  MessageSquare,
  User,
  X,
  Sparkles,
  Bike
} from 'lucide-react'
import { DEFAULT_SERVICES } from '@/lib/catalog'
import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const RIO_VERDE_NEIGHBORHOODS = [
  'Setor Central',
  'Bairro Popular',
  'Bairro Promissão',
  'Morada do Sol',
  'Santo Agostinho',
  'Setor Universitário',
  'Parque das Laranjeiras',
  'Gameleira',
  'Vila Maria',
  'Eldorado',
  'Residencial Buriti',
  'Solar Campestre',
  'Interlagos',
]

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: Sparkles, color: '#0F172A' },
  { id: 'Elétrica', name: 'Elétrica', icon: Zap, color: '#F59E0B' },
  { id: 'Hidráulica', name: 'Hidráulica', icon: Droplets, color: '#06B6D4' },
  { id: 'Pequenos Reparos', name: 'Reparos & Alvenaria', icon: Hammer, color: '#F97316' },
  { id: 'Montagem', name: 'Montagem de Móveis', icon: Armchair, color: '#8B5CF6' },
  { id: 'Pintura', name: 'Pintura', icon: Paintbrush, color: '#EC4899' },
  { id: 'Emergência', name: 'Emergência 24h', icon: AlertTriangle, color: '#EF4444' },
]

export default function TriiderClientHomePage() {
  const router = useRouter()
  const [services, setServices] = useState<QuickService[]>(DEFAULT_SERVICES)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Setor Central')
  const [isAddressModalOpen, setIsAddressModalOpen] = useState<boolean>(false)
  const [customAddress, setCustomAddress] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'support' | 'profile'>('home')

  // Carrega do Supabase em background se disponível
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('quick_services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(
        ({ data }) => {
          if (data && data.length > 0) {
            setServices(data as QuickService[])
          }
        },
        () => {}
      )
  }, [])

  // Filtragem combinada (busca instantânea + categoria)
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesCategory =
        selectedCategory === 'all' ||
        service.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        (selectedCategory === 'Pequenos Reparos' && service.category.includes('Montagem'))

      const cleanQuery = searchQuery.trim().toLowerCase()
      const matchesQuery =
        !cleanQuery ||
        service.name.toLowerCase().includes(cleanQuery) ||
        (service.description && service.description.toLowerCase().includes(cleanQuery)) ||
        service.category.toLowerCase().includes(cleanQuery)

      return matchesCategory && matchesQuery
    })
  }, [services, selectedCategory, searchQuery])

  // Sugestões rápidas de busca baseadas no catálogo
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const clean = searchQuery.trim().toLowerCase()
    return services
      .filter(s => s.name.toLowerCase().includes(clean) || s.category.toLowerCase().includes(clean))
      .slice(0, 4)
  }, [services, searchQuery])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 selection:bg-orange-100 selection:text-orange-900">
      {/* Container Centralizado para Mobile e Desktop */}
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl shadow-slate-200/50 flex flex-col relative">

        {/* ────────────────────────────────────────────────────────
            1. HEADER / BARRA DE LOCALIZAÇÃO (ESTILO TRIIDER)
            ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Logotipo Repara RV */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Wrench size={18} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight leading-none text-slate-900">
                  Repara<span className="text-orange-600">RV</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase leading-tight">
                  Serviços Residenciais
                </span>
              </div>
            </Link>

            {/* Alternar Modo Prestador */}
            <Link
              href="/painel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200/80 transition-colors"
            >
              <Bike size={14} className="text-orange-600" />
              <span>Sou Profissional</span>
            </Link>
          </div>

          {/* Seletor Rápido de Endereço / Bairro */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="flex items-center gap-1.5 text-left text-slate-600 hover:text-slate-900 group"
            >
              <MapPin size={14} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="truncate">
                <span className="text-slate-400 font-medium">Você está em: </span>
                <strong className="text-slate-900 font-bold underline underline-offset-2 decoration-orange-300">
                  {selectedNeighborhood}, Rio Verde - GO
                </strong>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
          </div>
        </header>

        {/* ────────────────────────────────────────────────────────
            2. HERO SECTION COM BUSCA INSTANTÂNEA
            ──────────────────────────────────────────────────────── */}
        <section className="px-4 pt-5 pb-4 bg-gradient-to-b from-white to-slate-50/50">
          <div className="space-y-1 mb-4">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
              O que você precisa <span className="text-orange-600 underline decoration-orange-300 decoration-wavy decoration-2">consertar</span> hoje?
            </h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Profissionais autônomos locais em Rio Verde com preço fixo, agilidade e garantia de serviço.
            </p>
          </div>

          {/* Barra de Busca Proeminente com Autocomplete */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Busque: chuveiro, torneira, fechadura..."
                className="w-full pl-10 pr-10 py-3.5 bg-white border-2 border-slate-200 focus:border-orange-500 rounded-2xl text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Dropdown de Autocomplete em Tempo Real */}
            {isSearchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sugestões imediatas
                </div>
                {searchSuggestions.map(service => (
                  <Link
                    key={service.id}
                    href={`/chamar/${service.id}`}
                    onClick={() => setIsSearchFocused(false)}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-orange-50/60 transition-colors text-xs text-slate-800"
                  >
                    <span className="font-semibold text-slate-900">{service.name}</span>
                    <span className="text-orange-600 font-bold">{formatCurrency(service.fixed_price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tags de Pesquisas Frequentes */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">Populares:</span>
            {['Chuveiro', 'Torneira', 'Tomada', 'Ventilador', 'Fechadura'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearchQuery(tag)}
                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-medium hover:border-orange-400 hover:text-orange-600 transition-colors shrink-0"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            3. CARROSSEL / GRID DE CATEGORIAS RÁPIDAS
            ──────────────────────────────────────────────────────── */}
        <section className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Categorias
            </h2>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-semibold text-orange-600 hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
            {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
              const Icon = cat.icon
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                  className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-orange-50 border-orange-500 shadow-md shadow-orange-500/10'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                    style={{
                      background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(241, 245, 249, 0.9)',
                      color: isSelected ? '#EA580C' : cat.color,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-orange-700' : 'text-slate-800'}`}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            4. GRID DE "SERVIÇOS MAIS PEDIDOS" COM PREÇO FIXO
            ──────────────────────────────────────────────────────── */}
        <section className="px-4 py-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Serviços Mais Pedidos
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Preço tabelado sem surpresas e atendimento ágil
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
              {filteredServices.length} {filteredServices.length === 1 ? 'opção' : 'opções'}
            </span>
          </div>

          {filteredServices.length === 0 ? (
            <div className="bg-slate-50 rounded-3xl border border-dashed border-slate-300 p-8 text-center my-4">
              <Search size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-800">Nenhum serviço encontrado</p>
              <p className="text-xs text-slate-500 mt-1">
                Tente buscar por termos como &quot;chuveiro&quot;, &quot;torneira&quot; ou limpe os filtros.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
                className="mt-3 px-4 py-1.5 rounded-full bg-orange-600 text-white text-xs font-bold hover:bg-orange-700"
              >
                Ver todos os serviços
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredServices.map(service => (
                <div
                  key={service.id}
                  className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-orange-300 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                          {service.category}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Clock size={12} />
                          Até 40 min
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {service.name}
                      </h3>
                      {service.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Preço e Botão Chamar Agora */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Preço Mão de Obra
                      </span>
                      <span className="text-lg font-black text-slate-900 tracking-tight">
                        {formatCurrency(service.fixed_price)}
                      </span>
                    </div>

                    <Link
                      href={`/chamar/${service.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all"
                    >
                      <span>Chamar Agora</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────────────────────
            5. BANNER DE CONFIANÇA / GARANTIA (ELEMENTO CHAVE DA TRIIDER)
            ──────────────────────────────────────────────────────── */}
        <section className="px-4 py-5 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 border-t border-slate-100 mt-4">
          <div className="rounded-3xl border border-orange-200/80 p-5 bg-white/80 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={22} className="text-orange-600" />
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Garantia & Confiança Repara RV
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Seguimos o padrão das maiores plataformas de serviços do Brasil para que você contrate com total tranquilidade:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Garantia do Serviço de 30 Dias</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Se o serviço apresentar qualquer vício técnico, garantimos o retorno sem custo adicional.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Profissionais Verificados de Rio Verde</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Checagem criteriosa de documentos, antecedentes e avaliações constantes pela comunidade.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock size={13} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Pagamento Protegido via Pix</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    O pagamento é realizado somente após você aprovar a finalização do conserto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────
            6. BARRA DE NAVEGAÇÃO INFERIOR FIXA (MOBILE NATIVE FEEL)
            ──────────────────────────────────────────────────────── */}
        <nav className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-lg shadow-slate-900/5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'home' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home size={20} />
            <span className="text-[10px] font-bold">Início</span>
          </button>

          <Link
            href="/acompanhar/demo-call-101"
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'orders' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ClipboardList size={20} />
            <span className="text-[10px] font-bold">Meus Pedidos</span>
          </Link>

          <a
            href="https://wa.me/5564999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Repara%20RV"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setActiveTab('support')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'support' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-bold">Suporte</span>
          </a>

          <Link
            href="/login"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User size={20} />
            <span className="text-[10px] font-bold">Perfil</span>
          </Link>
        </nav>

        {/* ────────────────────────────────────────────────────────
            MODAL DE SELEÇÃO DE BAIRRO (RIO VERDE - GO)
            ──────────────────────────────────────────────────────── */}
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Selecionar Localização</h3>
                  <p className="text-xs text-slate-500">Rio Verde - Goiás</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Digitação Livre */}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Endereço ou Bairro específico:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAddress}
                    onChange={e => setCustomAddress(e.target.value)}
                    placeholder="Ex: Rua 10, Qd 20, Bairro..."
                    className="input py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAddress.trim()) {
                        setSelectedNeighborhood(customAddress.trim())
                        setIsAddressModalOpen(false)
                        setCustomAddress('')
                      }
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 shrink-0"
                  >
                    Confirmar
                  </button>
                </div>
              </div>

              {/* Lista Rápida dos Principais Bairros de Rio Verde */}
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Bairros Atendidos
              </p>
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {RIO_VERDE_NEIGHBORHOODS.map(bairro => (
                  <button
                    key={bairro}
                    type="button"
                    onClick={() => {
                      setSelectedNeighborhood(bairro)
                      setIsAddressModalOpen(false)
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                      selectedNeighborhood === bairro
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{bairro}</span>
                    {selectedNeighborhood === bairro && <CheckCircle2 size={16} className="text-orange-600" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
