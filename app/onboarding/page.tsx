'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types'
import { User, Wrench, ChevronRight, ShieldCheck, CheckSquare, Square, Lock } from 'lucide-react'
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
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [selfDeclaration, setSelfDeclaration] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Digite seu nome completo'); return }
    if (!phone.trim()) { toast.error('Digite seu telefone celular'); return }
    if (!cpfOrCnpj.trim()) { toast.error('Informe seu CPF ou CNPJ MEI'); return }
    if (!termsAccepted) { toast.error('Você deve aceitar os Termos de Uso e Política de Privacidade.'); return }
    if (role === 'provider' && !pixKey.trim()) { toast.error('Informe sua chave Pix para receber seus pagamentos.'); return }
    if (role === 'provider' && !selfDeclaration) {
      toast.error('É obrigatório assinar a autodeclaração de aptidão e antecedentes para atuar no Repara RV.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        role,
        full_name: fullName.trim(),
        phone: phone.trim(),
        cpf_or_cnpj: cpfOrCnpj.trim(),
        terms_accepted_at: new Date().toISOString(),
        self_declaration_signed: role === 'provider' ? selfDeclaration : true,
      })

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
    toast.success('Perfil criado! Bem-vindo ao Repara RV 🎉')
    router.replace(role === 'provider' ? '/painel' : '/')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-orange-100 selection:text-orange-900">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/20 mx-auto mb-3">
            <Wrench size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Complete seu Perfil 🚀
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Onboarding rápido e sem atrito para Rio Verde (GO)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Seleção de Papel */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Selecione seu perfil
            </label>
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
                  className={`p-3.5 rounded-2xl text-left transition-all border ${
                    role === value
                      ? 'bg-orange-50 border-orange-500 shadow-md shadow-orange-500/10 ring-2 ring-orange-400/20'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon size={20} className={role === value ? 'text-orange-600' : 'text-slate-400'} />
                  <p className="font-bold text-sm text-slate-900 mt-1.5">{label}</p>
                  <p className="text-[11px] text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nome Completo
            </label>
            <input
              id="input-full-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:border-orange-500 outline-none transition-all"
              required
            />
          </div>

          {/* Celular / WhatsApp */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Celular (com DDD)
            </label>
            <input
              id="input-onboarding-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Ex: 64 99999-9999"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:border-orange-500 outline-none transition-all"
              inputMode="numeric"
              required
            />
          </div>

          {/* CPF ou CNPJ (Modelo PF Sem Atrito) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                CPF {role === 'provider' && 'ou CNPJ MEI'}
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Pessoa Física aceita
              </span>
            </div>
            <input
              id="input-cpf-cnpj"
              type="text"
              value={cpfOrCnpj}
              onChange={e => setCpfOrCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
              placeholder="000.000.000-00"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:border-orange-500 outline-none transition-all font-mono"
              inputMode="numeric"
              required
            />
          </div>

          {/* Dados Específicos para Prestador */}
          {role === 'provider' && (
            <div className="space-y-3.5 p-4 rounded-2xl bg-orange-50/50 border border-orange-200/80 animate-slide-up">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-orange-600" />
                <h4 className="text-xs font-bold text-orange-950 uppercase tracking-wider">
                  Chave Pix para Repasses Automáticos
                </h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tipo da Chave
                </label>
                <select
                  id="select-pix-type"
                  value={pixKeyType}
                  onChange={e => setPixKeyType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-orange-500 outline-none"
                >
                  <option value="phone">Celular</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Chave Pix
                </label>
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:border-orange-500 outline-none"
                />
              </div>

              {/* Autodeclaração Vinculante (Dispensa de Certidões - Onboarding Ágil) */}
              <div className="pt-2 border-t border-orange-200/60">
                <label className="flex items-start gap-2.5 cursor-pointer text-left">
                  <input
                    type="checkbox"
                    checked={selfDeclaration}
                    onChange={e => setSelfDeclaration(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 shrink-0"
                    required
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    <strong className="text-slate-900 block font-bold mb-0.5">
                      Autodeclaração de Aptidão & Antecedentes:
                    </strong>
                    &ldquo;Declaro, sob as penas da lei, ser profissional autônomo capacitado, não possuir antecedentes criminais e assumir responsabilidade civil direta pelos serviços executados.&rdquo;
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
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 shrink-0"
                required
              />
              <span className="text-xs text-slate-600 leading-tight">
                Li e concordo com os{' '}
                <a href="#termos" className="text-orange-600 underline font-semibold">
                  Termos de Uso
                </a>{' '}
                e a{' '}
                <a href="#privacidade" className="text-orange-600 underline font-semibold">
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
            className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-sm font-bold shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
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
