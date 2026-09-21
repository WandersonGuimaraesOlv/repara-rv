#!/usr/bin/env node
// =============================================================================
// scripts/test-no-show-fee.mjs
// Teste empírico, contra o banco Supabase real, da taxa de deslocamento
// (no-show) de R$25 — ver supabase/migrations/20260917_no_show_fee.sql,
// lib/cancel-authorization.ts (shouldChargeNoShowFee), app/api/calls/cancel,
// app/api/pix/create e app/api/pix/webhook.
//
// Não chama as rotas HTTP diretamente (exigiria um payment_id real aprovado
// pelo Mercado Pago e, no caso do webhook, uma assinatura HMAC válida) — em
// vez disso reproduz exatamente os mesmos UPDATEs condicionais que cada rota
// faz, direto contra o Postgres real, e confirma o fluxo completo:
//
//   1. Prestador cancela um chamado aceito com motivo 'provider_absent'
//      → mesma escrita de app/api/calls/cancel/route.ts:
//        status='cancelled', cancel_reason='provider_absent',
//        no_show_fee_status='pending'
//   2. Geração da cobrança Pix da taxa → mesma escrita de
//      app/api/pix/create/route.ts (branch no_show_fee_status==='pending'):
//        no_show_fee_payment_id/pix_qr_code/pix_copy_paste
//   3. Webhook confirma o pagamento → mesmo UPDATE condicional (CAS) de
//      app/api/pix/webhook/route.ts (matchType==='no_show_fee'):
//        UPDATE ... SET no_show_fee_status='paid' WHERE no_show_fee_status='pending'
//      — testado com 2 entregas concorrentes (idempotência) igual a
//      scripts/test-webhook-idempotency.mjs.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-no-show-fee.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-no-show-fee.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const FAKE_PAYMENT_ID = `test-noshow-${RUN_ID}`;
const createdUserIds = [];
let createdCallId = null;

function log(...args) {
  console.log(...args);
}

// Reproduz exatamente o UPDATE condicional do branch no_show_fee de
// app/api/pix/webhook/route.ts
async function deliverWebhook(callId, paymentId) {
  const { data, error } = await admin
    .from('service_calls')
    .update({
      no_show_fee_status: 'paid',
      no_show_fee_payment_id: String(paymentId),
    })
    .eq('id', callId)
    .eq('no_show_fee_status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return { applied: false, errored: true, errorMessage: error.message };
  return { applied: !!data, errored: false };
}

async function createTestUser(role, index) {
  const email = `noshow-test-${RUN_ID}-${role}-${index}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `NoShow!${RUN_ID}-${index}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role} #${index}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE TAXA NO-SHOW] ${role} #${index}`,
    phone: `62997${String(index).padStart(6, '0')}`,
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

  const leftoverIds = [];
  for (const id of createdUserIds) {
    if (auditBlocked) {
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
    log(`     Ficam permanentemente no banco, marcados "[TESTE TAXA NO-SHOW]":`);
    log(`       - service_calls.id       = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else if (callDeleted || !createdCallId) {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste da taxa de deslocamento (no-show, R$25) — fluxo completo contra o banco real');
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

  log('\n👤 Criando cliente e prestador de teste...');
  const clientId = await createTestUser('client', 0);
  const providerId = await createTestUser('provider', 0);

  // Simula um chamado já aceito pelo prestador — estado em que
  // app/chamado/[callId]/page.tsx permite ao prestador escolher o motivo
  // "Cliente ausente após 10 min" (provider_absent) ao cancelar.
  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const { data: call, error: callError } = await admin
    .from('service_calls')
    .insert({
      client_id: clientId,
      provider_id: providerId,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Central',
      client_address: '[TESTE TAXA NO-SHOW] Endereço fictício — gerado por scripts/test-no-show-fee.mjs',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'accepted',
      payment_status: 'pending',
    })
    .select('id')
    .single();
  if (callError || !call) {
    throw new Error(`Falha ao criar chamado de teste: ${callError?.message}`);
  }
  createdCallId = call.id;
  log(`\n📞 Chamado de teste criado: ${createdCallId} (status=accepted, prestador vinculado)`);

  // ── Passo 1: prestador cancela com motivo provider_absent ──────────────────
  // Reproduz exatamente a escrita de app/api/calls/cancel/route.ts quando
  // shouldChargeNoShowFee(resolveCancelReasonEnum('provider_absent', false), true) === true
  log(`\n🚫 Prestador cancela o chamado com motivo 'provider_absent' (cliente ausente no portão)...`);
  const { error: cancelError } = await admin
    .from('service_calls')
    .update({
      status: 'cancelled',
      cancel_reason: 'provider_absent',
      cancellation_reason: 'Cliente ausente após 10 min',
      cancellation_stage: 'accepted',
      cancelled_by: providerId,
      cancelled_by_role: 'provider',
      cancelled_at: new Date().toISOString(),
      no_show_fee_status: 'pending',
    })
    .eq('id', createdCallId);
  if (cancelError) {
    throw new Error(`Falha ao cancelar chamado de teste: ${cancelError.message}`);
  }

  const { data: afterCancel } = await admin
    .from('service_calls')
    .select('status, cancel_reason, no_show_fee_status')
    .eq('id', createdCallId)
    .single();
  log(`   status=${afterCancel?.status}  cancel_reason=${afterCancel?.cancel_reason}  no_show_fee_status=${afterCancel?.no_show_fee_status}`);
  const cancelOk =
    afterCancel?.status === 'cancelled' &&
    afterCancel?.cancel_reason === 'provider_absent' &&
    afterCancel?.no_show_fee_status === 'pending';

  // ── Passo 2: geração da cobrança Pix da taxa (R$25, fixo, sem split) ────────
  // Reproduz a escrita final do branch no_show_fee de app/api/pix/create/route.ts
  log(`\n💳 Gerando cobrança Pix da taxa de R$25 (payment_id=${FAKE_PAYMENT_ID})...`);
  const { error: pixError } = await admin
    .from('service_calls')
    .update({
      no_show_fee_payment_id: FAKE_PAYMENT_ID,
      no_show_fee_pix_qr_code: '[TESTE] base64-qr-code-fake',
      no_show_fee_pix_copy_paste: '[TESTE] 000201-copia-e-cola-fake',
    })
    .eq('id', createdCallId);
  if (pixError) {
    throw new Error(`Falha ao salvar dados do Pix de teste: ${pixError.message}`);
  }

  const { data: afterPix } = await admin
    .from('service_calls')
    .select('no_show_fee_payment_id, no_show_fee_pix_qr_code, no_show_fee_pix_copy_paste')
    .eq('id', createdCallId)
    .single();
  const pixSavedOk =
    afterPix?.no_show_fee_payment_id === FAKE_PAYMENT_ID &&
    !!afterPix?.no_show_fee_pix_qr_code &&
    !!afterPix?.no_show_fee_pix_copy_paste;
  log(`   Dados do Pix salvos corretamente: ${pixSavedOk ? 'sim' : 'não'}`);

  // ── Passo 3: webhook confirma o pagamento (CAS, com idempotência) ──────────
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

  log(`\n⏱  Disparando uma 3ª entrega sequencial (replay tardio, taxa já paga)...`);
  const d3 = await deliverWebhook(createdCallId, FAKE_PAYMENT_ID);
  log(`   Entrega C: ${d3.errored ? `erro (${d3.errorMessage})` : d3.applied ? 'aplicou' : 'no-op'}`);

  const { data: finalCall, error: finalCallError } = await admin
    .from('service_calls')
    .select('status, cancel_reason, no_show_fee_status, no_show_fee_payment_id')
    .eq('id', createdCallId)
    .single();
  if (finalCallError) {
    log(`\n   ⚠ Não consegui reler o chamado pra conferir o estado final: ${finalCallError.message}`);
  }

  log(`\n📊 Estado final no banco:`);
  log(`   status                  = ${finalCall?.status}`);
  log(`   cancel_reason           = ${finalCall?.cancel_reason}`);
  log(`   no_show_fee_status      = ${finalCall?.no_show_fee_status}`);
  log(`   no_show_fee_payment_id  = ${finalCall?.no_show_fee_payment_id}`);

  const paymentConfirmed =
    finalCall?.no_show_fee_status === 'paid' && finalCall?.no_show_fee_payment_id === FAKE_PAYMENT_ID;

  const pass =
    cancelOk &&
    pixSavedOk &&
    appliedCount === 1 &&
    noopCount === 1 &&
    erroredCount === 0 &&
    !d3.applied &&
    !d3.errored &&
    paymentConfirmed;

  log(`\n   Cancelamento gravou pending corretamente:  ${cancelOk ? 'sim' : 'não'} (esperado: sim)`);
  log(`   Dados do Pix salvos corretamente:          ${pixSavedOk ? 'sim' : 'não'} (esperado: sim)`);
  log(`   Entregas concorrentes que aplicaram:       ${appliedCount} (esperado: 1)`);
  log(`   Entregas concorrentes em no-op:             ${noopCount} (esperado: 1)`);
  log(`   Entregas com erro inesperado:               ${erroredCount} (esperado: 0)`);
  log(`   Replay tardio (3ª entrega) foi no-op:       ${!d3.applied && !d3.errored ? 'sim' : 'não'} (esperado: sim)`);
  log(`   no_show_fee_status = 'paid' no final:       ${paymentConfirmed ? 'sim' : 'não'}`);

  if (pass) {
    log('\n✅ PASSOU — cancelamento por provider_absent marcou a taxa como pending, a cobrança Pix foi salva com os campos próprios (sem misturar com pix_payment_id do serviço), e o webhook confirmou o pagamento de forma idempotente.');
  } else {
    log('\n❌ FALHOU — o fluxo da taxa de no-show NÃO se comportou como esperado. Ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste da taxa de no-show:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
