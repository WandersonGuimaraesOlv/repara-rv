#!/usr/bin/env node
// =============================================================================
// scripts/load-test.mjs
// Camada 7, item i1 do plano de validação: simula N prestadores (polling +
// 1 canal Realtime cada) e M clientes com chamado ativo (polling do próprio
// acompanhamento), medindo latência e taxa de erro contra o Supabase real.
//
// POR QUE NÃO K6/ARTILLERY: a carga real deste app não bate nas rotas do
// Next.js — o navegador do prestador e do cliente fala DIRETO com o Supabase
// (chave anon + RLS), tanto pra polling REST quanto pro canal Realtime (ver
// app/painel/page.tsx e app/acompanhar/[callId]/page.tsx). Nem k6 nem
// Artillery têm suporte de primeira classe pra abrir e manter centenas de
// conexões Realtime do Supabase ao mesmo tempo que fazem polling REST — um
// script Node usando o mesmo @supabase/supabase-js do app de verdade
// reproduz esse padrão com mais fidelidade, e já é o método usado em todos
// os outros scripts de teste desta auditoria.
//
// RISCO IMPORTANTE — leia antes de aumentar os números: o repositório só
// tem UM projeto Supabase configurado (achado da Camada 3, item i6) — não
// existe staging separado. Rodar isto com N/M altos gera carga real contra
// o banco de PRODUÇÃO, usado por clientes e prestadores reais agora. Os
// defaults abaixo são deliberadamente pequenos (smoke test, prova que o
// script funciona) — só suba LOAD_PROVIDERS/LOAD_CLIENTS depois de decidir,
// com o dono do projeto, que vale o risco de rodar contra produção (ou
// depois de existir um projeto Supabase separado pra isso).
//
// /api/calls/create tem rate limit de 5 req/10min por IP (proxy.ts) — os
// chamados dos clientes de teste são inseridos direto via Service Role
// (como os outros scripts desta auditoria), não via HTTP, porque o alvo
// aqui é medir a CARGA DE LEITURA (polling/Realtime) sob concorrência
// sustentada, não testar o rate limiter da rota de criação (já coberto
// por proxy.ts em si).
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/load-test.mjs
//   (LOAD_PROVIDERS, LOAD_CLIENTS, LOAD_DURATION_SECONDS configuráveis)
// =============================================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const N_PROVIDERS = Number(process.env.LOAD_PROVIDERS || 5)
const M_CLIENTS = Number(process.env.LOAD_CLIENTS || 3)
const DURATION_SECONDS = Number(process.env.LOAD_DURATION_SECONDS || 30)
const PROVIDER_POLL_MS = 3000 // mesmo intervalo de checkActiveCalls
const CLIENT_POLL_MS = 3000 // mesma ordem de grandeza do acompanhamento

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const RUN_ID = Date.now().toString(36)

const createdUserIds = []
const createdCallIds = []

const metrics = {
  providerPollLatenciesMs: [],
  providerPollErrors: 0,
  clientPollLatenciesMs: [],
  clientPollErrors: 0,
  realtimeConnected: 0,
  realtimeFailed: 0,
}

function percentile(arr, p) {
  if (arr.length === 0) return NaN
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function createTestProvider(index) {
  const email = `load-test-${RUN_ID}-provider-${index}@repararv-test.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: `Load!${RUN_ID}-Aa`, email_confirm: true })
  if (error || !data.user) throw new Error(`Falha ao criar prestador de teste #${index}: ${error?.message}`)
  createdUserIds.push(data.user.id)

  await admin.from('profiles').insert({
    id: data.user.id,
    role: 'provider',
    full_name: `[TESTE CARGA] provider #${index}`,
    phone: `6297${String(index).padStart(7, '0')}`,
    cpf_or_cnpj: '',
  })
  await admin.from('provider_status').insert({
    provider_id: data.user.id,
    is_online: true,
    pix_key: `6297${String(index).padStart(7, '0')}`,
    pix_key_type: 'phone',
    recipient_gateway_id: `[TESTE CARGA] gw-${RUN_ID}-${index}`,
    current_location: `POINT(${-50.9264 + index * 0.001} ${-17.7943 + index * 0.001})`,
  })

  return data.user
}

async function createTestClientWithActiveCall(index, serviceId) {
  const email = `load-test-${RUN_ID}-client-${index}@repararv-test.local`
  const { data, error } = await admin.auth.admin.createUser({ email, password: `Load!${RUN_ID}-Aa`, email_confirm: true })
  if (error || !data.user) throw new Error(`Falha ao criar cliente de teste #${index}: ${error?.message}`)
  createdUserIds.push(data.user.id)

  await admin.from('profiles').insert({
    id: data.user.id,
    role: 'client',
    full_name: `[TESTE CARGA] client #${index}`,
    phone: `6296${String(index).padStart(7, '0')}`,
    cpf_or_cnpj: '',
  })

  const { data: service } = await admin.from('quick_services').select('fixed_price, platform_fee').eq('id', serviceId).single()
  const { data: call, error: callError } = await admin
    .from('service_calls')
    .insert({
      client_id: data.user.id,
      service_id: serviceId,
      total_price: service.fixed_price,
      platform_fee: service.platform_fee,
      provider_cut: service.fixed_price - service.platform_fee,
      neighborhood: 'Setor Central',
      client_address: `[TESTE CARGA] Rua ${index}, chamado de carga`,
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'searching', // já com chamado ativo, como o item pede — não passa pela criação via HTTP
    })
    .select('id')
    .single()
  if (callError) throw new Error(`Falha ao criar chamado ativo do cliente #${index}: ${callError.message}`)
  createdCallIds.push(call.id)

  return { user: data.user, callId: call.id }
}

// Reproduz exatamente o polling de checkActiveCalls (app/painel/page.tsx)
function startProviderPolling(providerClient, providerId, signal) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (signal.aborted) { clearInterval(timer); resolve(); return }
      const startedAt = Date.now()
      const { error } = await providerClient
        .from('service_calls')
        .select('id, status, service:quick_services(*)')
        .eq('provider_id', providerId)
        .eq('status', 'searching')
        .order('created_at', { ascending: false })
        .limit(1)
      metrics.providerPollLatenciesMs.push(Date.now() - startedAt)
      if (error) metrics.providerPollErrors++
    }, PROVIDER_POLL_MS)
    signal.addEventListener('abort', () => { clearInterval(timer); resolve() })
  })
}

// Reproduz o canal Realtime de app/painel/page.tsx (alerta de chamado pendente)
function openProviderRealtimeChannel(providerClient, providerId) {
  return new Promise((resolve) => {
    const channel = providerClient
      .channel(`load-test-provider-calls-${providerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_calls', filter: `provider_id=eq.${providerId}` }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { metrics.realtimeConnected++; resolve(channel) }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { metrics.realtimeFailed++; resolve(channel) }
      })
  })
}

// Reproduz o polling de acompanhamento do cliente (app/acompanhar/[callId])
function startClientPolling(clientSupabase, callId, signal) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      if (signal.aborted) { clearInterval(timer); resolve(); return }
      const startedAt = Date.now()
      const { error } = await clientSupabase.from('service_calls').select('status').eq('id', callId).single()
      metrics.clientPollLatenciesMs.push(Date.now() - startedAt)
      if (error) metrics.clientPollErrors++
    }, CLIENT_POLL_MS)
    signal.addEventListener('abort', () => { clearInterval(timer); resolve() })
  })
}

async function cleanup() {
  console.log('\n🧹 Limpando dados de teste...')
  let auditBlocked = false
  for (const callId of createdCallIds) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId)
    if (error) auditBlocked = true
  }
  if (!auditBlocked) {
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id).catch(() => {})
    console.log('   Limpeza concluída — nenhum dado de teste ficou para trás.')
  } else {
    console.log(`   ℹ ${createdCallIds.length} chamado(s) de teste ficaram permanentes (service_audit_logs append-only), marcados "[TESTE CARGA]".`)
    console.log('   Lembre de rodar npm run monitor:synthetic (ou uma verificação manual) pra confirmar que nenhum desses prestadores ficou is_online=true pra sempre.')
  }
}

async function run() {
  console.log('🏁 Teste de carga — polling + Realtime sob concorrência sustentada')
  console.log(`   Projeto Supabase: ${SUPABASE_URL}`)
  console.log(`   Prestadores simulados: ${N_PROVIDERS}   Clientes simulados: ${M_CLIENTS}   Duração: ${DURATION_SECONDS}s`)
  if (N_PROVIDERS > 15 || M_CLIENTS > 15) {
    console.log('\n⚠️  N/M altos e SEM staging separado — isto gera carga real contra o banco de PRODUÇÃO.')
  }

  const { data: service } = await admin.from('quick_services').select('id').eq('is_active', true).limit(1).single()

  console.log('\n👤 Criando prestadores e clientes de teste...')
  const providers = []
  for (let i = 0; i < N_PROVIDERS; i++) providers.push(await createTestProvider(i))

  const clients = []
  for (let i = 0; i < M_CLIENTS; i++) clients.push(await createTestClientWithActiveCall(i, service.id))

  console.log(`   ${providers.length} prestadores online, ${clients.length} clientes com chamado ativo (status=searching).`)

  const controller = new AbortController()
  const tasks = []

  console.log('\n⚡ Iniciando polling + canais Realtime...')
  for (const provider of providers) {
    const providerClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    await providerClient.auth.signInWithPassword({ email: provider.email, password: `Load!${RUN_ID}-Aa` })
    const channel = await openProviderRealtimeChannel(providerClient, provider.id)
    tasks.push(startProviderPolling(providerClient, provider.id, controller.signal))
    tasks.push(Promise.resolve().then(async () => {
      controller.signal.addEventListener('abort', () => providerClient.removeChannel(channel))
    }))
  }

  for (const { user, callId } of clients) {
    const clientSupabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    await clientSupabase.auth.signInWithPassword({ email: user.email, password: `Load!${RUN_ID}-Aa` })
    tasks.push(startClientPolling(clientSupabase, callId, controller.signal))
  }

  console.log(`   Rodando por ${DURATION_SECONDS}s...`)
  await new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000))
  controller.abort()
  await Promise.all(tasks)

  console.log('\n📊 Resultado:')
  console.log(`   Canais Realtime conectados: ${metrics.realtimeConnected}/${N_PROVIDERS}  (falharam: ${metrics.realtimeFailed})`)
  console.log(`   Polling do prestador — amostras: ${metrics.providerPollLatenciesMs.length}, erros: ${metrics.providerPollErrors}`)
  console.log(`     p50=${percentile(metrics.providerPollLatenciesMs, 50)}ms  p95=${percentile(metrics.providerPollLatenciesMs, 95)}ms  p99=${percentile(metrics.providerPollLatenciesMs, 99)}ms`)
  console.log(`   Polling do cliente — amostras: ${metrics.clientPollLatenciesMs.length}, erros: ${metrics.clientPollErrors}`)
  console.log(`     p50=${percentile(metrics.clientPollLatenciesMs, 50)}ms  p95=${percentile(metrics.clientPollLatenciesMs, 95)}ms  p99=${percentile(metrics.clientPollLatenciesMs, 99)}ms`)

  const totalErrors = metrics.providerPollErrors + metrics.clientPollErrors + metrics.realtimeFailed
  if (totalErrors === 0) {
    console.log('\n✅ PASSOU — nenhum erro sob esta carga. Suba LOAD_PROVIDERS/LOAD_CLIENTS gradualmente pra achar o teto real.')
  } else {
    console.log(`\n⚠️  ${totalErrors} erro(s) sob esta carga — ver números acima antes de aumentar N/M.`)
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de carga:', err)
    process.exitCode = 1
  })
  .finally(cleanup)
