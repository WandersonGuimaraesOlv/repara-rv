#!/usr/bin/env node
// =============================================================================
// scripts/synthetic-monitor.mjs
// Monitoramento sintético — Camada 10, item i4 do plano de validação.
//
// Percorre o ciclo real de um chamado, ponta a ponta, contra o app rodando
// de verdade (npm run dev local, ou aponte TEST_APP_URL pra staging):
//
//   criar chamado (HTTP real, /api/calls/create)
//     -> casado automaticamente com um prestador de teste (RPC find_nearest_provider)
//     -> prestador aceita (mesma escrita que app/painel faz: UPDATE via sessão
//        autenticada real, não Service Role — exercita a RLS de verdade)
//     -> prestador segue pro endereço (mesma auto-transição de app/chamado)
//     -> prestador conclui o serviço (status=completed, payment_status=pending)
//     -> confirma pagamento (mesmo UPDATE condicional do webhook do Pix —
//        sem chamar a API de verdade do Mercado Pago: um monitor sintético
//        rodando em produção não deveria criar cobranças reais periodicamente
//        num gateway de pagamento de terceiros)
//
// Cada etapa confirma o estado esperado no banco antes de seguir pra próxima.
// Se qualquer etapa falhar ou o estado não bater, o script sai com erro —
// é esse sinal que alimentaria um alerta (ex: rodar isto como cron e mandar
// pro mesmo webhook de OPS_ALERT_WEBHOOK_URL usado pelo radar de fila).
//
// PRÉ-REQUISITO:
//   npm run dev (em outro terminal)
//   node --env-file=.env.local scripts/synthetic-monitor.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const RUN_ID = Date.now().toString(36);
const steps = [];
let clientUser = null;
let providerUser = null;
let callId = null;

function step(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`   ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function getCall(selectCols = '*') {
  const { data } = await admin.from('service_calls').select(selectCols).eq('id', callId).single();
  return data;
}

async function cleanup() {
  console.log('\n🧹 Limpando dados de teste...');
  let auditBlocked = false;
  if (callId) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId);
    if (error) auditBlocked = true;
  }
  for (const u of [clientUser, providerUser]) {
    if (!u) continue;
    if (auditBlocked) continue;
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  if (auditBlocked) {
    console.log(`   ℹ Chamado de teste ficou permanente (append-only de service_audit_logs), marcado "[MONITOR SINTETICO]": ${callId}`);
  } else {
    console.log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  console.log('🏁 Monitoramento sintético — ciclo completo de um chamado real');
  console.log(`   App: ${APP_URL}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);

  // ── Setup: cliente + prestador de teste (prestador online, gateway, localização) ──
  const clientEmail = `synthetic-${RUN_ID}-client@repararv-test.local`;
  const providerEmail = `synthetic-${RUN_ID}-provider@repararv-test.local`;
  const password = `Synthetic!${RUN_ID}-Aa`;

  const { data: c } = await admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true });
  clientUser = c.user;
  await admin.from('profiles').insert({ id: clientUser.id, role: 'client', full_name: '[MONITOR SINTETICO] client', phone: '62990000000', cpf_or_cnpj: '' });

  const { data: p } = await admin.auth.admin.createUser({ email: providerEmail, password, email_confirm: true });
  providerUser = p.user;
  await admin.from('profiles').insert({ id: providerUser.id, role: 'provider', full_name: '[MONITOR SINTETICO] provider', phone: '62990000001', cpf_or_cnpj: '' });
  await admin.from('provider_status').insert({
    provider_id: providerUser.id,
    is_online: true,
    pix_key: '62990000001',
    pix_key_type: 'phone',
    recipient_gateway_id: `[MONITOR SINTETICO] gw-${RUN_ID}`,
    current_location: 'POINT(-50.9264 -17.7943)',
  });

  const { data: service } = await admin.from('quick_services').select('id, name').eq('is_active', true).limit(1).single();
  console.log(`\n👤 Cliente e prestador de teste criados. Serviço usado: ${service.name}`);

  // ── 1. Criar chamado via HTTP real (/api/calls/create) ──────────────────────
  const createRes = await fetch(`${APP_URL}/api/calls/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: service.id,
      client_id: clientUser.id,
      client_address: '[MONITOR SINTETICO] Rua de Teste, 100',
      client_lat: -17.7943,
      client_lng: -50.9264,
      neighborhood: 'Setor Central',
    }),
  });
  const createBody = await createRes.json();
  if (!step('POST /api/calls/create respondeu 200', createRes.ok, `status=${createRes.status}`)) {
    console.log('   Resposta:', JSON.stringify(createBody));
    return false;
  }
  callId = createBody.call_id;
  console.log(`   Chamado criado: ${callId}`);

  // ── 2. Confirma casamento automático com o prestador de teste ───────────────
  const afterCreate = await getCall('status, provider_id');
  const matched = afterCreate?.status === 'searching' && afterCreate?.provider_id === providerUser.id;
  if (!step('Casado automaticamente com o prestador de teste (status=searching)', matched, `status=${afterCreate?.status} provider_id=${afterCreate?.provider_id}`)) {
    return false;
  }

  // ── 3. Prestador aceita — sessão autenticada real, exercita RLS de verdade ──
  const providerClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await providerClient.auth.signInWithPassword({ email: providerEmail, password });

  const { error: acceptErr } = await providerClient
    .from('service_calls')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', callId);
  if (!step('Prestador aceita o chamado (UPDATE via sessão real)', !acceptErr, acceptErr?.message)) return false;

  const afterAccept = await getCall('status');
  if (!step('Estado no banco confirma accepted', afterAccept?.status === 'accepted', `status=${afterAccept?.status}`)) return false;

  // ── 4. Prestador segue pro endereço (mesma auto-transição de app/chamado) ──
  const { error: otwErr } = await providerClient.from('service_calls').update({ status: 'on_the_way' }).eq('id', callId);
  if (!step('Prestador marca a caminho (on_the_way)', !otwErr, otwErr?.message)) return false;

  // ── 5. Prestador conclui o serviço ───────────────────────────────────────────
  const { error: completeErr } = await providerClient
    .from('service_calls')
    .update({ status: 'completed', payment_status: 'pending', completed_at: new Date().toISOString() })
    .eq('id', callId);
  if (!step('Prestador conclui o serviço (completed, payment_status=pending)', !completeErr, completeErr?.message)) return false;

  // ── 6. Confirma pagamento — mesmo UPDATE condicional do webhook, sem bater
  //      na API de verdade do Mercado Pago (ver comentário no topo do arquivo) ──
  const fakePaymentId = `synthetic-${RUN_ID}`;
  const { data: paidRow, error: paidErr } = await admin
    .from('service_calls')
    .update({ payment_status: 'paid', pix_payment_id: fakePaymentId })
    .eq('id', callId)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (!step('Confirmação de pagamento aplica (mesmo UPDATE condicional do webhook)', !paidErr && !!paidRow, paidErr?.message)) return false;

  const final = await getCall('status, payment_status, completed_at, pix_payment_id');
  const finalOk = final?.status === 'completed' && final?.payment_status === 'paid' && final?.pix_payment_id === fakePaymentId;
  step('Estado final: completed + paid + pix_payment_id correto', finalOk, JSON.stringify(final));

  return steps.every((s) => s.ok);
}

run()
  .then((pass) => {
    console.log(`\n📊 ${steps.filter((s) => s.ok).length}/${steps.length} etapas passaram.`);
    if (pass) {
      console.log('\n✅ PASSOU — ciclo completo do chamado funcionou ponta a ponta contra o app real.');
    } else {
      console.log('\n❌ FALHOU — o ciclo quebrou em alguma etapa. Ver detalhes acima.');
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error('\n💥 Erro no monitoramento sintético:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
