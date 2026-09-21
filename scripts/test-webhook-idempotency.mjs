#!/usr/bin/env node
// =============================================================================
// scripts/test-webhook-idempotency.mjs
// Teste de idempotência real do UPDATE condicional em app/api/pix/webhook.
//
// O Mercado Pago reentrega notificações de webhook (atraso de rede, timeout na
// resposta, retry automático do lado deles) — não é hipotético, é documentado
// no próprio painel deles. app/api/pix/webhook/route.ts trata isso com uma
// escrita compare-and-swap: `UPDATE service_calls SET payment_status='paid', ...
// WHERE id = X AND payment_status = 'pending'`. A 2ª entrega do mesmo
// payment_id não encontra mais nenhuma linha em 'pending' pra atualizar e vira
// um no-op, em vez de reprocessar a confirmação.
//
// Este script NÃO chama a rota HTTP (exigiria assinatura HMAC válida e uma
// resposta real da API do Mercado Pago pra um payment_id de teste, que não
// existe). Em vez disso, reproduz exatamente o mesmo UPDATE condicional da
// rota, direto contra o Postgres real, simulando duas entregas "quase
// simultâneas" da mesma notificação — é onde a garantia de atomicidade
// realmente mora (o lock de linha do Postgres), não na lógica da rota.
//
// O que confirma, contra o banco de verdade:
//   - das 2 entregas concorrentes, exatamente 1 aplica a atualização
//   - a outra recebe 0 linhas (no-op) — não é tratada como erro
//   - `completed_at` (setado antecipadamente, simulando o prestador já ter
//     concluído o serviço) NUNCA é tocado pelo webhook — nem pela 1ª entrega
//     nem pela 2ª, confirmando que o webhook não compete mais com o prestador
//     por esse campo (bug corrigido nesta sessão)
//   - uma 3ª entrega SEQUENCIAL, depois que o pagamento já está 'paid', também
//     é um no-op — cobre o caso de replay tardio (não só corrida)
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-webhook-idempotency.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-webhook-idempotency.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const FAKE_PAYMENT_ID = `test-idem-${RUN_ID}`;
const createdUserIds = [];
let createdCallId = null;
let sentinelCompletedAt = null;

function log(...args) {
  console.log(...args);
}

// Reproduz exatamente o UPDATE condicional de app/api/pix/webhook/route.ts
async function deliverWebhook(callId, paymentId) {
  const { data, error } = await admin
    .from('service_calls')
    .update({
      payment_status: 'paid',
      pix_payment_id: String(paymentId),
    })
    .eq('id', callId)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return { applied: false, errored: true, errorMessage: error.message };
  return { applied: !!data, errored: false };
}

async function createTestUser(role, index) {
  const email = `idem-test-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Idem!${RUN_ID}-${index}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role} #${index}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE IDEMPOTENCIA WEBHOOK] ${role} #${index}`,
    phone: `62998${String(index).padStart(6, '0')}`,
    cpf_or_cnpj: '',
  });
  if (profileError) {
    throw new Error(`Falha ao criar profile de teste (${role} #${index}): ${profileError.message}`);
  }

  return data.user.id;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');

  // Igual aos outros scripts de teste: service_audit_logs é append-only, e o
  // INSERT do chamado de teste já gera 1 linha lá (trigger dispara sempre em
  // INSERT). Isso bloqueia o DELETE em cascata do chamado — fica permanente,
  // claramente marcado.
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
      // client_id do chamado está referenciado em service_audit_logs — não dá pra apagar o usuário.
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
    log(`\n   ℹ O INSERT do chamado de teste já gerou um registro permanente em`);
    log(`     service_audit_logs — a tabela recusa o DELETE em cascata (append-only, por design).`);
    log(`     Ficam permanentemente no banco, marcados "[TESTE IDEMPOTENCIA WEBHOOK]":`);
    log(`       - service_calls.id       = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else if (callDeleted || !createdCallId) {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste de idempotência do webhook de pagamento (UPDATE condicional real)');
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

  log('\n👤 Criando cliente de teste...');
  const clientId = await createTestUser('client', 0);

  // Simula o chamado já "concluído pelo prestador" (status completed,
  // payment_status pending, completed_at já gravado) — exatamente o estado em
  // que app/chamado/[callId]/page.tsx deixa o chamado antes do cliente pagar.
  sentinelCompletedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min atrás
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
      client_address: '[TESTE IDEMPOTENCIA WEBHOOK] Endereço fictício — gerado por scripts/test-webhook-idempotency.mjs',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'completed',
      payment_status: 'pending',
      completed_at: sentinelCompletedAt,
    })
    .select('id')
    .single();
  if (callError || !call) {
    throw new Error(`Falha ao criar chamado de teste: ${callError?.message}`);
  }
  createdCallId = call.id;
  log(`\n📞 Chamado de teste criado: ${createdCallId}`);
  log(`   status=completed  payment_status=pending  completed_at=${sentinelCompletedAt} (simulando prestador já concluiu)`);

  // ── Rodada 1: duas entregas "quase simultâneas" do MESMO payment_id ────────
  log(`\n⚡ Disparando 2 entregas concorrentes do webhook pra payment_id=${FAKE_PAYMENT_ID}...`);
  const [d1, d2] = await Promise.all([
    deliverWebhook(createdCallId, FAKE_PAYMENT_ID),
    deliverWebhook(createdCallId, FAKE_PAYMENT_ID),
  ]);
  log(`   Entrega A: ${d1.errored ? `erro (${d1.errorMessage})` : d1.applied ? 'aplicou' : 'no-op'}`);
  log(`   Entrega B: ${d2.errored ? `erro (${d2.errorMessage})` : d2.applied ? 'aplicou' : 'no-op'}`);

  const appliedCount = [d1, d2].filter((r) => r.applied).length;
  const noopCount = [d1, d2].filter((r) => !r.applied && !r.errored).length;
  const erroredCount = [d1, d2].filter((r) => r.errored).length;

  // ── Rodada 2: 3ª entrega SEQUENCIAL depois que já está 'paid' (replay tardio) ─
  log(`\n⏱  Disparando uma 3ª entrega sequencial (replay tardio, chamado já pago)...`);
  const d3 = await deliverWebhook(createdCallId, FAKE_PAYMENT_ID);
  log(`   Entrega C: ${d3.errored ? `erro (${d3.errorMessage})` : d3.applied ? 'aplicou' : 'no-op'}`);

  // ── Verificação final no banco ──────────────────────────────────────────────
  const { data: finalCall, error: finalCallError } = await admin
    .from('service_calls')
    .select('payment_status, pix_payment_id, completed_at')
    .eq('id', createdCallId)
    .single();
  if (finalCallError) {
    log(`\n   ⚠ Não consegui reler o chamado pra conferir o estado final: ${finalCallError.message}`);
  }

  log(`\n📊 Estado final no banco:`);
  log(`   payment_status = ${finalCall?.payment_status}`);
  log(`   pix_payment_id = ${finalCall?.pix_payment_id}`);
  log(`   completed_at   = ${finalCall?.completed_at}`);

  // Compara o instante, não a string: o Postgres devolve timestamptz como
  // "...+00:00" em vez do "...Z" original — mesmo instante, formatação diferente.
  const completedAtUntouched =
    !!finalCall?.completed_at &&
    new Date(finalCall.completed_at).getTime() === new Date(sentinelCompletedAt).getTime();
  const paymentConfirmed = finalCall?.payment_status === 'paid' && finalCall?.pix_payment_id === FAKE_PAYMENT_ID;

  const pass =
    appliedCount === 1 &&
    noopCount === 1 &&
    erroredCount === 0 &&
    !d3.applied &&
    !d3.errored &&
    paymentConfirmed &&
    completedAtUntouched;

  log(`\n   Entregas concorrentes que aplicaram:  ${appliedCount} (esperado: 1)`);
  log(`   Entregas concorrentes em no-op:        ${noopCount} (esperado: 1)`);
  log(`   Entregas com erro inesperado:          ${erroredCount} (esperado: 0)`);
  log(`   Replay tardio (3ª entrega) foi no-op:  ${!d3.applied && !d3.errored ? 'sim' : 'não'} (esperado: sim)`);
  log(`   payment_status/pix_payment_id corretos: ${paymentConfirmed ? 'sim' : 'não'}`);
  log(`   completed_at não foi tocado pelo webhook: ${completedAtUntouched ? 'sim' : 'não'}`);

  if (pass) {
    log('\n✅ PASSOU — exatamente 1 entrega aplicou a confirmação, as outras 2 (concorrente + replay tardio) foram no-op, e completed_at nunca foi sobrescrito pelo webhook.');
  } else {
    log('\n❌ FALHOU — a idempotência NÃO se comportou como esperado. Ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de idempotência:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
