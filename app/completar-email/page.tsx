'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

// Achado (16/09/2026): o e-mail só virou obrigatório no cadastro a partir da
// feature de "cadastro obrigatório de e-mail" desta mesma sessão — contas
// criadas antes disso ficaram com profiles.email nulo, e o login nunca
// checava isso, deixando essas contas acessarem o app pra sempre sem e-mail
// (sem recuperação de PIN por e-mail possível). Este gate força o
// preenchimento na próxima vez que a conta acessa, antes de liberar o
// destino normal — ver app/login/page.tsx e app/painel/page.tsx.
export default function CompletarEmailPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setCheckingSession(false)
    })
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Digite um e-mail válido')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      router.replace('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ email: cleanEmail })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      toast.error('Erro ao salvar e-mail. Tente novamente.')
      return
    }

    toast.success('E-mail cadastrado com sucesso!')
    const role = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('role') : null
    router.replace(role === 'provider' ? '/painel' : '/')
  }

  if (checkingSession) return null

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
          <div className="inline-flex items-center justify-center">
            <Logo variant="full" width={180} height={46} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-4" style={{ color: 'var(--color-text)' }}>
            Complete seu Cadastro
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Seu e-mail ainda não está cadastrado. Ele é obrigatório para recuperação de PIN e avisos importantes da sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="completar-email" className="label">E-mail</label>
            <div className="relative flex items-center">
              <Mail size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="completar-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input pl-11"
                required
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !email.trim()} className="btn-primary mt-2">
            {loading ? (
              <span>Salvando...</span>
            ) : (
              <>
                <span>Salvar e Continuar</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-5">
          <ShieldCheck size={14} style={{ color: 'var(--color-text-subtle)' }} />
          <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--color-text-subtle)' }}>
            Seus dados são protegidos conforme a LGPD. Repara RV • Rio Verde (GO)
          </p>
        </div>
      </div>
    </div>
  )
}
