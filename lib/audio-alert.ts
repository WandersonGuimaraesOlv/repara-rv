// lib/audio-alert.ts
// Sistema de alerta sonoro e vibratório de alta confiabilidade para Android e iOS (Safari/Chrome)
// Utiliza arquitetura Dual-Engine: HTML5 Audio com WAV Base64 auto-contido + Web Audio API Synthesizer + Vibração

import { CHIME_DATA_URI } from './sound-data'

class AudioAlertService {
  private ctx: AudioContext | null = null
  private htmlAudio: HTMLAudioElement | null = null
  private isPlaying = false
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      // Pré-inicializa o elemento HTML5 Audio
      this.initHtmlAudio()

      // Registra desbloqueio automático no primeiro toque/clique em qualquer lugar da tela
      const autoUnlock = () => {
        this.unlockAudio().catch(() => {})
        window.removeEventListener('click', autoUnlock)
        window.removeEventListener('touchstart', autoUnlock)
      }
      window.addEventListener('click', autoUnlock, { passive: true })
      window.addEventListener('touchstart', autoUnlock, { passive: true })
    }
  }

  private initHtmlAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null
    if (!this.htmlAudio) {
      try {
        this.htmlAudio = new Audio(CHIME_DATA_URI)
        this.htmlAudio.preload = 'auto'
        this.htmlAudio.volume = 1.0
      } catch (err) {
        console.warn('[AudioAlert] Erro ao instanciar HTMLAudioElement:', err)
      }
    }
    return this.htmlAudio
  }

  // Obtém ou inicializa o AudioContext, garantindo que saia do estado suspended
  private async getRunningContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null

    try {
      if (!this.ctx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass()
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }

      return this.ctx
    } catch (err) {
      console.warn('[AudioAlert] Falha ao obter AudioContext ativo:', err)
      return null
    }
  }

  // Desbloqueia totalmente os subsistemas de áudio em navegadores mobile (iOS e Android)
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    try {
      // 1. Desbloqueio Web Audio (resume + reprodução de 1 sample silencioso para WebKit)
      const ctx = await this.getRunningContext()
      if (ctx) {
        const buffer = ctx.createBuffer(1, 1, 22050)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start(0)
      }

      // 2. Desbloqueio HTML5 Audio (play e pause instantâneo)
      const audio = this.initHtmlAudio()
      if (audio) {
        audio.currentTime = 0
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.pause()
              audio.currentTime = 0
            })
            .catch(() => {})
        }
      }

      return true
    } catch (err) {
      console.warn('[AudioAlert] Aviso durante unlockAudio:', err)
      return false
    }
  }

  // Síntese de tom via Web Audio API com rampas lineares (100% imune a crashes no iOS Safari)
  private async playSynthesizedTone(
    freq: number,
    durationMs: number,
    type: OscillatorType = 'triangle',
    gainLevel = 0.7
  ): Promise<void> {
    const ctx = await this.getRunningContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      const startTime = ctx.currentTime + 0.01
      const stopTime = startTime + durationMs / 1000

      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.02)
      gain.gain.linearRampToValueAtTime(0.001, stopTime)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(stopTime)
    } catch (err) {
      console.warn('[AudioAlert] Falha ao sintetizar tom Web Audio:', err)
    }
  }

  // Toca o chime de chamado (binaural alto e cristalino: 880Hz -> 1320Hz)
  public async playCallChime(): Promise<void> {
    // 1. Tátil: Vibração em Android
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([180, 80, 180])
      } catch {}
    }

    // 2. Motor 1: HTML5 Audio (reproduz WAV master em base64 auto-contido)
    let htmlPlayed = false
    try {
      const audio = this.initHtmlAudio()
      if (audio) {
        audio.currentTime = 0
        const p = audio.play()
        if (p !== undefined) {
          await p
          htmlPlayed = true
        }
      }
    } catch (err) {
      console.warn('[AudioAlert] HTML5 Audio play aviso:', err)
    }

    // 3. Motor 2: Web Audio API Synthesizer (reforço imediato com harmônicos)
    try {
      await this.playSynthesizedTone(880, 180, 'triangle', 0.6)
      await new Promise(r => setTimeout(r, 130))
      await this.playSynthesizedTone(1320, 260, 'triangle', 0.75)
    } catch (err) {
      if (!htmlPlayed) {
        console.warn('[AudioAlert] Ambos os motores falharam:', err)
      }
    }
  }

  // Inicia alarme contínuo (loop a cada 1.4s) para chamado urgente
  public startAlarm(): void {
    if (this.isPlaying) return

    this.isPlaying = true
    this.unlockAudio().catch(() => {})

    // Vibração de alerta no Android
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 400, 150, 800])
      } catch {}
    }

    // Toca imediatamente
    this.playCallChime().catch(() => {})

    // Mantém loop
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([300, 100, 300])
          } catch {}
        }
        this.playCallChime().catch(() => {})
      }
    }, 1400)

    console.log('🚨 [AudioAlert] Alarme de chamado ativado.')
  }

  // Para o alarme imediatamente
  public stopAlarm(): void {
    this.isPlaying = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause()
        this.htmlAudio.currentTime = 0
      } catch {}
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0)
      } catch {}
    }

    console.log('🔇 [AudioAlert] Alarme de chamado silenciado.')
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }
}

export const audioAlert = new AudioAlertService()
