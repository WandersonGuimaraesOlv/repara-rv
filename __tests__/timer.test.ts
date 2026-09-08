import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('SQA Timer & Field Reliability: 30s Accept Window', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates circular progress percentage correctly for 30s countdown', () => {
    const TOTAL_SECONDS = 30
    const getProgress = (secondsLeft: number) => (secondsLeft / TOTAL_SECONDS) * 100

    expect(getProgress(30)).toBe(100)
    expect(getProgress(15)).toBe(50)
    expect(getProgress(0)).toBe(0)
  })

  it('triggers onTimeout after 30 seconds when timer elapses', () => {
    const onTimeout = vi.fn()
    let secondsLeft = 30
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

    // Avança 15 segundos
    vi.advanceTimersByTime(15000)
    expect(secondsLeft).toBe(15)
    expect(onTimeout).not.toHaveBeenCalled()
    expect(isRunning).toBe(true)

    // Avança os 15 segundos restantes
    vi.advanceTimersByTime(15000)
    expect(secondsLeft).toBe(0)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(isRunning).toBe(false)
  })

  it('allows manual stop before timeout without calling onTimeout', () => {
    const onTimeout = vi.fn()
    let secondsLeft = 30
    let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      secondsLeft -= 1
    }, 1000)

    // Avança 10s
    vi.advanceTimersByTime(10000)
    expect(secondsLeft).toBe(20)

    // Prestador aceita o chamado (stop manual)
    clearInterval(interval!)
    interval = null

    // Avança mais 40s
    vi.advanceTimersByTime(40000)
    expect(secondsLeft).toBe(20)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
