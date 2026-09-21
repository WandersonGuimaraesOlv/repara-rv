'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QuickService } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useGeolocation } from '@/hooks/useGeolocation'
import { MapPin, Loader2, AlertTriangle, CheckCircle, ArrowLeft, CheckCircle2, XCircle, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { DEFAULT_SERVICES, getServiceScope } from '@/lib/catalog'
import { EnderecoForm, StructuredAddress } from '@/components/endereco-form'

export default function ChamarServicePage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [service, setService] = useState<QuickService | null>(null)
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [defaultNeighborhood, setDefaultNeighborhood] = useState<string | undefined>(undefined)
  const [profileChecked, setProfileChecked] = useState(false)

  const scope = useMemo(() => {
    return getServiceScope(service?.name)
  }, [service])

  const { lat, lng, error: geoError, loading: geoLoading, getPosition } = useGeolocation()

  // Limpa cookies residuais de teste antigo se existirem
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.cookie = 'repara_demo_role=; path=/; max-age=0'
    }
  }, [])

  useEffect(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)

    if (isUuid) {
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
    } else {
      const fallback = DEFAULT_SERVICES.find(s => s.id === serviceId) ?? DEFAULT_SERVICES[0]
      setService(fallback)
    }
  }, [serviceId, supabase])

  useEffect(() => {
    getPosition()
  }, [getPosition])

  // Pré-preenche o campo de bairro com o bairro registrado no cadastro do
  // cliente (via CEP), em vez do "Setor Central" fixo do EnderecoForm — o
  // GPS acima só captura lat/lng para o dispatch, nunca resolveu bairro.
  useEffect(() => {
    async function loadClientNeighborhood() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('neighborhood')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.neighborhood) {
          setDefaultNeighborhood(profile.neighborhood)
        }
      }
      setProfileChecked(true)
    }
    loadClientNeighborhood()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmed) {
      toast.error('Confirme que leu o aviso sobre peças e materiais')
      return
    }
    if (!structuredAddress) {
      toast.error('Preencha o endereço completo (Bairro, Rua, Número e Ponto de Referência)')
      return
    }
    if (!service) return

    setLoading(true)

    try {
      // Verifica se o usuário cliente está autenticado
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()

      if (!user) {
        setLoading(false)
        toast.info('Acesse com seu celular para chamar o prestador.')
        router.push(`/login?redirect=/chamar/${service.id}`)
        return
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/calls/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          service_id: service.id,
          client_id: user.id,
          client_address: structuredAddress.fullAddress,
          neighborhood: structuredAddress.neighborhood,
          client_lat: lat ?? -17.7915,
          client_lng: lng ?? -50.9192,
        }),
      })

      const result = await response.json()
      setLoading(false)

      if (!response.ok) {
        toast.error(result.error ?? 'Erro ao solicitar prestador. Tente novamente.')
        return
      }

      toast.success('Chamado criado! Conectando com prestador em Rio Verde')
      router.replace(`/acompanhar/${result.call_id}`)
    } catch (err) {
      setLoading(false)
      console.error('Erro ao chamar prestador:', err)
      toast.error('Erro de conexão ao enviar chamado. Tente novamente.')
    }
  }

  if (!service || !profileChecked) {
    return (
      <div className="page-container items-center justify-center">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
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
          style={{ borderColor: 'var(--color-border-strong)' }}
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
              style={{ background: 'var(--color-primary-soft)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Você paga</p>
              <p className="text-xl font-black" style={{ color: 'var(--color-accent)' }}>
                {formatCurrency(service.fixed_price)}
              </p>
            </div>
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Mão de obra</p>
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
              <MapPin size={13} strokeWidth={2} className="inline-block shrink-0 -mt-0.5 mr-1" aria-hidden="true" />Sua localização
            </label>
            {geoLoading ? (
              <div className="input flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
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
                style={{ color: 'var(--color-primary)' }}
              >
                <MapPin size={16} />
                Toque para detectar localização
              </button>
            )}
          </div>

          {/* Endereço Inteligente Estruturado */}
          <EnderecoForm onAddressChange={setStructuredAddress} initialNeighborhood={defaultNeighborhood} />

          {/* Escopo Claro: O que está incluso vs Não incluso */}
          <div className="space-y-2 pt-1 text-left">
            <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Escopo do Atendimento (Transparência Total)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Bloco Verde: Incluso */}
              <div
                className="p-3.5 rounded-2xl text-left"
                style={{
                  background: 'rgba(94, 211, 164, 0.08)',
                  border: '1px solid rgba(94, 211, 164, 0.2)',
                }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle2 size={15} className="shrink-0" style={{ color: 'var(--color-success)' }} />
                  <span>O que está incluso:</span>
                </div>
                <ul className="space-y-1.5">
                  {scope.included.map((item, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-1.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="font-bold" style={{ color: 'var(--color-success)' }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bloco Vermelho: Não Incluso */}
              <div
                className="p-3.5 rounded-2xl text-left"
                style={{
                  background: 'rgba(244, 124, 124, 0.08)',
                  border: '1px solid rgba(244, 124, 124, 0.2)',
                }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--color-danger)' }}>
                  <XCircle size={15} className="shrink-0" style={{ color: 'var(--color-danger)' }} />
                  <span>O que NÃO está incluso:</span>
                </div>
                <ul className="space-y-1.5">
                  {scope.not_included.map((item, idx) => (
                    <li key={idx} className="text-xs flex items-start gap-1.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="font-bold" style={{ color: 'var(--color-danger)' }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Aviso obrigatório de peças */}
          <div className="banner-warning">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#F59E0B' }}>
                Leia antes de confirmar
              </p>
              <p className="text-xs" style={{ color: '#FCD34D' }}>
                Os valores cobrem <strong>exclusivamente a mão de obra</strong>. Peças, conectores, fitas, vedantes ou aparelhos novos devem ser fornecidos pelo cliente ou combinados à parte com o prestador.
              </p>
            </div>
          </div>

          {/* Checkbox de confirmação */}
          <label
            htmlFor="checkbox-confirm-parts"
            className="flex items-start gap-3 cursor-pointer"
          >
            <input
              type="checkbox"
              id="checkbox-confirm-parts"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 flex-shrink-0 accent-green-600"
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Entendi. Sei que o valor cobre apenas a mão de obra e vou providenciar ou combinar as peças necessárias com o prestador.
            </span>
          </label>

          <div className="sticky-bottom w-full">
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
                <>
                  <Wrench size={18} strokeWidth={2} aria-hidden="true" />
                  Chamar Prestador Agora
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
