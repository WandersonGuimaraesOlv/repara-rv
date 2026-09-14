import { z } from 'zod'

// Piso de remuneração inegociável ao prestador (AGENTS.md seção 2). Achado em
// 14/09/2026: nem updateServiceSchema nem createServiceSchema checavam isso —
// só que a taxa não fosse >= o preço total — o que permitiu 4 serviços reais
// do catálogo entrarem em produção pagando abaixo do piso (R$48, R$48, R$48 e
// R$38 de repasse líquido). Corrigido pra bloquear na origem, na própria
// validação usada pelo painel /admin/servicos.
const MIN_PROVIDER_CUT = 50

export const updateServiceSchema = z
  .object({
    id: z.string().uuid('ID do serviço inválido'),
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').optional(),
    category: z.string().min(2, 'Categoria inválida').optional(),
    description: z.string().optional(),
    fixed_price: z.number().min(20, 'O valor mínimo é R$ 20,00').max(2000, 'O valor máximo é R$ 2.000,00'),
    platform_fee: z.number().min(5, 'A taxa mínima é R$ 5,00').max(500, 'Taxa máxima excedida').optional(),
    is_active: z.boolean().optional(),
    included: z.array(z.string()).optional(),
    not_included: z.array(z.string()).optional(),
    duration_est: z.string().optional(),
  })
  .refine((data) => data.fixed_price - (data.platform_fee ?? 12.0) >= MIN_PROVIDER_CUT, {
    message: `O repasse líquido ao prestador não pode ficar abaixo de R$ ${MIN_PROVIDER_CUT.toFixed(2)} (piso de remuneração obrigatório)`,
    path: ['platform_fee'],
  })

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

export const createServiceSchema = z
  .object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    category: z.string().min(2, 'Selecione ou digite uma categoria'),
    description: z.string().optional().default(''),
    fixed_price: z.number().min(20, 'O valor mínimo é R$ 20,00').max(2000, 'O valor máximo é R$ 2.000,00'),
    platform_fee: z.number().min(5, 'A taxa mínima é R$ 5,00').max(500, 'Taxa máxima excedida').optional().default(12.0),
    icon: z.string().optional().default('Wrench'),
    color: z.string().optional().default('#F97316'),
    is_active: z.boolean().optional().default(true),
    included: z.array(z.string()).optional().default([]),
    not_included: z.array(z.string()).optional().default([]),
    duration_est: z.string().optional().default('40 min'),
  })
  .refine((data) => data.fixed_price - data.platform_fee >= MIN_PROVIDER_CUT, {
    message: `O repasse líquido ao prestador não pode ficar abaixo de R$ ${MIN_PROVIDER_CUT.toFixed(2)} (piso de remuneração obrigatório)`,
    path: ['platform_fee'],
  })

export type CreateServiceInput = z.infer<typeof createServiceSchema>

export const deleteServiceSchema = z.object({
  id: z.string().uuid('ID do serviço inválido'),
})

export type DeleteServiceInput = z.infer<typeof deleteServiceSchema>

export const toggleServiceStatusSchema = z.object({
  id: z.string().uuid('ID do serviço inválido'),
  is_active: z.boolean(),
})

export type ToggleServiceStatusInput = z.infer<typeof toggleServiceStatusSchema>
