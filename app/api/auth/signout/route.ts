import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
  } catch {}

  const cookieStore = await cookies()
  const all = cookieStore.getAll()

  const response = NextResponse.json({ success: true })

  // Limpa explicitamente todos os cookies de sessão
  for (const c of all) {
    if (
      c.name.startsWith('sb-') ||
      c.name.includes('auth') ||
      c.name.includes('token') ||
      c.name.startsWith('repara_')
    ) {
      try {
        cookieStore.delete(c.name)
      } catch {}
      response.cookies.set(c.name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    }
  }

  return response
}

export async function GET() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {})
  } catch {}

  const cookieStore = await cookies()
  const all = cookieStore.getAll()

  const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com')
  const response = NextResponse.redirect(loginUrl)

  for (const c of all) {
    if (
      c.name.startsWith('sb-') ||
      c.name.includes('auth') ||
      c.name.includes('token') ||
      c.name.startsWith('repara_')
    ) {
      try {
        cookieStore.delete(c.name)
      } catch {}
      response.cookies.set(c.name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    }
  }

  return response
}
