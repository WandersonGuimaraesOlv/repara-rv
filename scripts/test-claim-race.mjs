#!/usr/bin/env node
// =============================================================================
// scripts/test-claim-race.mjs
// Teste de concorrência real da função Postgres claim_queued_call().
//
// Dispara N chamadas RPC simultâneas de N prestadores de teste diferentes,
// todos tentando aceitar o MESMO chamado na fila ao mesmo tempo. O objetivo é
// confirmar, contra o banco de verdade (não um mock), que:
//   - exatamente 1 prestador recebe uma linha de volta (venceu)
//   - todos os outros recebem 0 linhas (perderam — chamado já não era 'queued')
//   - o chamado no banco fica com o provider_id do único vencedor
//
// Isso valida a atomicidade real do UPDATE condicional em claim_queued_call()
// (supabase/schema.sql) — algo que um teste unitário com mock NÃO consegue
// provar, porque a garantia vem do lock de linha do Postgres, não da lógica
// da aplicação.
//
// POR QUE VIA RPC DIRETO E NÃO VIA POST /api/calls/claim-queued:
// A rota HTTP é só uma casca fina em volta desse mesmo RPC — a garantia de
// atomicidade que queremos provar está inteira no banco, não na rota. Na
// prática, testar via HTTP local não dá pra fazer de forma confiável: o
// `proxy.ts` aplica rate limit de 1 req/s por IP nessa rota (anti-bot, achado
// real ao tentar isso pela primeira vez), e o `next dev` local SEMPRE resolve
// o IP de origem como o socket real (`::1`), ignorando qualquer
// X-Forwarded-For que o cliente mande — então N requisições HTTP concorrentes
// vindas do mesmo processo Node sempre parecem vir do mesmo IP, e o rate
// limiter bloqueia 9 de 10 antes de chegarem perto do banco. Isso é o rate
// limiter funcionando corretamente (também documentado/testado), só não dá
// pra testar A ATOMICIDADE DO BANCO por cima dele a partir de uma máquina só.
// Testar o full round-trip HTTP com IPs de verdade só faz sentido contra um
// ambiente já implantado (staging/preview), não em dev local.
//
// PRÉ-REQUISITO:
//   Rodar este script com as variáveis de ambiente carregadas:
//     node --env-file=.env.local --env-file=.dev.vars scripts/test-claim-race.mjs
//   (Precisa de Node 20.6+ para o --env-file. `node -v` pra conferir. Não
//   precisa do `npm run dev` rodando — este teste não passa pela rota HTTP.)
//
// O script cria e apaga os PRÓPRIOS dados de teste (1 cliente + N prestadores
// fake + 1 chamado), usando a Service Role Key — nunca toca em usuário real.
// Roda contra o projeto Supabase apontado em NEXT_PUBLIC_SUPABASE_URL — hoje o
// repositório só tem esse único projeto configurado (não existe staging/dev
// separado), então isso RODA CONTRA O MESMO BANCO USADO EM PRODUÇÃO.
//
// `service_audit_logs` é append-only: se a corrida tiver um vencedor de
// verdade, o chamado de teste (e o cliente/prestador ligados a ele) NÃO
// podem mais ser apagados — ficam permanentes no banco, claramente marcados
// "[TESTE CORRIDA]". O script avisa exatamente quais IDs ficaram.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 10);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-claim-race.mjs');
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

async function createTestUser(role, index) {
  const email = `race-test-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Race!${RUN_ID}-${index}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role} #${index}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE CORRIDA] ${role} #${index}`,
    phone: `62999${String(index).padStart(6, '0')}`,
    cpf_or_cnpj: '',
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile de teste (${role} #${index}): ${profileError.message}`);
  }

  if (role === 'provider') {
    const { error: statusError } = await admin.from('provider_status').insert({
      provider_id: data.user.id,
      is_online: false,
      pix_key: `62999${String(index).padStart(6, '0')}`,
      pix_key_type: 'phone',
    });
    if (statusError) {
      throw new Error(`Falha ao criar provider_status de teste (#${index}): ${statusError.message}`);
    }
  }

  return data.user.id;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');

  // service_audit_logs é append-only (achado real ao rodar este script pela 1ª vez):
  // qualquer chamado que chegou a ser aceito (status queued -> accepted) já foi
  // gravado lá por trigger, e um trigger de imutabilidade na própria tabela recusa
  // o DELETE em cascata. Ou seja: se a corrida teve um vencedor de verdade, o
  // chamado de teste — e o cliente/prestador vinculados a ele — ficam permanentes
  // no banco. São dados claramente marcados "[TESTE CORRIDA]", inofensivos, mas
  // não têm como ser apagados por aqui (nem pela Service Role Key). Só tentamos
  // apagar o resto (chamado nunca aceito, e os prestadores que perderam a corrida
  // e nunca chegaram a ser referenciados por nenhum log de auditoria).
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
    // profiles e provider_status cascateiam via ON DELETE CASCADE a partir de auth.users
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      leftoverIds.push(id);
      console.warn(`  ⚠ Não consegui apagar o usuário de teste ${id}: ${error.message}`);
    }
  }

  if (auditBlocked) {
    log(`\n   ℹ Chamado ${createdCallId} foi aceito de verdade durante o teste, então já existe`);
    log(`     um registro permanente em service_audit_logs referenciando ele — a própria`);
    log(`     tabela de auditoria recusa o DELETE em cascata (é append-only, por design).`);
    log(`     Ficam permanentemente no banco, todos marcados "[TESTE CORRIDA]":`);
    log(`       - service_calls.id       = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else if (callDeleted || !createdCallId) {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log(`🏁 Teste de corrida em claim_queued_call — ${CONCURRENCY} prestadores simultâneos`);
  log(`   Via: RPC direta (admin.rpc), não HTTP — ver comentário no topo do arquivo`);
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  // 1. Serviço ativo qualquer do catálogo, pra ter um service_id válido
  const { data: service, error: serviceError } = await admin
    .from('quick_services')
    .select('id, fixed_price, platform_fee')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (serviceError || !service) {
    throw new Error(`Não encontrei nenhum serviço ativo em quick_services: ${serviceError?.message}`);
  }

  // 2. Cliente + N prestadores de teste
  log('\n👤 Criando cliente e prestadores de teste...');
  const clientId = await createTestUser('client', 0);
  clientUserId = clientId;
  const providerIds = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    providerIds.push(await createTestUser('provider', i + 1));
  }
  log(`   Criados: 1 cliente + ${CONCURRENCY} prestadores.`);

  // 3. Chamado já na fila (status = 'queued', sem prestador ainda)
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
      client_address: '[TESTE CORRIDA] Endereço fictício — gerado por scripts/test-claim-race.mjs',
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

  // 4. Disparo simultâneo — todo mundo tenta aceitar o MESMO chamado ao mesmo tempo,
  // chamando a função Postgres diretamente via RPC (mesma credencial de Service
  // Role que a rota HTTP usa internamente — é o mesmo caminho até o banco,
  // só sem a casca da rota Next.js e do rate limiter por IP).
  log(`\n⚡ Disparando ${CONCURRENCY} chamadas RPC simultâneas para claim_queued_call()...`);
  const results = await Promise.all(
    providerIds.map(async (providerId) => {
      const startedAt = Date.now();
      const { data, error } = await admin.rpc('claim_queued_call', {
        p_call_id: createdCallId,
        p_provider_id: providerId,
      });
      const ms = Date.now() - startedAt;
      if (error) return { providerId, outcome: 'error', errorMessage: error.message, ms };
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return { providerId, outcome: rows.length > 0 ? 'won' : 'lost', ms };
    })
  );

  // 5. Verificação
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

  log(`\n   Vencedores (linha retornada):           ${winners.length}`);
  log(`   Perdedores (0 linhas — já não era queued): ${losers.length}`);
  log(`   Erros inesperados:                       ${errored.length}`);
  if (errored.length > 0) {
    errored.forEach((r) => log(`     - provider=${r.providerId}: ${r.errorMessage}`));
  }

  // 6. Confirma que o estado gravado no banco bate com o vencedor da corrida
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
    log('\n✅ PASSOU — exatamente 1 prestador venceu a corrida no banco, todos os outros perderam, e o banco bate com o vencedor.');
  } else {
    log('\n❌ FALHOU — a corrida NÃO foi atômica. Ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de corrida:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
