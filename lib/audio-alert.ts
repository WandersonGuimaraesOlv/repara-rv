// lib/audio-alert.ts
// Alerta sonoro de alta prioridade via Web Audio API (zero dependências externas / sem risco de 404 de MP3)

class AudioAlertService {
  private ctx: AudioContext | null = null
  private isPlaying = false
  private intervalId: any = null

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null

    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }

    return this.ctx
  }

  // Desbloqueia o áudio no primeiro toque do prestador (ex: botão Ficar Online ou Testar Som)
  public unlockAudio(): void {
    const ctx = this.getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  }

  // Toca um tom único com frequência, duração e rampa de ganho suaves
  private playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', gainLevel = 0.3): void {
    const ctx = this.getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)

      gain.gain.setValueAtTime(gainLevel, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + durationMs / 1000)
    } catch (err) {
      console.warn('[AudioAlert] Falha ao sintetizar tom:', err)
    }
  }

  // Toca a sequência padrão de chamado: dois bipes rápidos (880Hz e 1200Hz)
  public playCallChime(): void {
    this.playTone(880, 140, 'triangle', 0.4)
    setTimeout(() => {
      this.playTone(1200, 200, 'triangle', 0.45)
    }, 160)
  }

  // Inicia o alarme contínuo em loop (toca a cada 1.4 segundos até o técnico aceitar ou recusar)
  public startAlarm(): void {
    if (this.isPlaying) return

    this.unlockAudio()
    this.isPlaying = true

    // Toca imediatamente
    this.playCallChime()

    // Mantém o loop
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        this.playCallChime()
      }
    }, 1300)

    console.log('🚨 [AudioAlert] Alarme de chamado ativado.')
  }

  // Para o alarme imediatamente
  public stopAlarm(): void {
    if (!this.isPlaying && !this.intervalId) return

    this.isPlaying = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    console.log('🔇 [AudioAlert] Alarme de chamado silenciado.')
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }
}

export const audioAlert = new AudioAlertService()
