import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CancelCallPayload } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body: CancelCallPayload = await request.json()
    const { call_id, reason, note } = body

    if (!call_id || !reason) {
      return NextResponse.json({ error: 'call_id e reason são obrigatórios' }, { status: 400 })
    }

    // Verifica se o usuário tem permissão para cancelar este chamado
    const { data: call } = await supabase
      .from('service_calls')
      .select('client_id, provider_id, status')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const isClient = call.client_id === user.id
    const isProvider = call.provider_id === user.id

    if (!isClient && !isProvider) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Cliente só pode cancelar se ainda estiver buscando
    if (isClient && !['searching', 'no_providers_available'].includes(call.status)) {
      return NextResponse.json(
        { error: 'Cancelamento de cliente só é permitido enquanto o chamado está sendo buscado.' },
        { status: 400 }
      )
    }

    // Atualiza o chamado
    const { error: updateError } = await supabase
      .from('service_calls')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancel_note: note ?? null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', call_id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao cancelar chamado' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] /api/calls/cancel:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
