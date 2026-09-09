import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login primeiro.' }, { status: 401 })
    }

    const clientId = process.env.MERCADOPAGO_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'MERCADOPAGO_CLIENT_ID não configurado no servidor' },
        { status: 500 }
      )
    }

    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
    const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
      ? rawAppUrl
      : 'https://repararv.com'

    const redirectUri = `${appUrl}/api/mercadopago/oauth/callback`

    // URL oficial de autorização OAuth do Mercado Pago
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${user.id}&redirect_uri=${encodeURIComponent(redirectUri)}`

    return NextResponse.json({
      success: true,
      url: authUrl,
      redirectUri,
    })
  } catch (err: any) {
    console.error('[API /api/mercadopago/oauth/url] Erro inesperado:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar URL de autorização Mercado Pago' },
      { status: 500 }
    )
  }
}
