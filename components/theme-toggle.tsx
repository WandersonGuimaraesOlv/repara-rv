'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  // ⚠️ Prevenção de Hydration Mismatch:
  // Só renderiza o ícone correto após montagem no cliente.
  // O servidor não sabe qual tema está salvo no localStorage.
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Placeholder neutro durante SSR / antes da montagem
  if (!mounted) {
    return (
      <button
        aria-label="Alternar tema"
        className={`w-9 h-9 rounded-xl flex items-center justify-center opacity-0 pointer-events-none ${className}`}
        tabIndex={-1}
      >
        <Sun size={18} />
      </button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      id="theme-toggle-btn"
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
      onClick={toggle}
      className={`
        w-9 h-9 rounded-xl flex items-center justify-center
        transition-all duration-200 active:scale-90
        bg-slate-100 hover:bg-slate-200 text-slate-700
        dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300
        ${className}
      `}
    >
      {isDark ? (
        <Sun size={18} className="text-amber-400" />
      ) : (
        <Moon size={18} className="text-slate-600" />
      )}
    </button>
  )
}
