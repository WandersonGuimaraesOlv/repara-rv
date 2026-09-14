import React from 'react'

interface LogoProps {
  variant?: 'full' | 'compact' | 'icon'
  className?: string
  width?: number | string
  height?: number | string
  textColor?: string
  subtextColor?: string
  inverted?: boolean
}

export function Logo({
  variant = 'full',
  className = '',
  width,
  height,
  textColor,
  subtextColor,
  inverted = false,
}: LogoProps) {
  const primaryText = textColor || (inverted ? '#FFFFFF' : 'var(--color-text)')
  const secondaryText = subtextColor || (inverted ? '#94A3B8' : 'var(--color-text-muted)')
  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 110"
        width={width || 40}
        height={height || 44}
        className={className}
        aria-label="Repara RV Ícone"
      >
        <defs>
          <linearGradient id="reparaIconOnlyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <filter id="softShadowIconOnly" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#EA580C" floodOpacity="0.25" />
          </filter>
        </defs>
        <path
          d="M50 5 C28 5 10 23 10 45 C10 70 45 98 50 102 C55 98 90 70 90 45 C90 23 72 5 50 5 Z"
          fill="url(#reparaIconOnlyGrad)"
          filter="url(#softShadowIconOnly)"
        />
        <circle cx="50" cy="40" r="17" fill="#0F172A" />
        <circle cx="50" cy="40" r="8" fill="url(#reparaIconOnlyGrad)" />
        <rect x="47" y="46" width="6" height="18" rx="3" fill="#0F172A" />
        <path d="M50 28 L53 37 L48 37 L51 46 L45 39 L49 39 Z" fill="#FFFFFF" opacity="0.9" />
      </svg>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${className}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 110"
          width={width || 28}
          height={height || 32}
          aria-hidden="true"
          className="shrink-0"
        >
          <defs>
            <linearGradient id="reparaCompactGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
          </defs>
          <path
            d="M50 5 C28 5 10 23 10 45 C10 70 45 98 50 102 C55 98 90 70 90 45 C90 23 72 5 50 5 Z"
            fill="url(#reparaCompactGrad)"
          />
          <circle cx="50" cy="40" r="17" fill="#0F172A" />
          <circle cx="50" cy="40" r="8" fill="url(#reparaCompactGrad)" />
          <rect x="47" y="46" width="6" height="18" rx="3" fill="#0F172A" />
          <path d="M50 28 L53 37 L48 37 L51 46 L45 39 L49 39 Z" fill="#FFFFFF" opacity="0.9" />
        </svg>
        <span className="text-lg sm:text-xl font-black tracking-tight leading-none text-slate-900 dark:text-white shrink-0" style={textColor ? { color: textColor } : undefined}>
          Repara<span className="text-orange-600">RV</span>
        </span>
      </div>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 120"
      width={width || 180}
      height={height || 48}
      className={className}
      aria-label="Repara RV — Serviços Residenciais"
    >
      <defs>
        <linearGradient id="reparaFullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <filter id="softShadowFull" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#EA580C" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Ícone Pin GPS + Chave */}
      <g transform="translate(15, 10)">
        <path
          d="M50 5 C28 5 10 23 10 45 C10 70 45 98 50 102 C55 98 90 70 90 45 C90 23 72 5 50 5 Z"
          fill="url(#reparaFullGrad)"
          filter="url(#softShadowFull)"
        />
        <circle cx="50" cy="40" r="17" fill={inverted ? '#020617' : '#0F172A'} />
        <circle cx="50" cy="40" r="8" fill="url(#reparaFullGrad)" />
        <rect x="47" y="46" width="6" height="18" rx="3" fill={inverted ? '#020617' : '#0F172A'} />
        <path d="M50 28 L53 37 L48 37 L51 46 L45 39 L49 39 Z" fill="#FFFFFF" opacity="0.9" />
      </g>

      {/* Tipografia Oficial */}
      <g transform="translate(130, 75)" fontFamily="Inter, system-ui, -apple-system, sans-serif">
        <text x="0" y="0" fontSize="52" fontWeight="700" fill={primaryText} letterSpacing="-1.5">
          Repara
        </text>
        <text x="185" y="0" fontSize="54" fontWeight="900" fill="url(#reparaFullGrad)" letterSpacing="-1">
          RV
        </text>
        <text x="3" y="24" fontSize="13" fontWeight="600" fill={secondaryText} letterSpacing="3.5">
          SERVIÇOS RESIDENCIAIS
        </text>
      </g>
    </svg>
  )
}
