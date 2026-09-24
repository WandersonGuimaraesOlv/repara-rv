'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  updateUserRoleSchema,
  updateBackgroundCheckSchema,
  toggleUserBlockedSchema,
  resetUserPinSchema,
} from '@/lib/validations/admin-users'
import {
  adminApproveCompletionSchema,
  adminCancelCallSchema,
  canAdminCancel,
  completionReviewPatch,
} from '@/lib/completion-review'
import { clearOfflineProviderLocation } from '@/lib/provider-location'
import { markPayoutSchema, undoPayoutSchema } from '@/lib/payouts'
import { resolveWarrantySchema } from '@/lib/warranty'
import { resolveSosSchema } from '@/lib/validations/admin-users'
import { runInBackground } from '@/lib/background'
import { notifyProvider, buildNotificationEnv } from '@/modules/notifications'
import { revalidatePath } from 'next/cache'

/**
 * Valida se o solicitante possui perfil autenticado de 'admin'.
 */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { authorized: false, error: 'Acesso negado. Usuário não autenticado.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') {
    return { authorized: false, error: 'Acesso restrito a Administradores da plataforma.' }
  }

  return { authorized: true, user }
}

export interface AdminUserListItem {
  id: string
  role: 'client' | 'provider' | 'admin'
  full_name: string
  phone: string
  cpf_or_cnpj: string
  created_at: string
  terms_accepted_at?: string | null
  self_declaration_signed?: boolean | null
  background_check_status: 'pending' | 'approved' | 'rejected'
  avatar_url: string | null
  rejection_reason: string | null
  verified_at: string | null
  is_blocked: boolean
  completed_orders_count: number
  rating_avg: number
  mercado_pago_connected: boolean
  recipient_gateway_id: string | null
  provider_status?: {
    is_online: boolean
    pix_key: string
    pix_key_type: string
    updated_at: string
    recipient_gateway_id?: string | null
  } | null
  total_calls_as_client: number
  unpaid_calls_as_client: number
  total_calls_as_provider: number
  completed_calls_as_provider: number
  paid_calls_as_provider: number
  total_earned_as_provider: number
  pending_earnings_as_provider: number
}

/**
 * Busca a lista completa de usuários cadastrados com dados operacionais e financeiros.
 */
export async function getAdminUsersListAction(): Promise<{
  success: boolean
  data?: AdminUserListItem[]
  error?: string
}> {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()

  try {
    // 1. Busca todos os perfis
    const { data: profiles, error: profilesError } = await adminDb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError || !profiles) {
      return { success: false, error: 'Falha ao consultar perfis de usuários.' }
    }

    // 2. Busca status de prestadores (Pix, online/offline, recipient_gateway_id)
    const { data: providerStatuses } = await adminDb
      .from('provider_status')
      .select('*')

    interface ProviderStatusRow {
      provider_id: string
      is_online?: boolean | null
      pix_key?: string | null
      pix_key_type?: string | null
      recipient_gateway_id?: string | null
      updated_at?: string | null
    }

    const providerMap = new Map<string, ProviderStatusRow>()
    if (providerStatuses) {
      (providerStatuses as ProviderStatusRow[]).forEach((ps) => {
        providerMap.set(ps.provider_id, ps)
      })
    }

    // 3. Busca chamados para calcular estatísticas por usuário
    const { data: calls } = await adminDb
      .from('service_calls')
      .select('id, client_id, provider_id, status, payment_status, provider_cut, total_price')

    const clientCallsMap = new Map<string, number>()
    const clientUnpaidMap = new Map<string, number>()
    const providerCallsMap = new Map<string, number>()
    const providerCompletedMap = new Map<string, number>()
    const providerPaidMap = new Map<string, number>()
    const providerEarningsMap = new Map<string, number>()
    const providerPendingEarningsMap = new Map<string, number>()

    calls?.forEach((c) => {
      // Cliente
      if (c.client_id) {
        clientCallsMap.set(c.client_id, (clientCallsMap.get(c.client_id) || 0) + 1)
        if (c.status === 'completed' && c.payment_status !== 'paid') {
          clientUnpaidMap.set(c.client_id, (clientUnpaidMap.get(c.client_id) || 0) + 1)
        }
      }

      // Prestador
      if (c.provider_id) {
        providerCallsMap.set(c.provider_id, (providerCallsMap.get(c.provider_id) || 0) + 1)
        if (c.status === 'completed') {
          providerCompletedMap.set(c.provider_id, (providerCompletedMap.get(c.provider_id) || 0) + 1)
          const earned = Number(c.provider_cut || (Number(c.total_price) - 12))

          if (c.payment_status === 'paid') {
            providerPaidMap.set(c.provider_id, (providerPaidMap.get(c.provider_id) || 0) + 1)
            providerEarningsMap.set(c.provider_id, (providerEarningsMap.get(c.provider_id) || 0) + earned)
          } else {
            providerPendingEarningsMap.set(c.provider_id, (providerPendingEarningsMap.get(c.provider_id) || 0) + earned)
          }
        }
      }
    })

    // Monta a lista consolidada
    const usersList: AdminUserListItem[] = profiles.map((p) => {
      const ps = providerMap.get(p.id)
      const rawStatus = (p as Record<string, unknown>).background_check_status
      // Achado (16/09/2026): colapsava qualquer status que não fosse 'rejected'
      // em 'approved' pra exibição — escondia 'pending' da UI do admin desde
      // sempre. Agora que o cadastro de prestador entra 'pending' de verdade
      // (app/onboarding/page.tsx) até a aprovação manual, os 3 estados reais
      // precisam chegar até a tela.
      const backgroundCheckStatus: 'pending' | 'approved' | 'rejected' =
        rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending'

      const isBlocked = Boolean((p as Record<string, unknown>).is_blocked)
      const ratingAvg = typeof (p as Record<string, unknown>).rating_avg === 'number'
        ? Number((p as Record<string, unknown>).rating_avg)
        : 5.0
      
      const completedCalls = providerCompletedMap.get(p.id) ?? (
        typeof (p as Record<string, unknown>).completed_orders_count === 'number'
          ? Number((p as Record<string, unknown>).completed_orders_count)
          : 0
      )

      const rawMpConnected = Boolean((p as Record<string, unknown>).mercado_pago_connected)
      const gatewayId = ps?.recipient_gateway_id || ((p as Record<string, unknown>).recipient_gateway_id as string) || null
      const isMpConnected = rawMpConnected || Boolean(gatewayId && String(gatewayId).trim().length > 0)

      return {
        id: p.id,
        role: p.role,
        full_name: p.full_name || 'Sem nome cadastrado',
        phone: p.phone,
        cpf_or_cnpj: p.cpf_or_cnpj || '',
        created_at: p.created_at || new Date().toISOString(),
        terms_accepted_at: p.terms_accepted_at,
        self_declaration_signed: p.self_declaration_signed,
        background_check_status: backgroundCheckStatus,
        avatar_url: (p as Record<string, unknown>).avatar_url as string | null ?? null,
        rejection_reason: (p as Record<string, unknown>).rejection_reason as string | null ?? null,
        verified_at: (p as Record<string, unknown>).verified_at as string | null ?? null,
        is_blocked: isBlocked,
        completed_orders_count: completedCalls,
        rating_avg: ratingAvg,
        mercado_pago_connected: isMpConnected,
        recipient_gateway_id: gatewayId,
        provider_status: ps
          ? {
              is_online: Boolean(ps.is_online),
              pix_key: ps.pix_key || '',
              pix_key_type: ps.pix_key_type || '',
              recipient_gateway_id: ps.recipient_gateway_id || null,
              updated_at: ps.updated_at || '',
            }
          : null,
        total_calls_as_client: clientCallsMap.get(p.id) || 0,
        unpaid_calls_as_client: clientUnpaidMap.get(p.id) || 0,
        total_calls_as_provider: providerCallsMap.get(p.id) || 0,
        completed_calls_as_provider: completedCalls,
        paid_calls_as_provider: providerPaidMap.get(p.id) || 0,
        total_earned_as_provider: providerEarningsMap.get(p.id) || 0,
        pending_earnings_as_provider: providerPendingEarningsMap.get(p.id) || 0,
      }
    })

    return { success: true, data: usersList }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado ao consultar usuários.'
    return { success: false, error: message }
  }
}

/**
 * Atualiza o status de pagamento de um chamado (pago / pendente / estornado)
 */
export async function updateCallPaymentStatusAction(input: {
  callId: string
  paymentStatus: 'paid' | 'pending' | 'refunded'
}) {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()

  // Repasse já feito: voltar o pagamento pra pendente deixaria o técnico pago
  // por um serviço "não pago". Desfazer o repasse primeiro.
  if (input.paymentStatus !== 'paid') {
    const { data: current } = await adminDb
      .from('service_calls')
      .select('payout_at')
      .eq('id', input.callId)
      .maybeSingle()
    if (current?.payout_at) {
      return { success: false, error: 'O repasse deste chamado já foi feito. Desfaça o repasse antes de mudar o pagamento.' }
    }
  }

  const { data, error } = await adminDb
    .from('service_calls')
    .update({
      payment_status: input.paymentStatus,
      // paid_at conta o prazo de 48 h do repasse (lib/payouts.ts)
      paid_at: input.paymentStatus === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', input.callId)
    .select('id, status, payment_status')
    .single()

  if (error) {
    return { success: false, error: 'Erro ao atualizar status de pagamento no banco.' }
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/usuarios')
  return { success: true, data }
}

/**
 * Cancela um chamado ainda não concluído (lacuna do plano de contingência,
 * 24/09/2026): depois do aceite o cliente não cancela, e se o técnico some
 * ninguém conseguia encerrar o chamado pelo app. Sem cobrança de ninguém.
 */
export async function cancelCallAsAdminAction(input: { callId: string; reason: string }) {
  const parsed = adminCancelCallSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error }
  }

  const { callId, reason } = parsed.data
  const adminDb = await createServiceClient()
  const { data: call } = await adminDb
    .from('service_calls')
    .select('status, provider_id')
    .eq('id', callId)
    .maybeSingle()

  if (!call) {
    return { success: false, error: 'Chamado não encontrado.' }
  }
  if (!canAdminCancel(call.status)) {
    return { success: false, error: 'Chamado concluído ou já encerrado não pode ser cancelado por aqui.' }
  }

  const nowIso = new Date().toISOString()
  // Condicional no status lido: se o técnico concluiu ou o cliente aprovou
  // nesse meio-tempo, nada é gravado.
  const { data: updated, error } = await adminDb
    .from('service_calls')
    .update({
      status: 'cancelled',
      cancel_reason: 'other',
      cancellation_reason: `Cancelado pela equipe: ${reason}`,
      cancel_note: reason,
      cancellation_stage: call.status,
      cancelled_by: authCheck.user.id,
      cancelled_by_role: 'admin',
      cancelled_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', callId)
    .eq('status', call.status)
    .select('id')

  if (error) {
    console.error('[admin] Erro ao cancelar chamado:', error)
    return { success: false, error: 'Erro ao cancelar o chamado no banco.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'O chamado mudou enquanto você decidia. Atualize a tela.' }
  }

  if (call.provider_id) {
    await clearOfflineProviderLocation(adminDb, call.provider_id)
    runInBackground(
      notifyProvider(
        call.provider_id,
        {
          title: 'Chamado cancelado pela equipe',
          body: 'A equipe do Repara RV cancelou um chamado seu. Abra o app para ver.',
          url: '/painel',
        },
        buildNotificationEnv()
      )
    )
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

/**
 * Aprova a conclusão pelo cliente (impasse na conferência antes do Pix —
 * lib/completion-review.ts). O chamado vira concluído e o Pix aparece pro
 * cliente, como se ele tivesse aprovado; fica registrado quem aprovou.
 */
export async function approveCompletionAsAdminAction(input: { callId: string }) {
  const parsed = adminApproveCompletionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error }
  }

  const { callId } = parsed.data
  const adminDb = await createServiceClient()
  const patch = completionReviewPatch(
    { call_id: callId, decision: 'approve' },
    { approvedBy: authCheck.user.id, issueCount: 0, nowIso: new Date().toISOString() }
  )
  const { data: updated, error } = await adminDb
    .from('service_calls')
    .update(patch)
    .eq('id', callId)
    .eq('status', 'awaiting_approval')
    .select('id')

  if (error) {
    console.error('[admin] Erro ao aprovar conclusão:', error)
    return { success: false, error: 'Erro ao aprovar a conclusão no banco.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Este chamado não está aguardando a conferência do cliente. Atualize a tela.' }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

/**
 * Atualiza o papel de um usuário (promover a admin, mudar para prestador ou cliente).
 */
export async function updateUserRoleAction(input: unknown) {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = updateUserRoleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Dados inválidos para alteração de perfil.' }
  }

  const { userId, role } = parsed.data
  const adminDb = await createServiceClient()

  const { data, error } = await adminDb
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, full_name, role')
    .single()

  if (error) {
    return { success: false, error: 'Erro ao atualizar papel do usuário no banco.' }
  }

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/dashboard')

  return { success: true, data }
}

/**
 * Atualiza o status de liberação operacional (compliance) do usuário.
 */
export async function updateBackgroundCheckStatusAction(input: unknown) {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error || 'Acesso negado.' }
  }

  const parsed = updateBackgroundCheckSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Dados inválidos para alteração de compliance.' }
  }

  const { userId, status, rejectionReason } = parsed.data
  const adminDb = await createServiceClient()

  try {
    const { data, error } = await adminDb
      .from('profiles')
      .update({
        background_check_status: status,
        // Auditoria da aprovação/reprovação (migration
        // 20260918_provider_identity_verification.sql). 'pending' nunca é
        // setado por aqui — só o admin aprovando/reprovando dispara isto.
        verified_at: status === 'approved' ? new Date().toISOString() : null,
        verified_by: status === 'approved' ? authCheck.user.id : null,
        rejection_reason: status === 'rejected' ? (rejectionReason ?? null) : null,
      })
      .eq('id', userId)
      .select('id, full_name, background_check_status, rejection_reason')
      .single()

    if (error) {
      if (error.code === '42703' || error.message?.includes('background_check_status')) {
        return {
          success: false,
          error: 'Coluna background_check_status ainda não existe no Supabase. Execute o script SQL no painel Supabase.'
        }
      }
      return { success: false, error: `Erro ao atualizar compliance: ${error.message}` }
    }

    // Se reprovado, derruba prestador do radar imediatamente para proteção dos moradores
    if (status === 'rejected') {
      await adminDb
        .from('provider_status')
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq('provider_id', userId)
    }

    revalidatePath('/admin/usuarios')
    revalidatePath('/admin/dashboard')
    revalidatePath('/painel')

    return { success: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao atualizar compliance.'
    return { success: false, error: msg }
  }
}

/**
 * Suspende ou reativa a conta de um usuário (bloqueio emergencial de segurança).
 */
export async function toggleUserBlockedAction(input: unknown) {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = toggleUserBlockedSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Dados inválidos para bloqueio/desbloqueio.' }
  }

  const { userId, isBlocked } = parsed.data
  const adminDb = await createServiceClient()

  try {
    const { data, error } = await adminDb
      .from('profiles')
      .update({ is_blocked: isBlocked })
      .eq('id', userId)
      .select('id, full_name, is_blocked')
      .single()

    if (error) {
      if (error.code === '42703' || error.message?.includes('is_blocked')) {
        return {
          success: false,
          error: 'Coluna is_blocked ainda não existe no Supabase. Execute o script SQL no painel Supabase.'
        }
      }
      return { success: false, error: `Erro ao atualizar status de suspensão: ${error.message}` }
    }

    // Se bloqueado/suspenso, derruba prestador do radar imediatamente
    if (isBlocked) {
      await adminDb
        .from('provider_status')
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq('provider_id', userId)
    }

    revalidatePath('/admin/usuarios')
    revalidatePath('/admin/dashboard')
    revalidatePath('/painel')

    return { success: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao alterar status da conta.'
    return { success: false, error: msg }
  }
}

/**
 * Reseta o PIN de acesso de um usuário (não existe fluxo de "esqueci minha
 * senha" self-service, já que o login é feito com celular + PIN e não há
 * e-mail real por trás — só o admin pode gerar um PIN novo aqui).
 */
export async function resetUserPinAction(input: unknown) {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = resetUserPinSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos para reset de PIN.' }
  }

  const { userId, newPin } = parsed.data
  const adminDb = await createServiceClient()

  const { data: profile } = await adminDb
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  const { error } = await adminDb.auth.admin.updateUserById(userId, {
    password: `pin_${newPin}`,
  })

  if (error) {
    return { success: false, error: `Erro ao resetar PIN: ${error.message}` }
  }

  return { success: true, data: { full_name: profile?.full_name || 'Usuário' } }
}


// ── Repasse manual ao técnico (lib/payouts.ts) ──────────────────────────────

export interface PayoutRow {
  callId: string
  serviceName: string
  providerId: string | null
  providerName: string
  providerPhone: string | null
  pixKey: string | null
  pixKeyType: string | null
  amount: number
  paidAt: string | null
  completedAt: string | null
  payoutAt: string | null
  payoutAmount: number | null
  payoutReference: string | null
  hasOpenWarranty: boolean
}

/**
 * Chamados concluídos e pagos: os que falta repassar e os repassados nos
 * últimos 30 dias. A chave Pix vem de provider_status (a mesma que o técnico
 * cadastrou), nunca do telefone.
 */
export async function getPayoutsAction(): Promise<{ success: boolean; error?: string; data?: PayoutRow[] }> {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  const { data: calls, error } = await adminDb
    .from('service_calls')
    .select('id, provider_id, provider_cut, paid_at, completed_at, payout_at, payout_amount, payout_reference, service:quick_services(name), provider:profiles!provider_id(full_name, phone)')
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .or(`payout_at.is.null,payout_at.gt."${since}"`)
    .order('paid_at', { ascending: true, nullsFirst: true })

  if (error) {
    console.error('[admin] Erro ao listar repasses:', error)
    return { success: false, error: 'Erro ao carregar os repasses.' }
  }

  const rows = calls ?? []
  const providerIds = [...new Set(rows.map((c) => c.provider_id).filter((id): id is string => Boolean(id)))]
  const callIds = rows.map((c) => c.id)

  const [{ data: statuses }, { data: warranties }] = await Promise.all([
    providerIds.length
      ? adminDb.from('provider_status').select('provider_id, pix_key, pix_key_type').in('provider_id', providerIds)
      : Promise.resolve({ data: [] as { provider_id: string; pix_key: string | null; pix_key_type: string | null }[] }),
    callIds.length
      ? adminDb.from('warranty_claims').select('call_id').eq('status', 'open').in('call_id', callIds)
      : Promise.resolve({ data: [] as { call_id: string }[] }),
  ])

  const pixByProvider = new Map((statuses ?? []).map((s) => [s.provider_id, s]))
  const openWarranty = new Set((warranties ?? []).map((w) => w.call_id))

  return {
    success: true,
    data: rows.map((c) => {
      const provider = c.provider as { full_name?: string; phone?: string } | null
      const pix = c.provider_id ? pixByProvider.get(c.provider_id) : undefined
      return {
        callId: c.id,
        serviceName: (c.service as { name?: string } | null)?.name ?? 'Serviço',
        providerId: c.provider_id,
        providerName: provider?.full_name ?? 'Técnico',
        providerPhone: provider?.phone ?? null,
        pixKey: pix?.pix_key ?? null,
        pixKeyType: pix?.pix_key_type ?? null,
        amount: Number(c.provider_cut),
        paidAt: c.paid_at,
        completedAt: c.completed_at,
        payoutAt: c.payout_at,
        payoutAmount: c.payout_amount === null ? null : Number(c.payout_amount),
        payoutReference: c.payout_reference,
        hasOpenWarranty: openWarranty.has(c.id),
      }
    }),
  }
}

/**
 * Registra que a equipe já fez o Pix de repasse ao técnico. Condicional:
 * só chamado concluído, pago e ainda sem repasse; com garantia aberta o
 * repasse fica suspenso (Contrato, cláusula 4).
 */
export async function markPayoutDoneAction(input: { callId: string; reference?: string }) {
  const parsed = markPayoutSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error }
  }

  const { callId, reference } = parsed.data
  const adminDb = await createServiceClient()

  const { data: openClaim } = await adminDb
    .from('warranty_claims')
    .select('id')
    .eq('call_id', callId)
    .eq('status', 'open')
    .maybeSingle()
  if (openClaim) {
    return { success: false, error: 'Há uma garantia aberta neste chamado: o repasse fica suspenso até ela ser resolvida.' }
  }

  const { data: call } = await adminDb
    .from('service_calls')
    .select('provider_cut')
    .eq('id', callId)
    .maybeSingle()
  if (!call) {
    return { success: false, error: 'Chamado não encontrado.' }
  }

  const { data: updated, error } = await adminDb
    .from('service_calls')
    .update({
      payout_at: new Date().toISOString(),
      payout_by: authCheck.user.id,
      payout_amount: call.provider_cut,
      payout_reference: reference || null,
    })
    .eq('id', callId)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .is('payout_at', null)
    .select('id')

  if (error) {
    console.error('[admin] Erro ao registrar repasse:', error)
    return { success: false, error: 'Erro ao registrar o repasse no banco.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Este chamado não está aguardando repasse (já repassado ou ainda não pago). Atualize a tela.' }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

/** Desfaz um repasse marcado por engano. */
export async function undoPayoutAction(input: { callId: string }) {
  const parsed = undoPayoutSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()
  const { data: updated, error } = await adminDb
    .from('service_calls')
    .update({ payout_at: null, payout_by: null, payout_amount: null, payout_reference: null })
    .eq('id', parsed.data.callId)
    .not('payout_at', 'is', null)
    .select('id')

  if (error) {
    console.error('[admin] Erro ao desfazer repasse:', error)
    return { success: false, error: 'Erro ao desfazer o repasse no banco.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Este chamado não tem repasse registrado.' }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

// ── Garantia de 7 dias (lib/warranty.ts) ────────────────────────────────────

export interface WarrantyClaimRow {
  id: string
  callId: string
  status: 'open' | 'resolved' | 'rejected'
  description: string
  resolutionNote: string | null
  createdAt: string
  resolvedAt: string | null
  serviceName: string
  completedAt: string | null
  clientName: string
  clientPhone: string | null
  providerName: string
  providerPhone: string | null
}

/** Garantias abertas e as resolvidas/recusadas nos últimos 30 dias. */
export async function getWarrantyClaimsAction(): Promise<{ success: boolean; error?: string; data?: WarrantyClaimRow[] }> {
  const authCheck = await requireAdmin()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  const { data, error } = await adminDb
    .from('warranty_claims')
    .select('id, call_id, status, description, resolution_note, created_at, resolved_at, client:profiles!client_id(full_name, phone), provider:profiles!provider_id(full_name, phone), call:service_calls!call_id(completed_at, service:quick_services(name))')
    .or(`status.eq.open,created_at.gt."${since}"`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin] Erro ao listar garantias:', error)
    return { success: false, error: 'Erro ao carregar as garantias.' }
  }

  return {
    success: true,
    data: (data ?? []).map((w) => {
      const client = w.client as { full_name?: string; phone?: string } | null
      const provider = w.provider as { full_name?: string; phone?: string } | null
      const call = w.call as { completed_at?: string | null; service?: { name?: string } | null } | null
      return {
        id: w.id,
        callId: w.call_id,
        status: w.status as WarrantyClaimRow['status'],
        description: w.description,
        resolutionNote: w.resolution_note,
        createdAt: w.created_at,
        resolvedAt: w.resolved_at,
        serviceName: call?.service?.name ?? 'Serviço',
        completedAt: call?.completed_at ?? null,
        clientName: client?.full_name ?? 'Cliente',
        clientPhone: client?.phone ?? null,
        providerName: provider?.full_name ?? 'Técnico',
        providerPhone: provider?.phone ?? null,
      }
    }),
  }
}

/** Encerra a garantia: resolvida (retorno feito) ou recusada (fora da cobertura). */
export async function resolveWarrantyClaimAction(input: { claimId: string; outcome: 'resolved' | 'rejected'; note: string }) {
  const parsed = resolveWarrantySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()
  const { data: updated, error } = await adminDb
    .from('warranty_claims')
    .update({
      status: parsed.data.outcome,
      resolution_note: parsed.data.note,
      resolved_at: new Date().toISOString(),
      resolved_by: authCheck.user.id,
    })
    .eq('id', parsed.data.claimId)
    .eq('status', 'open')
    .select('id')

  if (error) {
    console.error('[admin] Erro ao encerrar garantia:', error)
    return { success: false, error: 'Erro ao encerrar a garantia no banco.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Esta garantia já foi encerrada. Atualize a tela.' }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

// ── SOS ─────────────────────────────────────────────────────────────────────

/** Marca um alerta de SOS como resolvido, com o que foi feito. */
export async function resolveSosAlertAction(input: { alertId: string; notes: string }) {
  const parsed = resolveSosSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const authCheck = await requireAdmin()
  if (!authCheck.authorized || !authCheck.user) {
    return { success: false, error: authCheck.error }
  }

  const adminDb = await createServiceClient()
  const { data: updated, error } = await adminDb
    .from('emergency_alerts')
    .update({
      resolved: true,
      resolved_notes: parsed.data.notes,
      resolved_at: new Date().toISOString(),
      resolved_by: authCheck.user.id,
    })
    .eq('id', parsed.data.alertId)
    .or('resolved.is.null,resolved.eq.false')
    .select('id')

  if (error) {
    console.error('[admin] Erro ao resolver SOS:', error)
    return { success: false, error: 'Erro ao registrar a resolução do SOS.' }
  }
  if (!updated || updated.length === 0) {
    return { success: false, error: 'Este SOS já foi resolvido. Atualize a tela.' }
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}
