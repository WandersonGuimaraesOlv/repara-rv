'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown'

interface GeolocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  error: string | null
  // 1 = permissão negada, 2 = posição indisponível, 3 = tempo esgotado (GeolocationPositionError)
  errorCode: number | null
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
    errorCode: null,
    loading: false,
  })
  const [permission, setPermission] = useState<GeoPermission>('unknown')
  // Muda quando a permissão volta a ser concedida, pra recriar o watchPosition
  // (um watch que recebeu "permissão negada" não volta sozinho).
  const [watchKey, setWatchKey] = useState(0)
  const watchIdRef = useRef<number | null>(null)

  const onSuccess = useCallback((pos: GeolocationPosition) => {
    setState({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      error: null,
      errorCode: null,
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
      errorCode: err.code,
      loading: false,
    }))
  }, [])

  const getPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState(prev => ({ ...prev, error: 'GPS não suportado neste dispositivo.', errorCode: 2 }))
      return
    }
    setState(prev => ({ ...prev, loading: true, error: null, errorCode: null }))
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    })
  }, [onSuccess, onError])

  // Acompanha a permissão do navegador (Chrome/Android e Safari/iOS 16+): quando
  // o usuário libera a localização nas configurações do site e volta pro app,
  // a posição é buscada de novo sem precisar recarregar a página.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let status: PermissionStatus | null = null
    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(s => {
        if (cancelled) return
        status = s
        setPermission(s.state as GeoPermission)
        s.onchange = () => {
          setPermission(s.state as GeoPermission)
          if (s.state === 'granted') {
            setWatchKey(k => k + 1)
            getPosition()
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (status) status.onchange = null
    }
  }, [getPosition])

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
  }, [watch, watchKey, onSuccess, onError])

  return { ...state, permission, getPosition }
}
