'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { 
  updateServiceSchema, 
  toggleServiceStatusSchema,
  createServiceSchema,
  deleteServiceSchema 
} from '@/lib/validations/service-admin'
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
      error: parsed.error.issues[0]?.message || 'Dados inválidos fornecidos para o serviço.',
      issues: parsed.error.format(),
    }
  }

  const { id, name, category, description, fixed_price, is_active } = parsed.data
  const adminDb = await createServiceClient()

  // Observação: a tabela quick_services não possui coluna updated_at no banco
  const updatePayload: Record<string, unknown> = {
    fixed_price,
    platform_fee: 12.0, // Regra inegociável da plataforma
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
    console.error('[updateServiceAction error]', error)
    return { success: false, error: `Erro ao atualizar dados do serviço no banco de dados: ${error.message}` }
  }

  // Revalidação de cache instantânea para a Home e catálogo público
  revalidatePath('/')
  revalidatePath('/admin/servicos')
  revalidatePath('/chamar')

  return { success: true, data }
}

/**
 * Cadastra um novo serviço no catálogo do Repara RV.
 */
export async function createServiceAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = createServiceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados inválidos para criação do serviço.',
    }
  }

  const { name, category, description, fixed_price, icon, color, is_active } = parsed.data
  const adminDb = await createServiceClient()

  // Determina o próximo sort_order
  const { data: existingServices } = await adminDb
    .from('quick_services')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = ((existingServices?.[0]?.sort_order as number) ?? 0) + 1

  const { data, error } = await adminDb
    .from('quick_services')
    .insert({
      name,
      category,
      description: description || null,
      fixed_price,
      platform_fee: 12.0, // Regra inegociável
      icon: icon || 'Wrench',
      color: color || '#F97316',
      sort_order: nextSortOrder,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error('[createServiceAction error]', error)
    return { success: false, error: `Erro ao cadastrar novo serviço: ${error.message}` }
  }

  revalidatePath('/')
  revalidatePath('/admin/servicos')
  revalidatePath('/chamar')

  return { success: true, data }
}

/**
 * Exclui ou desativa com segurança um serviço do catálogo.
 */
export async function deleteServiceAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = deleteServiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'ID do serviço inválido.' }
  }

  const { id } = parsed.data
  const adminDb = await createServiceClient()

  // 1. Verifica se existem atendimentos vinculados a este serviço
  const { count, error: countError } = await adminDb
    .from('service_calls')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', id)

  if (countError) {
    return { success: false, error: 'Erro ao verificar dependências do serviço.' }
  }

  if (count && count > 0) {
    // Possui histórico operacional: desativa do catálogo para preservar integridade referencial
    const { error: deactivateError } = await adminDb
      .from('quick_services')
      .update({ is_active: false })
      .eq('id', id)

    if (deactivateError) {
      return { success: false, error: 'Falha ao desativar serviço com histórico.' }
    }

    revalidatePath('/')
    revalidatePath('/admin/servicos')
    revalidatePath('/chamar')

    return {
      success: true,
      deactivatedOnly: true,
      message: `O serviço possui ${count} chamado(s) no histórico. Para proteger a integridade dos relatórios contábeis, ele foi desativado do catálogo em vez de apagado.`,
    }
  }

  // 2. Sem atendimentos: exclusão física permanente
  const { error: deleteError } = await adminDb
    .from('quick_services')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[deleteServiceAction error]', deleteError)
    return { success: false, error: `Erro ao excluir serviço do catálogo: ${deleteError.message}` }
  }

  revalidatePath('/')
  revalidatePath('/admin/servicos')
  revalidatePath('/chamar')

  return { success: true, deleted: true, message: 'Serviço excluído permanentemente do catálogo com sucesso.' }
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

