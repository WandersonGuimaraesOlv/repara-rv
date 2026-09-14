import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const STATE_COOKIE = 'mp_oauth_state'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
  const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
    ? rawAppUrl
    : 'https://repararv.com'

  if (error) {
    console.error('[OAuth Callback] Erro retornado pelo Mercado Pago:', error, errorDescription)
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code || !returnedState) {
    console.error('[OAuth Callback] Código ou state ausente:', { code, returnedState })
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent('Código de autorização inválido')}`
    )
  }

  // Achado de segurança (14/09/2026): antes disso, `state` era usado direto como
  // provider_id, sem checar sessão — qualquer um podia forjar `state=<uuid-alheio>`
  // e sequestrar o repasse Pix de outro prestador com a PRÓPRIA conta Mercado
  // Pago. Corrigido em duas camadas: (1) `state` só serve como nonce CSRF,
  // comparado contra o cookie httpOnly gerado em /api/mercadopago/oauth/url —
  // nunca mais interpretado como identidade; (2) o provider_id vem exclusivamente
  // da sessão autenticada verificada aqui, nunca de um valor vindo da URL.
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)

  if (!expectedState || expectedState !== returnedState) {
    console.error('[OAuth Callback] state CSRF inválido ou ausente — possível tentativa forjada')
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent('Sessão de autorização expirada. Tente conectar novamente.')}`
    )
  }

  const supabaseSession = await createClient()
  const { data: { user }, error: sessionError } = await supabaseSession.auth.getUser()

  if (sessionError || !user) {
    console.error('[OAuth Callback] Sessão não autenticada no momento do callback')
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent('Faça login novamente e repita a conexão com o Mercado Pago.')}`
    )
  }

  const providerId = user.id

  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/mercadopago/oauth/callback`

  if (!clientId || !clientSecret) {
    console.error('[OAuth Callback] Credenciais de client_id/secret ausentes no ambiente')
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent('Configuração do servidor incompleta')}`
    )
  }

  try {
    // 1. Troca o código de autorização pelos tokens de acesso da subconta
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[OAuth Callback] Erro na troca de token do Mercado Pago:', tokenData)
      return NextResponse.redirect(
        `${appUrl}/painel?mp_error=${encodeURIComponent(tokenData.message || 'Falha ao autenticar conta com Mercado Pago')}`
      )
    }

    const supabaseAdmin = await createServiceClient()

    // 2. Salva as credenciais completas na tabela de subcontas
    try {
      await supabaseAdmin.from('provider_gateway_accounts').upsert({
        provider_id: providerId,
        gateway: 'mercadopago',
        mp_user_id: String(tokenData.user_id),
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token || null,
        mp_public_key: tokenData.public_key || null,
        live_mode: tokenData.live_mode ?? true,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (dbErr) {
      console.warn('[OAuth Callback] provider_gateway_accounts pendente de migração:', dbErr)
    }

    // 3. Atualiza ou insere recipient_gateway_id na tabela provider_status
    await supabaseAdmin
      .from('provider_status')
      .upsert({
        provider_id: providerId,
        recipient_gateway_id: String(tokenData.user_id),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider_id' })

    // 4. Marca flag em profiles de forma defensiva
    try {
      await supabaseAdmin
        .from('profiles')
        .update({
          mercado_pago_connected: true,
        })
        .eq('id', providerId)
    } catch {
      // Silencioso caso a coluna mercado_pago_connected ainda não exista no schema
    }

    console.log(`[OAuth Callback] Prestador ${providerId} conectou com sucesso conta MP ${tokenData.user_id}`)

    return NextResponse.redirect(`${appUrl}/painel?mp_connected=true`)
  } catch (err: any) {
    console.error('[OAuth Callback] Exceção inesperada:', err)
    return NextResponse.redirect(
      `${appUrl}/painel?mp_error=${encodeURIComponent(err?.message || 'Erro inesperado')}`
    )
  }
}
