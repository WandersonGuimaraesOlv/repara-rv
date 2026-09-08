'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Wrench, Phone, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.length < 10) {
      toast.error('Digite um telefone válido com DDD')
      return
    }
    setLoading(true)
    const formattedPhone = `+55${phone}`
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    })
    setLoading(false)
    if (error) {
      toast.error('Erro ao enviar código. Verifique o número e tente novamente.')
      return
    }
    toast.success('Código enviado por SMS!')
    setStep('otp')
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      toast.error('O código tem 6 dígitos')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+55${phone}`,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setLoading(false)
      toast.error('Código inválido ou expirado. Tente novamente.')
      return
    }
    // Verifica se tem perfil cadastrado
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', data.user!.id)
      .single()

    setLoading(false)
    if (!profile) {
      router.replace('/onboarding')
    } else if (profile.role === 'provider') {
      router.replace('/painel')
    } else {
      router.replace('/')
    }
  }

  return (
    <div className="page-container items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-10 animate-slide-up">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          <Wrench size={36} color="white" />
        </div>
        <h1 className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>
          Repara<span style={{ color: 'var(--color-cta)' }}>RV</span>
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Deu problema em casa? O Repara RV resolve.
        </p>
      </div>

      {/* Card de login */}
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-slide-up"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          animationDelay: '100ms',
        }}
      >
        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
                Entrar / Criar conta
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Digite seu celular com DDD para receber o código de acesso.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Celular (com DDD)
              </label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-subtle)' }}
                />
                <input
                  id="input-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="62 99999-9999"
                  className="input pl-10"
                  inputMode="numeric"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-send-otp"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Enviando...' : (
                <>
                  Receber código SMS
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
                Digite o código
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Enviamos um código de 6 dígitos para{' '}
                <strong style={{ color: 'var(--color-brand-light)' }}>
                  ({phone.slice(0, 2)}) {phone.slice(2, 7)}-{phone.slice(7)}
                </strong>
              </p>
            </div>

            <input
              id="input-otp"
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input text-center text-2xl font-mono tracking-widest"
              inputMode="numeric"
              required
              autoFocus
              maxLength={6}
            />

            <button
              type="submit"
              id="btn-verify-otp"
              disabled={loading || otp.length !== 6}
              className="btn-primary"
            >
              {loading ? 'Verificando...' : 'Confirmar e entrar →'}
            </button>

            <button
              type="button"
              id="btn-back-to-phone"
              onClick={() => { setStep('phone'); setOtp('') }}
              className="text-sm w-full text-center mt-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Trocar número
            </button>
          </form>
        )}

        {/* Divisor */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full" style={{ borderTop: '1px solid var(--color-border)' }} />
          </div>
          <span
            className="relative px-3 text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-subtle)' }}
          >
            ou teste agora
          </span>
        </div>

        {/* Acesso Rápido / Demonstração */}
        <div className="space-y-2">
          <button
            type="button"
            id="btn-demo-provider"
            onClick={() => {
              document.cookie = 'repara_demo_role=provider; path=/; max-age=86400'
              toast.success('Entrando no Painel do Prestador!')
              router.push('/painel')
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--color-text)',
            }}
          >
            <div>
              <div className="text-xs font-bold text-indigo-400">⚡ Modo Prestador (Moto)</div>
              <div className="text-xs text-slate-400">Radar, alerta com som/vibração e Waze</div>
            </div>
            <ArrowRight size={16} className="text-indigo-400" />
          </button>

          <button
            type="button"
            id="btn-demo-client"
            onClick={() => {
              document.cookie = 'repara_demo_role=client; path=/; max-age=86400'
              toast.success('Entrando como Morador de Rio Verde!')
              router.push('/')
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              color: 'var(--color-text)',
            }}
          >
            <div>
              <div className="text-xs font-bold text-orange-400">🏠 Modo Morador / Cliente</div>
              <div className="text-xs text-slate-400">Catálogo com preço fixo e chamada rápida</div>
            </div>
            <ArrowRight size={16} className="text-orange-400" />
          </button>
        </div>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: 'var(--color-text-subtle)' }}>
        Ao continuar, você concorda com nossos termos de uso.<br />
        Repara RV — Rio Verde (GO)
      </p>
    </div>
  )
}
