'use client'

import { useState, useEffect } from 'react'
import { Copy, CheckCheck, QrCode, CreditCard, ShieldCheck, Loader2, ExternalLink, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface PixPaymentModalProps {
  amount: number
  providerCut: number
  pixQrCode?: string | null
  pixCopyPaste?: string | null
  checkoutUrl?: string | null
  callId: string
  onClose?: () => void
}

export function PixPaymentModal({
  amount,
  providerCut,
  pixQrCode: initialQrCode,
  pixCopyPaste: initialCopyPaste,
  checkoutUrl: initialCheckoutUrl,
  callId,
  onClose,
}: PixPaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'pix' | 'card'>('pix')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(!initialCopyPaste)
  const [qrCode, setQrCode] = useState<string | null>(initialQrCode || null)
  const [copyPaste, setCopyPaste] = useState<string | null>(initialCopyPaste || null)
  const [cardUrl, setCardUrl] = useState<string | null>(initialCheckoutUrl || null)
  const [isPaid, setIsPaid] = useState(false)

  const supabase = createClient()

  // Se o chamado ainda não tem os dados de pagamento gerados, gera automaticamente
  useEffect(() => {
    let isMounted = true

    async function ensurePayment() {
      try {
        const res = await fetch('/api/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId, amount }),
        })
        const data = await res.json()
        if (isMounted && data.success) {
          if (data.pix_qr_code) setQrCode(data.pix_qr_code)
          if (data.pix_copy_paste) setCopyPaste(data.pix_copy_paste)
          if (data.checkout_url) setCardUrl(data.checkout_url)
          if (data.payment_status === 'paid') setIsPaid(true)
        }
      } catch (err) {
        console.error('Erro ao gerar pagamento:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (!copyPaste || !qrCode || !cardUrl) {
      ensurePayment()
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [callId, amount, copyPaste, qrCode, cardUrl])

  // Monitora se o pagamento foi confirmado em tempo real
  useEffect(() => {
    if (isPaid) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('service_calls')
        .select('payment_status, cancel_note')
        .eq('id', callId)
        .maybeSingle()

      if (data?.payment_status === 'paid') {
        setIsPaid(true)
        toast.success('🎉 Pagamento confirmado com sucesso!')
      }
      if (data?.cancel_note && !cardUrl) {
        setCardUrl(data.cancel_note)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [callId, isPaid, cardUrl, supabase])

  const handleCopy = async () => {
    if (!copyPaste) return
    try {
      await navigator.clipboard.writeText(copyPaste)
      setCopied(true)
      toast.success('Código Pix Copia e Cola copiado com sucesso!')
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error('Selecione e copie o código manualmente.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
      id="pix-payment-modal"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 animate-slide-up overflow-hidden shadow-2xl"
        style={{ background: 'var(--color-surface, #ffffff)', border: '1px solid rgba(249, 115, 22, 0.2)' }}
      >
        {isPaid ? (
          <div className="text-center py-6 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={36} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">
              Pagamento Confirmado!
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Seu pagamento de <strong>{formatCurrency(amount)}</strong> foi aprovado. O prestador foi notificado e o atendimento está concluído.
            </p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md"
              >
                Concluir e Fechar
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase tracking-wider mb-2">
                <ShieldCheck size={14} className="text-orange-600" />
                <span>Pagamento Seguro Mercado Pago</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Pagar pelo Serviço
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha pagar via Pix instantâneo ou Cartão de Crédito / Débito
              </p>
            </div>

            {/* Abas de Seleção: Pix ou Cartão */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('pix')}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'pix'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode size={15} />
                <span>Pix Instantâneo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'card'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard size={15} />
                <span>Cartão (Crédito/Débito)</span>
              </button>
            </div>

            {/* Resumo do Valor */}
            <div className="rounded-2xl p-3.5 mb-4 bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Total a pagar</span>
                <span className="text-2xl font-black text-slate-900">{formatCurrency(amount)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Sem acréscimos
                </span>
              </div>
            </div>

            {/* Conteúdo da Aba Pix */}
            {activeTab === 'pix' && (
              <div className="animate-fade-in">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 size={32} className="animate-spin text-orange-600 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Gerando QR Code oficial no Mercado Pago...</p>
                  </div>
                ) : (
                  <>
                    {/* Imagem do QR Code Pix */}
                    {qrCode && (
                      <div className="flex justify-center mb-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/png;base64,${qrCode}`}
                          alt="QR Code Pix"
                          className="w-44 h-44 rounded-2xl shadow-sm"
                          style={{ border: '4px solid #ffffff' }}
                        />
                      </div>
                    )}

                    {/* Botão Copia e Cola */}
                    {copyPaste && (
                      <div className="space-y-2 mb-4">
                        <button
                          type="button"
                          onClick={handleCopy}
                          id="btn-copy-pix-code"
                          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all shadow-md shadow-orange-600/20"
                        >
                          {copied ? (
                            <>
                              <CheckCheck size={18} />
                              <span>Código Pix Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={18} />
                              <span>Copiar Código Pix Copia e Cola</span>
                            </>
                          )}
                        </button>
                        <p className="text-[11px] text-center text-slate-500">
                          Abra o app do seu banco, escolha <strong>Pix Copia e Cola</strong> e efetue o pagamento.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Conteúdo da Aba Cartão */}
            {activeTab === 'card' && (
              <div className="animate-fade-in space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 text-center">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-2">
                    <CreditCard size={20} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    Pague com Cartão de Crédito ou Débito
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Você será direcionado para o ambiente seguro do Mercado Pago, onde pode parcelar no cartão de crédito ou pagar com cartão de débito virtual da Caixa e bancos conveniados.
                  </p>
                </div>

                {cardUrl ? (
                  <a
                    href={cardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                  >
                    <span>Pagar com Cartão no Mercado Pago</span>
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs text-slate-400 bg-slate-100"
                  >
                    <Loader2 size={16} className="animate-spin" />
                    <span>Carregando opções de cartão...</span>
                  </button>
                )}

                <p className="text-[11px] text-center text-slate-500">
                  Após concluir o pagamento no Mercado Pago, a confirmação é registrada automaticamente aqui!
                </p>
              </div>
            )}

            {/* Botão Fechar se fornecido */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 text-center"
              >
                Fechar janela
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
