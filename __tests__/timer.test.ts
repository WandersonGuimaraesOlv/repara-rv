import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('SQA Timer & Field Reliability: 45s Accept Window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates circular progress percentage correctly for 45s countdown', () => {
    const TOTAL_SECONDS = 45
    const getProgress = (secondsLeft: number) => (secondsLeft / TOTAL_SECONDS) * 100

    expect(getProgress(45)).toBe(100)
    expect(getProgress(22.5)).toBe(50)
    expect(getProgress(0)).toBe(0)
  })

  it('triggers onTimeout after 45 seconds when timer elapses', () => {
    const onTimeout = vi.fn()
    let secondsLeft = 45
    let isRunning = true

    const interval = setInterval(() => {
      if (secondsLeft <= 1) {
        clearInterval(interval)
        isRunning = false
        onTimeout()
        secondsLeft = 0
      } else {
        secondsLeft -= 1
      }
    }, 1000)

    // Avança 20 segundos
    vi.advanceTimersByTime(20000)
    expect(secondsLeft).toBe(25)
    expect(onTimeout).not.toHaveBeenCalled()
    expect(isRunning).toBe(true)

    // Avança os 25 segundos restantes
    vi.advanceTimersByTime(25000)
    expect(secondsLeft).toBe(0)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(isRunning).toBe(false)
  })

  it('allows manual stop before timeout without calling onTimeout', () => {
    const onTimeout = vi.fn()
    let secondsLeft = 45
    let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      secondsLeft -= 1
    }, 1000)

    // Avança 10s
    vi.advanceTimersByTime(10000)
    expect(secondsLeft).toBe(35)

    // Prestador aceita o chamado (stop manual)
    clearInterval(interval!)
    interval = null

    // Avança mais 50s
    vi.advanceTimersByTime(50000)
    expect(secondsLeft).toBe(35)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
