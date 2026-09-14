import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Nome e duração do cookie de nonce CSRF do fluxo OAuth — precisa sobreviver
// à ida e volta completa até auth.mercadopago.com.br (10 min é folgado).
const STATE_COOKIE = 'mp_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600

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

    // Achado de segurança (14/09/2026): `state` chegou a ser o próprio user.id, sem
    // assinatura nenhuma — o callback usava esse valor direto como provider_id pra
    // vincular a conta MP retornada, sem checar sessão. Qualquer pessoa podia
    // completar o OAuth com a PRÓPRIA conta MP e forjar `state=<uuid-de-outro-
    // prestador>` no callback, sequestrando o repasse Pix futuro dele. Corrigido:
    // `state` agora é só um nonce CSRF aleatório, guardado num cookie httpOnly —
    // o callback ignora completamente quem o `state` "diz" ser e usa a sessão
    // autenticada de verdade pra decidir a quem vincular a conta.
    const stateNonce = crypto.randomUUID()
    const cookieStore = await cookies()
    cookieStore.set(STATE_COOKIE, stateNonce, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: '/api/mercadopago/oauth',
    })

    // URL oficial de autorização OAuth do Mercado Pago Brasil
    const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${stateNonce}&redirect_uri=${encodeURIComponent(redirectUri)}`

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
