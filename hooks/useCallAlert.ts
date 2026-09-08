'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook que dispara áudio + vibração quando um novo chamado chega.
 * Retorna funções para iniciar e parar o alerta.
 */
export function useCallAlert() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPlayingRef = useRef(false)

  const stopAlert = useCallback(() => {
    isPlayingRef.current = false

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current)
      vibrationIntervalRef.current = null
    }

    // Para a vibração
    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }
  }, [])

  const startAlert = useCallback(() => {
    if (isPlayingRef.current) return
    isPlayingRef.current = true

    // Áudio de alerta
    if (typeof window !== 'undefined') {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/sounds/alert.mp3')
          audioRef.current.loop = true
        }
        audioRef.current.play().catch(() => {
          // Autoplay bloqueado pelo browser — silencioso
        })
      } catch {
        // Ignora erro de áudio em ambientes sem suporte
      }
    }

    // Vibração em loop (padrão: vibra 200ms, pausa 100ms, vibra 200ms)
    if ('vibrate' in navigator) {
      const vibratePattern = () => {
        if (isPlayingRef.current) {
          navigator.vibrate([300, 100, 300, 100, 300])
        }
      }
      vibratePattern()
      vibrationIntervalRef.current = setInterval(vibratePattern, 1500)
    }
  }, [])

  // Limpeza automática ao desmontar
  useEffect(() => {
    return () => {
      stopAlert()
    }
  }, [stopAlert])

  return { startAlert, stopAlert }
}
