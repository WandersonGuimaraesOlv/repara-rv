import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Digite seu nome completo (mínimo 3 caracteres)'),
    // Aceita qualquer formatação (com máscara, espaços, etc.) — os dígitos são
    // extraídos e validados a seguir, igual ao comportamento anterior.
    phone: z.string().min(1, 'Celular é obrigatório'),
    pin: z.string().min(1, 'PIN é obrigatório'),
    role: z.enum(['client', 'provider']).optional().default('client'),
    cpfOrCnpj: z.string().trim().optional(),
    pixKey: z.string().trim().optional(),
    pixKeyType: z.enum(['cpf', 'phone', 'email', 'random']).optional().default('phone'),
    selfDeclaration: z.boolean().optional().default(true),
    // CEP informado no cadastro (opcional) — o bairro já vem resolvido do
    // frontend via ViaCEP, aqui só armazenamos os dois.
    cep: z.string().trim().optional(),
    neighborhood: z.string().trim().max(100).optional(),
  })
  .transform((data) => ({
    ...data,
    cleanPhone: data.phone.replace(/\D/g, ''),
    cleanPin: data.pin.trim(),
  }))
  .refine((data) => data.cleanPhone.length >= 10 && data.cleanPhone.length <= 11, {
    message: 'Digite um celular válido com DDD (10 ou 11 dígitos)',
    path: ['phone'],
  })
  .refine((data) => /^\d{4,8}$/.test(data.cleanPin), {
    message: 'O PIN deve conter entre 4 e 8 dígitos numéricos',
    path: ['pin'],
  })
  .refine((data) => data.role !== 'provider' || Boolean(data.pixKey && data.pixKey.length > 0), {
    message: 'Profissionais precisam informar a chave Pix para receber os repasses de serviços',
    path: ['pixKey'],
  })

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    const parsed = registerSchema.safeParse(rawBody)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || 'Dados inválidos', issues: parsed.error.format() },
        { status: 400 }
      )
    }

    const { fullName, cleanPhone, cleanPin, role, cpfOrCnpj, pixKey, pixKeyType, selfDeclaration, cep, neighborhood } = parsed.data

    const cleanFullName = fullName
    const validRole = role

    const email = `${cleanPhone}@repararv.com`
    const password = `pin_${cleanPin}`

    const supabaseAdmin = await createServiceClient()

    // 1. Verifica se já existe usuário com este e-mail/telefone
    //
    // Achado de escalabilidade (14/09/2026): listUsers() sem paginação só
    // devolve a 1ª página (50 usuários, default da Auth API) — mesmo bug e
    // mesma correção de app/api/auth/pin/route.ts. Sem isso, cadastro de
    // telefone já usado por uma conta mais antiga (fora da 1ª página) caía
    // direto no createUser() e falhava com erro genérico de banco em vez do
    // aviso correto "já possui cadastro".
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
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
      cep: cep ? cep.replace(/\D/g, '') : null,
      neighborhood: neighborhood || null,
    }

    let { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload)

    // Fallback caso a tabela ainda não contenha colunas adicionais
    if (profileError && profileError.code === 'PGRST204') {
      delete profilePayload.cpf_or_cnpj
      delete profilePayload.terms_accepted_at
      delete profilePayload.self_declaration_signed
      delete profilePayload.cep
      delete profilePayload.neighborhood
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
