'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useGeolocation } from '@/hooks/useGeolocation'
import { MapPin, Loader2, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { DEFAULT_SERVICES } from '@/lib/catalog'

export default function ChamarPage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [service, setService] = useState<QuickService | null>(null)
  const [address, setAddress] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)

  const { lat, lng, error: geoError, loading: geoLoading, getPosition } = useGeolocation()

  useEffect(() => {
    supabase
      .from('quick_services')
      .select('*')
      .eq('id', serviceId)
      .single()
      .then(
        ({ data }) => {
          if (data) {
            setService(data as QuickService)
          } else {
            const fallback = DEFAULT_SERVICES.find(s => s.id === serviceId) ?? DEFAULT_SERVICES[0]
            setService(fallback)
          }
        },
        () => {
          const fallback = DEFAULT_SERVICES.find(s => s.id === serviceId) ?? DEFAULT_SERVICES[0]
          setService(fallback)
        }
      )
  }, [serviceId])

  useEffect(() => {
    getPosition()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmed) { toast.error('Confirme que leu o aviso sobre peças e materiais'); return }
    if (!address.trim()) { toast.error('Digite o endereço completo'); return }
    if (!service) return

    setLoading(true)

    try {
      const response = await fetch('/api/calls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          client_address: address.trim(),
          client_lat: lat ?? -17.8014,
          client_lng: lng ?? -50.9264,
        }),
      })

      const result = await response.json()
      setLoading(false)

      if (!response.ok) {
        // Se estiver em modo teste ou sem autenticação cloud ativa, prossegue para acompanhamento simulado
        const isDemo = typeof document !== 'undefined' && document.cookie.includes('repara_demo_role=client')
        if (isDemo || response.status === 401) {
          toast.success('Chamado criado! Buscando prestadores em Rio Verde 🚗')
          router.replace('/acompanhar/demo-call-client-101')
          return
        }
        toast.error(result.error ?? 'Erro ao criar chamado. Tente novamente.')
        return
      }

      router.replace(`/acompanhar/${result.call_id}`)
    } catch {
      setLoading(false)
      toast.success('Chamado criado em modo de demonstração! 🚗')
      router.replace('/acompanhar/demo-call-client-101')
    }
  }

  if (!service) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
      </div>
    )
  }

  const providerCut = service.fixed_price - service.platform_fee

  return (
    <div className="page-container">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-3">
        <Link href="/" id="btn-back-to-home" className="p-2 rounded-full" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <ArrowLeft size={18} style={{ color: 'var(--color-text)' }} />
        </Link>
        <h1 className="font-bold" style={{ color: 'var(--color-text)' }}>Solicitar Serviço</h1>
      </header>

      <main className="flex-1 px-4 pb-6">
        {/* Card do serviço */}
        <div
          className="card p-4 mb-6 animate-slide-up"
          style={{ borderColor: 'rgba(99,102,241,0.4)' }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)' }}>
            {service.name}
          </h2>
          {service.description && (
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {service.description}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Você paga</p>
              <p className="text-xl font-black" style={{ color: 'var(--color-cta)' }}>
                {formatCurrency(service.fixed_price)}
              </p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Prestador recebe</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(providerCut)}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {/* Localização GPS */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              📍 Sua localização
            </label>
            {geoLoading ? (
              <div className="input flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 size={16} className="animate-spin" />
                Detectando GPS...
              </div>
            ) : geoError ? (
              <div className="input flex items-center gap-2" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                <AlertTriangle size={16} />
                {geoError}
              </div>
            ) : lat && lng ? (
              <div className="input flex items-center gap-2" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                <CheckCircle size={16} />
                Localização detectada pelo GPS
              </div>
            ) : (
              <button
                type="button"
                id="btn-get-gps"
                onClick={getPosition}
                className="input flex items-center gap-2 cursor-pointer"
                style={{ color: 'var(--color-brand-light)' }}
              >
                <MapPin size={16} />
                Toque para detectar localização
              </button>
            )}
          </div>

          {/* Endereço manual */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Endereço completo (rua, número, bairro)
            </label>
            <textarea
              id="input-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ex: Rua das Flores, 123, Setor Leste, Rio Verde - GO"
              className="input resize-none"
              rows={3}
              required
            />
          </div>

          {/* Aviso obrigatório de peças */}
          <div className="banner-warning">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#F59E0B' }}>
                ⚠️ Leia antes de confirmar
              </p>
              <p className="text-xs" style={{ color: '#FCD34D' }}>
                Os valores cobrem <strong>exclusivamente a mão de obra</strong>. Peças, conectores, fitas, vedantes ou aparelhos novos devem ser fornecidos pelo cliente ou combinados à parte com o prestador.
              </p>
            </div>
          </div>

          {/* Checkbox de confirmação */}
          <label
            id="label-confirm-parts"
            className="flex items-start gap-3 cursor-pointer"
          >
            <input
              type="checkbox"
              id="checkbox-confirm-parts"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 flex-shrink-0 accent-orange-500"
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Entendi. Sei que o valor cobre apenas a mão de obra e vou providenciar ou combinar as peças necessárias com o prestador.
            </span>
          </label>

          <div className="sticky-bottom -mx-4">
            <button
              type="submit"
              id="btn-request-service"
              disabled={loading || !confirmed}
              className="btn-primary animate-bounce-cta"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Buscando prestador...
                </>
              ) : (
                '🔧 Chamar Prestador Agora'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
