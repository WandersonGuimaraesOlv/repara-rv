import { z } from 'zod'

export const createServiceCallSchema = z.object({
  serviceId: z.string().uuid('ID de serviço inválido'),
  clientId: z.string().uuid('ID de cliente inválido'),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  clientAddress: z.string().min(5, 'Informe o endereço completo'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export type CreateServiceCallInput = z.infer<typeof createServiceCallSchema>
