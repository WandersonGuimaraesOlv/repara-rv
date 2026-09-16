import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Achado de auditoria (16/09/2026): a checagem do PIN de chegada
// (service_calls.arrival_pin) rodava inteiramente no navegador do prestador,
// comparando contra um valor que o próprio prestador já tinha em mãos (a
// mesma linha que ele buscou via select('*')) — sem tentativa limitada, sem
// verificação de servidor. Move a decisão que realmente importa (a
// transição pra in_progress) pro servidor: exige sessão do prestador
// vinculado ao chamado E limita tentativas por IP (proxy.ts), fechando o
// caminho de força bruta às cegas. Residual documentado, não resolvido
// aqui por desproporcional ao risco: arrival_pin ainda aparece na linha que
// o prestador já lê (select('*') em app/chamado/[callId]/page.tsx) e em
// eventos Realtime dessa linha — RLS decide LINHA, não COLUNA, então
// esconder de verdade exigiria uma view separada. Ameaça real é baixa
// (prestador já é aprovado/verificado; o PIN é fricção adicional, não a
// única defesa — ver também o card de identificação e a denúncia "não é a
// pessoa da foto").
const verifyPinSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
  pin: z.string().trim().max(10),
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

    const parsed = verifyPinSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, pin } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('provider_id, status, arrival_pin')
      .eq('id', call_id)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    if (call.provider_id !== user.id) {
      return NextResponse.json({ error: 'Você não tem permissão para iniciar este atendimento' }, { status: 403 })
    }

    if (call.status !== 'accepted' && call.status !== 'on_the_way') {
      return NextResponse.json({ error: 'Este chamado não está pronto pra iniciar atendimento' }, { status: 400 })
    }

    // Chamados aceitos antes desta feature não têm PIN (arrival_pin null) —
    // não bloqueia, pra não travar atendimento em andamento no deploy.
    if (call.arrival_pin && pin !== call.arrival_pin) {
      return NextResponse.json({ error: 'PIN incorreto. Confirme o código de 4 dígitos com o cliente.' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', call_id)

    if (updateError) {
      console.error('[API /api/calls/verify-arrival-pin] Erro ao iniciar atendimento:', updateError)
      return NextResponse.json({ error: 'Erro ao iniciar atendimento. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] /api/calls/verify-arrival-pin:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
