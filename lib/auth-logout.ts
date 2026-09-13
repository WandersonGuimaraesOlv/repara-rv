// lib/auth-logout.ts
// Utilitário central de encerramento seguro e definitivo de sessão (Client & Server)
// Garante limpeza completa de Storage, Cookies de Autenticação e Hard Reload

import { createClient } from '@/lib/supabase/client'

export async function performLogout(redirectTo: string = '/login') {
  // 1. Limpa Storage local e de sessão imediatamente
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('repara_user')
      sessionStorage.clear()
      // Remove todas as chaves do Supabase e do Repara RV no localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith('sb-') ||
            key.includes('supabase') ||
            key.includes('auth') ||
            key.startsWith('repara'))
        ) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
    }
  } catch (e) {
    console.warn('[Logout] Aviso ao limpar storage:', e)
  }

  // 2. Limpa todos os cookies via document.cookie no navegador
  try {
    if (typeof document !== 'undefined') {
      document.cookie =
        'repara_demo_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim()
        if (
          name.startsWith('sb-') ||
          name.includes('auth') ||
          name.includes('token') ||
          name.startsWith('repara')
        ) {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`
          if (typeof window !== 'undefined') {
            document.cookie = `${name}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Logout] Aviso ao limpar document.cookie:', e)
  }

  // 3. Notifica o backend com timeout agressivo de 1.2s para revogar sessão no Supabase e limpar cookies de servidor
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)
    await fetch('/api/auth/signout', { method: 'POST', signal: controller.signal }).catch(() => {})
    clearTimeout(timer)
  } catch {}

  // 4. Invoca signOut do SDK do Supabase localmente para resetar listeners
  try {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } catch {}

  // 5. Redirecionamento forçado (Hard Navigation) para resetar todo o estado da memória do PWA
  if (typeof window !== 'undefined') {
    window.location.replace(redirectTo)
  }
}
