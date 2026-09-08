/**
 * Gera um arquivo de áudio de alerta MP3 simples para o Repara RV.
 * Cria um arquivo WAV com beeps para uso como alerta de chamado.
 * 
 * Execute: node scripts/generate-alert-sound.js
 */

const fs = require('fs')
const path = require('path')

// Gera WAV PCM 16-bit, 44100 Hz, Mono
function generateAlertWav() {
  const sampleRate = 44100
  const duration = 1.5 // segundos
  const numSamples = Math.floor(sampleRate * duration)
  
  // Cabeçalho WAV
  const buffer = Buffer.alloc(44 + numSamples * 2)
  
  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + numSamples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20)  // PCM format
  buffer.writeUInt16LE(1, 22)  // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32)  // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(numSamples * 2, 40)
  
  // Gera padrão de beep: 3 pulsos de 880Hz
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    let sample = 0
    
    // Beep 1: 0.0 - 0.2s
    if (t < 0.2) {
      sample = Math.sin(2 * Math.PI * 880 * t) * 0.7
      sample *= Math.min(t / 0.01, 1) * Math.min((0.2 - t) / 0.02, 1) // envelope
    }
    // Silêncio: 0.2 - 0.3s
    // Beep 2: 0.3 - 0.5s
    else if (t >= 0.3 && t < 0.5) {
      sample = Math.sin(2 * Math.PI * 1100 * t) * 0.8
      sample *= Math.min((t - 0.3) / 0.01, 1) * Math.min((0.5 - t) / 0.02, 1)
    }
    // Silêncio: 0.5 - 0.6s
    // Beep 3: 0.6 - 0.9s (mais longo, tom mais alto)
    else if (t >= 0.6 && t < 0.9) {
      sample = Math.sin(2 * Math.PI * 1320 * t) * 0.9
      sample *= Math.min((t - 0.6) / 0.01, 1) * Math.min((0.9 - t) / 0.03, 1)
    }
    
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)))
    buffer.writeInt16LE(int16, 44 + i * 2)
  }
  
  return buffer
}

const outputPath = path.join(__dirname, '..', 'public', 'sounds', 'alert.wav')
fs.writeFileSync(outputPath, generateAlertWav())
console.log('✅ Arquivo de alerta gerado:', outputPath)
console.log('ℹ️  Renomeie para alert.mp3 ou use um arquivo MP3 real para melhor compatibilidade.')
