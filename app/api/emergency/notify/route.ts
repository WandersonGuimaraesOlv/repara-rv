import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatEmergencyMessage } from '@/lib/utils'

// user_role e triggered_by que o cliente mandava aqui nunca foram usados pra
// autorização de verdade (achado de segurança, ver comentário abaixo) — o
// papel de quem aciona e o call_id ao qual está vinculado agora vêm sempre
// da sessão autenticada + do próprio chamado, nunca de entrada do usuário.
const emergencyNotifySchema = z.object({
  call_id:   z.string().uuid('call_id inválido'),
  latitude:  z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const parsed = emergencyNotifySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, latitude, longitude } = parsed.data

    // Achado de segurança (16/09/2026): esta rota não tinha NENHUM check de
    // autorização — qualquer call_id devolvia nome/telefone/endereço/GPS das
    // duas partes no corpo da resposta. Autenticação real via cookie
    // (createClient, não createServiceClient — que não tem cookie nenhum e
    // sempre devolveria user=null aqui) + confirmação de que quem está
    // chamando é de fato cliente ou prestador DESTE chamado, antes de
    // qualquer leitura sensível.
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Busca detalhes do chamado
    const { data: call, error: callError } = await supabase
      .from('service_calls')
      .select('*, service:quick_services(name), client:profiles!client_id(*), provider:profiles!provider_id(*)')
      .eq('id', call_id)
      .single()

    if (callError || !call) {
      console.error('[SOS Error] Chamado não encontrado:', call_id, callError)
      return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    }

    if (call.client_id !== user.id && call.provider_id !== user.id) {
      return NextResponse.json({ error: 'Você não tem permissão para acionar SOS neste chamado' }, { status: 403 })
    }

    const user_role: 'client' | 'provider' = call.provider_id === user.id ? 'provider' : 'client'
    const callerId = user.id
    const clientCoords = call.client_location?.coordinates
    const lat = latitude ?? (Array.isArray(clientCoords) ? clientCoords[1] : undefined)
    const lng = longitude ?? (Array.isArray(clientCoords) ? clientCoords[0] : undefined)

    // Registra o incidente na tabela emergency_alerts
    const { data: alertRecord, error: insertError } = await supabase
      .from('emergency_alerts')
      .insert({
        call_id,
        triggered_by: callerId,
        user_role: user_role || 'client',
        latitude: lat ?? null,
        longitude: lng ?? null,
        resolved: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[SOS Error] Falha ao inserir emergency_alerts:', insertError)
      // Não aborta: o alerta deve ser transmitido mesmo com falha no banco
    }

    const isClient = user_role !== 'provider'
    const callerProfile = isClient ? call.client : call.provider
    const otherProfile = isClient ? call.provider : call.client

    const message = formatEmergencyMessage({
      callerName: callerProfile?.full_name || (isClient ? 'Cliente' : 'Prestador'),
      callerRole: user_role || 'client',
      callerPhone: callerProfile?.phone || 'Não informado',
      otherPartyName: otherProfile?.full_name || (isClient ? 'Prestador no local' : 'Cliente no local'),
      otherPartyRole: isClient ? 'provider' : 'client',
      otherPartyPhone: otherProfile?.phone || 'Não informado',
      serviceName: call.service?.name || 'Serviço Repara RV',
      address: call.client_address,
      latitude: lat,
      longitude: lng,
      callId: call_id,
    })

    console.error('🚨 [ALERTA DE EMERGÊNCIA DISPARADO]\n' + message)

    // Dispara webhook dos fundadores (se configurado)
    if (process.env.EMERGENCY_WEBHOOK_URL) {
      try {
        await fetch(process.env.EMERGENCY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'emergency_sos',
            alert_id: alertRecord?.id,
            call_id,
            user_role,
            text: message,
            latitude: lat,
            longitude: lng,
            created_at: new Date().toISOString(),
          }),
        })
      } catch (webhookErr) {
        console.error('[SOS Webhook Error]', webhookErr)
      }
    }

    // components/emergency-sos-button.tsx dispara essa chamada fire-and-forget
    // (keepalive, .catch() só) e nunca lê o corpo da resposta — não devolve
    // mais `message` (nome/telefone/endereço/GPS das duas partes) pra quem
    // chamou, mesmo já autorizado, por não ter utilidade nenhuma pro cliente.
    return NextResponse.json({
      success: true,
      alert_id: alertRecord?.id ?? 'recorded',
    })
  } catch (err) {
    console.error('[Emergency API Internal Error]', err)
    return NextResponse.json({ error: 'Erro interno ao processar alerta SOS' }, { status: 500 })
  }
}
