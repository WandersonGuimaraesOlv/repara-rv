'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Phone, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { normalizeBrazilianPhone } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
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

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (phone.length < 10) {
      toast.error('Digite um telefone celular válido com DDD (10 ou 11 dígitos)')
      return
    }

    if (pin.length < 4) {
      toast.error('O PIN de segurança deve ter pelo menos 4 dígitos')
      return
    }

    setLoading(true)

    try {
      // 1. Chama a API de PIN para verificar ou criar usuário no Supabase
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setLoading(false)
        toast.error(json.error || 'Erro ao processar autenticação.')
        return
      }

      // 2. Faz o login no Supabase client usando a credencial gerada
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: json.password,
      })

      if (signInError) {
        setLoading(false)
        toast.error('PIN incorreto para este celular. Digite seu PIN cadastrado.')
        return
      }

      // 3. Verifica se o usuário já possui perfil cadastrado
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name, phone')
        .eq('id', data.user!.id)
        .maybeSingle()

      setLoading(false)

      if (profile) {
        try {
          localStorage.setItem('repara_user', JSON.stringify({
            id: profile.id,
            role: profile.role,
            full_name: profile.full_name,
            phone: profile.phone || phone,
          }))
        } catch {}
      }

      if (json.isNew || !profile) {
        toast.success('Acesso liberado! Vamos completar seu cadastro 🎉')
        router.replace('/onboarding')
      } else if (profile.role === 'provider') {
        toast.success(`Bem-vindo de volta, ${profile.full_name || 'Profissional'}! ⚡`)
        router.replace('/painel')
      } else {
        toast.success(`Bem-vindo de volta, ${profile.full_name || 'Cliente'}! 🏠`)
        router.replace('/')
      }
    } catch {
      setLoading(false)
      toast.error('Falha na conexão. Tente novamente.')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Card central */}
      <div
        className="w-full max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 animate-fade-in"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >

        {/* Logo & Título */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center transition-opacity hover:opacity-85">
            <Logo variant="full" width={180} height={46} />
          </Link>
          <h1 className="text-xl font-black tracking-tight mt-4" style={{ color: 'var(--color-text)' }}>
            Acesse sua Conta
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Acesso com seu celular e PIN de segurança
          </p>
        </div>

        {/* Abas: Entrar vs Criar Conta */}
        <div
          className="flex p-1 rounded-2xl mb-6"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            Entrar
          </button>
          <Link
            href="/cadastro"
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Criar Nova Conta
          </Link>
        </div>

        {/* Formulário */}
        <form onSubmit={handlePinLogin} className="space-y-4">

          {/* Celular */}
          <div>
            <label htmlFor="input-phone" className="label">
              Celular com DDD
            </label>
            <div className="relative flex items-center">
              <Phone size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="input-phone"
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

          {/* PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="input-pin" className="label mb-0">
                PIN de Acesso (4 a 6 dígitos)
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPin ? 'Ocultar' : 'Ver'}</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="input-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Ex: 1234"
                className="input pl-11 tracking-widest font-mono"
                inputMode="numeric"
                required
                maxLength={6}
                autoComplete="current-password"
              />
            </div>
            <p className="text-[11px] mt-2 leading-snug" style={{ color: 'var(--color-text-subtle)' }}>
              💡 <strong>Primeiro acesso?</strong> Você pode{' '}
              <Link href="/cadastro" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                clicar aqui para se cadastrar
              </Link>.
            </p>
            <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--color-text-subtle)' }}>
              <Link
                href="/recuperar-pin"
                className="font-bold hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Esqueci meu PIN
              </Link>{' '}— recupere por e-mail em segundos.
            </p>
          </div>

          {/* Botão de Submissão */}
          <button
            type="submit"
            id="btn-login-pin"
            disabled={loading || phone.length < 10 || pin.length < 4}
            className="btn-primary mt-2"
          >
            {loading ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <span>Entrar no Repara RV</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Link para cadastro */}
        <div
          className="text-center mt-6 pt-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ainda não possui cadastro?{' '}
            <Link
              href="/cadastro"
              className="font-bold hover:underline inline-flex items-center gap-1"
              style={{ color: 'var(--color-primary)' }}
            >
              Criar conta grátis →
            </Link>
          </p>
        </div>

        {/* Rodapé Legal */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <ShieldCheck size={14} style={{ color: 'var(--color-text-subtle)' }} />
          <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>
            Seus dados são protegidos conforme a LGPD. Repara RV • Rio Verde (GO)
          </p>
        </div>

      </div>

      {/* Link de volta para o início */}
      <Link
        href="/"
        className="mt-6 text-xs font-medium hover:underline transition-colors"
        style={{ color: 'var(--color-text-subtle)' }}
      >
        ← Voltar para o início
      </Link>
    </div>
  )
}
