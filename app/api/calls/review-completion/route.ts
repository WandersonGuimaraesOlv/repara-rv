import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { runInBackground } from '@/lib/background'
import { completionReviewPatch, completionReviewSchema, evaluateCompletionReview } from '@/lib/completion-review'
import { alertAboutCompletionIssue, alertRouteError } from '@/modules/notifications'

// Conferência do serviço pelo cliente antes do Pix (pedido do dono em
// 24/09/2026 — ver lib/completion-review.ts). Aprovar leva a completed (o Pix
// aparece na tela do cliente); apontar problema volta pra in_progress e avisa
// o técnico e a equipe. Nada aprova sozinho.
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

    const parsed = completionReviewSchema.safeParse(rawBody)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json({ error: firstIssue?.message ?? 'Dados inválidos' }, { status: 422 })
    }

    const input = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('client_id, provider_id, status, completion_issue_count, service:quick_services(name)')
      .eq('id', input.call_id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const decision = evaluateCompletionReview({ userId, call })
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status })
    }

    const patch = completionReviewPatch(input, {
      approvedBy: userId,
      issueCount: call.completion_issue_count ?? 0,
      nowIso: new Date().toISOString(),
    })

    // Condicional no status: dois toques seguidos (ou admin decidindo ao mesmo
    // tempo) não gravam duas vezes.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update(patch)
      .eq('id', input.call_id)
      .eq('status', 'awaiting_approval')
      .select('id, status')

    if (updateError) {
      console.error('[API /api/calls/review-completion] Erro ao gravar a conferência:', updateError)
      return NextResponse.json({ error: 'Não foi possível registrar agora. Tente de novo.' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'O chamado mudou enquanto você respondia. Atualize a tela.' }, { status: 409 })
    }

    if (input.decision === 'reject' && call.provider_id) {
      const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
      const appUrl = rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost') ? rawAppUrl : 'https://repararv.com'
      runInBackground(
        alertAboutCompletionIssue({
          callId: input.call_id,
          providerId: call.provider_id,
          serviceName: (call.service as { name?: string } | null)?.name ?? 'Serviço residencial',
          reason: input.reason,
          issueCount: (call.completion_issue_count ?? 0) + 1,
          appUrl,
        })
      )
    }

    return NextResponse.json({ success: true, status: patch.status })
  } catch (error) {
    console.error('[API] /api/calls/review-completion:', error)
    runInBackground(alertRouteError('/api/calls/review-completion'))
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
