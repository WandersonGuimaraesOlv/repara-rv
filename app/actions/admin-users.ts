'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { updateUserRoleSchema } from '@/lib/validations/admin-users'
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
  provider_status?: {
    is_online: boolean
    pix_key: string
    pix_key_type: string
    updated_at: string
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

    // 2. Busca status de prestadores (Pix, online/offline)
    const { data: providerStatuses } = await adminDb
      .from('provider_status')
      .select('*')

    interface ProviderStatusRow {
      provider_id: string
      is_online?: boolean | null
      pix_key?: string | null
      pix_key_type?: string | null
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
      return {
        id: p.id,
        role: p.role,
        full_name: p.full_name || 'Sem nome cadastrado',
        phone: p.phone,
        cpf_or_cnpj: p.cpf_or_cnpj || '',
        created_at: p.created_at || new Date().toISOString(),
        terms_accepted_at: p.terms_accepted_at,
        self_declaration_signed: p.self_declaration_signed,
        provider_status: ps
          ? {
              is_online: Boolean(ps.is_online),
              pix_key: ps.pix_key || '',
              pix_key_type: ps.pix_key_type || '',
              updated_at: ps.updated_at || '',
            }
          : null,
        total_calls_as_client: clientCallsMap.get(p.id) || 0,
        unpaid_calls_as_client: clientUnpaidMap.get(p.id) || 0,
        total_calls_as_provider: providerCallsMap.get(p.id) || 0,
        completed_calls_as_provider: providerCompletedMap.get(p.id) || 0,
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
  const { data, error } = await adminDb
    .from('service_calls')
    .update({ payment_status: input.paymentStatus })
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
