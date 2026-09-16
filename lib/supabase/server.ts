import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado em Server Components (sem efeito colateral)
          }
        },
      },
    }
  )
}

// Achado crítico (16/09/2026): isto usava createServerClient (a variante
// ciente de cookies do @supabase/ssr), que prioriza o access_token da SESSÃO
// do usuário logado (lido dos cookies) como Authorization Bearer de toda
// chamada — a Service Role Key só valia de verdade quando não havia sessão
// nenhuma. Na prática, toda vez que esta função era chamada dentro de uma
// Route Handler com um usuário de verdade logado (cookies presentes — o caso
// comum), o cliente resultante rodava com a IDENTIDADE DO USUÁRIO, sujeito
// às políticas de RLS dele, não como Service Role de verdade. Ficou mascarado
// até agora porque a maioria das tabelas escritas por essa função também
// tinha alguma política RLS permissiva o bastante pro próprio usuário (ex:
// cliente cancelando o próprio chamado) — só ficou visível como erro
// explícito ao escrever em identity_reports, que não tem NENHUMA política
// pra anon/authenticated de propósito (42501 "violates row-level security
// policy"). Corrigido usando o cliente stateless do @supabase/supabase-js
// (sem cookies nenhum) — mesmo padrão já usado em todo scripts/test-*.mjs
// desta sessão, que sempre bypassaram RLS de verdade.
export async function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
