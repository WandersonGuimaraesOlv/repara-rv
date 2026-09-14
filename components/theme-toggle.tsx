'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme, theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = resolvedTheme || theme || 'light'
  const isDark = currentTheme === 'dark'

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  // Placeholder neutro durante SSR / antes da montagem para evitar mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Alternar tema"
        className={`w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-60 ${className}`}
        disabled
      >
        <Moon size={18} />
      </button>
    )
  }

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
      onClick={toggle}
      className={`
        w-9 h-9 rounded-xl flex items-center justify-center
        transition-all duration-200 active:scale-90 cursor-pointer
        bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/70
        dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700
        shadow-xs
        ${className}
      `}
    >
      {isDark ? (
        <Sun size={18} className="text-amber-400" />
      ) : (
        <Moon size={18} className="text-slate-600 dark:text-slate-300" />
      )}
    </button>
  )
}
