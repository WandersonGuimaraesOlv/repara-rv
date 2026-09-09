import { z } from 'zod'

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  role: z.enum(['client', 'provider', 'admin']),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
