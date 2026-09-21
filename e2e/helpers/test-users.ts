// =============================================================================
// e2e/helpers/test-users.ts
// Cria/limpa usuários de teste direto no Supabase (Service Role) pros
// specs de E2E — evita depender da UI de cadastro (mais lento, mais frágil)
// só pra chegar ao estado "tenho uma conta", que não é o que estamos testando.
//
// O email/senha seguem exatamente o mesmo padrão que app/api/auth/pin/route.ts
// usa internamente (email = `${telefone}@repararv.com`, senha = `pin_${pin}`),
// então o login via UI (telefone + PIN) funciona normalmente contra esses
// usuários — a autenticação em si roda de verdade, não é pulada.
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export const TEST_PIN = '1234'

export interface TestUserHandle {
  id: string
  phone: string
  pin: string
}

let counter = 0

// 11 dígitos exatos e determinísticos: "6299" (4) + 6 dígitos do timestamp + 1 dígito do contador.
function makePhone(prefix: '6299' | '6298'): string {
  counter++
  return `${prefix}${String(Date.now()).slice(-6)}${counter % 10}`
}

export async function createTestClient(runId: string): Promise<TestUserHandle> {
  const phone = makePhone('6299')
  const email = `${phone}@repararv.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `pin_${TEST_PIN}`,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Falha ao criar cliente de teste: ${error?.message}`)

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: 'client',
    full_name: `[E2E ${runId}] Cliente Teste`,
    phone,
    // E-mail é obrigatório desde 16/09/2026: sem ele o login manda pra
    // /completar-email e o teste nunca chega na tela de destino.
    email: `${phone}@repararv-test.local`,
    cpf_or_cnpj: '',
    terms_accepted_at: new Date().toISOString(),
  })
  if (profileError) throw new Error(`Falha ao criar profile do cliente de teste: ${profileError.message}`)

  return { id: data.user.id, phone, pin: TEST_PIN }
}

export async function createTestProvider(runId: string): Promise<TestUserHandle> {
  const phone = makePhone('6298')
  const email = `${phone}@repararv.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `pin_${TEST_PIN}`,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Falha ao criar prestador de teste: ${error?.message}`)

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: 'provider',
    full_name: `[E2E ${runId}] Prestador Teste`,
    phone,
    email: `${phone}@repararv-test.local`,
    // Gate de aprovação (18/09/2026): find_nearest_provider e o trigger de
    // provider_status só aceitam prestador 'approved'.
    background_check_status: 'approved',
    verified_at: new Date().toISOString(),
    cpf_or_cnpj: '',
    terms_accepted_at: new Date().toISOString(),
    self_declaration_signed: true,
  })
  if (profileError) throw new Error(`Falha ao criar profile do prestador de teste: ${profileError.message}`)

  const { error: statusError } = await admin.from('provider_status').insert({
    provider_id: data.user.id,
    is_online: true,
    pix_key: phone,
    pix_key_type: 'phone',
    recipient_gateway_id: `[E2E ${runId}] gw`,
    current_location: 'POINT(-50.9264 -17.7943)',
  })
  if (statusError) throw new Error(`Falha ao criar provider_status do prestador de teste: ${statusError.message}`)

  return { id: data.user.id, phone, pin: TEST_PIN }
}

export async function getActiveServiceId(): Promise<string> {
  const { data, error } = await admin
    .from('quick_services')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (error || !data) throw new Error(`Nenhum serviço ativo encontrado: ${error?.message}`)
  return data.id
}

export async function cleanupTestData(userIds: string[], callIds: string[] = []) {
  let auditBlocked = false
  for (const callId of callIds) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId)
    if (error) auditBlocked = true
  }
  if (!auditBlocked) {
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
  }
  return { auditBlocked }
}
