import { describe, it, expect } from 'vitest'
import {
  getLegalDocumentSchema,
  upsertLegalClauseSchema,
  deleteLegalClauseSchema,
  reorderLegalClausesSchema,
  updateLegalDocumentMetaSchema,
} from '../lib/validations/legal-admin'

const validId = '11111111-1111-4111-8111-111111111111'
const validId2 = '22222222-2222-4222-8222-222222222222'

describe('getLegalDocumentSchema (lib/validations/legal-admin) — usado por app/actions/legal-admin.ts', () => {
  it('aceita um slug válido', () => {
    expect(getLegalDocumentSchema.safeParse({ slug: 'termos' }).success).toBe(true)
  })

  it('rejeita slug fora do allowlist', () => {
    expect(getLegalDocumentSchema.safeParse({ slug: 'faq' }).success).toBe(false)
  })
})

describe('upsertLegalClauseSchema', () => {
  const validPayload = {
    document_slug: 'termos' as const,
    section_id: 'garantia-7-dias',
    title: 'Da Garantia do Serviço',
    body_markdown: 'Todo reparo possui garantia de 7 dias corridos.',
  }

  it('aceita o payload mínimo válido (criação, sem id)', () => {
    const result = upsertLegalClauseSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('aceita payload de atualização (com id e icon_key)', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, id: validId, icon_key: 'Shield' })
    expect(result.success).toBe(true)
  })

  it('rejeita id que não é UUID', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, id: 'nao-e-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejeita document_slug fora do allowlist', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, document_slug: 'faq' })
    expect(result.success).toBe(false)
  })

  it.each(['Garantia7Dias', 'garantia_7_dias', 'Garantia 7 Dias', 'ab--cd', '-garantia'])(
    'rejeita section_id que não é kebab-case (%s)',
    (section_id) => {
      const result = upsertLegalClauseSchema.safeParse({ ...validPayload, section_id })
      expect(result.success).toBe(false)
    }
  )

  it('rejeita título com menos de 3 caracteres', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, title: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejeita body_markdown vazio', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, body_markdown: '' })
    expect(result.success).toBe(false)
  })

  it('rejeita icon_key fora do allowlist (previne import dinâmico arbitrário)', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, icon_key: 'RandomIconNaoExiste' })
    expect(result.success).toBe(false)
  })

  it('aceita icon_key nulo (cláusula sem ícone)', () => {
    const result = upsertLegalClauseSchema.safeParse({ ...validPayload, icon_key: null })
    expect(result.success).toBe(true)
  })

  it('rejeita order_index negativo ou não-inteiro', () => {
    expect(upsertLegalClauseSchema.safeParse({ ...validPayload, order_index: -1 }).success).toBe(false)
    expect(upsertLegalClauseSchema.safeParse({ ...validPayload, order_index: 1.5 }).success).toBe(false)
  })
})

describe('deleteLegalClauseSchema', () => {
  it('aceita um id UUID válido', () => {
    expect(deleteLegalClauseSchema.safeParse({ id: validId }).success).toBe(true)
  })

  it('rejeita id que não é UUID', () => {
    expect(deleteLegalClauseSchema.safeParse({ id: 'nao-e-uuid' }).success).toBe(false)
  })
})

describe('reorderLegalClausesSchema', () => {
  it('aceita uma lista de ids válida', () => {
    const result = reorderLegalClausesSchema.safeParse({ document_slug: 'contrato', ordered_ids: [validId, validId2] })
    expect(result.success).toBe(true)
  })

  it('rejeita lista vazia', () => {
    const result = reorderLegalClausesSchema.safeParse({ document_slug: 'contrato', ordered_ids: [] })
    expect(result.success).toBe(false)
  })

  it('rejeita um id inválido dentro da lista', () => {
    const result = reorderLegalClausesSchema.safeParse({ document_slug: 'contrato', ordered_ids: [validId, 'nao-e-uuid'] })
    expect(result.success).toBe(false)
  })
})

describe('updateLegalDocumentMetaSchema', () => {
  it('aceita payload parcial (só slug, sem campos opcionais)', () => {
    expect(updateLegalDocumentMetaSchema.safeParse({ slug: 'privacidade' }).success).toBe(true)
  })

  it('aceita payload completo', () => {
    const result = updateLegalDocumentMetaSchema.safeParse({
      slug: 'privacidade',
      title: 'Política de Privacidade (LGPD)',
      version: '1.1',
      effective_date: '2026-09-15',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita effective_date fora do formato AAAA-MM-DD', () => {
    const result = updateLegalDocumentMetaSchema.safeParse({ slug: 'privacidade', effective_date: '15/09/2026' })
    expect(result.success).toBe(false)
  })

  it('rejeita slug fora do allowlist', () => {
    expect(updateLegalDocumentMetaSchema.safeParse({ slug: 'faq' }).success).toBe(false)
  })
})
