'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types'
import { User, Wrench, ChevronRight, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [cpfOrCnpj, setCpfOrCnpj] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('phone')
  // Achado de compliance (14/09/2026): estava true por padrão — o checkbox de
  // aceite renderizava pré-marcado, permitindo cadastro sem consentimento
  // ativo. Contraria diretamente o AGENTS.md ("sempre iniciar desmarcado...
  // Nunca pré-marcar") e o requisito de consentimento informado da LGPD.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [selfDeclaration, setSelfDeclaration] = useState(false)
  const [loading, setLoading] = useState(false)

  // Pré-preenchimento para usuários existentes e leitura de ?role=provider
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('role') === 'provider') {
        setRole('provider')
      }
    }

    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/cadastro')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        if (profile.full_name) setFullName(profile.full_name)
        if (profile.phone) setPhone(profile.phone)
        if (profile.cpf_or_cnpj) setCpfOrCnpj(profile.cpf_or_cnpj)
      }
    }
    loadUserData()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Digite seu nome completo'); return }
    if (!phone.trim()) { toast.error('Digite seu telefone celular'); return }
    if (!cpfOrCnpj.trim()) { toast.error('Informe seu CPF ou CNPJ MEI'); return }
    if (!termsAccepted) { toast.error('Você deve aceitar os Termos de Uso e Política de Privacidade.'); return }
    if (role === 'provider' && !pixKey.trim()) { toast.error('Informe sua chave Pix para receber seus pagamentos.'); return }
    if (role === 'provider' && !selfDeclaration) {
      toast.error('É obrigatório assinar a autodeclaração de aptidão técnica para atuar no Repara RV.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/cadastro'); return }

    const profilePayload: Record<string, any> = {
      id: user.id,
      role,
      full_name: fullName.trim(),
      phone: phone.trim(),
      cpf_or_cnpj: cpfOrCnpj.trim(),
      terms_accepted_at: new Date().toISOString(),
      self_declaration_signed: role === 'provider' ? selfDeclaration : true,
      background_check_status: 'approved',
    }

    let { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload)

    // Fallback resiliente caso as colunas novas ainda não estejam criadas no Supabase
    if (profileError && profileError.code === 'PGRST204') {
      delete profilePayload.cpf_or_cnpj
      delete profilePayload.terms_accepted_at
      delete profilePayload.self_declaration_signed
      delete profilePayload.background_check_status
      const retry = await supabase.from('profiles').upsert(profilePayload)
      profileError = retry.error
    }

    if (profileError) {
      setLoading(false)
      toast.error('Erro ao salvar perfil. Tente novamente.')
      return
    }

    if (role === 'provider') {
      await supabase.from('provider_status').upsert({
        provider_id: user.id,
        is_online: false,
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
      })
    }

    setLoading(false)
    try {
      localStorage.setItem('repara_user', JSON.stringify({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
      }))
    } catch {}
    toast.success('Perfil criado! Bem-vindo ao Repara RV 🎉')
    router.replace(role === 'provider' ? '/painel' : '/')
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
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--color-primary)', boxShadow: 'var(--shadow-primary)' }}
          >
            <Wrench size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
            Complete seu Perfil 🚀
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Onboarding rápido e sem atrito para Rio Verde (GO)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Seleção de Papel */}
          <div>
            <label className="label">Selecione seu perfil</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'client', label: 'Cliente', desc: 'Contratar reparos', Icon: User },
                { value: 'provider', label: 'Prestador', desc: 'Atender chamados', Icon: Wrench },
              ] as const).map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  id={`role-${value}`}
                  onClick={() => setRole(value)}
                  className="p-4 rounded-2xl text-left transition-all flex flex-col gap-1.5"
                  style={{
                    border: `2px solid ${role === value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: role === value ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)',
                  }}
                  aria-pressed={role === value}
                >
                  <Icon size={20} style={{ color: role === value ? 'var(--color-primary)' : 'var(--color-text-subtle)' }} />
                  <p className="font-bold text-sm mt-1.5" style={{ color: 'var(--color-text)' }}>{label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Nome Completo */}
          <div>
            <label htmlFor="input-full-name" className="label">Nome Completo</label>
            <input
              id="input-full-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="input"
              required
              autoFocus
              autoComplete="name"
            />
          </div>

          {/* Celular / WhatsApp */}
          <div>
            <label htmlFor="input-onboarding-phone" className="label">Celular (com DDD)</label>
            <input
              id="input-onboarding-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Ex: 64 99999-9999"
              className="input"
              inputMode="numeric"
              required
              autoComplete="tel"
            />
          </div>

          {/* CPF ou CNPJ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="input-cpf-cnpj" className="label mb-0">
                CPF {role === 'provider' && 'ou CNPJ MEI'}
              </label>
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
                Pessoa Física aceita
              </span>
            </div>
            <input
              id="input-cpf-cnpj"
              type="text"
              value={cpfOrCnpj}
              onChange={e => setCpfOrCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="000.000.000-00"
              className="input font-mono"
              inputMode="numeric"
              required
            />
          </div>

          {/* Dados Específicos para Prestador */}
          {role === 'provider' && (
            <div
              className="space-y-4 p-4 rounded-2xl animate-fade-in"
              style={{ background: 'var(--color-primary-soft)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <Lock size={16} style={{ color: 'var(--color-primary)' }} />
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                  Chave Pix para Repasses Automáticos
                </h4>
              </div>

              <div>
                <label htmlFor="select-pix-key-type" className="label">Tipo de Chave Pix</label>
                <select
                  id="select-pix-key-type"
                  value={pixKeyType}
                  onChange={e => setPixKeyType(e.target.value as 'cpf' | 'phone' | 'email' | 'random')}
                  className="input py-3 text-sm"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="phone">Celular</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label htmlFor="input-pix-key" className="label">Chave Pix</label>
                <input
                  id="input-pix-key"
                  type="text"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder={
                    pixKeyType === 'phone'
                      ? '64 99999-9999'
                      : pixKeyType === 'cpf'
                      ? '000.000.000-00'
                      : 'sua-chave-pix'
                  }
                  className="input"
                />
              </div>

              <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                <label className="flex items-start gap-2.5 cursor-pointer text-left">
                  <input
                    type="checkbox"
                    checked={selfDeclaration}
                    onChange={e => setSelfDeclaration(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-green-600 shrink-0"
                    required
                  />
                  <span className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                    <strong className="block font-bold mb-0.5" style={{ color: 'var(--color-text)' }}>
                      Autodeclaração de Aptidão Técnica:
                    </strong>
                    &ldquo;Declaro, sob as penas da lei, ser profissional autônomo capacitado e assumir responsabilidade civil direta pelos serviços executados.&rdquo;
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Checkbox Termos de Uso e LGPD */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-left">
              <input
                type="checkbox"
                id="checkbox-onboarding-terms"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-green-600 shrink-0"
                required
              />
              <span className="text-xs leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                Li e concordo com os{' '}
                <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Termos de Uso
                </a>{' '}
                e a{' '}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                  Política de Privacidade
                </a>{' '}
                (LGPD).
              </span>
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            id="btn-complete-onboarding"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? (
              <span>Salvando perfil...</span>
            ) : (
              <>
                <span>Concluir e Acessar</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  )
}
