'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, AlertCircle, Loader2 } from 'lucide-react'
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
    <div className="flex flex-col h-[480px] border border-slate-200/90 rounded-2xl bg-slate-50 overflow-hidden shadow-sm my-4">
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
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <p className="text-xs font-semibold">Nenhuma mensagem ainda.</p>
            <p className="text-[11px] mt-1 text-slate-400">
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
                    isMe
                      ? 'bg-orange-500 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                  <span
                    className={`text-[9px] block mt-1 text-right font-mono ${
                      isMe ? 'text-orange-100' : 'text-slate-400'
                    }`}
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
        <div className="px-3 py-2 bg-white border-t border-slate-200/80 flex gap-1.5 overflow-x-auto text-xs whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => handleSend('Você já está com a peça nova em mãos?')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-slate-700 text-[11px] font-medium transition-all"
          >
            📦 Já comprou a peça?
          </button>
          <button
            type="button"
            onClick={() => handleSend('A voltagem no local é 110V ou 220V?')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-slate-700 text-[11px] font-medium transition-all"
          >
            ⚡ 110V ou 220V?
          </button>
          <button
            type="button"
            onClick={() => handleSend('Já estou me deslocando até o endereço.')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-slate-700 text-[11px] font-medium transition-all"
          >
            🚗 A caminho
          </button>
        </div>
      )}

      {/* CAMPO DE DIGITAÇÃO */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Combine os detalhes ou peças..."
          className="flex-1 rounded-full bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center shrink-0 transition-transform active:scale-95 text-white shadow-sm"
          aria-label="Enviar mensagem"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
