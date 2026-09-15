'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { Wrench, BarChart3, Users, ArrowLeft, Shield, LogOut, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { performLogout } from '@/lib/auth-logout'

interface AdminHeaderProps {
  userName?: string
}

export function AdminHeader({ userName }: AdminHeaderProps) {
  const pathname = usePathname()

  const handleLogout = async () => {
    toast.success('Desconectado com sucesso.')
    await performLogout('/login')
  }

  const navLinks = [
    { href: '/admin/servicos', label: 'Catálogo de Serviços', icon: Wrench },
    { href: '/admin/dashboard', label: 'Dashboard & Métricas', icon: BarChart3 },
    { href: '/admin/usuarios', label: 'Usuários Cadastrados', icon: Users },
    { href: '/admin/juridico', label: 'Documentos Jurídicos', icon: FileText },
  ]

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Badge Admin */}
          <div className="flex items-center gap-4">
            <Link href="/admin/servicos" className="flex items-center gap-2">
              <Logo variant="compact" />
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Shield size={12} />
                ADMIN
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-6">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={16} />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Actions: User info, Voltar ao App, Logout */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Voltar ao</span> App
            </Link>

            {userName && (
              <span className="hidden lg:inline-block text-xs text-slate-400">
                Olá, <strong className="text-slate-200">{userName}</strong>
              </span>
            )}

            <button
              onClick={handleLogout}
              title="Sair da Conta"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden border-t border-slate-800 py-2 gap-2 overflow-x-auto">
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
