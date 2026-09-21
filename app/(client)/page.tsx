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
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { DEFAULT_SERVICES } from '@/lib/catalog'
import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/logo'
import { PwaInstallBanner } from '@/components/pwa-install-banner'
import { PwaInstallButton } from '@/components/pwa-install-button'
import { SiteFooter } from '@/components/site-footer'
import { ThemeToggle } from '@/components/theme-toggle'
import { performLogout } from '@/lib/auth-logout'

const CATEGORIES = [
  { id: 'all', name: 'Todos', icon: Sparkles },
  { id: 'Elétrica', name: 'Elétrica', icon: Zap },
  { id: 'Hidráulica', name: 'Hidráulica', icon: Droplets },
  { id: 'Montagem', name: 'Montagem', icon: Hammer },
  { id: 'Chaveiro', name: 'Chaveiro', icon: Key },
  { id: 'Instalação', name: 'Instalação', icon: WashingMachine },
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
  zap: Zap,
  droplets: Droplet,
  wrench: Wrench,
  hammer: Hammer,
  key: Key,
  lock: Lock,
}

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Cadastro Verificado', color: 'var(--color-success)' },
  { icon: Zap, title: 'Chegada em 30-45 min', color: 'var(--color-accent)' },
  { icon: Lock, title: 'Pagamento Seguro', color: 'var(--color-info)' },
  { icon: Sparkles, title: 'Garantia de 7 Dias', color: 'var(--color-primary)' },
  { icon: CheckCircle2, title: 'Profissionais de Rio Verde', color: 'var(--color-success)' },
  { icon: Shield, title: 'Preço Fixo Sem Surpresas', color: 'var(--color-accent)' },
]

// Map status to display config using CSS variable colors
function getStatusConfig(status: string) {
  switch (status) {
    case 'queued':
    case 'searching':
      return { label: 'Aguardando Profissional', colorVar: '--color-warning', isActive: true }
    case 'accepted':
    case 'on_the_way':
      return { label: 'Técnico a Caminho', colorVar: '--color-info', isActive: true }
    case 'in_progress':
      return { label: 'Em Atendimento', colorVar: '--color-primary', isActive: true }
    case 'completed':
      return { label: 'Concluído', colorVar: '--color-success', isActive: false }
    case 'cancelled':
      return { label: 'Cancelado', colorVar: '--color-danger', isActive: false }
    default:
      return { label: status, colorVar: '--color-text-subtle', isActive: false }
  }
}

export default function TriiderClientHomePage() {
  const router = useRouter()
  const [services, setServices] = useState<QuickService[]>(DEFAULT_SERVICES)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'support' | 'profile'>('home')
  const [currentUser, setCurrentUser] = useState<{
    id: string
    full_name?: string
    phone?: string
    role?: string
    neighborhood?: string | null
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
        // `neighborhood` é coluna nova (migration 20260915_profile_cep_neighborhood) —
        // se ainda não foi aplicada no banco, cai no fallback sem essa coluna.
        let { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name, phone, neighborhood')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile) {
          const fallback = await supabase
            .from('profiles')
            .select('id, role, full_name, phone')
            .eq('id', user.id)
            .maybeSingle()
          profile = fallback.data ? { ...fallback.data, neighborhood: null } : null
        }

        if (profile) {
          setCurrentUser(profile)
          try {
            localStorage.setItem('repara_user', JSON.stringify(profile))
          } catch {}
        } else {
          // Achado (16/09/2026): sessão de auth válida mas sem linha
          // correspondente em profiles (ex: usuário navegou pra fora do
          // /onboarding antes de terminar de completar o cadastro) — isto
          // fabricava um "usuário fantasma" genérico ("Usuário", sem
          // telefone real) e mostrava como se estivesse logado de verdade.
          // Motivo do relato "consegui logar sem criar conta": exatamente
          // essa tela. Corrigido tratando como não logado — mesma regra
          // já usada em components/site-header.tsx.
          setCurrentUser(null)
          try {
            localStorage.removeItem('repara_user')
          } catch {}
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

  const userInitial = currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'
  const userName = currentUser?.full_name?.split(' ')[0] ?? 'Minha Conta'
  const firstName = currentUser?.full_name?.split(' ')[0]

  return (
    <div
      className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden pb-20 md:pb-0"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >

      {/* ────────────────────────────────────────────────────────
          1. HEADER RESPONSIVO
          ──────────────────────────────────────────────────────── */}
      <header
        className="surface-dark sticky top-0 z-30 w-full"
        style={{
          background: 'rgba(20, 38, 34, 0.96)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="content-container">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">

            {/* Esquerda: Logo + Bairro (quando o cliente tiver informado no cadastro) */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
              <Link href="/" className="flex items-center transition-opacity hover:opacity-85 shrink-0">
                <Logo variant="full" width={148} height={38} className="hidden sm:block" />
                <Logo variant="compact" className="sm:hidden" />
              </Link>

              {currentUser?.neighborhood && (
                <div
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <MapPin size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
                  <span>Bairro:</span>
                  <strong style={{ color: 'var(--color-text)' }}>{currentUser.neighborhood}</strong>
                </div>
              )}
            </div>

            {/* Direita: Ações */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ThemeToggle className="hidden sm:flex" />
              <button
                type="button"
                onClick={handleMyOrders}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Meus Pedidos"
              >
                <ClipboardList size={15} />
                <span>Meus Pedidos</span>
              </button>

              {/* Botão de Prestador / Painel */}
              {currentUser?.role === 'provider' ? (
                <Link
                  href="/painel"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    color: 'var(--color-success)',
                    background: 'rgba(94, 211, 164, 0.1)',
                    border: '1px solid rgba(94, 211, 164, 0.2)',
                  }}
                >
                  <Bike size={14} className="shrink-0" />
                  <span>Painel</span>
                </Link>
              ) : (
                <Link
                  href={currentUser ? '/onboarding?role=provider' : '/cadastro?role=provider'}
                  id="btn-nav-provider"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    color: 'var(--color-primary)',
                    background: 'var(--color-primary-soft)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <Bike size={14} className="shrink-0" />
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
                    className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    aria-label="Menu do usuário"
                    aria-expanded={isProfileMenuOpen}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black uppercase text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
                    >
                      {userInitial}
                    </div>
                    <span className="hidden sm:inline max-w-[110px] truncate">{userName}</span>
                    <ChevronDown
                      size={13}
                      className={`hidden sm:block shrink-0 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--color-text-subtle)' }}
                    />
                  </button>

                  {/* Dropdown desktop */}
                  {isProfileMenuOpen && (
                    <div
                      className="hidden md:block absolute right-0 mt-2 w-60 rounded-2xl py-1.5 z-50 animate-fade-in"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                      }}
                      role="menu"
                    >
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>
                          {currentUser.full_name || 'Usuário Repara RV'}
                        </p>
                        {currentUser.phone && (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                            {currentUser.phone}
                          </p>
                        )}
                        <span
                          className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                        >
                          {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'provider' ? 'Prestador Autônomo' : 'Cliente / Morador'}
                        </span>
                      </div>

                      <div className="py-1">
                        {currentUser.role === 'admin' && (
                          <Link
                            href="/admin/dashboard"
                            onClick={() => setIsProfileMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors"
                            style={{ color: 'var(--color-accent)' }}
                            role="menuitem"
                          >
                            <Shield size={15} />
                            <span>Torre de Controle Admin</span>
                          </Link>
                        )}
                        <Link
                          href="/painel"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}
                          role="menuitem"
                        >
                          <Bike size={15} style={{ color: 'var(--color-primary)' }} />
                          <span>Painel do Prestador</span>
                        </Link>
                        <button
                          type="button"
                          onClick={handleMyOrders}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors text-left cursor-pointer"
                          style={{ color: 'var(--color-text-muted)' }}
                          role="menuitem"
                        >
                          <ClipboardList size={15} style={{ color: 'var(--color-text-subtle)' }} />
                          <span>Meus Chamados & Histórico</span>
                        </button>
                        <PwaInstallButton variant="menuitem" onClose={() => setIsProfileMenuOpen(false)} />
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border)' }} className="pt-1">
                        <button
                          type="button"
                          id="btn-logout"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left cursor-pointer"
                          style={{ color: 'var(--color-danger)' }}
                          role="menuitem"
                        >
                          <LogOut size={15} />
                          <span>Sair da Conta</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href="/login"
                    id="btn-nav-login"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <User size={14} />
                    <span>Entrar</span>
                  </Link>
                  <Link
                    href="/cadastro"
                    id="btn-nav-cadastro"
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
                    style={{
                      background: 'var(--color-primary)',
                      boxShadow: 'var(--shadow-primary)',
                    }}
                  >
                    <span>Cadastre-se</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Localização para Mobile */}
          <div
            className="md:hidden pb-2 pt-1 flex items-center gap-2 text-xs"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-1.5 py-0.5 flex-1 min-w-0" style={{ color: 'var(--color-text-muted)' }}>
              <MapPin size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
              <span className="truncate">
                {currentUser?.neighborhood ? (
                  <>
                    <span style={{ color: 'var(--color-text-subtle)' }}>Você está em: </span>
                    <strong style={{ color: 'var(--color-text)' }}>{currentUser.neighborhood}, Rio Verde</strong>
                  </>
                ) : (
                  'Atendemos Rio Verde — GO'
                )}
              </span>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────
          2. PAINEL INICIAL (saudação + busca flutuante estilo app)
          ──────────────────────────────────────────────────────── */}
      <section className="content-container pt-4 pb-6 sm:pt-6 w-full">

        {/* Saudação pessoal */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black uppercase text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
          >
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-xl font-black tracking-tight truncate" style={{ color: 'var(--color-text)' }}>
              {firstName ? `Olá, ${firstName}!` : 'Olá! 👋'}
            </p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              <span className="live-dot" />
              <span>Disponível agora em Rio Verde (GO)</span>
            </div>
          </div>
        </div>

        {/* Painel verde com busca flutuante */}
        <div className="relative mb-10">
          <div
            className="rounded-3xl overflow-hidden relative px-5 pt-5 pb-11 sm:px-7 sm:pt-7 sm:pb-12"
            style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #067a57 100%)' }}
          >
            <div className="absolute inset-0 bg-ambient-grid opacity-20 pointer-events-none" />
            <div className="relative z-10 max-w-lg">
              <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight leading-tight">
                O que você precisa consertar hoje?
              </h1>
              <p className="text-white/80 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Encanador, eletricista ou montador na sua porta em 30 a 45 min. Preço fixo, sem surpresas.
              </p>
            </div>
          </div>

          {/* Busca flutuante sobrepondo a borda inferior do painel */}
          <div className="absolute left-4 right-4 sm:left-6 sm:right-6 -bottom-6">
            <div
              className="relative flex items-center rounded-2xl search-glow-container"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
              }}
            >
              <Search size={19} className="absolute left-4 pointer-events-none shrink-0" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                placeholder="Busque pelo conserto: chuveiro, torneira..."
                className="w-full pl-12 pr-4 py-4 bg-transparent text-sm outline-none font-medium"
                style={{ color: 'var(--color-text)' }}
                aria-label="Buscar serviço"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 p-1 transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-subtle)' }}
                  aria-label="Limpar busca"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Dropdown de Autocomplete */}
            {isSearchFocused && searchSuggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl py-2 z-30 text-left overflow-hidden animate-fade-in glass-panel"
                style={{
                  borderColor: 'var(--color-border-strong)',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-subtle)' }}
                >
                  Sugestões Rápidas
                </div>
                {searchSuggestions.map(service => (
                  <Link
                    key={service.id}
                    href={`/chamar/${service.id}`}
                    onClick={() => setIsSearchFocused(false)}
                    className="flex items-center justify-between px-4 py-3 transition-colors text-sm hover:bg-[rgba(10,155,112,0.12)]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Wrench size={15} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{service.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-subtle)' }}>
                        {service.category}
                      </span>
                    </div>
                    <span className="font-black text-sm shrink-0" style={{ color: 'var(--color-accent)' }}>
                      {formatCurrency(service.fixed_price)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags de Pesquisas Frequentes */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs max-w-full">
          <span className="font-bold mr-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)' }}>Mais buscados:</span>
          {['Chuveiro', 'Torneira', 'Tomada', 'Ventilador', 'Fechadura', 'Máquina de Lavar', 'Varal', 'Silicone'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setSearchQuery(tag)}
              className="search-tag-pill px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer active:scale-95"
              style={{
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Selos de confiança — carrossel animado contínuo da direita para a esquerda */}
        <div
          className="marquee-container marquee-mask group relative w-full overflow-hidden mt-4 py-1 -mx-4 px-4 sm:-mx-6 sm:px-6 select-none"
          role="region"
          aria-label="Selos de confiança e garantias"
        >
          <div className="flex w-max">
            {/* Faixa 1 */}
            <div className="animate-marquee-rtl flex items-center gap-2.5 shrink-0 pr-2.5 group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused] hover:[animation-play-state:paused]">
              {[...TRUST_BADGES, ...TRUST_BADGES].map(({ icon: Icon, title, color }, idx) => (
                <div
                  key={`t1-${title}-${idx}`}
                  className="flex items-center gap-2 shrink-0 px-3.5 py-2 rounded-full glass-panel transition-all duration-200 hover:scale-105 hover:border-[var(--color-primary)] cursor-default shadow-sm"
                >
                  <Icon size={14} style={{ color }} className="shrink-0" />
                  <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
                    {title}
                  </span>
                </div>
              ))}
            </div>

            {/* Faixa 2 — Cópia idêntica para transição contínua infinita sem saltos */}
            <div className="animate-marquee-rtl flex items-center gap-2.5 shrink-0 pr-2.5 group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused] hover:[animation-play-state:paused]" aria-hidden="true">
              {[...TRUST_BADGES, ...TRUST_BADGES].map(({ icon: Icon, title, color }, idx) => (
                <div
                  key={`t2-${title}-${idx}`}
                  className="flex items-center gap-2 shrink-0 px-3.5 py-2 rounded-full glass-panel transition-all duration-200 hover:scale-105 hover:border-[var(--color-primary)] cursor-default shadow-sm"
                >
                  <Icon size={14} style={{ color }} className="shrink-0" />
                  <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--color-text)' }}>
                    {title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ────────────────────────────────────────────────────────
          3. CATEGORIAS
          ──────────────────────────────────────────────────────── */}
      <section id="categorias" className="content-container py-8 sm:py-12 w-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
              Categorias de Serviços
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Escolha a área do reparo para filtrar os serviços disponíveis
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold hover:underline cursor-pointer shrink-0 ml-2"
              style={{ color: 'var(--color-primary)' }}
            >
              Ver todos
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className="p-3 sm:p-5 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer group"
                style={{
                  background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                  border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  boxShadow: isSelected ? 'var(--shadow-primary)' : 'none',
                }}
                aria-pressed={isSelected}
              >
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
                  style={{
                    background: isSelected ? 'rgba(10, 155, 112, 0.2)' : 'var(--color-surface-alt)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <Icon size={20} />
                </div>
                <span
                  className="text-[11px] sm:text-xs font-bold leading-tight"
                  style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                >
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          4. SERVIÇOS MAIS PEDIDOS
          ──────────────────────────────────────────────────────── */}
      <section id="servicos" className="content-container pb-8 sm:pb-12 w-full flex-1">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
              Serviços Mais Pedidos
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Preço tabelado de mão de obra com chegada em até 40 min
            </p>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ml-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
          </span>
        </div>

        {filteredServices.length === 0 ? (
          <div
            className="rounded-3xl p-10 sm:p-16 text-center my-4"
            style={{
              background: 'var(--color-surface)',
              border: '1px dashed var(--color-border-strong)',
            }}
          >
            <Search size={40} className="mx-auto mb-4" style={{ color: 'var(--color-text-subtle)' }} />
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              Nenhum serviço encontrado
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Não encontramos resultados para sua busca. Tente palavras simples como &quot;chuveiro&quot;, &quot;torneira&quot; ou confira nosso catálogo completo.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
              className="btn-primary max-w-xs mx-auto"
            >
              Exibir todos os serviços
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.map(service => {
              const ServiceIcon = (service.icon && SERVICE_ICONS[service.icon]) || Wrench
              return (
                <div
                  key={service.id}
                  className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between group cursor-pointer"
                  style={{
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div>
                    {/* Header: Ícone + Categoria + Tempo */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
                          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                        >
                          <ServiceIcon size={18} />
                        </div>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
                        >
                          {service.category}
                        </span>
                      </div>
                      <span
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: 'rgba(94, 211, 164, 0.1)',
                          color: 'var(--color-success)',
                          border: '1px solid rgba(94, 211, 164, 0.2)',
                        }}
                      >
                        <Clock size={11} />
                        Em até 40 min
                      </span>
                    </div>

                    {/* Nome e Descrição */}
                    <h3
                      className="text-sm font-bold leading-snug mb-1 transition-colors"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {service.name}
                    </h3>
                    {service.description && (
                      <p
                        className="text-xs line-clamp-2 leading-relaxed mb-3"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {service.description}
                      </p>
                    )}

                    {/* Aviso Transparente de Peças */}
                    <div
                      className="flex items-center gap-1.5 text-[11px] py-1.5 px-2.5 rounded-xl"
                      style={{
                        background: 'rgba(237, 198, 107, 0.08)',
                        border: '1px solid rgba(237, 198, 107, 0.2)',
                        color: 'var(--color-warning)',
                      }}
                    >
                      <AlertCircle size={12} className="shrink-0" />
                      <span className="leading-tight">Peças combinadas à parte com o técnico</span>
                    </div>
                  </div>

                  {/* Preço e Botão */}
                  <div
                    className="mt-4 pt-4 flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-subtle)' }}>
                        Mão de obra fixa
                      </span>
                      <span className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--color-accent)' }}>
                        {formatCurrency(service.fixed_price)}
                      </span>
                    </div>

                    <Link
                      href={`/chamar/${service.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 shrink-0 group-hover:shadow-[0_4px_16px_rgba(10,155,112,0.4)]"
                      style={{ background: 'var(--color-primary)' }}
                      aria-label={`Solicitar serviço: ${service.name}`}
                    >
                      <span>Solicitar</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────
          5. GARANTIA E CONFIANÇA
          ──────────────────────────────────────────────────────── */}
      <section id="garantia" className="content-container py-10 sm:py-16 w-full">
        <div
          className="rounded-3xl p-6 sm:p-10 glass-panel relative overflow-hidden"
          style={{
            borderColor: 'var(--color-border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
          }}
        >
          <div className="max-w-2xl mb-8 relative z-10">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
              style={{
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <ShieldCheck size={14} className="shrink-0" />
              <span>Segurança e Confiabilidade</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--color-text)' }}>
              Compromisso Repara RV
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Sem burocracia e com regras claras. Você só paga quando o conserto estiver devidamente concluído e funcionando.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
            {[
              {
                icon: CheckCircle2,
                color: 'var(--color-success)',
                title: 'Garantia de 7 Dias',
                desc: 'Se o reparo apresentar qualquer falha técnica em até 7 dias corridos, garantimos o retorno do técnico sem cobrança adicional.',
              },
              {
                icon: ShieldCheck,
                color: 'var(--color-primary)',
                title: 'Profissionais de Rio Verde',
                desc: 'Técnicos e autônomos da cidade cadastrados na plataforma com identidade checada e avaliação dos próprios moradores.',
              },
              {
                icon: Lock,
                color: 'var(--color-info)',
                title: 'Pagamento Seguro via Pix',
                desc: 'O valor do serviço fica retido com segurança e só é repassado ao profissional depois que você testar e aprovar o conserto.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="p-5 rounded-2xl flex items-start gap-4 transition-all"
                style={{
                  background: 'var(--color-surface-alt)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}1a`, border: `1px solid ${color}30` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text)' }}>{title}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          6. CTA PARA PROFISSIONAIS
          ──────────────────────────────────────────────────────── */}
      <section className="content-container pb-10 sm:pb-16 w-full">
        <div
          className="rounded-3xl p-6 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(10, 155, 112, 0.24) 0%, var(--color-surface) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div className="relative z-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
              style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
            >
              <Bike size={13} />
              <span>Para Eletricistas, Encanadores e Técnicos</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black mb-1" style={{ color: 'var(--color-text)' }}>
              Quer receber chamados no celular em Rio Verde?
            </h3>
            <p className="text-sm max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
              Cadastre-se gratuitamente como prestador autônomo. Você define seus horários, não paga mensalidade e recebe direto na conta.
            </p>
          </div>
          <Link
            href={currentUser ? '/onboarding?role=provider' : '/cadastro?role=provider'}
            id="btn-cta-provider"
            className="btn-accent sm:w-auto whitespace-nowrap text-sm px-7 py-3.5 shrink-0 z-10"
            style={{ minWidth: '220px' }}
          >
            Quero ser Profissional
          </Link>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          7. FOOTER DESKTOP
          ──────────────────────────────────────────────────────── */}
      <div className="hidden md:block mt-auto">
        <SiteFooter onCategorySelect={setSelectedCategory} />
      </div>

      {/* ────────────────────────────────────────────────────────
          8. BARRA DE NAVEGAÇÃO INFERIOR — MOBILE
          ──────────────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full"
        style={{
          background: 'rgba(20, 38, 34, 0.97)',
          borderTop: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
        aria-label="Navegação mobile"
      >
        <div className="flex items-center justify-around px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex flex-col items-center gap-0.5 transition-colors"
            style={{ color: activeTab === 'home' ? 'var(--color-primary)' : 'var(--color-text-subtle)' }}
            aria-label="Início"
            aria-current={activeTab === 'home' ? 'page' : undefined}
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
            className="flex flex-col items-center gap-0.5 transition-colors"
            style={{ color: activeTab === 'orders' ? 'var(--color-primary)' : 'var(--color-text-subtle)' }}
            aria-label="Meus Pedidos"
          >
            <ClipboardList size={20} />
            <span className="text-[10px] font-bold">Pedidos</span>
          </button>

          <a
            href="https://wa.me/5564999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Repara%20RV"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setActiveTab('support')}
            className="flex flex-col items-center gap-0.5 transition-colors"
            style={{ color: activeTab === 'support' ? 'var(--color-primary)' : 'var(--color-text-subtle)' }}
            aria-label="Suporte WhatsApp"
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-bold">Suporte</span>
          </a>

          {currentUser ? (
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 transition-colors"
              style={{ color: isProfileMenuOpen ? 'var(--color-primary)' : 'var(--color-text-subtle)' }}
              aria-label="Perfil"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black uppercase text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
              >
                {userInitial}
              </div>
              <span className="text-[10px] font-bold truncate max-w-[50px]">
                {currentUser.full_name?.split(' ')[0] || 'Perfil'}
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setActiveTab('profile')}
              className="flex flex-col items-center gap-0.5 transition-colors"
              style={{ color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-text-subtle)' }}
              aria-label="Entrar"
            >
              <User size={20} />
              <span className="text-[10px] font-bold">Entrar</span>
            </Link>
          )}
        </div>
      </nav>

      {/* ────────────────────────────────────────────────────────
          MODAL DE PERFIL NO MOBILE
          ──────────────────────────────────────────────────────── */}
      {isProfileMenuOpen && currentUser && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProfileMenuOpen(false)
          }}
          style={{ background: 'rgba(7, 16, 15, 0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-6 animate-slide-up"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between pb-4 mb-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black uppercase text-white"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
                >
                  {userInitial}
                </div>
                <div>
                  <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                    {currentUser.full_name || 'Minha Conta'}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{currentUser.phone || 'Repara RV'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(false)}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)' }}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <span
                className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider mb-2"
                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
              >
                {currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'provider' ? 'Prestador Autônomo' : 'Cliente / Morador'}
              </span>

              {currentUser.role === 'admin' && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 p-3.5 rounded-xl font-bold text-xs w-full transition-colors"
                  style={{ background: 'var(--color-primary)', color: '#ffffff' }}
                >
                  <Shield size={18} />
                  <span>Torre de Controle (Admin)</span>
                </Link>
              )}

              <Link
                href="/painel"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-3 p-3.5 rounded-xl font-semibold text-xs w-full transition-colors"
                style={{
                  color: 'var(--color-success)',
                  background: 'rgba(94, 211, 164, 0.1)',
                  border: '1px solid rgba(94, 211, 164, 0.15)',
                }}
              >
                <Bike size={18} />
                <span>Painel do Prestador</span>
              </Link>

              <button
                type="button"
                onClick={handleMyOrders}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-left"
                style={{
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-surface-alt)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <ClipboardList size={18} style={{ color: 'var(--color-text-subtle)' }} />
                <span>Meus Chamados & Histórico</span>
              </button>

              <PwaInstallButton fullWidth onClose={() => setIsProfileMenuOpen(false)} />

              <div
                className="flex items-center justify-center gap-3 py-2 text-[11px] flex-wrap"
                style={{
                  borderTop: '1px solid var(--color-border)',
                  color: 'var(--color-text-subtle)',
                  marginTop: 8,
                }}
              >
                <Link href="/termos" onClick={() => setIsProfileMenuOpen(false)} className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                  Termos de Uso
                </Link>
                <span>•</span>
                <Link href="/privacidade" onClick={() => setIsProfileMenuOpen(false)} className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                  Privacidade (LGPD)
                </Link>
                <span>•</span>
                <Link href="/contrato" onClick={() => setIsProfileMenuOpen(false)} className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
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
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 transition-all"
              style={{
                color: 'var(--color-danger)',
                background: 'rgba(244, 124, 124, 0.08)',
                border: '1px solid rgba(244, 124, 124, 0.15)',
              }}
            >
              <LogOut size={16} />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL DE MEUS CHAMADOS
          ──────────────────────────────────────────────────────── */}
      {isOrdersModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          style={{ background: 'rgba(7, 16, 15, 0.8)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] flex flex-col animate-slide-up"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div
              className="flex items-center justify-between pb-4 mb-4 shrink-0"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                >
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>Meus Chamados & Histórico</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Acompanhe seus pedidos ou veja comprovantes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOrdersModalOpen(false)
                  setActiveTab('home')
                }}
                className="p-1.5 rounded-full transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)' }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3">
              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 size={36} className="animate-spin mb-3" style={{ color: 'var(--color-primary)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Buscando seus chamados...</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Conectando ao banco de dados</p>
                </div>
              ) : userOrders.length === 0 ? (
                <div className="py-10 px-4 text-center flex flex-col items-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                  >
                    <ClipboardList size={30} />
                  </div>
                  <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text)' }}>Nenhum chamado registrado</h4>
                  <p className="text-xs max-w-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
                    Você ainda não possui pedidos na Repara RV. Escolha um serviço abaixo para chamar um profissional!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrdersModalOpen(false)
                      const el = document.getElementById('servicos')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="btn-primary max-w-xs"
                  >
                    Solicitar Serviço Agora
                  </button>
                </div>
              ) : (
                userOrders.map((order) => {
                  const serviceName = Array.isArray(order.service)
                    ? order.service[0]?.name
                    : order.service?.name || 'Serviço Repara RV'
                  const { label, colorVar, isActive } = getStatusConfig(order.status)
                  const isCompleted = order.status === 'completed'
                  const isCancelled = order.status === 'cancelled'

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
                      style={{
                        background: 'var(--color-surface-alt)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                            {serviceName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] mt-1" style={{ color: 'var(--color-text-subtle)' }}>
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
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0"
                          style={{
                            background: `color-mix(in srgb, var(${colorVar}) 12%, transparent)`,
                            color: `var(${colorVar})`,
                            border: `1px solid color-mix(in srgb, var(${colorVar}) 25%, transparent)`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: `var(${colorVar})`,
                              animation: isActive && order.status === 'searching' ? 'pulse 1s infinite' : 'none',
                            }}
                          />
                          {label}
                        </span>
                      </div>

                      <div
                        className="flex items-center justify-between text-xs py-2 px-3 rounded-xl"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                      >
                        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                          <MapPin size={12} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
                          <span className="truncate max-w-[180px] text-[11px] font-medium">
                            {order.neighborhood || 'Rio Verde - GO'}
                          </span>
                        </div>
                        <span className="font-black text-xs" style={{ color: 'var(--color-text)' }}>
                          {formatCurrency(order.total_price || 0)}
                        </span>
                      </div>

                      <div>
                        {isActive ? (
                          <Link
                            href={`/acompanhar/${order.id}`}
                            onClick={() => setIsOrdersModalOpen(false)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                            style={{ background: 'var(--color-primary)', boxShadow: 'var(--shadow-primary)' }}
                          >
                            <span>Acompanhar em Tempo Real</span>
                            <ArrowRight size={14} />
                          </Link>
                        ) : isCompleted ? (
                          <Link
                            href={`/acompanhar/${order.id}`}
                            onClick={() => setIsOrdersModalOpen(false)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              color: 'var(--color-text-muted)',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <FileText size={14} style={{ color: 'var(--color-text-subtle)' }} />
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
                            className="w-full text-center py-1.5 text-xs font-bold hover:underline cursor-pointer transition-colors"
                            style={{ color: 'var(--color-primary)' }}
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

      {/* Banner de instalação PWA */}
      <PwaInstallBanner />

    </div>
  )
}
