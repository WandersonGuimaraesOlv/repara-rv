'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types'
import { User, Wrench, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('client')
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('phone')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Digite seu nome completo'); return }
    if (!phone.trim()) { toast.error('Digite seu telefone'); return }
    if (role === 'provider' && !pixKey.trim()) { toast.error('Informe sua chave Pix'); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, role, full_name: fullName.trim(), phone: phone.trim() })

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
    <div className="page-container justify-center p-6">
      <div className="w-full max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
            Quase lá! 🚀
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Complete seu perfil para começar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {/* Seleção de papel */}
          <div>
            <label className="block text-xs font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Você é...
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'client', label: 'Cliente', desc: 'Preciso de serviços', Icon: User },
                { value: 'provider', label: 'Prestador', desc: 'Quero trabalhar', Icon: Wrench },
              ] as const).map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  type="button"
                  id={`role-${value}`}
                  onClick={() => setRole(value)}
                  className="p-4 rounded-xl text-left transition-all"
                  style={{
                    background: role === value ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-alt)',
                    border: `2px solid ${role === value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    boxShadow: role === value ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  <Icon size={22} style={{ color: role === value ? 'var(--color-brand-light)' : 'var(--color-text-muted)' }} />
                  <p className="font-semibold text-sm mt-2" style={{ color: 'var(--color-text)' }}>{label}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Nome completo
            </label>
            <input
              id="input-full-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="input"
              required
              autoFocus
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Celular
            </label>
            <input
              id="input-onboarding-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="62 99999-9999"
              className="input"
              inputMode="numeric"
              required
            />
          </div>

          {/* Campos extras para prestador */}
          {role === 'provider' && (
            <div
              className="space-y-4 p-4 rounded-xl animate-slide-up"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--color-brand-light)' }}>
                🔑 Dados para receber via Pix
              </p>
              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Tipo da chave Pix
                </label>
                <select
                  id="select-pix-type"
                  value={pixKeyType}
                  onChange={e => setPixKeyType(e.target.value)}
                  className="input"
                >
                  <option value="phone">Celular</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Chave Pix
                </label>
                <input
                  id="input-pix-key"
                  type="text"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  placeholder={pixKeyType === 'phone' ? '62 99999-9999' : pixKeyType === 'cpf' ? '000.000.000-00' : 'sua-chave@email.com'}
                  className="input"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            id="btn-complete-onboarding"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Salvando...' : (
              <>
                Entrar no Repara RV
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
