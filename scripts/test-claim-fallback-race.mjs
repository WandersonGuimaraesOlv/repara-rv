#!/usr/bin/env node
// =============================================================================
// scripts/test-claim-fallback-race.mjs
// Teste de concorrência real do CAMINHO DE FALLBACK de
// app/api/calls/claim-queued/route.ts — o UPDATE atômico manual usado
// quando a RPC claim_queued_call() está indisponível ou falha.
//
// scripts/test-claim-race.mjs já prova que a RPC claim_queued_call() é
// atômica. Mas a rota tem um SEGUNDO caminho, usado só quando a RPC falha
// (claimError) ou não retorna dado nenhum:
//
//   await supabase.from('service_calls')
//     .update({ provider_id, status: 'accepted', accepted_at, updated_at })
//     .eq('id', callId)
//     .eq('status', 'queued')
//     .select();
//
// Esse UPDATE nunca tinha sido testado sob concorrência de verdade — só a
// RPC. Este script exercita EXATAMENTE essa consulta (mesmos campos, mesmo
// WHERE), disparada por N "prestadores" simultâneos, SEM nunca chamar a
// RPC — simula com fidelidade o que a rota faz quando o fallback é
// acionado, sem precisar derrubar de verdade a função no banco.
//
// O que confirma, contra o Postgres real (não mock): exatamente 1 UPDATE
// aplica (linha retornada), todos os outros afetam 0 linhas (porque o
// vencedor já mudou status para 'accepted', então o WHERE status='queued'
// deixa de bater) — a mesma garantia de atomicidade da RPC, só que vinda
// do lock de linha nativo do UPDATE do Postgres em vez de uma função
// plpgsql.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local scripts/test-claim-fallback-race.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 10);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local scripts/test-claim-fallback-race.mjs');
  process.exit(1);
}

if (Number.isNaN(CONCURRENCY) || CONCURRENCY < 2) {
  console.error('❌ TEST_CONCURRENCY precisa ser um número >= 2.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const createdUserIds = [];
let createdCallId = null;
let clientUserId = null;
let winnerProviderId = null;

function log(...args) {
  console.log(...args);
}

// Reproduz exatamente o UPDATE de fallback de app/api/calls/claim-queued/route.ts
async function attemptClaimFallback(callId, providerId) {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('service_calls')
    .update({
      provider_id: providerId,
      status: 'accepted',
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', callId)
    .eq('status', 'queued')
    .select();

  return { data, error };
}

async function createTestUser(role, index) {
  const email = `fallback-race-test-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Fallback!${RUN_ID}-${index}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role} #${index}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE CORRIDA FALLBACK] ${role} #${index}`,
    phone: `62996${String(index).padStart(6, '0')}`,
    cpf_or_cnpj: '',
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile de teste (${role} #${index}): ${profileError.message}`);
  }

  return data.user.id;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');

  let callDeleted = false;
  let auditBlocked = false;
  if (createdCallId) {
    const { error } = await admin.from('service_calls').delete().eq('id', createdCallId);
    if (!error) {
      callDeleted = true;
    } else if (/imutável|immutable|service_audit_logs/i.test(error.message)) {
      auditBlocked = true;
    } else {
      console.warn(`  ⚠ Não consegui apagar o chamado de teste ${createdCallId}: ${error.message}`);
    }
  }

  const protectedIds = new Set(auditBlocked ? [winnerProviderId, clientUserId].filter(Boolean) : []);
  const leftoverIds = [];

  for (const id of createdUserIds) {
    if (protectedIds.has(id)) {
      leftoverIds.push(id);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      leftoverIds.push(id);
      console.warn(`  ⚠ Não consegui apagar o usuário de teste ${id}: ${error.message}`);
    }
  }

  if (auditBlocked) {
    log(`\n   ℹ Chamado ${createdCallId} foi aceito de verdade durante o teste, então já existe`);
    log(`     um registro permanente em service_audit_logs (append-only, por design).`);
    log(`     Ficam permanentemente no banco, marcados "[TESTE CORRIDA FALLBACK]":`);
    log(`       - service_calls.id       = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else if (callDeleted || !createdCallId) {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log(`🏁 Teste de corrida no CAMINHO DE FALLBACK de claim-queued — ${CONCURRENCY} prestadores simultâneos`);
  log(`   Via: UPDATE manual direto (mesma consulta do fallback), RPC NUNCA é chamada`);
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  const { data: service, error: serviceError } = await admin
    .from('quick_services')
    .select('id, fixed_price, platform_fee')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (serviceError || !service) {
    throw new Error(`Não encontrei nenhum serviço ativo em quick_services: ${serviceError?.message}`);
  }

  log('\n👤 Criando cliente e prestadores de teste...');
  const clientId = await createTestUser('client', 0);
  clientUserId = clientId;
  const providerIds = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    providerIds.push(await createTestUser('provider', i + 1));
  }
  log(`   Criados: 1 cliente + ${CONCURRENCY} prestadores.`);

  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const { data: call, error: callError } = await admin
    .from('service_calls')
    .insert({
      client_id: clientId,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Central',
      client_address: '[TESTE CORRIDA FALLBACK] Endereço fictício — gerado por scripts/test-claim-fallback-race.mjs',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'queued',
    })
    .select('id')
    .single();
  if (callError || !call) {
    throw new Error(`Falha ao criar chamado de teste: ${callError?.message}`);
  }
  createdCallId = call.id;
  log(`\n📞 Chamado de teste criado: ${createdCallId} (status: queued)`);

  log(`\n⚡ Disparando ${CONCURRENCY} UPDATEs de fallback simultâneos (RPC nunca é chamada)...`);
  const results = await Promise.all(
    providerIds.map(async (providerId) => {
      const startedAt = Date.now();
      const { data, error } = await attemptClaimFallback(createdCallId, providerId);
      const ms = Date.now() - startedAt;
      if (error) return { providerId, outcome: 'error', errorMessage: error.message, ms };
      const rows = Array.isArray(data) ? data : [];
      return { providerId, outcome: rows.length > 0 ? 'won' : 'lost', ms };
    })
  );

  const winners = results.filter((r) => r.outcome === 'won');
  if (winners.length > 0) winnerProviderId = winners[0].providerId;
  const losers = results.filter((r) => r.outcome === 'lost');
  const errored = results.filter((r) => r.outcome === 'error');

  log('\n📊 Resultado (ordenado por tempo de resposta):');
  results
    .slice()
    .sort((a, b) => a.ms - b.ms)
    .forEach((r) => {
      const tag = r.outcome === 'won' ? '🏆 GANHOU' : r.outcome === 'lost' ? '  perdeu' : '❗ ERRO';
      log(`   ${tag}  provider=${r.providerId}  ${r.ms}ms${r.errorMessage ? `  — ${r.errorMessage}` : ''}`);
    });

  log(`\n   Vencedores (linha retornada):            ${winners.length}`);
  log(`   Perdedores (0 linhas — já não era queued): ${losers.length}`);
  log(`   Erros inesperados:                        ${errored.length}`);
  if (errored.length > 0) {
    errored.forEach((r) => log(`     - provider=${r.providerId}: ${r.errorMessage}`));
  }

  const { data: finalCall, error: finalCallError } = await admin
    .from('service_calls')
    .select('status, provider_id')
    .eq('id', createdCallId)
    .single();
  if (finalCallError) {
    log(`\n   ⚠ Não consegui reler o chamado pra conferir o estado final: ${finalCallError.message}`);
  }

  const dbMatchesWinner =
    winners.length === 1 &&
    finalCall?.status === 'accepted' &&
    finalCall?.provider_id === winners[0]?.providerId;

  log(`\n   Estado final no banco: status=${finalCall?.status ?? '?'}  provider_id=${finalCall?.provider_id ?? '?'}`);

  const pass =
    winners.length === 1 &&
    losers.length === CONCURRENCY - 1 &&
    errored.length === 0 &&
    dbMatchesWinner;

  if (pass) {
    log('\n✅ PASSOU — o caminho de fallback (UPDATE manual) é tão atômico quanto a RPC: exatamente 1');
    log('   prestador venceu no banco, todos os outros perderam, e o banco bate com o vencedor.');
  } else {
    log('\n❌ FALHOU — o fallback NÃO foi atômico. Ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de corrida do fallback:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
