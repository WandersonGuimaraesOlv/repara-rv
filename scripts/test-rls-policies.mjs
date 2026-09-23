#!/usr/bin/env node
// =============================================================================
// scripts/test-rls-policies.mjs
// Teste real de RLS (Row Level Security) contra o Supabase de produção,
// autenticando de verdade como cliente e prestador (não a Service Role Key
// usada nos outros scripts de teste) — Camada 4, itens i2/i3/i4 do plano de
// validação. `supabase start` local não está disponível neste ambiente (sem
// Docker), então o teste roda contra o projeto real, exatamente como o
// navegador do usuário faria (chave anon + JWT de sessão).
//
// HIPÓTESE TESTADA (item i3): a policy "Prestador vê chamados 'searching' e
// os seus" em service_calls é `USING (status = 'searching' OR auth.uid() =
// provider_id)` — uma policy de LINHA, não de COLUNA. RLS do Postgres não
// tem como esconder colunas específicas de uma linha visível; só decide se
// a linha inteira é visível ou não. Isso significa que se algum código
// fizer `select('*')` (ou incluir client_address/client_location
// explicitamente) numa consulta autenticada como prestador, o endereço
// completo do cliente vaza ANTES do aceite — contrariando o mandato
// explícito do AGENTS.md ("Antes do aceite, o radar exibe apenas Bairro,
// Distância aproximada, Serviço e Valor Líquido. Endereço completo só é
// liberado após status accepted"). E é exatamente isso que
// app/painel/page.tsx faz: `.select('*, service:quick_services(*)')` numa
// chamada 'searching' já atribuída ao prestador.
//
// ITEM i4: um cliente autenticado NÃO deve conseguir ler o chamado de outro
// cliente manipulando o id na query.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-rls-policies.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-rls-policies.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const createdUserIds = [];
const createdCallIds = [];
const results = [];

function log(...args) { console.log(...args); }
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function createTestUser(role, index) {
  const email = `rls-test-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const password = `Rls!${RUN_ID}-${index}-Aa`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`Falha ao criar usuário (${role} #${index}): ${error?.message}`);
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE RLS] ${role} #${index}`,
    phone: `62995${String(index).padStart(6, '0')}`,
    cpf_or_cnpj: '',
  });
  if (profileError) throw new Error(`Falha ao criar profile (${role} #${index}): ${profileError.message}`);

  return { id: data.user.id, email, password };
}

// Retorna um client Supabase (chave anon) autenticado de verdade como o usuário
async function signInAs(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Falha ao logar como ${email}: ${error?.message}`);
  return client;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');
  let auditBlocked = false;
  for (const callId of createdCallIds) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId);
    if (error && /imutável|immutable|service_audit_logs/i.test(error.message)) auditBlocked = true;
  }
  const leftover = [];
  for (const id of createdUserIds) {
    if (auditBlocked) { leftover.push(id); continue; }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) leftover.push(id);
  }
  if (auditBlocked || leftover.length > 0) {
    log('   ℹ Alguns dados de teste ficaram permanentes (append-only de service_audit_logs), marcados "[TESTE RLS]":');
    for (const id of createdCallIds) log(`     - service_calls.id = ${id}`);
    for (const id of leftover) log(`     - profiles/auth.users.id = ${id}`);
  } else {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste de RLS contra o Supabase real (chave anon + sessão de login, não Service Role)');
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  const { data: service } = await admin
    .from('quick_services').select('id, fixed_price, platform_fee').eq('is_active', true).limit(1).single();
  if (!service) throw new Error('Nenhum serviço ativo encontrado em quick_services');

  log('\n👤 Criando usuários de teste: 2 clientes + 1 prestador...');
  const clientA = await createTestUser('client', 0);
  const clientB = await createTestUser('client', 1);
  const provider = await createTestUser('provider', 0);

  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);

  // Chamado de A, JÁ ATRIBUÍDO ao prestador de teste, em status 'searching'
  // — exatamente o estado que app/painel/page.tsx consulta antes do aceite.
  const { data: callA, error: callAError } = await admin
    .from('service_calls')
    .insert({
      client_id: clientA.id,
      provider_id: provider.id,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Central',
      client_address: '[TESTE RLS] Rua Sigilosa, 123, Casa dos Fundos',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'searching',
    })
    .select('id')
    .single();
  if (callAError || !callA) throw new Error(`Falha ao criar chamado de teste (A): ${callAError?.message}`);
  createdCallIds.push(callA.id);

  // Chamado de B, sem relação nenhuma com A nem com o prestador
  const { data: callB, error: callBError } = await admin
    .from('service_calls')
    .insert({
      client_id: clientB.id,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Oeste',
      client_address: '[TESTE RLS] Avenida Privada, 456',
      client_location: 'POINT(-50.93 -17.80)',
      status: 'searching',
    })
    .select('id')
    .single();
  if (callBError || !callB) throw new Error(`Falha ao criar chamado de teste (B): ${callBError?.message}`);
  createdCallIds.push(callB.id);

  log(`\n📞 Chamado A (cliente A, atribuído ao prestador, status=searching): ${callA.id}`);
  log(`📞 Chamado B (cliente B, sem relação com A/prestador, status=searching): ${callB.id}`);

  // ── Item i3: endereço vaza pro prestador antes do aceite? ──────────────────
  log('\n🔎 Item i3 — endereço/coordenadas vazam pro prestador ANTES do aceite?');
  const providerClient = await signInAs(provider.email, provider.password);
  const { data: providerView, error: providerViewError } = await providerClient
    .from('service_calls')
    .select('*, service:quick_services(*)')
    .eq('provider_id', provider.id)
    .eq('status', 'searching')
    .maybeSingle();

  // Achado J1 (23/09/2026): até aqui isto era só registrado como "esperado" —
  // o técnico com a oferta lia a linha inteira (endereço e coordenadas) antes
  // de aceitar, e só a tela escondia. Desde a migration
  // 20260924_provider_reads_after_accept.sql ele só lê depois do aceite; a
  // oferta vem de /api/calls/offer, sem endereço.
  const leaked = !providerViewError && providerView && typeof providerView.client_address === 'string';
  record('prestador NÃO lê o chamado (nem o endereço) antes do aceite', !leaked,
    leaked ? `vazou: ${providerView.client_address}` : (providerViewError?.message ?? '0 linhas'));

  // ── Item i4: cliente A consegue ler o chamado do cliente B? ─────────────────
  log("\n🔎 Item i4 — cliente A consegue ler o chamado do cliente B manipulando o id?");
  const clientAClient = await signInAs(clientA.email, clientA.password);
  const { data: crossRead, error: crossReadError } = await clientAClient
    .from('service_calls')
    .select('id, client_address, client_id')
    .eq('id', callB.id)
    .maybeSingle();

  if (crossReadError) {
    record('RLS bloqueou a leitura cross-cliente', true, crossReadError.message);
  } else if (!crossRead) {
    record('RLS bloqueou a leitura cross-cliente (0 linhas)', true);
  } else {
    record('cliente A NÃO deveria conseguir ler o chamado do cliente B', false, `retornou: ${JSON.stringify(crossRead)}`);
  }

  // ── Achado A5 (23/09/2026): perfil de outra pessoa (CPF, telefone, e-mail) ──
  // A política "Perfis visíveis para usuários autenticados" deixava qualquer
  // logado ler todo mundo. Migration 20260924_restrict_profile_reads*.
  log('\n🔎 A5 — um usuário logado consegue ler o perfil (CPF/telefone/e-mail) de outro?');
  const { data: otherProfile } = await clientAClient.from('profiles').select('id, cpf_or_cnpj, phone, email').eq('id', clientB.id);
  record('cliente A NÃO lê o perfil do cliente B', !otherProfile?.length, `linhas=${otherProfile?.length ?? 0}`);
  const { data: ownProfile } = await clientAClient.from('profiles').select('id').eq('id', clientA.id);
  record('cliente A lê o próprio perfil', ownProfile?.length === 1);
  const { data: providerReadsClient } = await providerClient.from('profiles').select('id, phone').eq('id', clientA.id);
  record('prestador NÃO lê o perfil do cliente do chamado', !providerReadsClient?.length, `linhas=${providerReadsClient?.length ?? 0}`);
  const { data: partyBeforeAccept } = await providerClient.rpc('call_party_profiles', { p_call_id: callA.id });
  record('antes do aceite, call_party_profiles não mostra nem o nome do cliente', !partyBeforeAccept?.length, `linhas=${partyBeforeAccept?.length ?? 0}`);

  // ── Bônus: usuário anônimo (sem login) consegue ler service_calls? ──────────
  log('\n🔎 Bônus — usuário anônimo (sem login nenhum) consegue ler service_calls?');
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: anonRead, error: anonReadError } = await anonClient
    .from('service_calls')
    .select('id, client_address')
    .eq('id', callA.id)
    .maybeSingle();

  if (anonReadError || !anonRead) {
    record('anônimo bloqueado de ler service_calls', true, anonReadError?.message);
  } else {
    record('usuário anônimo NÃO deveria conseguir ler service_calls', false, `retornou: ${JSON.stringify(anonRead)}`);
  }

  // ── Bônus: prestador consegue fazer UPDATE num chamado que não é seu? ───────
  log('\n🔎 Bônus — prestador consegue atualizar um chamado que não está atribuído a ele (chamado B)?');
  const { data: crossUpdate, error: crossUpdateError } = await providerClient
    .from('service_calls')
    .update({ status: 'accepted' })
    .eq('id', callB.id)
    .select();

  const crossUpdateApplied = !crossUpdateError && Array.isArray(crossUpdate) && crossUpdate.length > 0;
  record('prestador NÃO deveria conseguir atualizar o chamado B (não é dele)', !crossUpdateApplied,
    crossUpdateError?.message ?? (crossUpdateApplied ? `aplicou: ${JSON.stringify(crossUpdate)}` : '0 linhas afetadas'));

  // ── Resumo ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  log('\n📊 Resumo:');
  for (const r of results) log(`   ${r.pass ? '✅' : '❌'} ${r.name}`);

  if (failed.length === 0) {
    log('\n✅ PASSOU — todas as políticas de RLS testadas se comportaram como esperado.');
  } else {
    log(`\n❌ ${failed.length} verificação(ões) de RLS falharam — ver detalhes acima.`);
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de RLS:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
