import { z } from 'zod'

export const forgotPinSchema = z.object({
  phone: z.string().min(1, 'Celular é obrigatório'),
})

export const resetPinSchema = z.object({
  phone: z.string().min(1, 'Celular é obrigatório'),
  code: z.string().trim().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
  newPin: z.string().regex(/^\d{4,8}$/, 'O PIN deve conter entre 4 e 8 dígitos numéricos'),
})
