import { z } from 'zod'
import { isWeakPin } from '@/lib/validations/br-documents'

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  role: z.enum(['client', 'provider', 'admin']),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

export const updateBackgroundCheckSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectionReason: z.string().trim().max(500).optional(),
})

export type UpdateBackgroundCheckInput = z.infer<typeof updateBackgroundCheckSchema>

export const toggleUserBlockedSchema = z.object({
  userId: z.string().uuid('ID de usuário inválido'),
  isBlocked: z.boolean(),
})

export type ToggleUserBlockedInput = z.infer<typeof toggleUserBlockedSchema>

export const resetUserPinSchema = z
  .object({
    userId: z.string().uuid('ID de usuário inválido'),
    newPin: z.string().regex(/^\d{4,8}$/, 'O PIN deve conter entre 4 e 8 dígitos numéricos'),
  })
  .refine((data) => !isWeakPin(data.newPin), {
    message: 'PIN muito fácil de adivinhar (sequência ou dígitos repetidos). Escolha outro.',
    path: ['newPin'],
  })

export type ResetUserPinInput = z.infer<typeof resetUserPinSchema>


// Encerrar um alerta de SOS no painel (o que a equipe fez)
export const resolveSosSchema = z.object({
  alertId: z.string().uuid('ID do alerta inválido'),
  notes: z.string().trim().min(5, 'Escreva o que foi feito (pelo menos 5 caracteres).').max(1000, 'Use no máximo 1000 caracteres.'),
})
