'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Zap, CheckCircle2, ArrowRight, ExternalLink, AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function MercadoPagoSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [recipientId, setRecipientId] = useState<string | null>(null)

  useEffect(() => {
    async function checkStatus() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser(user)

        const { data: status } = await supabase
          .from('provider_status')
          .select('recipient_gateway_id, is_online')
          .eq('provider_id', user.id)
          .maybeSingle()

        if (status?.recipient_gateway_id) {
          setIsConnected(true)
          setRecipientId(status.recipient_gateway_id)
        }
      } catch (err) {
        console.error('Erro ao verificar status Mercado Pago:', err)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/mercadopago/oauth/url')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Erro ao gerar link de conexão.')
        setConnecting(false)
      }
    } catch {
      toast.error('Erro de conexão ao servidor.')
      setConnecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Topo / Voltar */}
        <div className="flex items-center justify-between">
          <Link
            href="/painel"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Voltar ao Painel
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            Split Automático Pix
          </span>
        </div>

        {/* Header Visual */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-sky-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Zap size={32} className="fill-blue-400/20" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Vinculação Mercado Pago
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Receba o valor da sua mão de obra instantaneamente na sua conta, direto pelo split oficial sem intermediários.
          </p>
        </div>

        {/* Benefícios */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span><strong>Split 100% Automático:</strong> o dinheiro cai direto no seu Mercado Pago assim que o serviço é pago.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span><strong>Habilita Chamados Imediatos:</strong> prestadores com Mercado Pago conectado aparecem com prioridade no radar de Rio Verde.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span><strong>Segurança e Proteção Fiscal:</strong> comprovante de transação oficial emitido pelo Banco Central.</span>
          </div>
        </div>

        {/* Status e Ação */}
        {loading ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Verificando status da sua conta...
          </div>
        ) : isConnected ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Conta Conectada e Ativa!</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ID da Subconta: <span className="font-mono text-emerald-300">{recipientId}</span>
              </p>
            </div>
            <Link
              href="/painel"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20"
            >
              Ir para o Painel de Chamados <ArrowRight size={16} />
            </Link>
          </div>
        ) : !user ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Faça login para continuar</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Para vincular seu Mercado Pago à Repara RV, entre com seu telefone cadastrado.
              </p>
            </div>
            <Link
              href="/login?redirect=/painel/configuracoes/mercado-pago"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors shadow-lg shadow-orange-500/20"
            >
              Fazer Login com Telefone <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/25 disabled:opacity-50"
            >
              {connecting ? (
                <span>Iniciando autorização segura...</span>
              ) : (
                <>
                  <ExternalLink size={18} />
                  <span>Conectar Conta Mercado Pago Agora</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-500">
              Você será redirecionado para o ambiente seguro do Mercado Pago para autorizar o recebimento de repasses.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
