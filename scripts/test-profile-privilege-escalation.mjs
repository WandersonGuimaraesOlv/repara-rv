#!/usr/bin/env node
// =============================================================================
// scripts/test-profile-privilege-escalation.mjs
// Teste real (não mock) contra o Supabase de produção — Camada 4/5 do plano
// de validação.
//
// Achado crítico de 14/09/2026: a policy "Usuário edita o próprio perfil"
// (`USING (auth.uid() = id)`, sem WITH CHECK) em profiles não restringe QUAIS
// colunas um usuário pode alterar no próprio registro — só QUAIS LINHAS.
// Confirmado contra o banco real: um prestador com is_blocked=true e
// background_check_status='rejected' conseguia, com a própria sessão
// autenticada (chave anon), setar is_blocked=false, background_check_status
// ='approved' e inflar completed_orders_count — se autodesbanindo e
// autoaprovando, sem passar por nenhuma tela do admin.
//
// Corrigido com um trigger (protect_sensitive_profile_fields) que reverte
// is_blocked, background_check_status, rating_avg, completed_orders_count
// e mercado_pago_connected pro valor anterior sempre que quem está
// escrevendo não é a Service Role — aplicado manualmente no SQL Editor do
// Supabase pelo dono do projeto (fora do alcance desta sessão).
//
// Este script prova, contra o banco real, que:
//   1. Um usuário tentando se autodesbanir/autoaprovar via UPDATE direto
//      (mesmo caminho que o navegador usaria) tem os campos sensíveis
//      silenciosamente revertidos.
//   2. Escritas legítimas (ex: full_name) continuam funcionando normalmente
//      — o trigger não quebrou o autoatendimento de perfil.
//   3. O painel admin (app/actions/admin-users.ts — toggleUserBlockedAction
//      e updateBackgroundCheckStatusAction) continua funcionando: essas
//      actions usam createServiceClient() (Service Role), que o trigger
//      explicitamente deixa passar. Sem essa checagem, o fix desta sessão
//      poderia ter corrigido a escalação de privilégio e quebrado a única
//      forma legítima de bloquear/aprovar um usuário ao mesmo tempo.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-profile-privilege-escalation.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const RUN_ID = Date.now().toString(36)
let userId = null
let userId2 = null

function record(name, pass, detail) {
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  return pass
}

async function cleanup() {
  console.log('\n🧹 Limpando dados de teste...')
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
  if (userId2) await admin.auth.admin.deleteUser(userId2).catch(() => {})
  console.log('   Limpeza concluída.')
}

async function run() {
  console.log('🏁 Teste de proteção contra escalação de privilégio em profiles')
  console.log(`   Projeto Supabase: ${SUPABASE_URL}`)

  const email = `priv-esc-test-${RUN_ID}@repararv-test.local`
  const password = `PrivEsc!${RUN_ID}-Aa`
  const { data: u, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createErr) throw new Error(`Falha ao criar usuário de teste: ${createErr.message}`)
  userId = u.user.id

  await admin.from('profiles').insert({
    id: userId,
    role: 'provider',
    full_name: '[TESTE ESCALACAO PRIVILEGIO] provider',
    phone: '62975000000',
    cpf_or_cnpj: '',
    is_blocked: true,
    background_check_status: 'rejected',
  })

  console.log(`\n👤 Prestador de teste criado, deliberadamente bloqueado e reprovado: ${userId}`)

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signInErr } = await asUser.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`Falha ao logar como o usuário de teste: ${signInErr.message}`)

  console.log('\n🔓 Tentando autodesbanir + autoaprovar + inflar métricas (mesma sessão que o navegador usaria)...')
  await asUser
    .from('profiles')
    .update({
      is_blocked: false,
      background_check_status: 'approved',
      rating_avg: 5.0,
      completed_orders_count: 999,
    })
    .eq('id', userId)

  const { data: after } = await admin
    .from('profiles')
    .select('is_blocked, background_check_status, rating_avg, completed_orders_count')
    .eq('id', userId)
    .single()

  const results = []
  results.push(record('is_blocked continua true (não conseguiu se autodesbanir)', after.is_blocked === true))
  results.push(record("background_check_status continua 'rejected' (não conseguiu se autoaprovar)", after.background_check_status === 'rejected'))
  results.push(record('completed_orders_count continua 0 (não conseguiu inflar métrica)', Number(after.completed_orders_count) === 0))

  console.log('\n✍️  Confirmando que uma escrita legítima (full_name) ainda funciona...')
  const { error: nameErr } = await asUser.from('profiles').update({ full_name: '[TESTE ESCALACAO PRIVILEGIO] nome atualizado' }).eq('id', userId)
  const { data: afterName } = await admin.from('profiles').select('full_name').eq('id', userId).single()
  results.push(record('full_name foi atualizado normalmente (trigger não quebrou autoatendimento)', !nameErr && afterName?.full_name?.includes('atualizado')))

  // Achado de 23/09/2026: o gatilho não cobria role — dava pra virar admin.
  console.log('\n👑 Tentando virar admin pela própria sessão...')
  await asUser.from('profiles').update({ role: 'admin' }).eq('id', userId)
  const { data: afterRole } = await admin.from('profiles').select('role').eq('id', userId).single()
  results.push(record("role continua 'provider' (não conseguiu virar admin)", afterRole?.role === 'provider'))

  console.log('\n🔁 Cliente aprovado virando prestador (caminho do "Quero ser Profissional")...')
  await admin.from('profiles').update({ role: 'client', background_check_status: 'approved', is_blocked: false }).eq('id', userId)
  await asUser.from('profiles').update({ role: 'provider', background_check_status: 'approved' }).eq('id', userId)
  const { data: afterPromo } = await admin.from('profiles').select('role, background_check_status').eq('id', userId).single()
  results.push(record("vira prestador, mas com cadastro 'pending' (não herda o 'approved' de cliente)", afterPromo?.role === 'provider' && afterPromo?.background_check_status === 'pending'))

  console.log('\n🆕 Conta nova criando o próprio perfil já como admin aprovado...')
  const email2 = `priv-esc-test-2-${RUN_ID}@repararv-test.local`
  const { data: u2, error: create2Err } = await admin.auth.admin.createUser({ email: email2, password, email_confirm: true })
  if (create2Err) throw new Error(`Falha ao criar 2º usuário de teste: ${create2Err.message}`)
  userId2 = u2.user.id
  const asUser2 = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  await asUser2.auth.signInWithPassword({ email: email2, password })
  await asUser2.from('profiles').insert({
    id: userId2, role: 'admin', full_name: '[TESTE ESCALACAO PRIVILEGIO] conta nova', phone: '62975000001', cpf_or_cnpj: '', background_check_status: 'approved',
  })
  const { data: afterInsert } = await admin.from('profiles').select('role').eq('id', userId2).single()
  results.push(record("perfil novo nasce 'client', não 'admin'", afterInsert?.role === 'client'))

  console.log('\n🛡️  Confirmando que o painel admin (Service Role) ainda consegue bloquear/aprovar de verdade...')
  const { error: adminBlockErr } = await admin.from('profiles').update({ is_blocked: true }).eq('id', userId)
  const { error: adminApproveErr } = await admin.from('profiles').update({ background_check_status: 'approved' }).eq('id', userId)
  const { data: afterAdminWrites } = await admin
    .from('profiles')
    .select('is_blocked, background_check_status')
    .eq('id', userId)
    .single()
  results.push(
    record(
      'Service Role (painel admin) consegue escrever is_blocked/background_check_status normalmente',
      !adminBlockErr && !adminApproveErr && afterAdminWrites?.is_blocked === true && afterAdminWrites?.background_check_status === 'approved'
    )
  )

  const pass = results.every(Boolean)
  if (pass) {
    console.log('\n✅ PASSOU — campos sensíveis protegidos contra autoedição, escrita legítima intacta.')
  } else {
    console.log('\n❌ FALHOU — ver detalhes acima. O trigger protect_sensitive_profile_fields foi aplicado no Supabase?')
    process.exitCode = 1
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste:', err)
    process.exitCode = 1
  })
  .finally(cleanup)
