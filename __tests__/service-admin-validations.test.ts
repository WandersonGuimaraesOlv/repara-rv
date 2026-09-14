import { describe, it, expect } from 'vitest'
import {
  updateServiceSchema,
  createServiceSchema,
  deleteServiceSchema,
  toggleServiceStatusSchema,
} from '../lib/validations/service-admin'

const validId = '11111111-1111-4111-8111-111111111111'

describe('updateServiceSchema (lib/validations/service-admin) — usado por app/actions/service-admin.ts', () => {
  it('aceita o payload mínimo válido (só id + fixed_price)', () => {
    const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 80 })
    expect(result.success).toBe(true)
  })

  it('rejeita id que não é UUID', () => {
    const result = updateServiceSchema.safeParse({ id: 'nao-e-uuid', fixed_price: 80 })
    expect(result.success).toBe(false)
  })

  it('rejeita fixed_price ausente — é o único campo realmente obrigatório além do id', () => {
    const result = updateServiceSchema.safeParse({ id: validId })
    expect(result.success).toBe(false)
  })

  it.each([19, 2001, -50, 0])('rejeita fixed_price fora da faixa R$20-R$2000 (%d)', (fixed_price) => {
    const result = updateServiceSchema.safeParse({ id: validId, fixed_price })
    expect(result.success).toBe(false)
  })

  it.each([4, 501])('rejeita platform_fee fora da faixa R$5-R$500 (%d)', (platform_fee) => {
    const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 80, platform_fee })
    expect(result.success).toBe(false)
  })

  it('rejeita name com menos de 3 caracteres', () => {
    const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 80, name: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejeita included/not_included que não são array de strings', () => {
    const result = updateServiceSchema.safeParse({
      id: validId,
      fixed_price: 80,
      included: 'não é array',
    })
    expect(result.success).toBe(false)
  })

  it('aceita atualização parcial: name/category/is_active omitidos continuam undefined, não quebram o parse', () => {
    const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 80, is_active: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeUndefined()
      expect(result.data.is_active).toBe(false)
    }
  })

  describe('piso de remuneração de R$50 (achado real: 4 serviços do catálogo violavam isso)', () => {
    it('rejeita repasse líquido abaixo de R$50 mesmo com fixed_price/platform_fee individualmente dentro dos limites', () => {
      // Caso real encontrado: Troca de Mangueira e Registro de Gás — R$50 total, R$12 de taxa, R$38 de repasse
      const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 50, platform_fee: 12 })
      expect(result.success).toBe(false)
    })

    it('aceita repasse líquido de exatamente R$50 (limite, não abaixo dele)', () => {
      const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 62, platform_fee: 12 })
      expect(result.success).toBe(true)
    })

    it('aplica o piso também quando platform_fee é omitido (usa o default de R$12 da action)', () => {
      // fixed_price=60 com fee implícito de 12 -> repasse de 48, abaixo do piso
      const result = updateServiceSchema.safeParse({ id: validId, fixed_price: 60 })
      expect(result.success).toBe(false)
    })
  })
})

describe('createServiceSchema (lib/validations/service-admin)', () => {
  it('aceita o payload mínimo e aplica os defaults documentados', () => {
    const result = createServiceSchema.safeParse({
      name: 'Troca de Torneira',
      category: 'Hidráulica',
      fixed_price: 90,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.platform_fee).toBe(12.0)
      expect(result.data.icon).toBe('Wrench')
      expect(result.data.color).toBe('#F97316')
      expect(result.data.is_active).toBe(true)
      expect(result.data.included).toEqual([])
      expect(result.data.not_included).toEqual([])
      expect(result.data.duration_est).toBe('40 min')
    }
  })

  it('rejeita name ausente', () => {
    const result = createServiceSchema.safeParse({ category: 'Elétrica', fixed_price: 80 })
    expect(result.success).toBe(false)
  })

  it('rejeita category com menos de 2 caracteres', () => {
    const result = createServiceSchema.safeParse({ name: 'Serviço X', category: 'A', fixed_price: 80 })
    expect(result.success).toBe(false)
  })

  it('rejeita fixed_price como string (não faz coerção silenciosa de tipo)', () => {
    const result = createServiceSchema.safeParse({ name: 'Serviço X', category: 'Geral', fixed_price: '80' })
    expect(result.success).toBe(false)
  })

  describe('piso de remuneração de R$50 (achado real: 4 serviços do catálogo violavam isso)', () => {
    it('rejeita um novo serviço cujo repasse líquido fica abaixo de R$50', () => {
      // Caso real encontrado: Instalação de Plafon/LED, Regulagem de Dobradiças, Vedação de Box — R$60 total, R$12 de taxa, R$48 de repasse
      const result = createServiceSchema.safeParse({ name: 'Serviço Barato', category: 'Geral', fixed_price: 60, platform_fee: 12 })
      expect(result.success).toBe(false)
    })

    it('rejeita mesmo usando o platform_fee default (R$12) quando fixed_price é baixo', () => {
      const result = createServiceSchema.safeParse({ name: 'Serviço Barato', category: 'Geral', fixed_price: 60 })
      expect(result.success).toBe(false)
    })

    it('aceita um novo serviço cujo repasse líquido é exatamente R$50', () => {
      const result = createServiceSchema.safeParse({ name: 'Serviço no Limite', category: 'Geral', fixed_price: 62, platform_fee: 12 })
      expect(result.success).toBe(true)
    })
  })
})

describe('deleteServiceSchema / toggleServiceStatusSchema (lib/validations/service-admin)', () => {
  it('deleteServiceSchema exige id em formato UUID', () => {
    expect(deleteServiceSchema.safeParse({ id: validId }).success).toBe(true)
    expect(deleteServiceSchema.safeParse({ id: '123' }).success).toBe(false)
    expect(deleteServiceSchema.safeParse({}).success).toBe(false)
  })

  it('toggleServiceStatusSchema exige id UUID + is_active booleano', () => {
    expect(toggleServiceStatusSchema.safeParse({ id: validId, is_active: true }).success).toBe(true)
    expect(toggleServiceStatusSchema.safeParse({ id: validId, is_active: 'true' }).success).toBe(false)
    expect(toggleServiceStatusSchema.safeParse({ id: validId }).success).toBe(false)
  })
})
