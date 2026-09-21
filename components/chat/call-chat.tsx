'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, AlertCircle, Loader2, Package, Zap, Car } from 'lucide-react'
import { CallMessage } from '@/lib/types'

interface CallChatProps {
  callId: string
  currentUserId: string
  userRole: 'client' | 'provider'
}

export function CallChat({ callId, currentUserId, userRole }: CallChatProps) {
  const [messages, setMessages] = useState<CallMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    // 1. Carga inicial de mensagens
    supabase
      .from('call_messages')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data as CallMessage[])
        }
      })

    // 2. Inscrição em tempo real via Supabase Realtime
    const channel = supabase
      .channel(`chat:${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_messages',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const newMsg = payload.new as CallMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [callId, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (msgToSend?: string) => {
    const content = msgToSend || text
    if (!content.trim() || sending) return

    setSending(true)
    if (!msgToSend) setText('')

    try {
      const { error } = await supabase.from('call_messages').insert({
        call_id: callId,
        sender_id: currentUserId,
        sender_role: userRole,
        message: content.trim(),
      })

      if (error) {
        console.error('Erro ao enviar mensagem:', error)
      }
    } catch (err) {
      console.error('Falha de envio no chat:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="flex flex-col h-[480px] rounded-2xl overflow-hidden shadow-sm my-4"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* BANNER FIXO OBRIGATÓRIO: AVISO DE MATERIAIS */}
      <div className="bg-amber-50/95 border-b border-amber-200/80 p-3 flex items-start gap-2.5 text-amber-950 text-xs">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <span className="font-bold text-amber-900">Aviso de Materiais:</span> O valor acordado cobre exclusivamente a <strong>mão de obra</strong>. 
          Todas as peças, conectores e insumos devem ser disponibilizados pelo cliente.
        </div>
      </div>

      {/* ÁREA DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6" style={{ color: 'var(--color-text-subtle)' }}>
            <p className="text-xs font-semibold">Nenhuma mensagem ainda.</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-subtle)' }}>
              Use este canal para alinhar detalhes do serviço, ferramentas e peças antes da chegada.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === currentUserId
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                    isMe ? 'text-white rounded-br-none' : 'rounded-bl-none'
                  }`}
                  style={
                    isMe
                      ? { background: 'var(--color-primary)' }
                      : { background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                  }
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                  <span
                    className="text-[9px] block mt-1 text-right font-mono"
                    style={{ color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-subtle)' }}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ATALHOS RÁPIDOS DE PERGUNTAS (PRESTADOR) */}
      {userRole === 'provider' && (
        <div
          className="px-3 py-2 flex gap-1.5 overflow-x-auto text-xs whitespace-nowrap scrollbar-none"
          style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={() => handleSend('Você já está com a peça nova em mãos?')}
            className="inline-flex items-center gap-1 px-2.5 py-1 hover:brightness-125 active:scale-95 rounded-full text-[11px] font-medium transition-all"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
          >
            <Package size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            Já comprou a peça?
          </button>
          <button
            type="button"
            onClick={() => handleSend('A voltagem no local é 110V ou 220V?')}
            className="inline-flex items-center gap-1 px-2.5 py-1 hover:brightness-125 active:scale-95 rounded-full text-[11px] font-medium transition-all"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
          >
            <Zap size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            110V ou 220V?
          </button>
          <button
            type="button"
            onClick={() => handleSend('Já estou me deslocando até o endereço.')}
            className="inline-flex items-center gap-1 px-2.5 py-1 hover:brightness-125 active:scale-95 rounded-full text-[11px] font-medium transition-all"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
          >
            <Car size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            A caminho
          </button>
        </div>
      )}

      {/* CAMPO DE DIGITAÇÃO */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="p-3 flex items-center gap-2"
        style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Combine os detalhes ou peças..."
          className="flex-1 rounded-full px-4 py-2.5 text-xs placeholder-[var(--color-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-all"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full hover:brightness-110 disabled:opacity-40 flex items-center justify-center shrink-0 transition-transform active:scale-95 text-white shadow-sm"
          style={{ background: 'var(--color-primary)' }}
          aria-label="Enviar mensagem"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
