'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Wrench, Phone, Lock, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    setPhone(digits)
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
    } catch (err: any) {
      setLoading(false)
      toast.error('Falha na conexão. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-orange-100 selection:text-orange-900">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 animate-fade-in">
        
        {/* Logo & Marca */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Wrench size={24} className="text-white" />
            </div>
            <div className="text-left">
              <span className="text-2xl font-black tracking-tight leading-none text-slate-900">
                Repara<span className="text-orange-600">RV</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">
                Rio Verde • GO
              </span>
            </div>
          </Link>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-4">
            Entrar ou Criar Conta
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Acesso instantâneo com seu celular e PIN de segurança
          </p>
        </div>

        {/* Formulário com Celular + PIN */}
        <form onSubmit={handlePinLogin} className="space-y-4">
          
          {/* Celular */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Celular com DDD
            </label>
            <div className="relative flex items-center">
              <Phone size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="input-phone"
                type="tel"
                value={formatDisplayPhone(phone)}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="(64) 99999-9999"
                className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                inputMode="numeric"
                required
                autoFocus
              />
            </div>
          </div>

          {/* PIN de Segurança */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                PIN de Acesso (4 a 6 dígitos)
              </label>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium"
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPin ? 'Ocultar' : 'Ver'}</span>
              </button>
            </div>
            
            <div className="relative flex items-center">
              <Lock size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="input-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Ex: 1234"
                className="w-full pl-10 pr-10 py-3.5 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-base font-mono tracking-widest text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                inputMode="numeric"
                required
                maxLength={6}
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
              💡 <strong>Primeiro acesso?</strong> O PIN digitado será cadastrado como sua senha pessoal.
            </p>
          </div>

          {/* Botão de Submissão */}
          <button
            type="submit"
            id="btn-login-pin"
            disabled={loading || phone.length < 10 || pin.length < 4}
            className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-sm font-bold shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 mt-3 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <span>Acessar Repara RV</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Rodapé Legal */}
        <p className="text-[11px] text-center text-slate-400 mt-6 leading-relaxed">
          Seus dados são protegidos conforme a LGPD.<br />
          Repara RV • Rio Verde (GO)
        </p>

      </div>
    </div>
  )
}
