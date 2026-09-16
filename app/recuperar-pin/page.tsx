'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Phone, Lock, KeyRound, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { normalizeBrazilianPhone } from '@/lib/utils'

export default function RecuperarPinPage() {
  const router = useRouter()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (value: string) => {
    setPhone(normalizeBrazilianPhone(value))
  }

  const formatDisplayPhone = (digits: string) => {
    if (!digits) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.length < 10) {
      toast.error('Digite um celular válido com DDD')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const json = await res.json()
      setLoading(false)

      if (!res.ok || json.error) {
        toast.error(json.error || 'Erro ao solicitar código. Tente novamente.')
        return
      }

      toast.success(json.message || 'Se esse celular tiver conta com e-mail cadastrado, você recebeu um código.')
      setStep('code')
    } catch {
      setLoading(false)
      toast.error('Falha de conexão. Verifique sua internet e tente novamente.')
    }
  }

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!/^\d{6}$/.test(code)) {
      toast.error('Digite o código de 6 dígitos recebido por e-mail')
      return
    }
    if (newPin.length < 4) {
      toast.error('O novo PIN deve ter pelo menos 4 dígitos')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Os PINs digitados não coincidem')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, newPin }),
      })
      const json = await res.json()
      setLoading(false)

      if (!res.ok || json.error) {
        toast.error(json.error || 'Erro ao redefinir PIN. Tente novamente.')
        return
      }

      toast.success('PIN redefinido com sucesso! Faça login com o novo PIN.')
      router.push(`/login?phone=${phone}`)
    } catch {
      setLoading(false)
      toast.error('Falha de conexão. Verifique sua internet e tente novamente.')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 sm:p-8 animate-fade-in"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center transition-opacity hover:opacity-85">
            <Logo variant="full" width={180} height={46} />
          </Link>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-4" style={{ color: 'var(--color-text)' }}>
            Recuperar PIN
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {step === 'phone'
              ? 'Informe seu celular cadastrado para receber um código por e-mail'
              : 'Digite o código recebido e crie um novo PIN'}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label htmlFor="recuperar-phone" className="label">Celular com DDD</label>
              <div className="relative flex items-center">
                <Phone size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
                <input
                  id="recuperar-phone"
                  type="tel"
                  value={formatDisplayPhone(phone)}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="(64) 99999-9999"
                  className="input pl-11"
                  inputMode="numeric"
                  required
                  autoFocus
                  autoComplete="tel"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || phone.length < 10} className="btn-primary mt-2">
              {loading ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <span>Enviar Código por E-mail</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label htmlFor="recuperar-code" className="label">Código recebido por e-mail</label>
              <div className="relative flex items-center">
                <KeyRound size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
                <input
                  id="recuperar-code"
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input pl-11 tracking-widest font-mono"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="recuperar-new-pin" className="label mb-0">Novo PIN</label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                    style={{ color: 'var(--color-text-subtle)' }}
                  >
                    {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
                  <input
                    id="recuperar-new-pin"
                    type={showPin ? 'text' : 'password'}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Ex: 4827"
                    className="input pl-10 tracking-widest font-mono"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="recuperar-confirm-pin" className="label">Confirmar PIN</label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
                  <input
                    id="recuperar-confirm-pin"
                    type={showPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Repita o PIN"
                    className="input pl-10 tracking-widest font-mono"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary mt-2">
              {loading ? <span>Salvando...</span> : <span>Redefinir PIN</span>}
            </button>

            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              <ArrowLeft size={13} />
              Usar outro celular / pedir novo código
            </button>
          </form>
        )}

        <div
          className="text-center mt-6 pt-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Lembrou o PIN?{' '}
            <Link href="/login" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
              Fazer Login
            </Link>
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="mt-4 mb-6 text-xs font-medium hover:underline transition-colors"
        style={{ color: 'var(--color-text-subtle)' }}
      >
        ← Voltar para o início
      </Link>
    </div>
  )
}
