'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { User, Phone, Lock, Eye, EyeOff, ShieldCheck, Wrench, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'

export default function CadastroPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<'client' | 'provider'>('client')
  const [fullName, setFullName] = useState('')
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
    const digits = value.replace(/\D/g, '').slice(0, 11)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanFullName = fullName.trim()
    if (cleanFullName.length < 3) {
      toast.error('Digite seu nome completo')
      return
    }

    if (phone.length < 10) {
      toast.error('Digite um telefone celular válido com DDD (10 ou 11 dígitos)')
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

    if (role === 'provider') {
      if (!cpfOrCnpj.trim()) {
        toast.error('Informe seu CPF ou CNPJ MEI para verificação cadastral')
        return
      }
      if (!pixKey.trim()) {
        toast.error('Informe sua chave Pix para receber os repasses dos atendimentos')
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
          phone,
          pin,
          role,
          cpfOrCnpj: cpfOrCnpj.trim(),
          pixKey: pixKey.trim(),
          pixKeyType,
          selfDeclaration,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-orange-100 selection:text-orange-900">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 animate-fade-in my-6">
        
        {/* Logo & Retorno */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center group transition-transform hover:scale-[1.02]">
            <Logo variant="full" width={200} height={50} />
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-4">
            Crie sua Conta Grátis
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Acesso rápido, seguro e sem atrito para Rio Verde (GO)
          </p>
        </div>

        {/* Alternador de Perfil: Cliente vs Prestador */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Como você deseja usar o Repara RV?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col gap-1.5 ${
                role === 'client'
                  ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl ${role === 'client' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <User size={18} />
                </div>
                {role === 'client' && <CheckCircle2 size={18} className="text-orange-600" />}
              </div>
              <strong className="text-sm font-bold text-slate-900">Sou Cliente</strong>
              <span className="text-[11px] text-slate-500 leading-tight">
                Quero solicitar consertos residenciais
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRole('provider')}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col gap-1.5 ${
                role === 'provider'
                  ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl ${role === 'provider' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Wrench size={18} />
                </div>
                {role === 'provider' && <CheckCircle2 size={18} className="text-orange-600" />}
              </div>
              <strong className="text-sm font-bold text-slate-900">Sou Profissional</strong>
              <span className="text-[11px] text-slate-500 leading-tight">
                Quero prestar serviços e receber chamados
              </span>
            </button>
          </div>
        </div>

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nome Completo
            </label>
            <div className="relative flex items-center">
              <User size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="cadastro-name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Celular com DDD */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Celular com DDD (WhatsApp)
            </label>
            <div className="relative flex items-center">
              <Phone size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="cadastro-phone"
                type="tel"
                value={formatDisplayPhone(phone)}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="(64) 99999-9999"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          {/* Criação de PIN e Confirmação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Criar PIN (4 a 6 dígitos)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  id="cadastro-pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ex: 1234"
                  className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-sm font-mono tracking-widest text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirmar PIN
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  id="cadastro-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Repita o PIN"
                  className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-sm font-mono tracking-widest text-slate-900 placeholder-slate-400 outline-none transition-all shadow-xs"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </div>
            </div>
          </div>

          {/* Seção Extra para Profissionais (Prestadores) */}
          {role === 'provider' && (
            <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-black text-orange-950 uppercase tracking-wider">
                <ShieldCheck size={16} className="text-orange-600" />
                <span>Dados do Profissional & Repasses Pix</span>
              </div>

              {/* CPF ou CNPJ */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  CPF ou CNPJ MEI
                </label>
                <input
                  id="cadastro-cpf"
                  type="text"
                  value={cpfOrCnpj}
                  onChange={e => setCpfOrCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none"
                  required={role === 'provider'}
                />
              </div>

              {/* Chave Pix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Tipo de Chave
                  </label>
                  <select
                    value={pixKeyType}
                    onChange={e => setPixKeyType(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  >
                    <option value="phone">Celular</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Sua Chave Pix para Recebimentos
                  </label>
                  <input
                    id="cadastro-pix-key"
                    type="text"
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    placeholder={pixKeyType === 'phone' ? 'Ex: 64999999999' : 'Informe sua chave Pix'}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-orange-500 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none"
                    required={role === 'provider'}
                  />
                </div>
              </div>

              {/* Autodeclaração de Aptidão Técnica */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={selfDeclaration}
                  onChange={e => setSelfDeclaration(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  Declaro sob as penas da lei possuir capacidade técnica para execução dos serviços residenciais oferecidos na Plataforma em Rio Verde (GO).
                </span>
              </label>
            </div>
          )}

          {/* Termos de Uso */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
              id="terms-checkbox"
            />
            <span className="text-xs text-slate-600 leading-snug">
              Li e concordo com os{' '}
              <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-600 hover:text-orange-700 hover:underline">Termos de Uso</a>
              {', '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-600 hover:text-orange-700 hover:underline">Política de Privacidade</a>
              {role === 'provider' && (
                <>
                  {' e '}
                  <a href="/contrato" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-600 hover:text-orange-700 hover:underline">Contrato de Técnico Parceiro</a>
                </>
              )}
              {' '}da Plataforma Repara RV.
            </span>
          </label>

          {/* Botão de Submissão */}
          <button
            type="submit"
            id="btn-submit-cadastro"
            disabled={loading || phone.length < 10 || pin.length < 4 || !fullName.trim() || !termsAccepted}
            className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-sm font-bold shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:pointer-events-none"
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

        {/* Link Alternativo para Login */}
        <div className="text-center mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Já possui uma conta no Repara RV?{' '}
            <Link
              href="/login"
              className="font-bold text-orange-600 hover:text-orange-700 hover:underline inline-flex items-center gap-1 ml-1"
            >
              Fazer Login com PIN
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
