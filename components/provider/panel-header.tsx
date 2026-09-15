'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Radio, LogOut } from 'lucide-react'
import { performLogout } from '@/lib/auth-logout'

interface PanelHeaderProps {
  isOnline: boolean
}

export function PanelHeader({ isOnline }: PanelHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <header
      className="w-full flex items-center justify-between px-3 py-3 rounded-2xl mb-5"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Botão de Retorno */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Voltar para a página inicial"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-colors cursor-pointer"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Início</span>
      </button>

      {/* Identificação Central */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="font-extrabold text-base tracking-tight hover:opacity-85 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          Repara<span style={{ color: 'var(--color-primary)' }}>RV</span>
        </Link>
        <span
          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
          style={{
            background: 'var(--color-primary-soft)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          Painel Prestador
        </span>
      </div>

      {/* Status da Conexão & Botão Sair */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
          style={
            isOnline
              ? {
                  background: 'rgba(94, 211, 164, 0.12)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(94, 211, 164, 0.25)',
                }
              : {
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-text-subtle)',
                  border: '1px solid var(--color-border)',
                }
          }
        >
          <Radio
            className="w-3.5 h-3.5"
            style={{
              color: isOnline ? 'var(--color-success)' : 'var(--color-text-subtle)',
              animation: isOnline ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <button
          type="button"
          onClick={() => performLogout('/login')}
          title="Sair da Conta"
          aria-label="Sair da Conta"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold active:scale-95 transition-colors cursor-pointer"
          style={{ color: 'var(--color-danger)', border: '1px solid rgba(244, 124, 124, 0.2)' }}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
