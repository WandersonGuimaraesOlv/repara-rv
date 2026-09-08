'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ACCEPT_TIMEOUT_SECONDS = 45

interface UseAcceptTimerOptions {
  onTimeout: () => void
  autoStart?: boolean
}

/**
 * Hook de countdown para janela de aceite do prestador.
 * Conta 45s regressivos e chama onTimeout ao expirar.
 */
export function useAcceptTimer({ onTimeout, autoStart = false }: UseAcceptTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(ACCEPT_TIMEOUT_SECONDS)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTimeoutRef = useRef(onTimeout)

  // Mantém referência atualizada sem re-criar intervalo
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const stop = useCallback(() => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    setSecondsLeft(ACCEPT_TIMEOUT_SECONDS)
    setIsRunning(true)
  }, [])

  const reset = useCallback(() => {
    stop()
    setSecondsLeft(ACCEPT_TIMEOUT_SECONDS)
  }, [stop])

  useEffect(() => {
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          stop()
          onTimeoutRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, stop])

  useEffect(() => {
    if (autoStart) start()
  }, [autoStart, start])

  const progress = (secondsLeft / ACCEPT_TIMEOUT_SECONDS) * 100

  return { secondsLeft, progress, isRunning, start, stop, reset }
}
