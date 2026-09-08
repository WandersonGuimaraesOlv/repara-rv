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
  Home,
  ClipboardList,
  MessageSquare,
  User,
  X,
  Sparkles,
  Bike,
  PhoneCall,
  Check
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

  // Sugestões rápidas no dropdown
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return services
      .filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      .slice(0, 4)
  }, [services, searchQuery])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-orange-100 selection:text-orange-900">

      {/* ────────────────────────────────────────────────────────
          1. HEADER RESPONSIVO (DESKTOP + MOBILE)
          ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            
            {/* Esquerda: Logo + Seletor de Bairro */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                  <Wrench size={20} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight leading-none text-slate-900">
                    Repara<span className="text-orange-600">RV</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-tight mt-0.5">
                    Rio Verde • GO
                  </span>
                </div>
              </Link>

              {/* Seletor de Localização (Desktop & Tablet) */}
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-orange-50/80 border border-slate-200/80 hover:border-orange-200 text-xs text-slate-700 transition-all group"
              >
                <MapPin size={14} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-slate-500 font-medium">Bairro:</span>
                <strong className="font-bold text-slate-900">{selectedNeighborhood}</strong>
                <ChevronDown size={14} className="text-slate-400 ml-0.5" />
              </button>
            </div>

            {/* Centro: Links de Navegação (Desktop) */}
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#categorias" className="hover:text-orange-600 transition-colors">
                Categorias
              </a>
              <a href="#servicos" className="hover:text-orange-600 transition-colors">
                Serviços Populares
              </a>
              <a href="#garantia" className="hover:text-orange-600 transition-colors">
                Garantia 30 Dias
              </a>
            </nav>

            {/* Direita: Ações & Perfil */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/acompanhar/demo-call-101"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <ClipboardList size={15} />
                <span>Meus Pedidos</span>
              </Link>

              <Link
                href="/painel"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100/80 border border-orange-200/60 shadow-sm transition-all"
              >
                <Bike size={15} className="text-orange-600" />
                <span className="hidden sm:inline">Sou</span> Profissional
              </Link>

              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-colors"
              >
                <User size={15} className="text-slate-600" />
                <span className="hidden sm:inline">Entrar</span>
              </Link>
            </div>

          </div>

          {/* Seletor de Bairro para Mobile (linha dedicada) */}
          <div className="md:hidden pb-3 pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="flex items-center gap-1.5 text-left text-slate-600 hover:text-slate-900 group w-full"
            >
              <MapPin size={14} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="truncate flex-1">
                <span className="text-slate-400 font-medium">Você está em: </span>
                <strong className="text-slate-900 font-bold underline underline-offset-2 decoration-orange-300">
                  {selectedNeighborhood}, Rio Verde
                </strong>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
          </div>

        </div>
      </header>

      {/* ────────────────────────────────────────────────────────
          2. HERO SECTION RESPONSIVA (ESTILO TRIIDER MODERNO)
          ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-orange-50/20 to-slate-50 border-b border-slate-200/60 pt-8 pb-12 sm:pt-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            
            {/* Selo Local */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/80 border border-orange-200 text-orange-800 text-xs font-bold tracking-wide uppercase mb-4 shadow-sm">
              <Sparkles size={14} className="text-orange-600" />
              <span>Serviços Residenciais Sob Demanda • Rio Verde (GO)</span>
            </div>

            {/* Título Principal de Alto Impacto */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-4">
              O que você precisa{' '}
              <span className="text-orange-600 underline decoration-orange-300 decoration-wavy decoration-2">
                consertar
              </span>{' '}
              hoje?
            </h1>

            {/* Subtítulo */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto mb-8">
              Encanadores, eletricistas e montadores verificados em Rio Verde com preço fixo transparente, atendimento ágil e garantia de 30 dias.
            </p>

            {/* Barra de Busca Proeminente com Autocomplete */}
            <div className="relative max-w-2xl mx-auto">
              <div className="relative flex items-center shadow-lg shadow-orange-950/5 rounded-2xl bg-white">
                <Search size={20} className="absolute left-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Busque pelo conserto: chuveiro, torneira, tomada, fechadura..."
                  className="w-full pl-12 pr-12 py-4 bg-transparent border-2 border-slate-200 focus:border-orange-500 rounded-2xl text-sm sm:text-base text-slate-900 placeholder-slate-400 transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Dropdown de Autocomplete */}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-30 text-left overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sugestões Imediatas
                  </div>
                  {searchSuggestions.map(service => (
                    <Link
                      key={service.id}
                      href={`/chamar/${service.id}`}
                      onClick={() => setIsSearchFocused(false)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/70 transition-colors text-sm text-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench size={15} className="text-orange-600" />
                        <span className="font-semibold text-slate-900">{service.name}</span>
                        <span className="text-xs text-slate-400">({service.category})</span>
                      </div>
                      <span className="text-orange-600 font-bold text-sm">
                        {formatCurrency(service.fixed_price)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tags de Pesquisas Frequentes */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
              <span className="text-slate-400 font-semibold mr-1">Populares:</span>
              {['Chuveiro', 'Torneira', 'Tomada', 'Ventilador', 'Fechadura', 'Pintura'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchQuery(tag)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-600 hover:text-orange-600 font-medium transition-all shadow-xs"
                >
                  {tag}
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          3. CATEGORIAS DE SERVIÇOS (GRID EXPANSIVO NO DESKTOP)
          ──────────────────────────────────────────────────────── */}
      <section id="categorias" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Categorias de Serviços
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Escolha a área do reparo para filtrar os serviços disponíveis
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-xs sm:text-sm font-bold text-orange-600 hover:text-orange-700 underline"
            >
              Ver todos os serviços
            </button>
          )}
        </div>

        {/* Grid Responsivo de Categorias (3 colunas mobile -> 7 colunas desktop) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 sm:gap-4">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group ${
                  isSelected
                    ? 'bg-orange-50/90 border-orange-500 shadow-md shadow-orange-500/10 ring-2 ring-orange-400/20'
                    : 'bg-white border-slate-200/80 hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs"
                  style={{
                    background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(241, 245, 249, 0.9)',
                    color: isSelected ? '#EA580C' : cat.color,
                  }}
                >
                  <Icon size={22} />
                </div>
                <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-orange-700' : 'text-slate-800'}`}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          4. SERVIÇOS MAIS PEDIDOS (GRID MULTI-COLUNA NO PC)
          ──────────────────────────────────────────────────────── */}
      <section id="servicos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Serviços Mais Pedidos
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Preço tabelado para mão de obra com chegada estimada em até 40 minutos
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-bold">
            {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>

        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center my-6 shadow-sm">
            <Search size={40} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-800">Nenhum serviço encontrado</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Não encontramos resultados para sua busca. Tente palavras simples como &quot;chuveiro&quot;, &quot;torneira&quot; ou confira nosso catálogo completo.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
              className="mt-4 px-5 py-2.5 rounded-full bg-orange-600 text-white text-xs sm:text-sm font-bold hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all"
            >
              Exibir todos os serviços
            </button>
          </div>
        ) : (
          /* Grid Responsivo: 1 coluna no mobile, 2 no tablet, 3 ou 4 no desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredServices.map(service => (
              <div
                key={service.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  {/* Tags de Categoria e Tempo */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                      {service.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <Clock size={12} />
                      Até 40 min
                    </span>
                  </div>

                  {/* Nome e Descrição */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-snug mb-1.5">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                </div>

                {/* Preço e Botão de Ação */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Mão de Obra
                    </span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(service.fixed_price)}
                    </span>
                  </div>

                  <Link
                    href={`/chamar/${service.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-600/20 group-hover:shadow-orange-600/30 transition-all"
                  >
                    <span>Chamar</span>
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────
          5. BANNER DE CONFIANÇA & GARANTIA (ESTILO TRIIDER)
          ──────────────────────────────────────────────────────── */}
      <section id="garantia" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
        <div className="rounded-3xl border border-orange-200/80 p-6 sm:p-10 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/40 shadow-sm">
          
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck size={16} className="text-orange-600" />
              <span>Segurança e Confiabilidade</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Padrão de Garantia Repara RV
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Desenvolvemos a plataforma sob os mesmos padrões de segurança das maiores empresas de serviços do país:
            </p>
          </div>

          {/* 3 Blocos de Confiança (1 coluna no mobile -> 3 no desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white/90 p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Garantia de 30 Dias</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Se o reparo apresentar qualquer falha técnica dentro de 30 dias, garantimos o retorno do profissional sem cobrança extra.
                </p>
              </div>
            </div>

            <div className="bg-white/90 p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Profissionais de Rio Verde</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Autônomos cadastrados com checagem de documentos e histórico. Avaliação pública e contínua pela comunidade rio-verdense.
                </p>
              </div>
            </div>

            <div className="bg-white/90 p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Pagamento Protegido via Pix</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  O valor do serviço só é repassado ao profissional após você atestar que o reparo foi devidamente finalizado e testado.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          6. FOOTER COMPLETO PARA DESKTOP
          ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 mt-auto hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Coluna 1: Marca & Descrição */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center">
                  <Wrench size={16} className="text-white" />
                </div>
                <span className="text-lg font-black text-white">
                  Repara<span className="text-orange-500">RV</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A plataforma sob demanda de serviços residenciais de Rio Verde (GO). Conectando clientes a prestadores qualificados com preço fixo e transparência.
              </p>
              <div className="text-xs text-slate-500">
                © {new Date().getFullYear()} Repara RV • Todos os direitos reservados.
              </div>
            </div>

            {/* Coluna 2: Serviços */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
                Categorias
              </h5>
              <ul className="space-y-2 text-xs">
                <li><button type="button" onClick={() => setSelectedCategory('Elétrica')} className="hover:text-white transition-colors">Eletricistas</button></li>
                <li><button type="button" onClick={() => setSelectedCategory('Hidráulica')} className="hover:text-white transition-colors">Encanadores & Desentupimento</button></li>
                <li><button type="button" onClick={() => setSelectedCategory('Montagem')} className="hover:text-white transition-colors">Montagem de Móveis</button></li>
                <li><button type="button" onClick={() => setSelectedCategory('Pintura')} className="hover:text-white transition-colors">Pintura Residencial</button></li>
                <li><button type="button" onClick={() => setSelectedCategory('Emergência')} className="hover:text-white transition-colors">Socorro Emergencial 24h</button></li>
              </ul>
            </div>

            {/* Coluna 3: Bairros Atendidos */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
                Bairros em Rio Verde
              </h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Setor Central, Morada do Sol, Universitário, Bairro Popular, Promissão, Gameleira, Vila Maria, Eldorado e toda a região urbana de Rio Verde (GO).
              </p>
            </div>

            {/* Coluna 4: Suporte e Contato */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
                Atendimento & Ajuda
              </h5>
              <p className="text-xs text-slate-400 mb-3">
                Dúvidas ou suporte para o seu chamado?
              </p>
              <a
                href="https://wa.me/5564999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Repara%20RV"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
              >
                <MessageSquare size={14} />
                <span>WhatsApp de Suporte</span>
              </a>
            </div>

          </div>
        </div>
      </footer>

      {/* ────────────────────────────────────────────────────────
          7. BARRA DE NAVEGAÇÃO INFERIOR (SOMENTE MOBILE: md:hidden)
          ──────────────────────────────────────────────────────── */}
      <nav className="md:hidden sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-lg shadow-slate-900/5">
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

            {/* Lista dos Principais Bairros de Rio Verde */}
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
  )
}
