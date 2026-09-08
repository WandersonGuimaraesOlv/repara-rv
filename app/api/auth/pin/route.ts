import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { phone, pin } = await req.json()
    const cleanPhone = (phone || '').replace(/\D/g, '')
    const cleanPin = (pin || '').trim()

    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return NextResponse.json(
        { error: 'Digite um celular válido com DDD (10 ou 11 dígitos)' },
        { status: 400 }
      )
    }

    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return NextResponse.json(
        { error: 'O PIN deve ter entre 4 e 8 dígitos' },
        { status: 400 }
      )
    }

    const email = `${cleanPhone}@repararv.com`
    const password = `pin_${cleanPin}`

    const supabaseAdmin = await createServiceClient()

    // Verifica se usuário já existe na base
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = usersData?.users.find(u => u.email === email)

    if (existingUser) {
      return NextResponse.json({
        isNew: false,
        email,
        password,
      })
    }

    // Cria novo usuário de forma imediata (sem cobrança de SMS)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone: cleanPhone },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({
      isNew: true,
      email,
      password,
      userId: newUser.user.id,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar autenticação' },
      { status: 500 }
    )
  }
}
