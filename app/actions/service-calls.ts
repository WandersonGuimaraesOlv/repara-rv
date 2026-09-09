'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceCallSchema } from '@/lib/validations/service-call'
import { revalidatePath } from 'next/cache'

export async function createServiceCallAction(input: unknown) {
  // 1. Validação em tempo de execução
  const parsed = createServiceCallSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: 'Dados inválidos', issues: parsed.error.format() }
  }

  const supabase = await createClient()

  // 2. Busca o serviço para validar preço fixo
  const { data: service, error: serviceError } = await supabase
    .from('quick_services')
    .select('fixed_price, platform_fee')
    .eq('id', parsed.data.serviceId)
    .single()

  if (serviceError || !service) {
    return { success: false, error: 'Serviço não localizado' }
  }

  const totalPrice = Number(service.fixed_price)
  const platformFee = Number(service.platform_fee) // R$ 12.00
  const providerCut = totalPrice - platformFee

  // 3. Inserção tipada no banco
  const { data, error } = await supabase
    .from('service_calls')
    .insert({
      client_id: parsed.data.clientId,
      service_id: parsed.data.serviceId,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: providerCut,
      neighborhood: parsed.data.neighborhood,
      client_address: parsed.data.clientAddress,
      client_location: `POINT(${parsed.data.longitude} ${parsed.data.latitude})`,
      status: 'searching',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: 'Falha ao abrir chamado técnico' }
  }

  revalidatePath('/meus-pedidos')
  return { success: true, data }
}
