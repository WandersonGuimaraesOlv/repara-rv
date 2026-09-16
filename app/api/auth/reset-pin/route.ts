import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeBrazilianPhone } from '@/lib/utils'
import { resetPinSchema } from '@/lib/validations/pin-reset'
import { hashResetCode, isResetCodeExpired } from '@/lib/pin-reset'
import { isWeakPin } from '@/lib/validations/br-documents'

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    const parsed = resetPinSchema.safeParse(rawBody)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json({ error: firstIssue?.message || 'Dados inválidos' }, { status: 400 })
    }

    const { code, newPin } = parsed.data
    const cleanPhone = normalizeBrazilianPhone(parsed.data.phone)

    if (isWeakPin(newPin)) {
      return NextResponse.json(
        { error: 'PIN muito fácil de adivinhar (sequência ou dígitos repetidos). Escolha outro.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = await createServiceClient()

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle()

    // Mensagem genérica de propósito — não confirma se o celular existe,
    // só se o código bate (o código em si já prova posse do e-mail).
    const invalidCodeError = { error: 'Código inválido ou expirado. Solicite um novo.' }

    if (!profile) {
      return NextResponse.json(invalidCodeError, { status: 400 })
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    const metadata = userData?.user?.user_metadata as
      | { pin_reset_code_hash?: string; pin_reset_expires_at?: string; [key: string]: unknown }
      | undefined

    if (!metadata?.pin_reset_code_hash || isResetCodeExpired(metadata.pin_reset_expires_at)) {
      return NextResponse.json(invalidCodeError, { status: 400 })
    }

    const submittedHash = await hashResetCode(code)
    if (submittedHash !== metadata.pin_reset_code_hash) {
      return NextResponse.json(invalidCodeError, { status: 400 })
    }

    // Código válido — atualiza o PIN (senha real no Supabase Auth) e invalida
    // o código imediatamente, pra não poder ser reaproveitado.
    //
    // Achado real ao testar (16/09/2026): a API admin do Supabase faz um
    // MERGE raso em `user_metadata`, não uma substituição — simplesmente
    // omitir uma chave do payload NÃO a remove, o valor antigo continua lá.
    // Testado e confirmado contra o banco real: só setar explicitamente como
    // `null` limpa de verdade. Sem isso, o código de reset continuava válido
    // e reutilizável mesmo depois de já ter sido usado.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: `pin_${newPin}`,
      user_metadata: {
        ...metadata,
        pin_reset_code_hash: null,
        pin_reset_expires_at: null,
      },
    })

    if (updateError) {
      console.error('[API] /api/auth/reset-pin erro ao atualizar PIN:', updateError)
      return NextResponse.json({ error: 'Erro ao redefinir PIN. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API] /api/auth/reset-pin:', err)
    return NextResponse.json({ error: 'Erro interno ao redefinir PIN' }, { status: 500 })
  }
}
