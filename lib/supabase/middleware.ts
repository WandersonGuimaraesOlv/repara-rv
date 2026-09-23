import { createServerClient } from '@supabase/ssr'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  // Rotas protegidas — redireciona para login se não autenticado
  const protectedPaths = ['/chamar', '/acompanhar', '/painel', '/chamado']
  const isProtected = protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  // Falha de rede ao consultar o Supabase Auth não é "sem login": deixa a
  // página abrir (ela e as rotas de API conferem a sessão de novo) em vez de
  // mandar quem está logado pro login por um soluço de conexão.
  if (!user && isProtected && !isAuthRetryableFetchError(error)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Volta pra cá depois do login (app/login/page.tsx, safeRedirectPath)
    url.search = ''
    url.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
