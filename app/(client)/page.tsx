'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Wrench,
  Search,
  MapPin,
  ChevronDown,
  Zap,
  Droplets,
  Droplet,
  Hammer,
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
  LogOut,
  ShowerHead,
  Plug,
  Fan,
  Lightbulb,
  Pipette,
  Tv,
  Shirt,
  Settings2,
  Key,
  WashingMachine,
  Flame,
  AlertCircle,
  Shield,
  FileText,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_SERVICES } from '@/lib/catalog'
import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { PwaInstallBanner } from '@/components/pwa-install-banner'
import { ThemeToggle } from '@/components/theme-toggle'
import { performLogout } from '@/lib/auth-logout'

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
  { id: 'Montagem', name: 'Montagem', icon: Hammer, color: '#8B5CF6' },
  { id: 'Chaveiro', name: 'Chaveiro', icon: Key, color: '#EAB308' },
  { id: 'Instalação', name: 'Instalação', icon: WashingMachine, color: '#10B981' },
]

const SERVICE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShowerHead,
  Plug,
  Fan,
  Lightbulb,
  Droplet,
  Pipette,
  Wrench,
  ShieldCheck,
  Tv,
  Hammer,
  Shirt,
  Settings2,
  Key,
  Lock,
  WashingMachine,
  Flame,
  // Fallbacks
  zap: Zap,
  droplets: Droplet,
  wrench: Wrench,
  hammer: Hammer,
  key: Key,
  lock: Lock,
}

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
  const [currentUser, setCurrentUser] = useState<{
    id: string
    full_name?: string
    phone?: string
    role?: string
  } | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState<boolean>(false)
  const [userOrders, setUserOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false)

  // Fecha o dropdown desktop ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
          setIsProfileMenuOpen(false)
        }
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isProfileMenuOpen])

  // Carrega usuário autenticado e escuta mudanças de auth
  useEffect(() => {
    const supabase = createClient()

    // 1. Tenta recuperar cache rápido do localStorage para exibição imediata
    try {
      const cached = localStorage.getItem('repara_user')
      if (cached) {
        setCurrentUser(JSON.parse(cached))
      }
    } catch {}

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name, phone')
          .eq('id', user.id)
          .maybeSingle()

        if (profile) {
          setCurrentUser(profile)
          try {
            localStorage.setItem('repara_user', JSON.stringify(profile))
          } catch {}
        } else {
          const fallbackUser = {
            id: user.id,
            full_name: user.user_metadata?.full_name || 'Usuário',
            phone: user.phone || '',
            role: 'client',
          }
          setCurrentUser(fallbackUser)
        }
      } else {
        setCurrentUser(null)
        try {
          localStorage.removeItem('repara_user')
        } catch {}
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUser(null)
        try {
          localStorage.removeItem('repara_user')
        } catch {}
      } else {
        checkAuth()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Ação para abrir o histórico completo de chamados do usuário
  const handleMyOrders = async () => {
    setIsProfileMenuOpen(false)
    if (!currentUser) {
      router.push('/login')
      return
    }

    setIsOrdersModalOpen(true)
    setLoadingOrders(true)

    try {
      const supabase = createClient()
      const { data: calls, error } = await supabase
        .from('service_calls')
        .select(`
          id, 
          status, 
          created_at, 
          total_price, 
          provider_cut, 
          neighborhood, 
          payment_status, 
          client_id, 
          provider_id,
          service:quick_services(name)
        `)
        .or(`client_id.eq.${currentUser.id},provider_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar pedidos:', error)
        toast.error('Não foi possível carregar seu histórico de chamados.')
      } else {
        setUserOrders(calls || [])
      }
    } catch (err) {
      console.error('Erro inesperado:', err)
      toast.error('Erro ao consultar chamados. Tente novamente.')
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleLogout = async () => {
    setIsProfileMenuOpen(false)
    setCurrentUser(null)
    toast.success('Desconectando da conta...')
    await performLogout('/login')
  }

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
        service.category.toLowerCase() === selectedCategory.toLowerCase()

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-orange-100 selection:text-orange-900 w-full max-w-full overflow-x-hidden transition-colors duration-200">

      {/* ────────────────────────────────────────────────────────
          1. HEADER RESPONSIVO (DESKTOP + MOBILE)
          ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-all w-full max-w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-20 gap-2 sm:gap-4">
            
            {/* Esquerda: Logo + Seletor de Bairro (Desktop) */}
            <div className="flex items-center gap-2 sm:gap-6 min-w-0 shrink-0">
              <Link href="/" className="flex items-center group transition-transform hover:opacity-95 shrink-0">
                <Logo variant="full" width={168} height={42} className="hidden sm:block" />
                <Logo variant="compact" className="sm:hidden shrink-0" />
              </Link>

              {/* Seletor de Localização (Desktop & Tablet) */}
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-orange-50/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 hover:border-orange-200 text-xs text-slate-700 dark:text-slate-300 transition-all group cursor-pointer"
              >
                <MapPin size={14} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bairro:</span>
                <strong className="font-bold text-slate-900 dark:text-white">{selectedNeighborhood}</strong>
                <ChevronDown size={14} className="text-slate-400 ml-0.5" />
              </button>
            </div>

            {/* Centro: Links de Navegação (Desktop) */}
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
              <a href="#categorias" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Categorias
              </a>
              <a href="#servicos" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Serviços Populares
              </a>
              <a href="#garantia" className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Garantia 30 Dias
              </a>
            </nav>

            {/* Direita: Ações & Perfil (Ultra responsivo para evitar qualquer overflow no mobile) */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={handleMyOrders}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ClipboardList size={15} />
                <span>Meus Pedidos</span>
              </button>

              {/* Alternador de tema */}
              <ThemeToggle />

              {/* Botão de Prestador / Painel */}
              {currentUser?.role === 'provider' ? (
                <Link
                  href="/painel"
                  aria-label="Painel do Prestador"
                  title="Painel do Prestador"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 shadow-sm transition-all shrink-0"
                >
                  <Bike size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden xs:inline">Painel</span>
                </Link>
              ) : (
                <Link
                  href={currentUser ? "/onboarding?role=provider" : "/cadastro?role=provider"}
                  aria-label="Sou Profissional"
                  title="Sou Profissional / Prestador"
                  className="hidden sm:flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100/80 dark:hover:bg-orange-900/50 border border-orange-200/60 dark:border-orange-800/60 shadow-sm transition-all shrink-0"
                >
                  <Bike size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
                  <span>Sou Profissional</span>
                </Link>
              )}

              {/* Perfil ou Login */}
              {currentUser ? (
                <div ref={profileMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    id="btn-user-profile-menu"
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center text-xs sm:text-[10px] font-black uppercase shadow-xs shrink-0">
                      {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
                    </div>
                    <span className="hidden sm:inline max-w-[120px] truncate">
                      {currentUser.full_name?.split(' ')[0] || 'Minha Conta'}
                    </span>
                    <ChevronDown size={13} className={`text-slate-400 hidden sm:block shrink-0 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu do Usuário (Desktop) */}
                  {isProfileMenuOpen && (
                    <div className="hidden md:block absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 text-left">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {currentUser.full_name || 'Usuário Repara RV'}
                        </p>
                        {currentUser.phone && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {currentUser.phone}
                          </p>
                        )}
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                          {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'provider' ? 'Prestador Autônomo' : 'Cliente / Morador'}
                        </span>
                      </div>

                      <div className="py-1">
                        {currentUser.role === 'admin' && (
                          <Link
                            href="/admin/dashboard"
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700/60 transition-colors"
                          >
                            <Shield size={15} />
                            <span>Torre de Controle Admin</span>
                          </Link>
                        )}

                        <Link
                          href="/painel"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700/60 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                        >
                          <Bike size={15} className="text-orange-600 dark:text-orange-400" />
                          <span>Acessar Painel do Prestador</span>
                        </Link>

                        <button
                          type="button"
                          onClick={handleMyOrders}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700/60 hover:text-orange-700 dark:hover:text-orange-300 transition-colors cursor-pointer text-left"
                        >
                          <ClipboardList size={15} className="text-slate-500 dark:text-slate-400" />
                          <span>Meus Chamados & Histórico</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                        <button
                          type="button"
                          id="btn-logout"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer text-left"
                        >
                          <LogOut size={15} />
                          <span>Sair da Conta</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Link
                    href="/login"
                    id="btn-nav-login"
                    className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                  >
                    <User size={14} className="text-slate-600 dark:text-slate-400" />
                    <span>Entrar</span>
                  </Link>
                  <Link
                    href="/cadastro"
                    id="btn-nav-cadastro"
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm shadow-orange-600/20 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
                  >
                    <Sparkles size={13} className="text-orange-200" />
                    <span>Cadastre-se</span>
                  </Link>
                </div>
              )}
            </div>

          </div>

          {/* Seletor de Bairro para Mobile (linha dedicada com min-w-0 e truncate) */}
          <div className="md:hidden pb-2.5 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs w-full min-w-0">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="flex items-center gap-1.5 text-left text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white group w-full min-w-0 py-0.5"
            >
              <MapPin size={14} className="text-orange-600 shrink-0 group-hover:scale-110 transition-transform" />
              <div className="truncate flex-1 min-w-0 text-xs">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Você está em: </span>
                <strong className="text-slate-900 dark:text-white font-bold underline underline-offset-2 decoration-orange-300">
                  {selectedNeighborhood}, Rio Verde
                </strong>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
            </button>
          </div>

        </div>
      </header>

      {/* ────────────────────────────────────────────────────────
          2. HERO SECTION RESPONSIVA (ESTILO TRIIDER MODERNO)
          ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-orange-50/20 to-slate-50 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-950 border-b border-slate-200/60 dark:border-slate-800 pt-6 pb-10 sm:pt-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            
            {/* Selo Local */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:py-1.5 rounded-full bg-orange-100/80 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-[11px] sm:text-xs font-bold tracking-wide uppercase mb-3 sm:mb-4 shadow-sm max-w-full">
              <Sparkles size={13} className="text-orange-600 dark:text-orange-400 shrink-0" />
              <span className="truncate sm:overflow-visible">Serviços Residenciais • Rio Verde (GO)</span>
            </div>

            {/* Título Principal de Alto Impacto */}
            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight sm:leading-[1.15] mb-3 sm:mb-4">
              O que você precisa{' '}
              <span className="text-orange-600 underline decoration-orange-300 decoration-wavy decoration-2">
                consertar
              </span>{' '}
              hoje?
            </h1>

            {/* Subtítulo */}
            <p className="text-xs sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto mb-6 sm:mb-8 px-1">
              Encanadores, eletricistas e montadores verificados em Rio Verde com preço fixo transparente, atendimento ágil e garantia de 30 dias.
            </p>

            {/* Barra de Busca Proeminente com Autocomplete */}
            <div className="relative max-w-2xl mx-auto w-full">
              <div className="relative flex items-center shadow-lg shadow-orange-950/5 dark:shadow-black/40 rounded-2xl bg-white dark:bg-slate-800">
                <Search size={18} className="absolute left-3.5 sm:left-4 text-slate-400 pointer-events-none shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Busque pelo conserto: chuveiro, torneira, tomada..."
                  className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 bg-transparent border-2 border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 rounded-2xl text-xs sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 sm:right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Dropdown de Autocomplete */}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-30 text-left overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Sugestões Imediatas
                  </div>
                  {searchSuggestions.map(service => (
                    <Link
                      key={service.id}
                      href={`/chamar/${service.id}`}
                      onClick={() => setIsSearchFocused(false)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/70 dark:hover:bg-slate-700/70 transition-colors text-sm text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench size={15} className="text-orange-600 dark:text-orange-400 shrink-0" />
                        <span className="font-semibold text-slate-900 dark:text-white">{service.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">({service.category})</span>
                      </div>
                      <span className="text-orange-600 dark:text-orange-400 font-bold text-sm shrink-0">
                        {formatCurrency(service.fixed_price)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tags de Pesquisas Frequentes */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3.5 sm:mt-4 text-xs max-w-full">
              <span className="text-slate-400 dark:text-slate-500 font-semibold mr-0.5 text-[11px] sm:text-xs">Populares:</span>
              {['Chuveiro', 'Torneira', 'Tomada', 'Ventilador', 'Fechadura', 'Máquina de Lavar', 'Varal', 'Silicone'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchQuery(tag)}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-orange-300 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 text-[11px] sm:text-xs font-medium transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* 4 Blocos de Garantia / Vantagens no Hero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-200/60 dark:border-slate-800 text-left">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center sm:items-start gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cadastro Verificado</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    Identidade e autodeclaração de aptidão técnica.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center sm:items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Chegada Rápida</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    Técnico no seu endereço em 30 a 45 min em Rio Verde.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center sm:items-start gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Pagamento Protegido</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    Pague via Pix com total segurança na plataforma.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center sm:items-start gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Garantia de 30 Dias</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    Se o reparo apresentar defeito, reexecutamos sem custo.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          3. CATEGORIAS DE SERVIÇOS (GRID ULTRA FLUIDO)
          ──────────────────────────────────────────────────────── */}
      <section id="categorias" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 w-full">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Categorias de Serviços
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Escolha a área do reparo para filtrar os serviços disponíveis
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-xs sm:text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 underline cursor-pointer shrink-0 ml-2"
            >
              Ver todos
            </button>
          )}
        </div>

        {/* Grid Responsivo de Categorias: 3 colunas no mobile -> 6 no desktop */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-4">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border text-center flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 group cursor-pointer ${
                  isSelected
                    ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-500 shadow-md shadow-orange-500/10 ring-2 ring-orange-400/20'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs shrink-0"
                  style={{
                    background: isSelected ? 'rgba(249, 115, 22, 0.2)' : 'rgba(241, 245, 249, 0.9)',
                    color: isSelected ? '#EA580C' : cat.color,
                  }}
                >
                  <Icon size={20} />
                </div>
                <span className={`text-[11px] sm:text-xs font-bold leading-tight ${isSelected ? 'text-orange-700 dark:text-orange-400' : 'text-slate-800 dark:text-slate-200'}`}>
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
      <section id="servicos" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 w-full flex-1">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Serviços Mais Pedidos
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Preço tabelado para mão de obra com chegada em até 40 min
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs font-bold shrink-0 ml-2">
            {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>

        {filteredServices.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center my-6 shadow-sm">
            <Search size={36} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Nenhum serviço encontrado</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Não encontramos resultados para sua busca. Tente palavras simples como &quot;chuveiro&quot;, &quot;torneira&quot; ou confira nosso catálogo completo.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
              className="mt-4 px-5 py-2.5 rounded-full bg-orange-600 text-white text-xs sm:text-sm font-bold hover:bg-orange-700 shadow-md shadow-orange-600/20 transition-all cursor-pointer active:scale-95"
            >
              Exibir todos os serviços
            </button>
          </div>
        ) : (
          /* Grid Responsivo: 1 coluna no mobile, 2 no tablet, 3 ou 4 no desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filteredServices.map(service => {
              const ServiceIcon = (service.icon && SERVICE_ICONS[service.icon]) || Wrench
              return (
                <div
                  key={service.id}
                  className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-500/50 transition-all flex flex-col justify-between group hover:-translate-y-1"
                >
                  <div>
                    {/* Header do Card: Ícone do Serviço, Categoria e Badge Até 40 min */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform shadow-xs shrink-0">
                          <ServiceIcon size={17} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                          {service.category}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs shrink-0">
                        <Clock size={12} className="text-emerald-600 dark:text-emerald-400" />
                        Até 40 min
                      </span>
                    </div>

                    {/* Nome e Descrição */}
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-snug mb-1">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                        {service.description}
                      </p>
                    )}

                    {/* Aviso Obrigatório: Peças e Materiais Não Inclusos */}
                    <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/70 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 mt-2">
                      <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Peças e materiais não inclusos</span>
                    </div>
                  </div>

                  {/* Preço e Botão de Ação */}
                  <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Mão de Obra
                      </span>
                      <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(service.fixed_price)}
                      </span>
                    </div>

                    <Link
                      href={`/chamar/${service.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-600/20 group-hover:shadow-orange-600/30 transition-all shrink-0"
                    >
                      <span>Chamar</span>
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────
          5. BANNER DE CONFIANÇA & GARANTIA (ESTILO TRIIDER)
          ──────────────────────────────────────────────────────── */}
      <section id="garantia" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-16 w-full">
        <div className="rounded-2xl sm:rounded-3xl border border-orange-200/80 dark:border-slate-700 p-4 sm:p-10 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/40 dark:from-slate-900 dark:via-slate-800/70 dark:to-slate-900 shadow-sm">
          
          <div className="max-w-3xl mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck size={16} className="text-orange-600 dark:text-orange-400 shrink-0" />
              <span>Segurança e Confiabilidade</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Padrão de Garantia Repara RV
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              Desenvolvemos a plataforma sob os mesmos padrões de segurança das maiores empresas de serviços do país:
            </p>
          </div>

          {/* 3 Blocos de Confiança (1 coluna no mobile -> 3 no desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6">
            
            <div className="bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">Garantia de 30 Dias</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Se o reparo apresentar qualquer falha técnica dentro de 30 dias, garantimos o retorno do profissional sem cobrança extra.
                </p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">Profissionais de Rio Verde</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Autônomos cadastrados com checagem de documentos e histórico. Avaliação pública e contínua pela comunidade rio-verdense.
                </p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">Pagamento Protegido via Pix</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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
              <Link href="/" className="inline-block transition-opacity hover:opacity-90">
                <Logo variant="full" width={180} height={45} inverted />
              </Link>
              <p className="text-xs text-slate-400 leading-relaxed">
                A plataforma sob demanda de serviços residenciais de Rio Verde (GO). Conectando moradores a prestadores qualificados com preço fixo e transparência.
              </p>
              <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-800 space-y-1">
                <p className="font-semibold text-slate-400">Repara RV Tecnologia e Intermediação Ltda</p>
                <p>CNAE 7490-1/04 • Sede em Rio Verde - GO • CEP 75901-000</p>
                <div className="flex items-center gap-3 pt-1 text-slate-400 flex-wrap">
                  <Link href="/termos" className="hover:text-white underline transition-colors">
                    Termos de Uso
                  </Link>
                  <span>•</span>
                  <Link href="/privacidade" className="hover:text-white underline transition-colors">
                    Privacidade (LGPD)
                  </Link>
                  <span>•</span>
                  <Link href="/contrato" className="hover:text-white underline transition-colors">
                    Contrato Técnico
                  </Link>
                </div>
                <p className="pt-0.5">© {new Date().getFullYear()} Repara RV • Todos os direitos reservados.</p>
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
      <nav className="md:hidden sticky bottom-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-around shadow-lg shadow-slate-900/5 w-full max-w-full" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'home' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Home size={20} />
          <span className="text-[10px] font-bold">Início</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('orders')
            handleMyOrders()
          }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'orders' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <ClipboardList size={20} />
          <span className="text-[10px] font-bold">Meus Pedidos</span>
        </button>

        <a
          href="https://wa.me/5564999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Repara%20RV"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setActiveTab('support')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'support' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold">Suporte</span>
        </a>

        {currentUser ? (
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(true)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isProfileMenuOpen ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center text-[9px] font-black uppercase">
              {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
            </div>
            <span className="text-[10px] font-bold truncate max-w-[50px]">
              {currentUser.full_name?.split(' ')[0] || 'Perfil'}
            </span>
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <User size={20} />
            <span className="text-[10px] font-bold">Entrar</span>
          </Link>
        )}
      </nav>

      {/* ────────────────────────────────────────────────────────
          MODAL DE PERFIL NO MOBILE
          ──────────────────────────────────────────────────────── */}
      {isProfileMenuOpen && currentUser && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-0 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsProfileMenuOpen(false)
            }
          }}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-2xl border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center text-sm font-black uppercase">
                  {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentUser.full_name || 'Minha Conta'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.phone || 'Repara RV'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 mb-2">
                {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'provider' ? 'Prestador Autônomo' : 'Cliente / Morador'}
              </span>

              {currentUser.role === 'admin' && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-sm hover:bg-orange-600 transition-colors"
                >
                  <Shield size={18} />
                  <span>Torre de Controle (Admin)</span>
                </Link>
              )}

              <Link
                href="/painel"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Bike size={18} className="text-orange-600 dark:text-orange-400" />
                <span>Acessar Painel do Prestador</span>
              </Link>

              <button
                type="button"
                onClick={handleMyOrders}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-orange-50 dark:hover:bg-slate-700 cursor-pointer text-left transition-colors"
              >
                <ClipboardList size={18} className="text-slate-600 dark:text-slate-400" />
                <span>Meus Chamados & Histórico</span>
              </button>
              <div className="flex items-center justify-center gap-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 mt-2 flex-wrap">
                <Link
                  href="/termos"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="hover:text-slate-800 dark:hover:text-white underline transition-colors"
                >
                  Termos de Uso
                </Link>
                <span>•</span>
                <Link
                  href="/privacidade"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="hover:text-slate-800 dark:hover:text-white underline transition-colors"
                >
                  Privacidade (LGPD)
                </Link>
                <span>•</span>
                <Link
                  href="/contrato"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="hover:text-slate-800 dark:hover:text-white underline transition-colors"
                >
                  Contrato Técnico
                </Link>
              </div>
            </div>

            <button
              type="button"
              id="btn-mobile-logout"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                await handleLogout()
              }}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/80 transition-colors cursor-pointer active:scale-95 shadow-sm"
            >
              <LogOut size={16} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL DE SELEÇÃO DE BAIRRO (RIO VERDE - GO)
          ──────────────────────────────────────────────────────── */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Selecionar Localização</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Rio Verde - Goiás</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Digitação Livre */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Endereço ou Bairro específico:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAddress}
                  onChange={e => setCustomAddress(e.target.value)}
                  placeholder="Ex: Rua 10, Qd 20, Bairro..."
                  className="input py-2 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
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
                  className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 shrink-0 cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>

            {/* Lista dos Principais Bairros de Rio Verde */}
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
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
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    selectedNeighborhood === bairro
                      ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{bairro}</span>
                  {selectedNeighborhood === bairro && <CheckCircle2 size={16} className="text-orange-600 dark:text-orange-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL DE MEUS CHAMADOS & HISTÓRICO COMPLETO
          ──────────────────────────────────────────────────────── */}
      {isOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Meus Chamados & Histórico</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe seus pedidos ou veja comprovantes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOrdersModalOpen(false)
                  setActiveTab('home')
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo Dinâmico */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 size={36} className="animate-spin text-orange-600 dark:text-orange-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Buscando seus chamados...</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Conectando ao banco de dados</p>
                </div>
              ) : userOrders.length === 0 ? (
                <div className="py-10 px-4 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-400 flex items-center justify-center mb-3">
                    <ClipboardList size={30} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Nenhum chamado registrado</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-5">
                    Você ainda não possui pedidos ou atendimentos na Repara RV. Escolha um serviço abaixo para chamar um profissional!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrdersModalOpen(false)
                      const el = document.getElementById('servicos')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-all shadow-sm shadow-orange-600/20 cursor-pointer"
                  >
                    Solicitar Serviço Agora
                  </button>
                </div>
              ) : (
                userOrders.map((order) => {
                  const serviceName = Array.isArray(order.service)
                    ? order.service[0]?.name
                    : order.service?.name || 'Serviço Repara RV'
                  const isActive = ['queued', 'searching', 'accepted', 'on_the_way', 'in_progress'].includes(order.status)
                  const isCompleted = order.status === 'completed'
                  const isCancelled = order.status === 'cancelled'

                  const statusConfig = (() => {
                    switch (order.status) {
                      case 'queued':
                        return { label: 'Na Fila de Espera', badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60', dotClass: 'bg-amber-500' }
                      case 'searching':
                        return { label: 'Buscando Técnico', badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60', dotClass: 'bg-amber-500 animate-ping' }
                      case 'accepted':
                      case 'on_the_way':
                        return { label: 'Técnico a Caminho', badgeClass: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60', dotClass: 'bg-blue-500' }
                      case 'in_progress':
                        return { label: 'Em Execução', badgeClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60', dotClass: 'bg-purple-500' }
                      case 'completed':
                        return { label: 'Concluído', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60', dotClass: 'bg-emerald-500' }
                      case 'cancelled':
                        return { label: 'Cancelado', badgeClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60', dotClass: 'bg-rose-500' }
                      default:
                        return { label: order.status, badgeClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', dotClass: 'bg-slate-400' }
                    }
                  })()

                  return (
                    <div
                      key={order.id}
                      className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 bg-white dark:bg-slate-800/90 hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {serviceName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            <Clock size={12} />
                            <span>
                              {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${statusConfig.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <MapPin size={13} className="text-orange-600 dark:text-orange-400 shrink-0" />
                          <span className="truncate max-w-[180px] sm:max-w-[240px] text-[11px] font-medium">
                            {order.neighborhood || 'Rio Verde - GO'}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 dark:text-white text-xs">
                          {formatCurrency(order.total_price || 0)}
                        </span>
                      </div>

                      <div>
                        {isActive ? (
                          <Link
                            href={`/acompanhar/${order.id}`}
                            onClick={() => setIsOrdersModalOpen(false)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-orange-600/20 transition-all hover:scale-[1.01]"
                          >
                            <span>Acompanhar em Tempo Real</span>
                            <ArrowRight size={14} />
                          </Link>
                        ) : isCompleted ? (
                          <Link
                            href={`/acompanhar/${order.id}`}
                            onClick={() => setIsOrdersModalOpen(false)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-600 transition-all"
                          >
                            <FileText size={14} className="text-slate-600 dark:text-slate-400" />
                            <span>Ver Detalhes / Comprovante</span>
                          </Link>
                        ) : isCancelled ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOrdersModalOpen(false)
                              const el = document.getElementById('servicos')
                              if (el) el.scrollIntoView({ behavior: 'smooth' })
                            }}
                            className="w-full text-center py-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                          >
                            Solicitar este serviço novamente
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banner Inteligente de Instalação PWA */}
      <PwaInstallBanner />

    </div>
  )
}
