import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabaseAdmin = await createServiceClient()

    // 1. Limpa recipient_gateway_id em provider_status e força status offline
    await supabaseAdmin
      .from('provider_status')
      .update({
        recipient_gateway_id: null,
        is_online: false,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', user.id)

    // 2. Remove registro de subconta em provider_gateway_accounts
    try {
      await supabaseAdmin
        .from('provider_gateway_accounts')
        .delete()
        .eq('provider_id', user.id)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao desvincular conta Mercado Pago' },
      { status: 500 }
    )
  }
}
