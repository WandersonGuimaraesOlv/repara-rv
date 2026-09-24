#!/usr/bin/env node
// =============================================================================
// scripts/test-skip-provider-race.mjs
// Teste de concorrência real da rota POST /api/calls/skip-provider.
//
// Diferente de claim_queued_call (uma função Postgres só, atômica por
// natureza), a garantia aqui vive na ROTA (app/api/calls/skip-provider/
// route.ts): um loop de retry com CAS (compare-and-swap) via updated_at.
// Por isso este teste NÃO chama RPC direto — ele precisa passar pela rota de
// verdade, senão estaríamos testando uma reimplementação nossa da lógica, não
// o código que está em produção.
//
// PRÉ-REQUISITO (diferente do teste de claim_queued_call!):
//   Precisa do servidor local rodando ANTES, em outro terminal:
//     npm run dev
//   E então, neste terminal:
//     node --env-file=.env.local --env-file=.dev.vars scripts/test-skip-provider-race.mjs
//   (skip-provider NÃO tem rate limit em proxy.ts — só /api/calls/create,
//   /api/calls/claim-queued e /api/auth* têm — então, ao contrário do teste
//   de claim_queued_call, aqui dá pra bater na rota HTTP local de verdade sem
//   cair no problema de resolução de IP do `next dev` documentado no outro
//   script.)
//
// ⚠️ CUIDADOS DE SEGURANÇA (leia antes de rodar — banco de produção, sem
// staging separado):
//   1. find_nearest_provider() busca em provider_status SEM nenhum limite de
//      raio (só ORDER BY distância + LIMIT 1) — se não tomarmos cuidado, a
//      rota pode escolher um prestador REAL online como "próximo prestador"
//      pro nosso chamado de teste. Por isso este script primeiro lê quem
//      está online de verdade e pré-popula cancel_metadata.rejected_providers
//      do chamado de teste com esses IDs, excluindo-os desde a primeira
//      leitura. (Ainda existe uma janela mínima de corrida real: um
//      prestador pode ficar online bem no meio do teste. O script confere no
//      final se o prestador atribuído é mesmo um dos nossos de teste e avisa
//      em CAIXA ALTA se não for.)
//   2. O branch "sem próximo prestador" de skip-provider dispara (fire-and-
//      forget) o push da fila (pushCallAlert) — que manda uma notificação PUSH
//      de verdade pra todo prestador real aprovado que tenha ativado as
//      notificações no painel (/painel → "Ativar notificações").
//      Isso seria um incidente real (spam de "cliente aguardando" pra
//      prestadores de verdade sobre um chamado falso). Por isso este script
//      cria prestadores de teste ONLINE o suficiente (concorrência + margem)
//      pra garantir que sempre exista candidato disponível e a rota NUNCA
//      caia nesse branch. Se mesmo assim cair (log claramente sinalizado),
//      o script aborta o resto das checagens e avisa pra conferir na mão.
//
// O que o teste prova: dispara N chamadas HTTP concorrentes de
// skip-provider pro MESMO chamado, cada uma "rejeitando" um prestador
// sintético diferente (rejected_provider_id só entra em cancel_metadata,
// não precisa ser um prestador real). Se a trava otimista funcionar, o
// cancel_metadata.rejected_providers final tem que conter TODOS os IDs das
// tentativas que retornaram sucesso — nenhuma escrita pode ter sido
// silenciosamente sobrescrita por outra (o bug original, antes do CAS).
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = Number(process.env.TEST_CONCURRENCY || 6);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-skip-provider-race.mjs');
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
const testProviderIds = [];
let createdCallId = null;
let clientUserId = null;

function log(...args) {
  console.log(...args);
}

async function pingServer() {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function createTestUser(role, index) {
  const email = `skip-race-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `SkipRace!${RUN_ID}-${index}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role} #${index}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE CORRIDA SKIP] ${role} #${index}`,
    phone: `62988${String(index).padStart(6, '0')}`,
    cpf_or_cnpj: '',
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile de teste (${role} #${index}): ${profileError.message}`);
  }

  if (role === 'provider') {
    // is_online:true + recipient_gateway_id preenchido + current_location válido:
    // os 3 requisitos que find_nearest_provider exige pra considerar o prestador
    // candidato. Coordenadas próximas às usadas no teste de claim_queued_call.
    const jitter = (index % 20) * 0.0005;
    const { error: statusError } = await admin.from('provider_status').insert({
      provider_id: data.user.id,
      is_online: true,
      pix_key: `62988${String(index).padStart(6, '0')}`,
      pix_key_type: 'phone',
      recipient_gateway_id: `[TESTE CORRIDA SKIP] gw-${RUN_ID}-${index}`,
      current_location: `POINT(${-50.9264 + jitter} ${-17.7943 + jitter})`,
    });
    if (statusError) {
      throw new Error(`Falha ao criar provider_status de teste (#${index}): ${statusError.message}`);
    }
    testProviderIds.push(data.user.id);
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

  const leftoverIds = [];
  for (const id of createdUserIds) {
    if (auditBlocked) {
      // Mesmo padrão do teste de claim_queued_call: se o log de auditoria bloqueou
      // o DELETE em cascata do chamado, os usuários vinculados a ele também ficam.
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
    log(`\n   ℹ O chamado ${createdCallId} sofreu updates de status reais durante o teste e`);
    log(`     service_audit_logs (append-only) bloqueou o DELETE em cascata. Ficam`);
    log(`     permanentes no banco, todos marcados "[TESTE CORRIDA SKIP]":`);
    log(`       - service_calls.id       = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else if (callDeleted || !createdCallId) {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log(`🏁 Teste de corrida em POST /api/calls/skip-provider — ${CONCURRENCY} chamadas HTTP simultâneas`);
  log(`   Via: HTTP real contra ${BASE_URL} (a garantia está na rota, não só no banco)`);
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  log('\n🌐 Conferindo se o servidor local está no ar...');
  const up = await pingServer();
  if (!up) {
    throw new Error(
      `Não consegui alcançar ${BASE_URL}. Rode "npm run dev" num terminal separado antes de rodar este script.`
    );
  }
  log('   Servidor respondeu.');

  // 0. Segurança: lista prestadores REAIS online agora, pra excluir desde já
  const { data: realOnline, error: realOnlineError } = await admin
    .from('provider_status')
    .select('provider_id')
    .eq('is_online', true);
  if (realOnlineError) {
    throw new Error(`Falha ao checar prestadores reais online: ${realOnlineError.message}`);
  }
  const realOnlineIds = (realOnline || []).map((r) => r.provider_id);
  log(`\n🛡️  Prestadores reais online agora (serão excluídos desde a criação do chamado): ${realOnlineIds.length}`);

  // 1. Serviço ativo qualquer do catálogo
  const { data: service, error: serviceError } = await admin
    .from('quick_services')
    .select('id, fixed_price, platform_fee')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (serviceError || !service) {
    throw new Error(`Não encontrei nenhum serviço ativo em quick_services: ${serviceError?.message}`);
  }

  // 2. Cliente + prestadores de teste ONLINE o suficiente. Precisa de folga:
  // a cada rejeição bem-sucedida, o prestador "atual" muda e passa a ser
  // excluído das próximas buscas, então precisamos de mais candidatos do que
  // CONCURRENCY pra nunca esgotar (o que faria a rota cair no branch perigoso
  // de "fila" — ver aviso no topo do arquivo).
  log('\n👤 Criando cliente e prestadores de teste (todos online, com gateway e localização)...');
  const clientId = await createTestUser('client', 0);
  clientUserId = clientId;

  const TOTAL_TEST_PROVIDERS = CONCURRENCY + 5;
  for (let i = 0; i < TOTAL_TEST_PROVIDERS; i++) {
    await createTestUser('provider', i + 1);
  }
  const testProviderIdSet = new Set(testProviderIds);
  const initialProvider = testProviderIds[0];
  log(`   Criados: 1 cliente + ${TOTAL_TEST_PROVIDERS} prestadores de teste (1 já "atual" no chamado, ${TOTAL_TEST_PROVIDERS - 1} de reserva).`);

  // 3. Chamado já aceito por um prestador de teste, pronto pra ser reencaminhado
  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const { data: call, error: callError } = await admin
    .from('service_calls')
    .insert({
      client_id: clientId,
      provider_id: initialProvider,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Central',
      client_address: '[TESTE CORRIDA SKIP] Endereço fictício — gerado por scripts/test-skip-provider-race.mjs',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'accepted',
      cancel_metadata: { rejected_providers: realOnlineIds },
    })
    .select('id')
    .single();
  if (callError || !call) {
    throw new Error(`Falha ao criar chamado de teste: ${callError?.message}`);
  }
  createdCallId = call.id;
  log(`\n📞 Chamado de teste criado: ${createdCallId} (status: accepted, provider atual: ${initialProvider})`);

  // 4. Disparo simultâneo — N chamadas HTTP reais pra mesma rota, cada uma
  // "rejeitando" um prestador sintético diferente (não precisa existir de
  // verdade — só entra em cancel_metadata.rejected_providers).
  log(`\n⚡ Disparando ${CONCURRENCY} requisições HTTP simultâneas para POST /api/calls/skip-provider...`);
  const rejectedIds = Array.from({ length: CONCURRENCY }, () => crypto.randomUUID());
  const results = await Promise.all(
    rejectedIds.map(async (rejectedId) => {
      const startedAt = Date.now();
      try {
        const res = await fetch(`${BASE_URL}/api/calls/skip-provider`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: createdCallId, rejected_provider_id: rejectedId }),
        });
        const ms = Date.now() - startedAt;
        let body = null;
        try { body = await res.json(); } catch { /* corpo vazio ou não-JSON */ }
        return { rejectedId, httpStatus: res.status, body, ms };
      } catch (err) {
        return { rejectedId, httpStatus: null, body: null, ms: Date.now() - startedAt, networkError: err?.message };
      }
    })
  );

  // 5. Verificação — primeiro o alarme de segurança mais importante
  const queuedResponses = results.filter((r) => r.body?.status === 'queued');
  if (queuedResponses.length > 0) {
    log('\n🚨🚨🚨 ALERTA CRÍTICO: uma ou mais chamadas caíram no branch "sem prestador disponível" 🚨🚨🚨');
    log('   Isso significa que o push da fila foi disparado de verdade para');
    log('   este chamado de teste — prestadores REAIS aprovados que tenham ativado as');
    log('   notificações push podem ter recebido um aviso falso agora. Confira o log');
    log('   do servidor (`npm run dev`) e,');
    log('   se necessário, avise a equipe.');
  }

  const successes = results.filter((r) => r.httpStatus === 200 && r.body?.status === 'searching');
  const conflicts = results.filter((r) => r.httpStatus === 409);
  const unexpected = results.filter(
    (r) => r.httpStatus !== 200 && r.httpStatus !== 409 && !(r.body?.status === 'queued')
  );

  log('\n📊 Resultado (ordenado por tempo de resposta):');
  results
    .slice()
    .sort((a, b) => a.ms - b.ms)
    .forEach((r) => {
      const tag =
        r.httpStatus === 200 && r.body?.status === 'searching' ? '✅ sucesso' :
        r.httpStatus === 409 ? '  conflito (409, tentativas esgotadas)' :
        r.body?.status === 'queued' ? '🚨 QUEUED' :
        '❗ inesperado';
      log(`   ${tag}  rejected=${r.rejectedId.slice(0, 8)}  http=${r.httpStatus ?? 'ERR'}  ${r.ms}ms${r.networkError ? `  — ${r.networkError}` : ''}`);
    });

  log(`\n   Sucessos (200, reencaminhado):                ${successes.length}`);
  log(`   Conflitos (409, 3 tentativas de CAS esgotadas): ${conflicts.length}  (esperado ocorrer às vezes sob concorrência alta — não é bug por si só)`);
  log(`   Caiu no branch "fila" (queued):                 ${queuedResponses.length}`);
  log(`   Respostas inesperadas:                          ${unexpected.length}`);
  if (unexpected.length > 0) {
    unexpected.forEach((r) => log(`     - rejected=${r.rejectedId}: http=${r.httpStatus} body=${JSON.stringify(r.body)}`));
  }

  // 6. Confirma o estado final no banco: nenhuma contribuição de escrita bem-sucedida
  // pode ter sido perdida, e o prestador atribuído precisa ser um dos nossos de teste
  const { data: finalCall, error: finalCallError } = await admin
    .from('service_calls')
    .select('status, provider_id, cancel_metadata, updated_at')
    .eq('id', createdCallId)
    .single();
  if (finalCallError) {
    log(`\n   ⚠ Não consegui reler o chamado pra conferir o estado final: ${finalCallError.message}`);
  }

  const finalRejected = new Set((finalCall?.cancel_metadata?.rejected_providers) || []);
  const missingContributions = successes.filter((s) => !finalRejected.has(s.rejectedId));

  const finalProviderId = finalCall?.provider_id ?? null;
  const foreignProvider =
    finalCall?.status === 'searching' &&
    finalProviderId &&
    !testProviderIdSet.has(finalProviderId);

  log(`\n   Estado final no banco: status=${finalCall?.status ?? '?'}  provider_id=${finalProviderId ?? '?'}`);
  log(`   rejected_providers final tem ${finalRejected.size} entrada(s)`);
  if (missingContributions.length > 0) {
    log(`\n   ❌ PERDA DE ESCRITA DETECTADA: ${missingContributions.length} tentativa(s) que retornaram sucesso`);
    log('      não aparecem no cancel_metadata.rejected_providers final — exatamente o bug que o CAS deveria evitar:');
    missingContributions.forEach((m) => log(`        - rejected=${m.rejectedId}`));
  }
  if (foreignProvider) {
    log(`\n   🚨 ALERTA: provider_id final (${finalProviderId}) NÃO é um dos prestadores de teste criados por este`);
    log('      script — pode ser um prestador REAL. Confira manualmente o painel desse prestador.');
  }

  const pass =
    queuedResponses.length === 0 &&
    unexpected.length === 0 &&
    missingContributions.length === 0 &&
    !foreignProvider &&
    finalCall?.status === 'searching';

  if (pass) {
    log('\n✅ PASSOU — nenhuma escrita bem-sucedida foi perdida, e o prestador final atribuído é um dos de teste.');
    if (conflicts.length > 0) {
      log(`   (${conflicts.length} requisição(ões) recebeu 409 por esgotar as 3 tentativas de CAS sob concorrência —`);
      log('    isso é o comportamento correto e documentado da rota sob alta contenção, não uma falha.)');
    }
  } else {
    log('\n❌ FALHOU — ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de corrida:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
