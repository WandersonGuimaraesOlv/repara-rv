import { z } from 'zod'

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  role: z.enum(['client', 'provider', 'admin']),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

export const updateBackgroundCheckSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  status: z.enum(['pending', 'approved', 'rejected']),
})

export type UpdateBackgroundCheckInput = z.infer<typeof updateBackgroundCheckSchema>

export const toggleUserBlockedSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  isBlocked: z.boolean(),
})

export type ToggleUserBlockedInput = z.infer<typeof toggleUserBlockedSchema>

