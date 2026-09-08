'use client'

import { buildGoogleMapsUrl, buildWazeUrl } from '@/lib/utils'
import { Map, Navigation } from 'lucide-react'

interface NavigationButtonsProps {
  lat: number
  lng: number
  address?: string
}

export function NavigationButtons({ lat, lng, address }: NavigationButtonsProps) {
  const googleUrl = buildGoogleMapsUrl(lat, lng)
  const wazeUrl = buildWazeUrl(lat, lng)

  return (
    <div className="space-y-2">
      {address && (
        <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
          📍 {address}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="btn-open-waze"
          className="flex flex-col items-center gap-2 p-4 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #33CCFF22, #00B4FF11)',
            border: '1.5px solid #33CCFF55',
            color: '#33CCFF',
          }}
        >
          <Navigation size={24} />
          <span>Waze</span>
        </a>

        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="btn-open-google-maps"
          className="flex flex-col items-center gap-2 p-4 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #4285F422, #34A85311)',
            border: '1.5px solid #4285F455',
            color: '#4285F4',
          }}
        >
          <Map size={24} />
          <span>Google Maps</span>
        </a>
      </div>
    </div>
  )
}
