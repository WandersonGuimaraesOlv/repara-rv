'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  MapPin,
  ChevronDown,
  ClipboardList,
  MessageSquare,
  Bike,
  User,
  LogOut,
  Shield,
  Home,
  Wrench,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { supportWhatsAppLink } from '@/lib/support'

// Suporte humano por WhatsApp (lib/support.ts); null esconde o botão
const supportLink = supportWhatsAppLink()
import { createClient } from '@/lib/supabase/client'
import { performLogout } from '@/lib/auth-logout'

interface CurrentUser {
  id: string
  full_name?: string
  phone?: string
  role?: string
}

interface SiteHeaderProps {
  /** Neighborhood currently selected — shown in mobile bar */
  neighborhood?: string
  /** Called when user clicks on the neighborhood selector */
  onNeighborhoodClick?: () => void
  /** Called when "Meus Pedidos" is clicked */
  onOrdersClick?: () => void
  /** If true, hides the orders/profile actions (e.g., during auth flows) */
  minimal?: boolean
}

export function SiteHeader({
  neighborhood,
  onNeighborhoodClick,
  onOrdersClick,
  minimal = false,
}: SiteHeaderProps) {
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Load authenticated user
  useEffect(() => {
    const supabase = createClient()
    try {
      const cached = localStorage.getItem('repara_user')
      if (cached) setCurrentUser(JSON.parse(cached))
    } catch {}

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('id, role, full_name, phone')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data)
              try { localStorage.setItem('repara_user', JSON.stringify(data)) } catch {}
            } else {
              // Achado (16/09/2026): sessão de auth válida mas sem linha
              // correspondente em profiles (cadastro que nunca completou o
              // upsert, por ex.) — antes disso o header simplesmente não
              // fazia nada aqui, deixando o valor de localStorage (que pode
              // estar visivelmente errado/genérico, "Usuário" sem nome) preso
              // pra sempre, reaparecendo a cada carregamento novo da página.
              // Trata como não logado de verdade e limpa o cache.
              setCurrentUser(null)
              try { localStorage.removeItem('repara_user') } catch {}
            }
          })
      } else {
        setCurrentUser(null)
        try { localStorage.removeItem('repara_user') } catch {}
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setCurrentUser(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    if (isProfileMenuOpen) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isProfileMenuOpen])

  const handleLogout = async () => {
    setIsProfileMenuOpen(false)
    setIsMobileMenuOpen(false)
    setCurrentUser(null)
    await performLogout('/login')
  }

  const navLinks = [
    { href: '/', label: 'Início', icon: Home },
    { href: '/#servicos', label: 'Serviços', icon: Wrench },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const userInitial = currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'
  const userName = currentUser?.full_name?.split(' ')[0] ?? 'Minha Conta'
  const roleLabel =
    currentUser?.role === 'admin' ? 'Administrador' :
    currentUser?.role === 'provider' ? 'Prestador Autônomo' : 'Cliente / Morador'

  return (
    <>
      <header
        id="site-header"
        style={{
          background: 'rgba(20, 38, 34, 0.96)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        className="surface-dark sticky top-0 z-40 w-full"
      >
        <div className="content-container">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">

            {/* ── Logo + bairro ── */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
              <Link href="/" className="shrink-0 transition-opacity hover:opacity-85">
                <Logo variant="full" width={148} height={38} className="hidden sm:block" />
                <Logo variant="compact" className="sm:hidden" />
              </Link>

              {neighborhood && onNeighborhoodClick && (
                <button
                  type="button"
                  onClick={onNeighborhoodClick}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
                  style={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                  aria-label={`Bairro selecionado: ${neighborhood}. Clique para alterar.`}
                >
                  <MapPin size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
                  <span>Bairro:</span>
                  <strong style={{ color: 'var(--color-text)' }}>{neighborhood}</strong>
                  <ChevronDown size={13} style={{ color: 'var(--color-text-subtle)' }} />
                </button>
              )}
            </div>

            {/* ── Nav desktop ── */}
            {!minimal && (
              <nav className="hidden lg:flex items-center gap-1" aria-label="Navegação principal">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      color: isActive(href) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      background: isActive(href) ? 'var(--color-primary-soft)' : 'transparent',
                    }}
                    aria-current={isActive(href) ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                ))}
                {supportLink && (
                  <a
                    href={supportLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Suporte
                  </a>
                )}
              </nav>
            )}

            {/* ── Ações direita ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ThemeToggle className="hidden sm:flex" />
              {!minimal && (
                <>
                  {/* Meus pedidos */}
                  {onOrdersClick && (
                    <button
                      type="button"
                      id="btn-header-my-orders"
                      onClick={onOrdersClick}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label="Meus Pedidos"
                    >
                      <ClipboardList size={15} />
                      <span>Meus Pedidos</span>
                    </button>
                  )}

                  {/* Sou profissional / Painel */}
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
                      id="btn-header-provider"
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
                              {currentUser.full_name ?? 'Usuário Repara RV'}
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
                              {roleLabel}
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
                            {onOrdersClick && (
                              <button
                                type="button"
                                onClick={() => { setIsProfileMenuOpen(false); onOrdersClick() }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors text-left cursor-pointer"
                                style={{ color: 'var(--color-text-muted)' }}
                                role="menuitem"
                              >
                                <ClipboardList size={15} style={{ color: 'var(--color-text-subtle)' }} />
                                <span>Meus Chamados & Histórico</span>
                              </button>
                            )}
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
                </>
              )}

              {/* Botão hambúrguer — mobile */}
              {!minimal && (
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer"
                  style={{
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                  }}
                  aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              )}
            </div>
          </div>

          {/* Seletor de bairro mobile */}
          {neighborhood && onNeighborhoodClick && (
            <div
              className="md:hidden pb-2 pt-1 flex items-center gap-2 text-xs"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <button
                type="button"
                onClick={onNeighborhoodClick}
                className="flex items-center gap-1.5 text-left transition-colors cursor-pointer py-0.5 w-full"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Alterar bairro: ${neighborhood}`}
              >
                <MapPin size={13} style={{ color: 'var(--color-primary)' }} className="shrink-0" />
                <div className="truncate flex-1 min-w-0 text-xs">
                  <span style={{ color: 'var(--color-text-subtle)' }}>Você está em: </span>
                  <strong style={{ color: 'var(--color-text)' }}>
                    {neighborhood}, Rio Verde
                  </strong>
                </div>
                <ChevronDown size={13} style={{ color: 'var(--color-text-subtle)' }} className="shrink-0 ml-1" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile Menu Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(7, 16, 15, 0.75)', backdropFilter: 'blur(4px)' }}
          />
          <div
            className="relative ml-auto w-72 h-full overflow-y-auto animate-slide-up flex flex-col"
            style={{ background: 'var(--color-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <Logo variant="compact" />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl cursor-pointer"
                style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)' }}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1" aria-label="Menu mobile">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                  style={{
                    color: isActive(href) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    background: isActive(href) ? 'var(--color-primary-soft)' : 'transparent',
                  }}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
              {onOrdersClick && (
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); onOrdersClick() }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <ClipboardList size={18} />
                  Meus Pedidos
                </button>
              )}
              {supportLink && (
                <a
                  href={supportLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <MessageSquare size={18} />
                  Suporte WhatsApp
                </a>
              )}
              <div className="flex items-center gap-3 px-4 py-2 text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                <ThemeToggle />
                <span>Alternar Tema</span>
              </div>
            </nav>

            <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {currentUser ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
                    >
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>
                        {currentUser.full_name ?? 'Usuário'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{roleLabel}</p>
                    </div>
                  </div>
                  <Link
                    href="/painel"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors w-full"
                    style={{
                      color: 'var(--color-success)',
                      background: 'rgba(94, 211, 164, 0.1)',
                      border: '1px solid rgba(94, 211, 164, 0.15)',
                    }}
                  >
                    <Bike size={18} />
                    Painel do Prestador
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer text-left"
                    style={{
                      color: 'var(--color-danger)',
                      background: 'rgba(244, 124, 124, 0.08)',
                      border: '1px solid rgba(244, 124, 124, 0.15)',
                    }}
                  >
                    <LogOut size={18} />
                    Sair da Conta
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-secondary text-sm"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/cadastro"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-primary text-sm"
                  >
                    Criar Conta Grátis
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
