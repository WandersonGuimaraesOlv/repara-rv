import { z } from 'zod'

export const LEGAL_DOCUMENT_SLUGS = ['termos', 'privacidade', 'contrato'] as const
export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number]

// Mantido em sincronia manual com lib/legal-icons.ts (LEGAL_ICON_MAP)
export const LEGAL_CLAUSE_ICONS = [
  'FileText', 'AlertTriangle', 'CheckCircle2', 'Shield', 'ShieldCheck', 'Wrench',
  'CreditCard', 'Clock', 'Star', 'Scale', 'Lock', 'Eye', 'Database', 'Fingerprint',
  'Globe', 'Mail', 'FileCheck',
] as const
export type LegalClauseIcon = (typeof LEGAL_CLAUSE_ICONS)[number]

const sectionIdSchema = z
  .string()
  .min(2, 'Âncora muito curta')
  .max(60, 'Âncora muito longa')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Âncora deve ser kebab-case (ex: garantia-7-dias)')

export const getLegalDocumentSchema = z.object({
  slug: z.enum(LEGAL_DOCUMENT_SLUGS),
})
export type GetLegalDocumentInput = z.infer<typeof getLegalDocumentSchema>

export const upsertLegalClauseSchema = z.object({
  id: z.string().uuid('ID da cláusula inválido').optional(),
  document_slug: z.enum(LEGAL_DOCUMENT_SLUGS),
  section_id: sectionIdSchema,
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(200, 'Título muito longo'),
  icon_key: z.enum(LEGAL_CLAUSE_ICONS).nullable().optional(),
  body_markdown: z.string().min(1, 'O corpo da cláusula não pode ficar vazio').max(20000, 'Corpo excede 20.000 caracteres'),
  order_index: z.number().int('Ordem deve ser um número inteiro').min(0, 'Ordem não pode ser negativa').optional(),
})
export type UpsertLegalClauseInput = z.infer<typeof upsertLegalClauseSchema>

export const deleteLegalClauseSchema = z.object({
  id: z.string().uuid('ID da cláusula inválido'),
})
export type DeleteLegalClauseInput = z.infer<typeof deleteLegalClauseSchema>

export const reorderLegalClausesSchema = z.object({
  document_slug: z.enum(LEGAL_DOCUMENT_SLUGS),
  ordered_ids: z.array(z.string().uuid('ID de cláusula inválido na lista de reordenação')).min(1, 'Lista de reordenação vazia'),
})
export type ReorderLegalClausesInput = z.infer<typeof reorderLegalClausesSchema>

export const updateLegalDocumentMetaSchema = z.object({
  slug: z.enum(LEGAL_DOCUMENT_SLUGS),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(200, 'Título muito longo').optional(),
  version: z.string().min(1, 'Versão não pode ficar vazia').max(20, 'Versão muito longa').optional(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)').optional(),
})
export type UpdateLegalDocumentMetaInput = z.infer<typeof updateLegalDocumentMetaSchema>
