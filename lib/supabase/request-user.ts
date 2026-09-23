import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Id do usuário logado numa Route Handler: token Bearer (scripts, ex.
// scripts/synthetic-monitor.mjs) ou cookie de sessão (o app no navegador) —
// mesma ordem de app/api/calls/cancel/route.ts.
export async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const supabaseAdmin = await createServiceClient()
    const { data } = await supabaseAdmin.auth.getUser(authHeader.substring(7))
    if (data?.user) return data.user.id
  }

  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))
  return user?.id ?? null
}
