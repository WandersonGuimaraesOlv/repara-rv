'use client'

import { useState } from 'react'
import { ShieldAlert, PhoneCall, X, Loader2, AlertTriangle, MapPin } from 'lucide-react'
import { isEmergencySosActive } from '@/lib/utils'
import { toast } from 'sonner'

interface EmergencySosButtonProps {
  callId: string
  userRole: 'client' | 'provider'
  status: string
  clientAddress?: string
  clientLocation?: { coordinates?: [number, number] }
}

export function EmergencySosButton({
  callId,
  userRole,
  status,
  clientAddress,
  clientLocation,
}: EmergencySosButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)

  // O botão só fica visível durante accepted, on_the_way e in_progress
  if (!isEmergencySosActive(status)) {
    return null
  }

  const handleConfirmEmergency = async () => {
    setIsTriggering(true)

    let lat: number | undefined = clientLocation?.coordinates?.[1]
    let lng: number | undefined = clientLocation?.coordinates?.[0]

    // Tenta capturar geolocalização exata atual em até 2s antes do redirecionamento
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 2000,
            maximumAge: 10000,
          })
        })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        // Usa fallback das coordenadas do chamado
      }
    }

    // 1. Dispara rota /api/emergency/notify em segundo plano com keepalive
    try {
      fetch('/api/emergency/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          call_id: callId,
          user_role: userRole,
          latitude: lat,
          longitude: lng,
        }),
      }).catch(err => console.error('[Emergency SOS POST Error]', err))
    } catch (err) {
      console.error('[Emergency SOS Dispatch Error]', err)
    }

    toast.error('Alerta de emergência registrado! Abrindo discador 190...', {
      duration: 4000,
    })

    // 2. Redirecionamento nativo para o discador com 190
    window.location.href = 'tel:190'

    setTimeout(() => {
      setIsTriggering(false)
      setIsOpen(false)
    }, 1200)
  }

  return (
    <>
      {/* Botão Discreto de Segurança no Topo */}
      <button
        type="button"
        id="btn-open-sos-modal"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shadow-sm active:scale-95 group select-none cursor-pointer"
        style={{
          background: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.35)',
          color: '#F87171',
        }}
        title="Central de Segurança & Botão SOS"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <ShieldAlert size={14} className="text-red-400 group-hover:scale-110 transition-transform" />
        <span className="tracking-wide">SOS Emergência</span>
      </button>

      {/* Modal de Confirmação de Emergência */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 md:p-6 text-center space-y-4 shadow-2xl border animate-scale-in"
            style={{
              background: '#0F172A',
              borderColor: 'rgba(239, 68, 68, 0.45)',
            }}
          >
            {/* Ícone de Escudo em Destaque */}
            <div className="relative mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-red-500/20 border-2 border-red-500/40">
              <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20"></span>
              <AlertTriangle size={32} className="text-red-400 relative z-10" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold tracking-wider uppercase text-red-400">
                Central de Segurança Repara RV
              </span>
              <h2 className="text-lg md:text-xl font-bold text-white">
                Você está em situação de perigo?
              </h2>
            </div>

            <p className="text-xs md:text-sm text-slate-300 leading-relaxed text-left bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              ⚠️ <strong>Ao confirmar:</strong>
              <br />
              <span className="block mt-1">
                1. Seu telefone discará imediatamente para o <strong>190 (Polícia Militar)</strong>.
              </span>
              <span className="block mt-1">
                2. A equipe de plantão do Repara RV receberá alerta com seu GPS e os dados deste chamado para apoio imediato.
              </span>
            </p>

            {clientAddress && (
              <div className="flex items-center gap-2 text-xs text-slate-400 text-left px-1">
                <MapPin size={13} className="text-red-400 flex-shrink-0" />
                <span className="truncate">{clientAddress}</span>
              </div>
            )}

            {/* Ações */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                id="btn-confirm-sos-190"
                onClick={handleConfirmEmergency}
                disabled={isTriggering}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                }}
              >
                {isTriggering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Disparando Alerta & Ligando 190...</span>
                  </>
                ) : (
                  <>
                    <PhoneCall size={18} />
                    <span>Confirmar & Ligar 190 Agora</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-cancel-sos-modal"
                onClick={() => setIsOpen(false)}
                disabled={isTriggering}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancelar (Estou em Segurança)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
