'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface GeolocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

/**
 * Hook para obter e monitorar a geolocalização do dispositivo.
 * Ideal para o prestador enviar posição ao ficar online.
 */
export function useGeolocation(watch = false) {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: false,
  })
  const watchIdRef = useRef<number | null>(null)

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setState({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      error: null,
      loading: false,
    })
  }, [])

  const onError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Permissão de localização negada. Habilite o GPS nas configurações.',
      2: 'Posição indisponível. Verifique se o GPS está ativo.',
      3: 'Tempo esgotado ao obter localização.',
    }
    setState(prev => ({
      ...prev,
      error: messages[err.code] ?? 'Erro ao obter localização.',
      loading: false,
    }))
  }, [])

  const getPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState(prev => ({ ...prev, error: 'GPS não suportado neste dispositivo.' }))
      return
    }
    setState(prev => ({ ...prev, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    })
  }, [onSuccess, onError])

  useEffect(() => {
    if (!watch) return
    if (!('geolocation' in navigator)) return

    setState(prev => ({ ...prev, loading: true }))
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 10000,
    })

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [watch, onSuccess, onError])

  return { ...state, getPosition }
}
