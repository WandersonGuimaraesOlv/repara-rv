import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeBrazilianPhone } from '@/lib/utils'
import { forgotPinSchema } from '@/lib/validations/pin-reset'
import { generateResetCode, hashResetCode, PIN_RESET_CODE_TTL_MINUTES } from '@/lib/pin-reset'
import { sendEmail } from '@/modules/notifications/services/email-dispatcher'

// Resposta sempre genérica, exista ou não o telefone — evita que alguém use
// esta rota pra descobrir quais números de celular têm conta no Repara RV.
const GENERIC_RESPONSE = {
  success: true,
  message: 'Se este celular tiver uma conta com e-mail cadastrado, você vai receber um código de verificação em instantes.',
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    const parsed = forgotPinSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Celular é obrigatório' }, { status: 400 })
    }

    const cleanPhone = normalizeBrazilianPhone(parsed.data.phone)
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return NextResponse.json({ error: 'Digite um celular válido com DDD' }, { status: 400 })
    }

    const supabaseAdmin = await createServiceClient()

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('phone', cleanPhone)
      .maybeSingle()

    // Conta não existe, ou existe mas nunca informou e-mail (contas antigas,
    // de antes do e-mail virar obrigatório no cadastro) — mesma resposta
    // genérica, sem vazar qual caso é.
    if (!profile?.email) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    if (!userData?.user) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const code = generateResetCode()
    const codeHash = await hashResetCode(code)
    const expiresAt = new Date(Date.now() + PIN_RESET_CODE_TTL_MINUTES * 60_000).toISOString()

    await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      user_metadata: {
        ...userData.user.user_metadata,
        pin_reset_code_hash: codeHash,
        pin_reset_expires_at: expiresAt,
      },
    })

    const firstName = (profile.full_name || '').trim().split(' ')[0] || 'olá'
    const env = process.env as unknown as { RESEND_API_KEY?: string }
    await sendEmail(
      {
        to: profile.email,
        subject: `${code} — Código para redefinir seu PIN Repara RV`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #0a9b70;">Repara RV</h2>
            <p>Olá, ${firstName}!</p>
            <p>Use o código abaixo para redefinir seu PIN de acesso. Ele vale por ${PIN_RESET_CODE_TTL_MINUTES} minutos.</p>
            <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px; background: #f0faf5; color: #0a9b70; padding: 16px 24px; border-radius: 12px; text-align: center;">${code}</p>
            <p style="color: #666; font-size: 13px;">Se você não pediu essa redefinição, pode ignorar este e-mail com segurança.</p>
          </div>
        `,
      },
      env.RESEND_API_KEY
    )

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (err) {
    console.error('[API] /api/auth/forgot-pin:', err)
    // Mesmo em erro interno, resposta genérica — não vaza detalhe nenhum.
    return NextResponse.json(GENERIC_RESPONSE)
  }
}
