'use client'

import { useState } from 'react'
import { buildGoogleMapsUrl, buildWazeUrl } from '@/lib/utils'
import { detectNavPlatform, navigationLink, type NavApp } from '@/lib/navigation-links'
import { Map, MapPin, Navigation, KeyRound } from 'lucide-react'

interface NavigationButtonsProps {
  lat: number
  lng: number
  address?: string
}

const PREFERRED_KEY = 'repara_nav_app'
const APP_FALLBACK_MS = 1500

function readPreferred(): NavApp | null {
  try {
    const value = localStorage.getItem(PREFERRED_KEY)
    return value === 'waze' || value === 'google' ? value : null
  } catch {
    return null
  }
}

// Abre o Waze/Google Maps INSTALADO já navegando até o cliente (ver
// lib/navigation-links.ts). O href de cada botão é o site — vale pra
// "copiar link" e sem JavaScript; o toque usa o link do app.
export function NavigationButtons({ lat, lng, address }: NavigationButtonsProps) {
  // Só é montado no navegador, depois de o chamado carregar — dá pra ler o
  // localStorage direto no estado inicial.
  const [preferred, setPreferred] = useState<NavApp | null>(readPreferred)

  const open = (app: NavApp) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setPreferred(app)
    try {
      localStorage.setItem(PREFERRED_KEY, app)
    } catch {}

    const platform = detectNavPlatform(navigator.userAgent, navigator.maxTouchPoints)
    const { href, fallback } = navigationLink(app, { lat, lng }, platform)

    if (platform === 'other') {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    if (fallback) {
      // App não instalado (iPhone): a página continua visível → vai pro site.
      const timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') window.location.href = fallback
      }, APP_FALLBACK_MS)
      const cancel = () => window.clearTimeout(timer)
      document.addEventListener('visibilitychange', cancel, { once: true })
      window.addEventListener('pagehide', cancel, { once: true })
    }
    window.location.href = href
  }

  const buttons: { app: NavApp; label: string; href: string; icon: typeof Navigation; color: string; bg: string; border: string }[] = [
    { app: 'waze', label: 'Waze', href: buildWazeUrl(lat, lng), icon: Navigation, color: '#33CCFF', bg: 'linear-gradient(135deg, #33CCFF22, #00B4FF11)', border: '#33CCFF55' },
    { app: 'google', label: 'Google Maps', href: buildGoogleMapsUrl(lat, lng), icon: Map, color: '#4285F4', bg: 'linear-gradient(135deg, #4285F422, #34A85311)', border: '#4285F455' },
  ]
  if (preferred === 'google') buttons.reverse()

  return (
    <div className="space-y-2">
      {address && (
        <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
          <MapPin size={13} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />{address}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {buttons.map(({ app, label, href, icon: Icon, color, bg, border }) => (
          <a
            key={app}
            href={href}
            onClick={open(app)}
            id={app === 'waze' ? 'btn-open-waze' : 'btn-open-google-maps'}
            className="relative flex flex-col items-center gap-2 p-4 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
            style={{ background: bg, border: `1.5px solid ${preferred === app ? color : border}`, color }}
          >
            {preferred === app && (
              <span className="absolute -top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: color, color: '#0b1512' }}>
                Último usado
              </span>
            )}
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-center pt-1" style={{ color: 'var(--color-text-subtle)' }}>
        <KeyRound size={12} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />
        Ao chegar, volte ao Repara RV para digitar o PIN do cliente.
      </p>
    </div>
  )
}
