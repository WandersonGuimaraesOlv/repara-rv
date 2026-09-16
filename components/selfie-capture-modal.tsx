'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, Check, X, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface SelfieCaptureModalProps {
  onClose: () => void
  onSuccess: (avatarUrl: string) => void
}

// Captura de selfie de verificação via getUserMedia — parte da verificação
// de identidade do prestador (ver app/api/profile/selfie/route.ts). Câmera
// frontal por padrão (facingMode 'user'), captura num <canvas> e envia como
// JPEG. Sem upload de arquivo do dispositivo de propósito — tem que ser uma
// foto tirada na hora, não uma imagem qualquer escolhida da galeria.
export function SelfieCaptureModal({ onClose, onSuccess }: SelfieCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<'loading' | 'live' | 'preview' | 'uploading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setPhase('live')
      } catch (err) {
        console.error('Erro ao acessar câmera:', err)
        setErrorMessage('Não foi possível acessar sua câmera. Verifique as permissões do navegador.')
        setPhase('error')
      }
    }
    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(blob => {
      if (!blob) return
      setCapturedBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      setPhase('preview')
    }, 'image/jpeg', 0.85)
  }

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCapturedBlob(null)
    setPhase('live')
  }

  const handleConfirm = async () => {
    if (!capturedBlob) return
    setPhase('uploading')

    try {
      const formData = new FormData()
      formData.append('selfie', capturedBlob, 'selfie.jpg')

      const res = await fetch('/api/profile/selfie', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || 'Erro ao enviar a foto. Tente novamente.')
        setPhase('preview')
        return
      }

      toast.success('Selfie enviada! Seu cadastro voltou pra análise.')
      onSuccess(data.avatar_url)
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
      setPhase('preview')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(7, 16, 15, 0.9)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5 shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>
            Selfie de Verificação
          </h3>
          <button type="button" onClick={onClose} style={{ color: 'var(--color-text-subtle)' }}>
            <X size={18} />
          </button>
        </div>

        <div
          className="relative w-full aspect-square rounded-2xl overflow-hidden mb-4 flex items-center justify-center"
          style={{ background: '#000' }}
        >
          {phase === 'loading' && <Loader2 size={28} className="animate-spin text-white" />}

          {phase === 'error' && (
            <div className="p-4 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--color-warning)' }} />
              <p className="text-xs text-white">{errorMessage}</p>
            </div>
          )}

          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ display: phase === 'live' ? 'block' : 'none', transform: 'scaleX(-1)' }}
            playsInline
            muted
          />

          {previewUrl && phase === 'preview' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selfie capturada" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          )}

          {phase === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <p className="text-[11px] text-center mb-4" style={{ color: 'var(--color-text-subtle)' }}>
          Tire uma foto do seu rosto com boa iluminação, sem óculos escuros ou boné. Ela é usada só pra o cliente conferir sua identidade no atendimento.
        </p>

        {phase === 'live' && (
          <button type="button" id="btn-take-selfie" onClick={handleCapture} className="btn-primary">
            <Camera size={18} /> Capturar Foto
          </button>
        )}

        {phase === 'preview' && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" id="btn-retake-selfie" onClick={handleRetake} className="btn-secondary">
              <RotateCcw size={16} /> Tentar de novo
            </button>
            <button type="button" id="btn-confirm-selfie" onClick={handleConfirm} className="btn-primary">
              <Check size={16} /> Usar esta foto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
