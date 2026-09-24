import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { runInBackground } from '@/lib/background'
import { evaluateWarrantyClaim, warrantyClaimSchema } from '@/lib/warranty'
import { alertAboutWarrantyClaim, alertRouteError } from '@/modules/notifications'

// Garantia de 7 dias acionada pelo cliente no app (pedido do dono em
// 24/09/2026 — antes só existia "fale com o suporte"). Regras em
// lib/warranty.ts; a equipe resolve ou recusa no painel admin, e o repasse do
// chamado fica suspenso enquanto a garantia estiver aberta (lib/payouts.ts).
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

    const parsed = warrantyClaimSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 422 })
    }

    const { call_id, description } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('client_id, provider_id, status, payment_status, completed_at, service:quick_services(name)')
      .eq('id', call_id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const decision = evaluateWarrantyClaim({ userId, call, now: Date.now() })
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status })
    }

    const { data: claim, error: insertError } = await supabaseAdmin
      .from('warranty_claims')
      .insert({ call_id, client_id: userId, provider_id: call.provider_id, description })
      .select('id, status, created_at')
      .single()

    if (insertError) {
      // Índice único warranty_claims_one_open_per_call
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Já existe uma garantia aberta para este chamado. A equipe vai entrar em contato.' }, { status: 409 })
      }
      console.error('[API /api/calls/warranty] Erro ao registrar a garantia:', insertError)
      return NextResponse.json({ error: 'Não foi possível registrar agora. Tente de novo.' }, { status: 500 })
    }

    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
    const appUrl = rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost') ? rawAppUrl : 'https://repararv.com'
    runInBackground(
      alertAboutWarrantyClaim({
        callId: call_id,
        providerId: call.provider_id,
        serviceName: (call.service as { name?: string } | null)?.name ?? 'Serviço residencial',
        description,
        appUrl,
      })
    )

    return NextResponse.json({ success: true, claim })
  } catch (error) {
    console.error('[API] /api/calls/warranty:', error)
    runInBackground(alertRouteError('/api/calls/warranty'))
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
