import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { runInBackground } from '@/lib/background'
import { alertRouteError } from '@/modules/notifications'
import { getRequestUserId } from '@/lib/supabase/request-user'
import { evaluateProviderTransition, isPinLocked, pinAttemptPatch, PIN_LOCK_MINUTES } from '@/lib/call-transitions'
import { generateArrivalPin } from '@/lib/utils'
import { clearOfflineProviderLocation } from '@/lib/provider-location'

// Achado de auditoria (16/09/2026): a checagem do PIN de chegada rodava
// inteiramente no navegador do prestador. Movida pra cá, com limite por IP em
// proxy.ts.
//
// Achado de 23/09/2026: mesmo assim o prestador sabia o PIN — ele era gerado
// no navegador dele e ficava em service_calls.arrival_pin, coluna que ele lê.
// O PIN agora mora em call_arrival_pins (migration
// 20260923_arrival_pin_private_table.sql), que só o cliente do chamado lê, e
// cada chamado trava por PIN_LOCK_MINUTES a cada 5 erros (o limite por IP do
// proxy.ts fica em memória de cada isolate do Worker, não segura sozinho).
const verifyPinSchema = z.object({
  call_id: z.string().uuid('call_id inválido'),
  pin: z.string().trim().max(10),
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

    const parsed = verifyPinSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, pin } = parsed.data
    const supabaseAdmin = await createServiceClient()

    const { data: call } = await supabaseAdmin
      .from('service_calls')
      .select('provider_id, status')
      .eq('id', call_id)
      .maybeSingle()

    if (!call) {
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    const decision = evaluateProviderTransition({ userId, call, action: 'start' })
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: decision.status })
    }

    const { data: pinRow } = await supabaseAdmin
      .from('call_arrival_pins')
      .select('pin, failed_attempts, locked_until')
      .eq('call_id', call_id)
      .maybeSingle()

    // Sem PIN gravado (a gravação no aceite falhou): cria agora. Ele aparece
    // na tela do cliente em poucos segundos — o atendimento nunca começa sem.
    if (!pinRow) {
      const { error: pinError } = await supabaseAdmin
        .from('call_arrival_pins')
        .insert({ call_id, pin: generateArrivalPin() })
      if (pinError) {
        console.error('[API /api/calls/verify-arrival-pin] Erro ao gerar PIN:', pinError)
        return NextResponse.json({ error: 'Erro ao gerar o PIN. Tente novamente.' }, { status: 500 })
      }
      return NextResponse.json(
        { error: 'O PIN acabou de aparecer na tela do cliente. Peça o código de 4 dígitos a ele.' },
        { status: 409 }
      )
    }

    const now = new Date()
    const nowIso = now.toISOString()
    if (isPinLocked(pinRow.locked_until, now)) {
      return NextResponse.json(
        { error: `Muitas tentativas erradas. Aguarde ${PIN_LOCK_MINUTES} minutos e confirme o código com o cliente.` },
        { status: 429 }
      )
    }

    // Reserva a tentativa antes de comparar: só uma requisição avança o
    // contador a partir deste valor, e nunca com o chamado travado.
    const attemptPatch = pinAttemptPatch(pinRow.failed_attempts + 1, now)
    const { data: reserved } = await supabaseAdmin
      .from('call_arrival_pins')
      .update(attemptPatch)
      .eq('call_id', call_id)
      .eq('failed_attempts', pinRow.failed_attempts)
      .or(`locked_until.is.null,locked_until.lt."${nowIso}"`)
      .select('call_id')
    if (!reserved || reserved.length === 0) {
      return NextResponse.json({ error: 'Outra tentativa estava em andamento. Tente de novo.' }, { status: 409 })
    }

    if (pin !== pinRow.pin) {
      const error = attemptPatch.locked_until
        ? `PIN incorreto. Muitas tentativas erradas — aguarde ${PIN_LOCK_MINUTES} minutos.`
        : 'PIN incorreto. Confirme o código de 4 dígitos com o cliente.'
      return NextResponse.json({ error }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('service_calls')
      .update({ status: decision.to, started_at: nowIso, updated_at: nowIso })
      .eq('id', call_id)
      .eq('provider_id', userId)
      .in('status', [...decision.from])
      .select('id')

    if (updateError) {
      console.error('[API /api/calls/verify-arrival-pin] Erro ao iniciar atendimento:', updateError)
      return NextResponse.json({ error: 'Erro ao iniciar atendimento. Tente novamente.' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'O chamado mudou enquanto você confirmava. Atualize a tela.' }, { status: 409 })
    }

    await clearOfflineProviderLocation(supabaseAdmin, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] /api/calls/verify-arrival-pin:', error)
    runInBackground(alertRouteError('/api/calls/verify-arrival-pin'))
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
