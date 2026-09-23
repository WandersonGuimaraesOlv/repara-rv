import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { evaluateCancelAuthorization, resolveCancelReasonEnum, shouldChargeNoShowFee } from '@/lib/cancel-authorization'

// `reason` aceita qualquer string, não um enum fixo — ver o comentário em
// lib/cancel-authorization.ts (resolveCancelReasonEnum) pro porquê: o cliente
// manda rótulo livre em português, o prestador manda um valor estruturado, e
// exigir o enum aqui rejeitava (422) todo cancelamento de cliente.
const cancelCallSchema = z.object({
  call_id:              z.string().uuid('call_id inválido'),
  reason:                z.string().trim().min(1).max(200).optional(),
  note:                  z.string().trim().max(500).optional(),
  cancellation_reason:   z.string().trim().max(500).optional(),
})

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

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const parsed = cancelCallSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, reason, note, cancellation_reason } = parsed.data

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

    // Autorização: só o cliente ou o prestador vinculados a este chamado podem
    // cancelá-lo, e o cliente só enquanto o chamado ainda não tem prestador
    // comprometido. Requisição sem usuário autenticado é rejeitada (401) —
    // antes disso um `user` nulo era tratado como "é o cliente", o que
    // permitia cancelar chamados alheios sem autenticação nenhuma.
    const authResult = evaluateCancelAuthorization({
      userId: user?.id ?? null,
      call,
    })

    if (!authResult.allowed) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { isClient, isProvider } = authResult
    const resolvedReason = resolveCancelReasonEnum(reason, isClient)

    // Taxa de deslocamento (R$25, já prometida em /termos) — só quando o
    // PRESTADOR cancela por cliente ausente no portão. Ver
    // lib/cancel-authorization.ts::shouldChargeNoShowFee.
    const chargeNoShowFee = shouldChargeNoShowFee(resolvedReason, isProvider, call.status)

    // 3. Atualiza o chamado com auditoria completa
    const { error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update({
        status: 'cancelled',
        cancel_reason: resolvedReason,
        cancellation_reason: effectiveReason,
        cancel_note: note ?? null,
        cancellation_stage: call.status,
        cancelled_by: user?.id ?? call.client_id,
        cancelled_by_role: isClient ? 'client' : 'provider',
        cancelled_at: new Date().toISOString(),
        ...(chargeNoShowFee ? { no_show_fee_status: 'pending' } : {}),
      })
      .eq('id', call_id)

    if (updateError) {
      console.error('[API /api/calls/cancel] Erro ao atualizar:', updateError)
      return NextResponse.json({ error: 'Erro ao cancelar chamado' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cancellation_reason: effectiveReason,
      no_show_fee_pending: chargeNoShowFee,
    })
  } catch (error) {
    console.error('[API] /api/calls/cancel:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
