import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      fullName,
      phone,
      pin,
      role = 'client',
      cpfOrCnpj,
      pixKey,
      pixKeyType = 'phone',
      selfDeclaration = true,
    } = body

    const cleanFullName = (fullName || '').trim()
    const cleanPhone = (phone || '').replace(/\D/g, '')
    const cleanPin = (pin || '').trim()
    const validRole = role === 'provider' ? 'provider' : 'client'

    if (cleanFullName.length < 3) {
      return NextResponse.json(
        { error: 'Digite seu nome completo (mínimo 3 caracteres)' },
        { status: 400 }
      )
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return NextResponse.json(
        { error: 'Digite um celular válido com DDD (10 ou 11 dígitos)' },
        { status: 400 }
      )
    }

    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return NextResponse.json(
        { error: 'O PIN deve conter entre 4 e 8 dígitos numéricos' },
        { status: 400 }
      )
    }

    if (validRole === 'provider' && !pixKey?.trim()) {
      return NextResponse.json(
        { error: 'Profissionais precisam informar a chave Pix para receber os repasses de serviços' },
        { status: 400 }
      )
    }

    const email = `${cleanPhone}@repararv.com`
    const password = `pin_${cleanPin}`

    const supabaseAdmin = await createServiceClient()

    // 1. Verifica se já existe usuário com este e-mail/telefone
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = usersData?.users.find(u => u.email === email)

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'Este número de celular já possui cadastro. Faça login com seu PIN.',
          userExists: true,
        },
        { status: 409 }
      )
    }

    // 2. Cria o usuário no Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone: cleanPhone,
        full_name: cleanFullName,
        role: validRole,
      },
    })

    if (createError || !newUser?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Erro ao criar autenticação do usuário' },
        { status: 500 }
      )
    }

    // 3. Cria o registro na tabela de perfis (profiles)
    const profilePayload: Record<string, any> = {
      id: newUser.user.id,
      role: validRole,
      full_name: cleanFullName,
      phone: cleanPhone,
      cpf_or_cnpj: cpfOrCnpj ? String(cpfOrCnpj).trim() : null,
      terms_accepted_at: new Date().toISOString(),
      self_declaration_signed: validRole === 'provider' ? Boolean(selfDeclaration) : true,
    }

    let { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload)

    // Fallback caso a tabela ainda não contenha colunas adicionais
    if (profileError && profileError.code === 'PGRST204') {
      delete profilePayload.cpf_or_cnpj
      delete profilePayload.terms_accepted_at
      delete profilePayload.self_declaration_signed
      const retry = await supabaseAdmin.from('profiles').upsert(profilePayload)
      profileError = retry.error
    }

    if (profileError) {
      console.error('[Register API] Erro ao criar profile:', profileError)
    }

    // 4. Se for prestador, inicializa provider_status com a chave Pix
    if (validRole === 'provider' && pixKey?.trim()) {
      await supabaseAdmin.from('provider_status').upsert({
        provider_id: newUser.user.id,
        is_online: false,
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType || 'phone',
      })
    }

    return NextResponse.json({
      success: true,
      email,
      password,
      role: validRole,
      userId: newUser.user.id,
      fullName: cleanFullName,
      phone: cleanPhone,
    })
  } catch (err: any) {
    console.error('[Register API] Erro inesperado:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar cadastro' },
      { status: 500 }
    )
  }
}
