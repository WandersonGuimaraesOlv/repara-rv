'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'
import { Navigation, Loader2 } from 'lucide-react'
import { formatDistance } from '@/lib/utils'
import type { Coordinates } from '@/lib/geocoding'
import { decodePolyline, formatAge, isPositionStale, remainingMinutes } from '@/lib/tracking'

interface TrackingData {
  status: string
  destination: Coordinates | null
  provider: (Coordinates & { updated_at: string | null; distance_km: number | null }) | null
  // Rota pelas ruas (Google Routes API via lib/directions.ts); null = sem rota
  route: { encoded_polyline: string; duration_seconds: number; distance_meters: number; computed_at: string } | null
}

interface ProviderTrackingMapProps {
  callId: string
  viewer: 'client' | 'provider'
}

const POLL_MS = 15_000

// Pino simples em HTML (L.divIcon): os ícones padrão do Leaflet apontam pra
// arquivos de imagem que o bundler não publica.
function pinHtml(color: string, pulse: boolean): string {
  const ring = pulse
    ? `<span class="animate-ping" style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.35"></span>`
    : ''
  return `<span style="position:relative;display:block;width:18px;height:18px">${ring}<span style="position:absolute;inset:0;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span></span>`
}

// Mapa do trajeto do técnico até o endereço do chamado (OpenStreetMap, sem
// chave de API no navegador). Posição e rota vêm de /api/calls/tracking, que
// só responde ao cliente e ao técnico deste chamado e só entre o aceite e o
// início do atendimento. O técnico manda a posição pelo app aberto
// (app/chamado); com o Waze/Google Maps na frente o navegador para de mandar,
// e a tela mostra há quanto tempo foi a última posição.
export function ProviderTrackingMap({ callId, viewer }: ProviderTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<{
    L: typeof import('leaflet')
    map: LeafletMap
    provider: Marker | null
    destination: Marker | null
    routeLine: Polyline | null
    routeKey: string | null
    fitted: boolean
  } | null>(null)
  const [data, setData] = useState<TrackingData | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/tracking?call_id=${encodeURIComponent(callId)}`, { cache: 'no-store' })
      if (!res.ok) return
      setData(await res.json())
      setNow(new Date())
    } catch {
      // sem rede: mantém a última posição e tenta de novo no próximo ciclo
    }
  }, [callId])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  // Cria o mapa uma vez (Leaflet só roda no navegador) e desmonta ao sair.
  useEffect(() => {
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !containerRef.current || leafletRef.current) return
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true })
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>')
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map)
      leafletRef.current = { L, map, provider: null, destination: null, routeLine: null, routeKey: null, fitted: false }
      setNow(new Date())
    })
    return () => {
      cancelled = true
      leafletRef.current?.map.remove()
      leafletRef.current = null
    }
  }, [])

  // Atualiza os pinos a cada posição nova. Enquadra os dois pontos na
  // primeira vez e de novo só se o técnico sair da área visível — assim quem
  // mexeu no mapa não perde o zoom a cada atualização.
  useEffect(() => {
    const leaflet = leafletRef.current
    if (!leaflet || !data) return
    const { L, map } = leaflet

    const place = (marker: Marker | null, point: Coordinates | null, color: string, pulse: boolean, label: string) => {
      if (!point) {
        marker?.remove()
        return null
      }
      if (marker) {
        marker.setLatLng([point.lat, point.lng])
        return marker
      }
      const icon = L.divIcon({ html: pinHtml(color, pulse), className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
      return L.marker([point.lat, point.lng], { icon, title: label, keyboard: false }).addTo(map)
    }

    leaflet.destination = place(leaflet.destination, data.destination, 'var(--color-accent)', false, 'Endereço do chamado')
    leaflet.provider = place(leaflet.provider, data.provider, 'var(--color-primary)', true, 'Técnico')

    // Rota pelas ruas: só redesenha quando o servidor calculou uma nova.
    let routePoints: [number, number][] = []
    if (data.route) {
      routePoints = decodePolyline(data.route.encoded_polyline)
      const key = `${data.route.computed_at}:${data.route.encoded_polyline.length}`
      if (leaflet.routeKey !== key) {
        if (leaflet.routeLine) leaflet.routeLine.setLatLngs(routePoints)
        // --color-primary (igual nos 3 temas); atributo de SVG não aceita var()
        else leaflet.routeLine = L.polyline(routePoints, { color: '#0a9b70', weight: 5, opacity: 0.85, interactive: false }).addTo(map)
        leaflet.routeKey = key
      }
    } else if (leaflet.routeLine) {
      leaflet.routeLine.remove()
      leaflet.routeLine = null
      leaflet.routeKey = null
    }

    const points: [number, number][] = [
      ...[data.destination, data.provider].filter((p): p is Coordinates => p !== null).map(p => [p.lat, p.lng] as [number, number]),
      ...routePoints,
    ]
    if (points.length === 0) return
    // getBounds() só existe depois do primeiro enquadramento
    const needsFit = !leaflet.fitted
      || (data.provider !== null && !map.getBounds().contains([data.provider.lat, data.provider.lng]))
    if (needsFit) {
      if (points.length === 1) map.setView(points[0], 16)
      else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 17 })
      leaflet.fitted = true
    }
  }, [data, now])

  const provider = data?.provider ?? null
  const stale = provider ? isPositionStale(provider.updated_at, now) : true
  const route = data?.route ?? null
  // Pelas ruas quando há rota; senão, em linha reta.
  const km = route ? route.distance_meters / 1000 : provider?.distance_km ?? null
  const age = provider?.updated_at ? formatAge(provider.updated_at, now) : null
  const etaMin = route && provider && !stale ? remainingMinutes(route.duration_seconds, route.computed_at, now) : null

  let message: string
  if (!data) {
    message = 'Carregando o mapa...'
  } else if (!provider) {
    message = viewer === 'client'
      ? 'Aguardando a localização do técnico.'
      : 'Sua localização ainda não chegou. Deixe a localização do celular ligada.'
  } else if (stale) {
    message = viewer === 'client'
      ? `Última posição do técnico ${age}. Ele pode estar com o app de navegação aberto.`
      : `Sua posição não é atualizada ${age}. Volte ao Repara RV de vez em quando para o cliente ver você chegando.`
  } else if (km !== null && km < 0.05) {
    message = viewer === 'client' ? 'O técnico está chegando.' : 'Você chegou ao endereço.'
  } else if (etaMin !== null && km !== null) {
    message = viewer === 'client'
      ? `O técnico chega em cerca de ${etaMin} min · ${formatDistance(km)} pelo caminho · atualizado ${age}`
      : `Você chega em cerca de ${etaMin} min · ${formatDistance(km)} · o cliente vê sua posição até você iniciar o atendimento`
  } else {
    const dist = km !== null ? formatDistance(km) : null
    message = viewer === 'client'
      ? `O técnico está a ${dist ?? '—'} do seu endereço · atualizado ${age}`
      : `Você está a ${dist ?? '—'} do endereço · o cliente vê sua posição até você iniciar o atendimento`
  }

  return (
    <div className="card p-4 mb-4 animate-slide-up" style={{ borderColor: 'var(--color-border-strong)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Navigation size={16} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--color-primary)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {viewer === 'client' ? 'Acompanhe o técnico' : 'Seu trajeto até o cliente'}
        </p>
        {etaMin !== null && (
          <span
            id="provider-tracking-eta"
            className="ml-auto text-sm font-black px-2.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
          >
            ~{etaMin} min
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        id="provider-tracking-map"
        role="img"
        aria-label={viewer === 'client' ? 'Mapa com a posição do técnico e o seu endereço' : 'Mapa com a sua posição e o endereço do cliente'}
        className="w-full rounded-2xl overflow-hidden relative z-0"
        style={{ height: 220, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
      >
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" aria-hidden="true" style={{ color: 'var(--color-text-subtle)' }} />
          </div>
        )}
      </div>

      <p
        id="provider-tracking-status"
        className="text-xs mt-3"
        aria-live="polite"
        style={{ color: provider && stale ? 'var(--color-warning)' : 'var(--color-text-muted)' }}
      >
        {message}
      </p>

      <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} aria-hidden="true" />
          Técnico
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} aria-hidden="true" />
          {viewer === 'client' ? 'Seu endereço' : 'Endereço do cliente'}
        </span>
      </div>
    </div>
  )
}
