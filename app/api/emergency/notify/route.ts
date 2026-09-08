import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { EmergencyNotifyPayload } from '@/lib/types'
import { formatEmergencyMessage } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body: EmergencyNotifyPayload = await request.json()
    const { call_id, user_role, latitude, longitude, triggered_by } = body

    if (!call_id) {
      return NextResponse.json({ error: 'call_id é obrigatório' }, { status: 400 })
    }

    // Modo Demonstração
    if (call_id.startsWith('demo-')) {
      const isClient = user_role !== 'provider'
      const message = formatEmergencyMessage({
        callerName: isClient ? 'Dona Maria (Cliente Demo)' : 'Carlos Eletricista (Prestador Demo)',
        callerRole: user_role || 'client',
        callerPhone: isClient ? '64991234567' : '64999998888',
        otherPartyName: isClient ? 'Carlos Eletricista (Rio Verde)' : 'Dona Maria (Bairro Popular)',
        otherPartyRole: isClient ? 'provider' : 'client',
        otherPartyPhone: isClient ? '64999998888' : '64991234567',
        serviceName: 'Troca de Chuveiro / Resistência',
        address: 'Rua das Flores, 142 - Bairro Popular, Rio Verde (GO)',
        latitude: latitude ?? -17.8014,
        longitude: longitude ?? -50.9264,
        callId: call_id,
      })

      console.warn('🚨 [EMERGENCY SOS DISPATCHED - MODO DEMO]\n' + message)

      // Webhook externo opcional (WhatsApp / Telegram)
      if (process.env.EMERGENCY_WEBHOOK_URL) {
        try {
          await fetch(process.env.EMERGENCY_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'emergency_sos',
              demo: true,
              call_id,
              user_role,
              text: message,
              latitude: latitude ?? -17.8014,
              longitude: longitude ?? -50.9264,
              created_at: new Date().toISOString(),
            }),
          })
        } catch (webhookErr) {
          console.error('[SOS Webhook Error (Demo)]', webhookErr)
        }
      }

      return NextResponse.json({
        success: true,
        alert_id: `demo-alert-${Date.now()}`,
        message,
      })
    }

    // Modo Produção / Supabase
    const supabase = await createServiceClient()

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const resolvedUserId = user?.id || triggered_by

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

    const callerId = resolvedUserId || (user_role === 'provider' ? call.provider_id : call.client_id)
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

    return NextResponse.json({
      success: true,
      alert_id: alertRecord?.id ?? 'recorded',
      message,
    })
  } catch (err) {
    console.error('[Emergency API Internal Error]', err)
    return NextResponse.json({ error: 'Erro interno ao processar alerta SOS' }, { status: 500 })
  }
}
