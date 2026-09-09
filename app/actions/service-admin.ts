'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { updateServiceSchema, toggleServiceStatusSchema } from '@/lib/validations/service-admin'
import { revalidatePath } from 'next/cache'

/**
 * Valida se a requisição atual é originada por um usuário autenticado com perfil 'admin'.
 */
async function requireAdminAuth() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { authorized: false, error: 'Acesso não autenticado. Faça login para continuar.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.role !== 'admin') {
    return { authorized: false, error: 'Acesso negado. Requer credenciais de Administrador.' }
  }

  return { authorized: true, user }
}

/**
 * Atualiza preço e dados de um serviço no catálogo do Repara RV.
 * Mantém obrigatoriamente a taxa fixa da plataforma de R$ 12,00 (Guardrail 3).
 */
export async function updateServiceAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = updateServiceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dados inválidos fornecidos para o serviço.',
      issues: parsed.error.format(),
    }
  }

  const { id, name, category, description, fixed_price, is_active } = parsed.data
  const adminDb = await createServiceClient()

  const updatePayload: Record<string, unknown> = {
    fixed_price,
    platform_fee: 12.0, // Regra inegociável da plataforma
    updated_at: new Date().toISOString(),
  }

  if (name !== undefined) updatePayload.name = name
  if (category !== undefined) updatePayload.category = category
  if (description !== undefined) updatePayload.description = description
  if (is_active !== undefined) updatePayload.is_active = is_active

  const { data, error } = await adminDb
    .from('quick_services')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: 'Erro ao atualizar dados do serviço no banco de dados.' }
  }

  // Revalidação de cache instantânea para a Home e catálogo público
  revalidatePath('/')
  revalidatePath('/admin/servicos')
  revalidatePath('/chamar')

  return { success: true, data }
}

/**
 * Alterna rapidamente a visibilidade do serviço (Ativo / Inativo).
 */
export async function toggleServiceStatusAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = toggleServiceStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Parâmetros inválidos para alternar status do serviço.' }
  }

  const { id, is_active } = parsed.data
  const adminDb = await createServiceClient()

  const { data, error } = await adminDb
    .from('quick_services')
    .update({ is_active })
    .eq('id', id)
    .select('id, name, is_active')
    .single()

  if (error) {
    return { success: false, error: 'Falha ao alterar o status do serviço.' }
  }

  revalidatePath('/')
  revalidatePath('/admin/servicos')

  return { success: true, data }
}
