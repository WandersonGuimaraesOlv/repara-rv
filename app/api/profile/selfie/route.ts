import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Recebe a selfie de verificação do prestador (captura via
// components/selfie-capture-modal.tsx), sobe pro bucket privado
// provider-selfies (ver supabase/migrations/20260918_provider_selfies_storage.sql)
// e grava a URL assinada em profiles.avatar_url. Sempre o mesmo caminho por
// usuário ({user_id}/selfie.jpg, upsert) — reenviar substitui a foto anterior
// sem precisar gerar/gravar uma URL nova a cada vez.
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
// ~10 anos — o bucket é privado, então toda exibição da foto depende de uma
// URL assinada; gerar uma com validade curta obrigaria o resto do app (card
// de identificação, admin) a re-assinar a cada leitura. Mais simples e
// suficiente pro escopo atual: assinar uma vez, bem longe, no upload.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabaseAdmin = await createServiceClient()
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, background_check_status, rejection_reason')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Apenas prestadores podem enviar selfie de verificação' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const file = formData.get('selfie')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 422 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'O arquivo precisa ser uma imagem' }, { status: 422 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande (máximo 5MB)' }, { status: 422 })
    }

    const path = `${user.id}/selfie.jpg`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('provider-selfies')
      .upload(path, file, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) {
      console.error('[API /api/profile/selfie] Erro ao subir imagem:', uploadError)
      return NextResponse.json({ error: 'Erro ao salvar a foto. Tente novamente.' }, { status: 500 })
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('provider-selfies')
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[API /api/profile/selfie] Erro ao gerar URL assinada:', signedUrlError)
      return NextResponse.json({ error: 'Erro ao processar a foto. Tente novamente.' }, { status: 500 })
    }

    const updatePayload: Record<string, unknown> = { avatar_url: signedUrlData.signedUrl }

    // Reenvio depois de reprovado volta pra fila de análise do admin — o
    // motivo mais comum de reprovação é exatamente "foto ilegível, tente de
    // novo" (ver modal de reprovação em app/(admin)/admin/usuarios). Nunca
    // mexe no status se já estiver 'approved' — isso só muda por decisão do
    // admin, não por reenvio de foto.
    if (profile.background_check_status === 'rejected') {
      updatePayload.background_check_status = 'pending'
      updatePayload.rejection_reason = null
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (updateError) {
      console.error('[API /api/profile/selfie] Erro ao salvar avatar_url:', updateError)
      return NextResponse.json({ error: 'Erro ao salvar a foto. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, avatar_url: signedUrlData.signedUrl })
  } catch (error) {
    console.error('[API] /api/profile/selfie:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
