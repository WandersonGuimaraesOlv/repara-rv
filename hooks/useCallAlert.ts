'use client'

import { useCallback, useEffect } from 'react'
import { audioAlert } from '@/lib/audio-alert'

/**
 * Hook que dispara áudio + vibração quando um novo chamado chega.
 * Conectado ao serviço unificado de alta confiabilidade para Android e iOS.
 */
export function useCallAlert() {
  const startAlert = useCallback(() => {
    audioAlert.startAlarm()
  }, [])

  const stopAlert = useCallback(() => {
    audioAlert.stopAlarm()
  }, [])

  // Limpeza automática ao desmontar
  useEffect(() => {
    return () => {
      audioAlert.stopAlarm()
    }
  }, [])

  return { startAlert, stopAlert }
}
