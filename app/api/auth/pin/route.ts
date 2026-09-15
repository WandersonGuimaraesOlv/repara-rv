import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const pinSchema = z
  .object({
    phone: z.string().min(1, 'Celular é obrigatório'),
    pin: z.string().min(1, 'PIN é obrigatório'),
  })
  .transform((data) => ({
    cleanPhone: data.phone.replace(/\D/g, ''),
    cleanPin: data.pin.trim(),
  }))
  .refine((data) => data.cleanPhone.length >= 10 && data.cleanPhone.length <= 11, {
    message: 'Digite um celular válido com DDD (10 ou 11 dígitos)',
    path: ['phone'],
  })
  // Só checa comprimento (não exige dígitos): esta rota também resolve login
  // de contas já existentes, e endurecer pra "só numérico" aqui arriscaria
  // travar o acesso de alguém cujo PIN histórico não seja puramente numérico.
  // A validação de "só dígitos" no cadastro (app/api/auth/register) já
  // garante que todo PIN novo criado a partir de agora é numérico.
  .refine((data) => data.cleanPin.length >= 4 && data.cleanPin.length <= 8, {
    message: 'O PIN deve ter entre 4 e 8 dígitos',
    path: ['pin'],
  })

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    const parsed = pinSchema.safeParse(rawBody)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstIssue?.message || 'Dados inválidos' },
        { status: 400 }
      )
    }

    const { cleanPhone, cleanPin } = parsed.data

    const email = `${cleanPhone}@repararv.com`
    const password = `pin_${cleanPin}`

    const supabaseAdmin = await createServiceClient()

    // Achado de escalabilidade (14/09/2026, ao rodar E2E real): `listUsers()`
    // sem paginação só devolve a 1ª página (50 usuários, default da Auth API
    // do Supabase) — com o projeto já tendo 77 usuários reais, essa checagem
    // simplesmente não enxergava ~27 deles. O login desses usuários passava a
    // tentar `createUser()` de novo (achando que era conta nova), que falhava
    // com "email já existe" — travando o acesso de contas mais antigas
    // conforme a base crescia além de 50 usuários. Corrigido pedindo
    // perPage=1000 explicitamente, cobrindo toda a base atual com folga
    // (revisar se algum dia isso se aproximar de 1000 usuários).
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
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
