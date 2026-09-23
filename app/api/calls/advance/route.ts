import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { evaluateProviderTransition } from '@/lib/call-transitions'
import { generateArrivalPin } from '@/lib/utils'

// Transições do chamado pedidas pelo prestador: aceitar (app/painel), sair
// para o endereço e concluir (app/chamado). Antes eram UPDATE direto no
// navegador — ver lib/call-transitions.ts. Iniciar o atendimento continua em
// /api/calls/verify-arrival-pin, que exige o PIN do cliente.
const advanceSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
  action: z.enum(['accept', 'on_the_way', 'complete']),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const parsed = advanceSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, action } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('provider_id, status')
      .eq('id', call_id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const decision = evaluateProviderTransition({ userId, call, action })
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status })
    }

    if (action === 'accept') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, is_blocked, background_check_status')
        .eq('id', userId)
        .maybeSingle()

      if (!profile || profile.role !== 'provider') {
        return NextResponse.json({ error: 'Prestador não autorizado' }, { status: 403 })
      }
      if (profile.is_blocked) {
        return NextResponse.json({ error: 'Sua conta de prestador está suspensa temporariamente.' }, { status: 403 })
      }
      if (profile.background_check_status !== 'approved') {
        return NextResponse.json({ error: 'Seu cadastro ainda está em análise de segurança — não é possível aceitar chamados agora.' }, { status: 403 })
      }
    }

    const nowIso = new Date().toISOString()
    const patch: Record<string, string> = { status: decision.to, updated_at: nowIso }
    if (action === 'accept') patch.accepted_at = nowIso
    if (action === 'complete') patch.completed_at = nowIso

    // Condicional no status de origem e no prestador: se o chamado mudou
    // entre a leitura acima e agora (cliente cancelou, passou pro próximo
    // prestador), nada é gravado.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update(patch)
      .eq('id', call_id)
      .eq('provider_id', userId)
      .in('status', [...decision.from])
      .select('id, status')

    if (updateError) {
      console.error('[API /api/calls/advance] Erro ao atualizar chamado:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar o chamado. Tente novamente.' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'O chamado mudou enquanto você respondia. Atualize a tela.' }, { status: 409 })
    }

    if (action === 'accept') {
      // Se esta gravação falhar, /api/calls/verify-arrival-pin gera o PIN na
      // hora de iniciar — o atendimento nunca começa sem PIN.
      const { error: pinError } = await supabaseAdmin
        .from('call_arrival_pins')
        .upsert({ call_id, pin: generateArrivalPin(), failed_attempts: 0, locked_until: null }, { onConflict: 'call_id' })
      if (pinError) {
        console.error('[API /api/calls/advance] Erro ao gravar PIN de chegada:', pinError)
      }
    }

    return NextResponse.json({ success: true, status: decision.to })
  } catch (error) {
    console.error('[API] /api/calls/advance:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
