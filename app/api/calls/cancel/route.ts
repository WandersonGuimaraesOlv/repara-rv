import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CancelCallPayload } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await createServiceClient()

    // 1. Identifica usuário autenticado via cookies ou cabeçalho Authorization
    let user: { id: string } | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const { data: authData } = await supabaseAdmin.auth.getUser(authHeader.substring(7))
      if (authData?.user) user = authData.user
    }

    if (!user) {
      const supabaseUser = await createClient()
      const { data: authData } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))
      if (authData?.user) user = authData.user
    }

    const body: CancelCallPayload & { cancellation_reason?: string } = await request.json()
    const { call_id, reason, note, cancellation_reason } = body

    if (!call_id) {
      return NextResponse.json({ error: 'call_id é obrigatório' }, { status: 400 })
    }

    const effectiveReason = cancellation_reason || reason || 'Desistência do cliente'

    // 2. Busca o chamado oficial
    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('client_id, provider_id, status')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const isClient = user ? call.client_id === user.id : true
    const isProvider = user ? call.provider_id === user.id : false

    // Cliente só pode cancelar se ainda estiver buscando ou na fila de espera
    if (isClient && !['searching', 'queued', 'no_providers_available'].includes(call.status)) {
      return NextResponse.json(
        { error: 'Cancelamento de cliente só é permitido enquanto o chamado está em busca ou na fila de espera.' },
        { status: 400 }
      )
    }

    // 3. Atualiza o chamado com auditoria completa
    const { error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update({
        status: 'cancelled',
        cancel_reason: 'client_request',
        cancellation_reason: effectiveReason,
        cancel_note: note ?? null,
        cancellation_stage: call.status,
        cancelled_by: user?.id ?? call.client_id,
        cancelled_by_role: isClient ? 'client' : 'provider',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', call_id)

    if (updateError) {
      console.error('[API /api/calls/cancel] Erro ao atualizar:', updateError)
      return NextResponse.json({ error: 'Erro ao cancelar chamado' }, { status: 500 })
    }

    return NextResponse.json({ success: true, cancellation_reason: effectiveReason })
  } catch (error) {
    console.error('[API] /api/calls/cancel:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
