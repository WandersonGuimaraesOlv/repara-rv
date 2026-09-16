'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User, Phone, Lock, Eye, EyeOff, ShieldCheck, Wrench, ArrowRight, CheckCircle2, MapPin, AlertCircle, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { normalizeBrazilianPhone } from '@/lib/utils'
import { isValidCpfOrCnpj, isValidPixKey, isWeakPin, type PixKeyType } from '@/lib/validations/br-documents'

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<'client' | 'provider'>('client')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [cpfOrCnpj, setCpfOrCnpj] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('phone')
  const [selfDeclaration, setSelfDeclaration] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cep, setCep] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [loadingCep, setLoadingCep] = useState(false)
  const [cepError, setCepError] = useState(false)

  // Lê papel inicial da URL (?role=provider ou ?tipo=prestador)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const r = params.get('role') || params.get('tipo')
      if (r === 'provider' || r === 'prestador') {
        setRole('provider')
      }
    }
  }, [])

  const handlePhoneChange = (value: string) => {
    const digits = normalizeBrazilianPhone(value)
    setPhone(digits)
    // Se prestador e tipo de chave for phone, pré-preenche a chave pix
    if (role === 'provider' && pixKeyType === 'phone' && (!pixKey || pixKey === phone)) {
      setPixKey(digits)
    }
  }

  const formatDisplayPhone = (digits: string) => {
    if (!digits) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  // Busca automática do bairro ao completar 8 dígitos de CEP (ViaCEP) — mesmo
  // serviço já usado em components/endereco-form.tsx, gratuito e sem chave.
  const handleCepChange = async (value: string) => {
    const rawValue = value.replace(/\D/g, '').slice(0, 8)
    setCep(rawValue)
    setCepError(false)
    if (rawValue.length < 8) {
      setNeighborhood('')
      return
    }

    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`)
      const data = await res.json()
      if (data.erro || !data.bairro) {
        setNeighborhood('')
        setCepError(true)
      } else {
        setNeighborhood(data.bairro)
      }
    } catch {
      setNeighborhood('')
      setCepError(true)
    } finally {
      setLoadingCep(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanFullName = fullName.trim()
    if (cleanFullName.length < 3) {
      toast.error('Digite seu nome completo')
      return
    }

    const cleanEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Digite um e-mail válido')
      return
    }

    if (phone.length < 10) {
      toast.error('Digite um telefone celular válido com DDD (10 ou 11 dígitos)')
      return
    }

    if (cep.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos')
      return
    }

    if (loadingCep) {
      toast.error('Aguarde a validação do CEP...')
      return
    }

    if (!neighborhood) {
      toast.error('CEP não encontrado. Verifique o número digitado.')
      return
    }

    if (pin.length < 4) {
      toast.error('O PIN de segurança deve ter pelo menos 4 dígitos numéricos')
      return
    }

    if (pin !== confirmPin) {
      toast.error('Os PINs digitados não coincidem. Digite o mesmo PIN nos dois campos.')
      return
    }

    if (isWeakPin(pin)) {
      toast.error('PIN muito fácil de adivinhar (sequência ou dígitos repetidos). Escolha outro.')
      return
    }

    if (!cpfOrCnpj.trim()) {
      toast.error('Informe seu CPF para verificação cadastral')
      return
    }
    if (!isValidCpfOrCnpj(cpfOrCnpj)) {
      toast.error('CPF inválido — confira os dígitos informados')
      return
    }

    if (role === 'provider') {
      if (!pixKey.trim()) {
        toast.error('Informe sua chave Pix para receber os repasses dos atendimentos')
        return
      }
      if (!isValidPixKey(pixKey, pixKeyType as PixKeyType)) {
        toast.error('Chave Pix não corresponde ao formato do tipo selecionado — confira antes de continuar')
        return
      }
      if (!selfDeclaration) {
        toast.error('Marque a autodeclaração de aptidão técnica para prosseguir')
        return
      }
    }

    if (!termsAccepted) {
      toast.error('Você deve aceitar os Termos de Uso e Política de Privacidade')
      return
    }

    setLoading(true)

    try {
      // 1. Envia payload para rota de registro seguro
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanFullName,
          email: cleanEmail,
          phone,
          pin,
          role,
          cpfOrCnpj: cpfOrCnpj.trim(),
          pixKey: pixKey.trim(),
          pixKeyType,
          selfDeclaration,
          cep: cep.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setLoading(false)
        if (json.userExists) {
          toast.info(json.error)
          router.push(`/login?phone=${phone}`)
          return
        }
        toast.error(json.error || 'Erro ao realizar cadastro.')
        return
      }

      // 2. Faz login no Supabase client com as credenciais criadas
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: json.email,
        password: json.password,
      })

      if (signInError || !authData.user) {
        setLoading(false)
        toast.success('Cadastro criado com sucesso! Faça login com seu celular e PIN.')
        router.push('/login')
        return
      }

      // 3. Salva no localStorage para carregamento imediato
      try {
        localStorage.setItem(
          'repara_user',
          JSON.stringify({
            id: authData.user.id,
            role: json.role,
            full_name: cleanFullName,
            phone,
          })
        )
      } catch {}

      setLoading(false)
      toast.success(`Cadastro realizado com sucesso! Bem-vindo ao Repara RV 🎉`)

      if (role === 'provider') {
        router.replace('/painel')
      } else {
        router.replace('/')
      }
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
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 animate-fade-in my-6"
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
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-4" style={{ color: 'var(--color-text)' }}>
            Crie sua Conta Grátis
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Acesso rápido, seguro e sem atrito para Rio Verde (GO)
          </p>
        </div>

        {/* Alternador de Perfil: Cliente vs Prestador */}
        <div className="mb-6">
          <label className="label">Como você deseja usar o Repara RV?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('client')}
              className="p-4 rounded-2xl text-left transition-all flex flex-col gap-1.5"
              style={{
                border: `2px solid ${role === 'client' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: role === 'client' ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)',
              }}
              aria-pressed={role === 'client'}
            >
              <div className="flex items-center justify-between">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    background: role === 'client' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: role === 'client' ? '#ffffff' : 'var(--color-text-muted)',
                  }}
                >
                  <User size={18} />
                </div>
                {role === 'client' && <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />}
              </div>
              <strong className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Sou Cliente</strong>
              <span className="text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                Quero solicitar consertos residenciais
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRole('provider')}
              className="p-4 rounded-2xl text-left transition-all flex flex-col gap-1.5"
              style={{
                border: `2px solid ${role === 'provider' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: role === 'provider' ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)',
              }}
              aria-pressed={role === 'provider'}
            >
              <div className="flex items-center justify-between">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    background: role === 'provider' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: role === 'provider' ? '#ffffff' : 'var(--color-text-muted)',
                  }}
                >
                  <Wrench size={18} />
                </div>
                {role === 'provider' && <CheckCircle2 size={18} style={{ color: 'var(--color-primary)' }} />}
              </div>
              <strong className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Sou Profissional</strong>
              <span className="text-[11px] leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                Quero prestar serviços e receber chamados
              </span>
            </button>
          </div>
        </div>

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nome Completo */}
          <div>
            <label htmlFor="cadastro-name" className="label">Nome Completo</label>
            <div className="relative flex items-center">
              <User size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="cadastro-name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="input pl-11"
                required
                autoFocus
                autoComplete="name"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="cadastro-email" className="label">E-mail</label>
            <div className="relative flex items-center">
              <Mail size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="cadastro-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input pl-11"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Celular */}
          <div>
            <label htmlFor="cadastro-phone" className="label">Celular com DDD (WhatsApp)</label>
            <div className="relative flex items-center">
              <Phone size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="cadastro-phone"
                type="tel"
                value={formatDisplayPhone(phone)}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="(64) 99999-9999"
                className="input pl-11"
                inputMode="numeric"
                required
                autoComplete="tel"
              />
            </div>
          </div>

          {/* CPF ou CNPJ — obrigatório pra todo mundo (achado 16/09/2026: só
              era pedido/validado pra prestador, cliente nunca precisava
              informar, nem no frontend nem na rota /api/auth/register) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="cadastro-cpf" className="label mb-0">
                CPF {role === 'provider' && 'ou CNPJ MEI'}
              </label>
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
                Pessoa Física aceita
              </span>
            </div>
            <input
              id="cadastro-cpf"
              type="text"
              value={cpfOrCnpj}
              onChange={e => setCpfOrCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="000.000.000-00"
              className="input font-mono"
              inputMode="numeric"
              required
            />
          </div>

          {/* CEP e Bairro */}
          <div>
            <label htmlFor="cadastro-cep" className="label">
              CEP <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
              <span className="font-normal" style={{ color: 'var(--color-text-subtle)' }}>(identifica seu bairro automaticamente)</span>
            </label>
            <div className="relative flex items-center">
              <MapPin size={17} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
              <input
                id="cadastro-cep"
                type="tel"
                value={cep}
                onChange={e => handleCepChange(e.target.value)}
                placeholder="75900-000"
                className="input pl-11"
                inputMode="numeric"
                maxLength={9}
                required
                autoComplete="postal-code"
              />
              {loadingCep && (
                <span
                  className="absolute right-4 text-xs font-medium animate-pulse"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Buscando...
                </span>
              )}
              {neighborhood && !loadingCep && (
                <span
                  className="absolute right-4 text-xs flex items-center gap-1 font-medium"
                  style={{ color: 'var(--color-success)' }}
                >
                  <CheckCircle2 size={14} /> {neighborhood}
                </span>
              )}
            </div>
            {cepError && (
              <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
                <AlertCircle size={12} className="shrink-0" /> CEP não encontrado. Verifique o número digitado.
              </p>
            )}
          </div>

          {/* PIN e Confirmação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="cadastro-pin" className="label mb-0">
                  Criar PIN (4 a 6 dígitos)
                </label>
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
                  id="cadastro-pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ex: 1234"
                  className="input pl-10 tracking-widest font-mono"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cadastro-confirm-pin" className="label">Confirmar PIN</label>
              <div className="relative flex items-center">
                <Lock size={15} className="absolute left-4 pointer-events-none" style={{ color: 'var(--color-text-subtle)' }} />
                <input
                  id="cadastro-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Repita o PIN"
                  className="input pl-10 tracking-widest font-mono"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Seção Extra para Profissionais */}
          {role === 'provider' && (
            <div
              className="p-4 rounded-2xl space-y-4 animate-fade-in"
              style={{
                background: 'var(--color-primary-soft)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                <ShieldCheck size={16} />
                <span>Dados do Profissional & Repasses Pix</span>
              </div>

              {/* Chave Pix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="cadastro-pix-type" className="label">Tipo de Chave</label>
                  <select
                    id="cadastro-pix-type"
                    value={pixKeyType}
                    onChange={e => setPixKeyType(e.target.value)}
                    className="input py-3 text-sm"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="phone">Celular</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-pix-key" className="label">Chave Pix para Recebimentos</label>
                  <input
                    id="cadastro-pix-key"
                    type="text"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    placeholder={pixKeyType === 'phone' ? 'Ex: 64999999999' : 'Informe sua chave Pix'}
                    className="input text-sm"
                    required={role === 'provider'}
                  />
                </div>
              </div>

              {/* Autodeclaração */}
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={selfDeclaration}
                  onChange={e => setSelfDeclaration(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-green-600 shrink-0"
                  id="checkbox-self-declaration"
                />
                <span className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  Declaro sob as penas da lei possuir capacidade técnica para execução dos serviços residenciais oferecidos na Plataforma em Rio Verde (GO).
                </span>
              </label>
            </div>
          )}

          {/* Termos de Uso */}
          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-green-600 shrink-0"
              id="terms-checkbox"
            />
            <span className="text-xs leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Li e concordo com os{' '}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>Termos de Uso</a>
              {', '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>Política de Privacidade</a>
              {role === 'provider' && (
                <>
                  {' e '}
                  <a href="/contrato" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>Contrato de Técnico Parceiro</a>
                </>
              )}
              {' '}da Plataforma Repara RV.
            </span>
          </label>

          {/* Botão de Submissão */}
          <button
            type="submit"
            id="btn-submit-cadastro"
            disabled={loading || phone.length < 10 || pin.length < 4 || !fullName.trim() || !email.trim() || !termsAccepted || cep.length !== 8 || loadingCep || !neighborhood}
            className="btn-primary mt-2"
          >
            {loading ? (
              <span>Criando conta e entrando...</span>
            ) : (
              <>
                <span>Concluir Cadastro e Acessar</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Link para Login */}
        <div
          className="text-center mt-6 pt-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Já possui uma conta no Repara RV?{' '}
            <Link
              href="/login"
              className="font-bold hover:underline inline-flex items-center gap-1"
              style={{ color: 'var(--color-primary)' }}
            >
              Fazer Login com PIN
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
