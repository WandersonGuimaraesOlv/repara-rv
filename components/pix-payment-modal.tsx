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
  // 'no_show_fee': taxa de deslocamento de R$25 (ver migration
  // 20260917_no_show_fee.sql) — cobrança só em Pix (sem checkout de cartão)
  // e monitora a coluna no_show_fee_status em vez de payment_status.
  mode?: 'service' | 'no_show_fee'
}

export function PixPaymentModal({
  amount,
  pixQrCode: initialQrCode,
  pixCopyPaste: initialCopyPaste,
  checkoutUrl: initialCheckoutUrl,
  callId,
  onClose,
  mode = 'service',
}: PixPaymentModalProps) {
  const isNoShowFee = mode === 'no_show_fee'
  const [activeTab, setActiveTab] = useState<'pix' | 'card'>('pix')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(!initialCopyPaste || !initialCheckoutUrl)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(initialQrCode || null)
  const [copyPaste, setCopyPaste] = useState<string | null>(initialCopyPaste || null)
  const [cardUrl, setCardUrl] = useState<string | null>(initialCheckoutUrl || null)
  const [isPaid, setIsPaid] = useState(false)

  const supabase = createClient()

  const generatePayment = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, amount }),
      })
      const data = await res.json()
      if (data.success && (data.pix_qr_code || data.checkout_url)) {
        if (data.pix_qr_code) setQrCode(data.pix_qr_code)
        if (data.pix_copy_paste) setCopyPaste(data.pix_copy_paste)
        if (data.checkout_url) setCardUrl(data.checkout_url)
        if (data.payment_status === 'paid') setIsPaid(true)
      } else {
        setError(data.error || 'Falha ao comunicar com o Mercado Pago. Clique para tentar novamente.')
      }
    } catch (err) {
      console.error('Erro ao gerar pagamento:', err)
      setError('Falha de conexão com o servidor. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Gera automaticamente ao abrir se não houver dados
  useEffect(() => {
    let isMounted = true

    if (!initialCopyPaste || !initialQrCode || !initialCheckoutUrl) {
      fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, amount }),
      })
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return
          if (data.success && (data.pix_qr_code || data.checkout_url)) {
            if (data.pix_qr_code) setQrCode(data.pix_qr_code)
            if (data.pix_copy_paste) setCopyPaste(data.pix_copy_paste)
            if (data.checkout_url) setCardUrl(data.checkout_url)
            if (data.payment_status === 'paid') setIsPaid(true)
          } else {
            setError(data.error || 'Não foi possível carregar as opções de pagamento.')
          }
        })
        .catch(err => {
          console.error('Erro ao gerar pagamento inicial:', err)
          if (isMounted) setError('Erro ao conectar ao Mercado Pago.')
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [callId, amount, initialCopyPaste, initialQrCode, initialCheckoutUrl])

  // Monitora se o pagamento foi confirmado em tempo real
  useEffect(() => {
    if (isPaid) return

    const interval = setInterval(async () => {
      if (isNoShowFee) {
        const { data } = await supabase
          .from('service_calls')
          .select('no_show_fee_status')
          .eq('id', callId)
          .maybeSingle()

        if (data?.no_show_fee_status === 'paid') {
          setIsPaid(true)
          toast.success('🎉 Pagamento confirmado com sucesso!')
        }
        return
      }

      const { data } = await supabase
        .from('service_calls')
        .select('payment_status, cancel_note, cancel_metadata')
        .eq('id', callId)
        .maybeSingle()

      if (data?.payment_status === 'paid') {
        setIsPaid(true)
        toast.success('🎉 Pagamento confirmado com sucesso!')
      }
      const remoteCheckout = (data?.cancel_metadata as Record<string, unknown>)?.checkout_url as string | undefined || data?.cancel_note
      if (remoteCheckout && !cardUrl) {
        setCardUrl(remoteCheckout)
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [callId, isPaid, cardUrl, supabase, isNoShowFee])

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
      style={{ background: 'rgba(7, 16, 15, 0.85)', backdropFilter: 'blur(10px)' }}
      id="pix-payment-modal"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 animate-slide-up overflow-hidden shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {isPaid ? (
          <div className="text-center py-6 animate-scale-in">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--color-primary-soft)', color: 'var(--color-success)' }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 className="text-xl font-black mb-2" style={{ color: 'var(--color-text)' }}>
              Pagamento Confirmado!
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              {isNoShowFee ? (
                <>Sua taxa de deslocamento de <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(amount)}</strong> foi paga com sucesso.</>
              ) : (
                <>Seu pagamento de <strong style={{ color: 'var(--color-text)' }}>{formatCurrency(amount)}</strong> foi aprovado. O prestador foi notificado e o atendimento está concluído.</>
              )}
            </p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn-primary w-full"
              >
                Concluir e Fechar
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2"
                style={{
                  background: 'var(--color-primary-soft)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <ShieldCheck size={14} style={{ color: 'var(--color-primary-hover)' }} />
                <span>Pagamento Seguro Mercado Pago</span>
              </div>
              <h3 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                {isNoShowFee ? 'Taxa de Deslocamento' : 'Pagar pelo Serviço'}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {isNoShowFee ? 'Pague via Pix instantâneo' : 'Escolha pagar via Pix instantâneo ou Cartão de Crédito / Débito'}
              </p>
            </div>

            {/* Abas de Seleção: Pix ou Cartão — taxa de no-show é só Pix */}
            {!isNoShowFee && (
              <div
                className="grid grid-cols-2 gap-2 p-1 rounded-2xl mb-4 text-xs font-bold"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('pix')}
                  className="py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    background: activeTab === 'pix' ? 'var(--color-primary-soft)' : 'transparent',
                    color: activeTab === 'pix' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === 'pix' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <QrCode size={15} />
                  <span>Pix Instantâneo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className="py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    background: activeTab === 'card' ? 'var(--color-primary-soft)' : 'transparent',
                    color: activeTab === 'card' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === 'card' ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <CreditCard size={15} />
                  <span>Cartão (Crédito/Débito)</span>
                </button>
              </div>
            )}

            {/* Resumo do Valor */}
            <div
              className="rounded-2xl p-3.5 mb-4 flex items-center justify-between"
              style={{
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div>
                <span className="text-[11px] font-semibold block" style={{ color: 'var(--color-text-subtle)' }}>
                  Total a pagar
                </span>
                <span className="text-2xl font-black" style={{ color: 'var(--color-accent)' }}>
                  {formatCurrency(amount)}
                </span>
              </div>
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--color-primary-soft)',
                    color: 'var(--color-primary-hover)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Sem acréscimos
                </span>
              </div>
            </div>

            {/* Conteúdo da Aba Pix */}
            {activeTab === 'pix' && (
              <div className="animate-fade-in">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 size={32} className="animate-spin mb-2" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Gerando QR Code oficial no Mercado Pago...
                    </p>
                  </div>
                ) : error && !qrCode ? (
                  <div
                    className="p-4 rounded-2xl text-center space-y-3 my-2"
                    style={{
                      background: 'rgba(237, 198, 107, 0.1)',
                      border: '1px solid var(--color-warning)',
                    }}
                  >
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={generatePayment}
                      className="btn-primary text-xs py-2 px-4"
                    >
                      Tentar Gerar Novamente
                    </button>
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
                          style={{ border: '4px solid white', background: 'white' }}
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
                          className="btn-primary w-full flex items-center justify-center gap-2"
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
                        <p className="text-[11px] text-center" style={{ color: 'var(--color-text-subtle)' }}>
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
                <div
                  className="p-4 rounded-2xl text-center"
                  style={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                    style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-hover)' }}
                  >
                    <CreditCard size={20} />
                  </div>
                  <h4 className="font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
                    Pague com Cartão de Crédito ou Débito
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    Você será direcionado para o ambiente seguro do Mercado Pago, onde pode parcelar no cartão de crédito ou pagar com cartão de débito virtual da Caixa e bancos conveniados.
                  </p>
                </div>

                {cardUrl ? (
                  <a
                    href={cardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <span>Pagar com Cartão no Mercado Pago</span>
                    <ExternalLink size={16} />
                  </a>
                ) : loading ? (
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs"
                    style={{
                      background: 'var(--color-surface-alt)',
                      color: 'var(--color-text-subtle)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" />
                    <span>Carregando opções de cartão...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={generatePayment}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <span>Gerar Link de Cartão no Mercado Pago</span>
                    <ExternalLink size={16} />
                  </button>
                )}

                <p className="text-[11px] text-center" style={{ color: 'var(--color-text-subtle)' }}>
                  Após concluir o pagamento no Mercado Pago, a confirmação é registrada automaticamente aqui!
                </p>
              </div>
            )}

            {/* Botão Fechar se fornecido */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2 py-2 text-xs font-semibold text-center cursor-pointer transition"
                style={{ color: 'var(--color-text-subtle)' }}
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
