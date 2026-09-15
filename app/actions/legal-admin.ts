'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import {
  getLegalDocumentSchema,
  upsertLegalClauseSchema,
  deleteLegalClauseSchema,
  reorderLegalClausesSchema,
  updateLegalDocumentMetaSchema,
} from '@/lib/validations/legal-admin'
import { revalidatePath } from 'next/cache'

/**
 * Valida se a requisição atual é originada por um usuário autenticado com perfil 'admin'.
 */
type AdminAuthResult =
  | { authorized: true; user: User }
  | { authorized: false; error: string }

async function requireAdminAuth(): Promise<AdminAuthResult> {
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

function revalidateLegalPaths(slug: string) {
  revalidatePath('/admin/juridico')
  revalidatePath(`/${slug}`)
}

/**
 * Busca um documento jurídico e suas cláusulas ordenadas, para o painel admin.
 */
export async function getLegalDocumentAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = getLegalDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Documento inválido.' }
  }

  const { slug } = parsed.data
  const adminDb = await createServiceClient()

  const [{ data: document, error: docError }, { data: clauses, error: clausesError }] = await Promise.all([
    adminDb.from('legal_documents').select('*').eq('slug', slug).maybeSingle(),
    adminDb.from('legal_clauses').select('*').eq('document_slug', slug).order('order_index', { ascending: true }),
  ])

  if (docError || clausesError) {
    console.error('[getLegalDocumentAction error]', docError, clausesError)
    return { success: false, error: 'Erro ao buscar documento jurídico.' }
  }

  return { success: true, document, clauses: clauses ?? [] }
}

/**
 * Cria ou atualiza uma cláusula (upsert conforme presença de `id`).
 */
export async function upsertLegalClauseAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = upsertLegalClauseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados inválidos fornecidos para a cláusula.',
      issues: parsed.error.format(),
    }
  }

  const { id, document_slug, section_id, title, icon_key, body_markdown, order_index } = parsed.data
  const adminDb = await createServiceClient()

  if (id) {
    const { data, error } = await adminDb
      .from('legal_clauses')
      .update({ section_id, title, icon_key: icon_key ?? null, body_markdown, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[upsertLegalClauseAction update error]', error)
      return { success: false, error: `Erro ao atualizar cláusula: ${error.message}` }
    }

    revalidateLegalPaths(document_slug)
    return { success: true, data }
  }

  let nextOrderIndex = order_index
  if (nextOrderIndex === undefined) {
    const { data: existing } = await adminDb
      .from('legal_clauses')
      .select('order_index')
      .eq('document_slug', document_slug)
      .order('order_index', { ascending: false })
      .limit(1)
    nextOrderIndex = ((existing?.[0]?.order_index as number) ?? -1) + 1
  }

  const { data, error } = await adminDb
    .from('legal_clauses')
    .insert({ document_slug, section_id, title, icon_key: icon_key ?? null, body_markdown, order_index: nextOrderIndex })
    .select()
    .single()

  if (error) {
    console.error('[upsertLegalClauseAction insert error]', error)
    return { success: false, error: `Erro ao criar cláusula: ${error.message}` }
  }

  revalidateLegalPaths(document_slug)
  return { success: true, data }
}

/**
 * Exclui permanentemente uma cláusula.
 */
export async function deleteLegalClauseAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = deleteLegalClauseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'ID da cláusula inválido.' }
  }

  const { id } = parsed.data
  const adminDb = await createServiceClient()

  const { data: existing, error: fetchError } = await adminDb
    .from('legal_clauses')
    .select('document_slug')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !existing) {
    return { success: false, error: 'Cláusula não encontrada.' }
  }

  const { error: deleteError } = await adminDb.from('legal_clauses').delete().eq('id', id)

  if (deleteError) {
    console.error('[deleteLegalClauseAction error]', deleteError)
    return { success: false, error: `Erro ao excluir cláusula: ${deleteError.message}` }
  }

  revalidateLegalPaths(existing.document_slug as string)
  return { success: true, deleted: true }
}

/**
 * Reordena atomicamente as cláusulas de um documento via RPC.
 */
export async function reorderLegalClausesAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = reorderLegalClausesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Lista de reordenação inválida.' }
  }

  const { document_slug, ordered_ids } = parsed.data
  const adminDb = await createServiceClient()

  const { error } = await adminDb.rpc('reorder_legal_clauses', {
    p_document_slug: document_slug,
    p_ordered_ids: ordered_ids,
  })

  if (error) {
    console.error('[reorderLegalClausesAction error]', error)
    return { success: false, error: `Erro ao reordenar cláusulas: ${error.message}` }
  }

  revalidateLegalPaths(document_slug)
  return { success: true }
}

/**
 * Atualiza título/versão/data de vigência de um documento jurídico.
 */
export async function updateLegalDocumentMetaAction(input: unknown) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }
  }

  const parsed = updateLegalDocumentMetaSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos para o documento.' }
  }

  const { slug, title, version, effective_date } = parsed.data
  const adminDb = await createServiceClient()

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: authCheck.user.id,
  }
  if (title !== undefined) updatePayload.title = title
  if (version !== undefined) updatePayload.version = version
  if (effective_date !== undefined) updatePayload.effective_date = effective_date

  const { data, error } = await adminDb
    .from('legal_documents')
    .update(updatePayload)
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    console.error('[updateLegalDocumentMetaAction error]', error)
    return { success: false, error: `Erro ao atualizar metadados do documento: ${error.message}` }
  }

  revalidateLegalPaths(slug)
  return { success: true, data }
}
