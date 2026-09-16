import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const skipProviderSchema = z.object({
  call_id:             z.string().uuid('call_id inválido'),
  rejected_provider_id: z.string().uuid('rejected_provider_id inválido').optional(),
})

// Trava otimista: a rota original lia o chamado e gravava com um UPDATE sem
// nenhuma condição sobre o estado lido — um clássico read-then-write sem
// proteção. Duas chamadas quase simultâneas a esta rota para o MESMO chamado
// (ex: o watchdog de 30s do cliente em app/acompanhar e uma recusa manual do
// prestador quase no mesmo instante) podiam calcular o próximo prestador a
// partir do mesmo estado "velho" e a escrita que chegasse por último vencia
// silenciosamente — inclusive podendo perder entradas da lista de exclusão
// (rejected_providers), reabrindo a possibilidade de oferecer de novo pra
// alguém que já tinha recusado.
//
// Corrigido com CAS (compare-and-swap) via updated_at: a escrita só é aceita
// se o updated_at ainda for o mesmo lido no início da tentativa. Se alguém
// mexeu no meio do caminho, a tentativa é refeita do zero (lendo o estado
// atual de novo) — até MAX_ATTEMPTS vezes. O contrato de resposta pras 3
// chamadas existentes (app/acompanhar, app/painel handleRejectCall e
// handleTimeoutCall) não muda: elas continuam recebendo { status: 'queued' }
// ou { status: 'searching', provider_id }, sem precisar saber que por trás
// pode ter havido uma nova tentativa.
const MAX_ATTEMPTS = 3

export async function POST(request: NextRequest) {
  try {
    // Achado de segurança (16/09/2026): esta rota nunca teve nenhum check de
    // autorização — qualquer call_id, de qualquer chamador (autenticado ou
    // não), conseguia reatribuir ou reencaminhar um chamado alheio. Só o
    // cliente ou o prestador atual do próprio chamado podem reencaminhá-lo
    // (ver comentário logo após a leitura de `call` abaixo).
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser().catch(() => ({ data: { user: null } }))
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
    }

    const parsed = skipProviderSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.format() }, { status: 422 })
    }

    const { call_id, rejected_provider_id } = parsed.data

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Busca o chamado atual (inclui client_id para blindagem de auto-atribuição)
      const { data: call } = await supabase
        .from('service_calls')
        .select('id, client_id, client_location, status, provider_id, cancel_metadata, updated_at')
        .eq('id', call_id)
        .single()

      if (!call) {
        return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
      }

      if (call.status !== 'accepted' && call.status !== 'searching') {
        return NextResponse.json({ error: 'Chamado não pode ser reencaminhado neste status' }, { status: 400 })
      }

      // Só o cliente (watchdog de 30s em app/acompanhar) ou o prestador
      // atualmente atribuído (handleRejectCall/handleTimeoutCall em
      // app/painel) podem reencaminhar — nunca um terceiro.
      if (call.client_id !== user.id && call.provider_id !== user.id) {
        return NextResponse.json({ error: 'Você não tem permissão para reencaminhar este chamado' }, { status: 403 })
      }

      // Histórico cumulativo de prestadores já tentados para evitar loop infinito.
      // ⚠️ O client_id é SEMPRE excluído: quem solicita JAMAIS pode executar o próprio chamado.
      const prevExclusions = (call.cancel_metadata as any)?.rejected_providers || []
      const excludedIds = Array.from(
        new Set([
          ...prevExclusions,
          call.client_id,       // Blindagem absoluta: cliente nunca vira prestador do próprio chamado
          call.provider_id,
          rejected_provider_id,
        ].filter(Boolean))
      )

      // Busca próximo prestador disponível no radar PostGIS
      const { data: nextProvider, error: nextProviderError } = await supabase.rpc('find_nearest_provider', {
        call_location: call.client_location,
        excluded_ids: excludedIds,
      })

      // Achado em 14/09/2026: um erro real desta RPC (havia uma 2ª versão ambígua da função
      // no banco, removida) estava sendo tratado em silêncio como "nenhum prestador
      // disponível" — o que empurrava o chamado pra fila e disparava notify-queue (alerta
      // pra TODOS os prestadores cadastrados) por engano. Erro de verdade agora falha alto
      // em vez de mascarar como fila.
      if (nextProviderError) {
        console.error('[API] /api/calls/skip-provider — find_nearest_provider RPC ERRO:', nextProviderError)
        return NextResponse.json({ error: 'Erro ao buscar próximo prestador — tente novamente' }, { status: 500 })
      }

      const updatedMetadata = {
        ...(call.cancel_metadata || {}),
        rejected_providers: excludedIds,
      }

      if (!nextProvider) {
        // Sem mais prestadores disponíveis no momento: entra na fila prioritária!
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        const queuedUpdate = supabase
          .from('service_calls')
          .update({
            status: 'queued',
            provider_id: null,
            expires_at: expiresAt,
            cancel_metadata: updatedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', call_id)

        // Trava otimista: NULL exige .is(), valor real exige .eq()
        const { data: updated } = await (
          call.updated_at === null
            ? queuedUpdate.is('updated_at', null)
            : queuedUpdate.eq('updated_at', call.updated_at)
        ).select('id')

        if (!updated || updated.length === 0) {
          // Alguém alterou o chamado entre a leitura e a escrita — tenta de novo com o estado atual
          continue
        }

        // Notifica prestadores cadastrados da fila prioritária
        const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://repararv.com'
        const appUrl = (rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost'))
          ? rawAppUrl
          : 'https://repararv.com'

        fetch(`${appUrl}/api/calls/notify-queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id }),
        }).catch(err => console.warn('[API /api/calls/skip-provider] Falha ao invocar notify-queue:', err))

        return NextResponse.json({ status: 'queued' })
      }

      // Atribui ao próximo prestador no radar com status 'searching' para que ele receba a oferta
      const searchingUpdate = supabase
        .from('service_calls')
        .update({
          provider_id: nextProvider,
          status: 'searching',
          accepted_at: null,
          cancel_metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', call_id)

      // Trava otimista: NULL exige .is(), valor real exige .eq()
      const { data: updated } = await (
        call.updated_at === null
          ? searchingUpdate.is('updated_at', null)
          : searchingUpdate.eq('updated_at', call.updated_at)
      ).select('id')

      if (!updated || updated.length === 0) {
        continue
      }

      return NextResponse.json({ status: 'searching', provider_id: nextProvider })
    }

    // Esgotou as tentativas: algo está gravando nesse chamado com muita frequência.
    // Não deveria acontecer na prática (a janela de corrida é de milissegundos),
    // mas devolve um erro claro em vez de gravar um estado que já pode estar
    // desatualizado.
    return NextResponse.json(
      { error: 'Conflito de concorrência ao reencaminhar chamado — tente novamente' },
      { status: 409 }
    )
  } catch (error) {
    console.error('[API] /api/calls/skip-provider:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
