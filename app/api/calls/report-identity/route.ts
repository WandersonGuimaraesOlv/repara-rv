import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { clearOfflineProviderLocation } from '@/lib/provider-location'

// Denúncia "Não é a pessoa da foto" (verificação de identidade do
// prestador — ver supabase/migrations/20260918_provider_identity_verification.sql).
// Cancela o chamado na hora, sem taxa pro cliente, e registra uma linha em
// identity_reports pendente de revisão do admin. Nunca suspende o prestador
// automaticamente (decisão do dono do projeto no plano aprovado) — só um
// humano decide isso em /admin/usuarios.
const reportIdentitySchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
  reason: z.string().trim().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const parsed = reportIdentitySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, reason } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('client_id, provider_id, status')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    // Só o cliente do próprio chamado pode denunciar, e só enquanto existe um
    // prestador vinculado ainda não concluído — diferente de
    // app/api/calls/cancel, aqui o cliente PODE agir mesmo com o chamado já
    // aceito/a caminho/em andamento, porque é exatamente essa janela que a
    // denúncia de identidade existe pra cobrir.
    if (call.client_id !== user.id) {
      return NextResponse.json({ error: 'Você não tem permissão para denunciar este chamado' }, { status: 403 })
    }
    if (!call.provider_id || !['accepted', 'on_the_way', 'in_progress'].includes(call.status || '')) {
      return NextResponse.json({ error: 'Este chamado não pode ser denunciado neste momento' }, { status: 400 })
    }

    const { error: cancelError } = await supabaseAdmin
      .from('service_calls')
      .update({
        status: 'cancelled',
        cancel_reason: 'other',
        cancellation_reason: 'Denúncia de identidade — prestador não corresponde à foto',
        cancel_note: reason ?? null,
        cancellation_stage: call.status,
        cancelled_by: user.id,
        cancelled_by_role: 'client',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', call_id)

    if (cancelError) {
      console.error('[API /api/calls/report-identity] Erro ao cancelar chamado:', cancelError)
      return NextResponse.json({ error: 'Erro ao cancelar chamado' }, { status: 500 })
    }

    await clearOfflineProviderLocation(supabaseAdmin, call.provider_id)

    const { error: reportError } = await supabaseAdmin
      .from('identity_reports')
      .insert({
        call_id,
        client_id: user.id,
        provider_id: call.provider_id,
        reason: reason ?? null,
        status: 'pending_review',
      })

    if (reportError) {
      // O chamado já foi cancelado (prioridade de segurança do cliente) —
      // loga alto mesmo que o registro da denúncia falhe, pra não perder o
      // rastro de compliance.
      console.error('[API /api/calls/report-identity] Chamado cancelado mas falha ao gravar denúncia:', reportError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] /api/calls/report-identity:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
