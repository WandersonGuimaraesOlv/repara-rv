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
        className={`w-9 h-9 rounded-xl flex items-center justify-center opacity-60 ${className}`}
        style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-subtle)' }}
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
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${className}`}
      style={{
        background: 'var(--color-surface-alt)',
        color: 'var(--color-text-muted)',
        border: '1px solid var(--color-border)',
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ color: 'var(--color-warning)' }} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  )
}
