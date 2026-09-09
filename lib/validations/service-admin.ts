import { z } from 'zod'

export const updateServiceSchema = z.object({
  id: z.string().uuid('ID do serviço inválido'),
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').optional(),
  category: z.string().min(2, 'Categoria inválida').optional(),
  description: z.string().optional(),
  fixed_price: z.number().min(20, 'O valor mínimo é R$ 20,00').max(2000, 'O valor máximo é R$ 2.000,00'),
  is_active: z.boolean().optional(),
})

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>

export const createServiceSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  category: z.string().min(2, 'Selecione ou digite uma categoria'),
  description: z.string().optional().default(''),
  fixed_price: z.number().min(20, 'O valor mínimo é R$ 20,00').max(2000, 'O valor máximo é R$ 2.000,00'),
  icon: z.string().optional().default('Wrench'),
  color: z.string().optional().default('#F97316'),
  is_active: z.boolean().optional().default(true),
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
