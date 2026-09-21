import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { pushCallAlert } from '@/modules/notifications'

const notifyQueueSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
})

// Avisa os prestadores, por notificação push no app, de um chamado que entrou
// na fila prioritária. Não existe mais envio por WhatsApp: decisão do dono
// (21/09/2026) — o risco de banimento dos números de WhatsApp da plataforma é
// maior que o ganho, então os alertas ficam dentro do app.
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = notifyQueueSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id } = parsed.data

    const supabase = await createServiceClient()

    const { data: call, error: callErr } = await supabase
      .from('service_calls')
      .select('id, status')
      .eq('id', call_id)
      .single()

    if (callErr || !call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    // Achado de segurança (16/09/2026): rota sem nenhum check antes — qualquer
    // call_id disparava alerta pra TODOS os prestadores. Só dispara se o
    // chamado estiver mesmo 'queued' (chamada internamente logo depois dessa
    // transição, por app/api/calls/create e app/api/calls/skip-provider).
    if (call.status !== 'queued') {
      return NextResponse.json({ error: 'Chamado não está na fila' }, { status: 400 })
    }

    // Push pros prestadores aprovados e não bloqueados que ativaram as notificações.
    const push = await pushCallAlert({ callId: call_id })

    console.log(`📢 [Fila Prioritária] Push do chamado #${call_id.slice(0, 8)}:`, JSON.stringify(push))

    return NextResponse.json({ success: true, call_id, push })
  } catch (err) {
    console.error('[API /api/calls/notify-queue] Erro interno:', err)
    return NextResponse.json({ error: 'Erro ao notificar prestadores da fila' }, { status: 500 })
  }
}
