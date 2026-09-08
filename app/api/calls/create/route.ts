import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CreateCallPayload } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()

    // Autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body: CreateCallPayload = await request.json()
    const { service_id, client_address, client_lat, client_lng } = body

    if (!service_id || !client_address) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Busca o serviço
    const { data: service } = await supabase
      .from('quick_services')
      .select('*')
      .eq('id', service_id)
      .eq('is_active', true)
      .single()

    if (!service) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    // Busca prestador mais próximo via PostGIS
    const { data: nearestProvider } = await supabase.rpc('find_nearest_provider', {
      call_location: `SRID=4326;POINT(${client_lng} ${client_lat})`,
      excluded_ids: [],
    })

    // Cria o chamado
    const { data: call, error: callError } = await supabase
      .from('service_calls')
      .insert({
        client_id: user.id,
        provider_id: nearestProvider ?? null,
        service_id,
        total_price: service.fixed_price,
        platform_fee: service.platform_fee,
        provider_cut: service.fixed_price - service.platform_fee,
        status: nearestProvider ? 'accepted' : 'no_providers_available',
        client_address,
        client_location: `SRID=4326;POINT(${client_lng} ${client_lat})`,
        accepted_at: nearestProvider ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Erro ao criar chamado' }, { status: 500 })
    }

    return NextResponse.json({ call_id: call.id, status: call.status })
  } catch (error) {
    console.error('[API] /api/calls/create:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
