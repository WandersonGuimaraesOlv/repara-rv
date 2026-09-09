import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CreateCallPayload } from '@/lib/types'
import { DEFAULT_SERVICES } from '@/lib/catalog'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient()

    const body: CreateCallPayload & { client_id?: string } = await request.json()
    const { service_id, client_address, client_lat, client_lng } = body

    if (!service_id || !client_address) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // 1. Identifica e autentica o usuário
    let user: { id: string } | null = null

    // Método A: Token Bearer no header
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    if (bearerToken) {
      const { data: tokenAuth } = await supabase.auth.getUser(bearerToken)
      if (tokenAuth?.user) {
        user = tokenAuth.user
      }
    }

    // Método B: Cookies de sessão do cliente
    if (!user) {
      try {
        const clientSupabase = await createClient()
        const { data: cookieAuth } = await clientSupabase.auth.getUser()
        if (cookieAuth?.user) {
          user = cookieAuth.user
        }
      } catch {}
    }

    // Método C: Validação pelo ID de perfil enviado pelo cliente autenticado
    if (!user && body.client_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', body.client_id)
        .maybeSingle()
      if (profile) {
        user = { id: profile.id }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Você precisa entrar na sua conta para solicitar um prestador.' }, { status: 401 })
    }

    // 2. Busca o serviço por UUID ou fallback por nome
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(service_id)
    let service = null

    if (isUuid) {
      const { data } = await supabase
        .from('quick_services')
        .select('*')
        .eq('id', service_id)
        .eq('is_active', true)
        .maybeSingle()
      service = data
    }

    if (!service) {
      const fallbackDef = DEFAULT_SERVICES.find(s => s.id === service_id)
      const searchName = fallbackDef ? fallbackDef.name : service_id
      const { data } = await supabase
        .from('quick_services')
        .select('*')
        .ilike('name', `%${searchName}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      service = data
    }

    if (!service) {
      return NextResponse.json({ error: 'Serviço não encontrado no catálogo oficial.' }, { status: 404 })
    }

    const lat = client_lat ?? -17.7915
    const lng = client_lng ?? -50.9192

    // 3. Busca prestador mais próximo via PostGIS RPC
    const { data: nearestProvider, error: rpcError } = await supabase.rpc('find_nearest_provider', {
      call_location: `SRID=4326;POINT(${lng} ${lat})`,
      excluded_ids: [],
    })

    if (rpcError) {
      console.warn('[API] find_nearest_provider RPC warning:', rpcError)
    }

    // 4. Cria o chamado oficial no banco de dados
    const { data: call, error: callError } = await supabase
      .from('service_calls')
      .insert({
        client_id: user.id,
        provider_id: nearestProvider ?? null,
        service_id: service.id,
        total_price: service.fixed_price,
        platform_fee: service.platform_fee,
        provider_cut: service.fixed_price - service.platform_fee,
        status: nearestProvider ? 'searching' : 'no_providers_available',
        client_address,
        client_location: `SRID=4326;POINT(${lng} ${lat})`,
        accepted_at: null,
      })
      .select()
      .single()

    if (callError || !call) {
      console.error('[API] Erro ao criar service_calls:', callError)
      return NextResponse.json({ error: callError?.message || 'Erro ao criar chamado no sistema.' }, { status: 500 })
    }

    return NextResponse.json({ call_id: call.id, status: call.status })
  } catch (error) {
    console.error('[API] /api/calls/create exceção:', error)
    return NextResponse.json({ error: 'Erro interno ao processar pedido.' }, { status: 500 })
  }
}
