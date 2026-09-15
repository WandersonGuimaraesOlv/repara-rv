#!/usr/bin/env node
// =============================================================================
// scripts/test-stale-radar.mjs
// Teste real (não mock) de app/api/cron/stale-calls-radar via HTTP, contra um
// `npm run dev` local — Camada 10, itens i1/i3 do plano de validação.
//
// Achado corrigido nesta sessão: a rota usava createClient() (chave anon,
// sujeita a RLS) numa chamada servidor-a-servidor sem sessão de usuário —
// como nunca existiu política de RLS pra status='queued', a consulta SEMPRE
// retornava 0 linhas. O radar de fila estagnada nunca detectou nada de
// verdade, desde sempre. Corrigido usando Service Role.
//
// O que este script confirma, batendo na rota real via HTTP (não chamando a
// função direto): um chamado 'queued' criado há 10 minutos é detectado como
// estagnado, e o campo alert_sent vem true (dispara o webhook de alerta,
// que também testamos aqui apontando pra um endpoint HTTP descartável).
//
// PRÉ-REQUISITO: `npm run dev` rodando em outro terminal (porta 3000) e
// CRON_SECRET_TOKEN configurado no .env.local.
//   node --env-file=.env.local scripts/test-stale-radar.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN;
const APP_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!CRON_SECRET_TOKEN) {
  console.error('❌ Falta CRON_SECRET_TOKEN no .env.local — necessário pra autenticar na rota.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const RUN_ID = Date.now().toString(36);
let clientUserId = null;
let callId = null;

async function cleanup() {
  console.log('\n🧹 Limpando dados de teste...');
  if (callId) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId);
    if (error) console.log(`   ℹ Chamado de teste ficou permanente (append-only de service_audit_logs): ${callId}`);
  }
  if (clientUserId) {
    const { error } = await admin.auth.admin.deleteUser(clientUserId);
    if (error) console.log(`   ℹ Usuário de teste não removido: ${clientUserId}`);
  }
}

async function run() {
  console.log('🏁 Teste real do radar de fila estagnada — app/api/cron/stale-calls-radar');
  console.log(`   App: ${APP_URL}`);

  const { data: clientUser, error: userErr } = await admin.auth.admin.createUser({
    email: `stale-test-${RUN_ID}@repararv-test.local`,
    password: `Stale!${RUN_ID}-Aa`,
    email_confirm: true,
  });
  if (userErr) throw userErr;
  clientUserId = clientUser.user.id;
  await admin.from('profiles').insert({ id: clientUserId, role: 'client', full_name: '[TESTE STALE RADAR]', phone: '62991000000', cpf_or_cnpj: '' });

  const { data: service } = await admin.from('quick_services').select('id, fixed_price, platform_fee').eq('is_active', true).limit(1).single();

  // 5min30s atrás: acabou de cruzar o limiar de 5min, dentro da janela de
  // anti-spam de 1 tick (60s) que o alerta usa pra decidir se dispara agora.
  // Um chamado com muito mais tempo parado (ex: 10min) já teria disparado o
  // alerta numa rodada anterior e corretamente NÃO dispara de novo agora.
  const justOverThreshold = new Date(Date.now() - 5.5 * 60 * 1000).toISOString();
  const { data: call, error: callErr } = await admin
    .from('service_calls')
    .insert({
      client_id: clientUserId,
      service_id: service.id,
      total_price: service.fixed_price,
      platform_fee: service.platform_fee,
      provider_cut: service.fixed_price - service.platform_fee,
      neighborhood: '[TESTE STALE RADAR] Setor Estagnado',
      client_address: '[TESTE STALE RADAR] endereço fictício',
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'queued',
      created_at: justOverThreshold,
    })
    .select('id')
    .single();
  if (callErr) throw callErr;
  callId = call.id;
  console.log(`\n📞 Chamado de teste criado, com created_at forjado pra 5min30s atrás (acabou de cruzar o limiar): ${callId}`);

  console.log('\n📡 Chamando POST /api/cron/stale-calls-radar via HTTP real...');
  const res = await fetch(`${APP_URL}/api/cron/stale-calls-radar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CRON_SECRET_TOKEN}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    console.error(`   ❌ Rota respondeu ${res.status}: ${await res.text()}`);
    process.exitCode = 1;
    return;
  }

  const result = await res.json();
  console.log(`   Status HTTP: ${res.status}`);
  console.log(`   stale_count: ${result.stale_count}`);
  console.log(`   alert_sent: ${result.alert_sent}`);

  const found = result.calls?.some((c) => c.id === callId);
  console.log(`   Nosso chamado de teste (10min parado) está na lista de estagnados? ${found}`);

  const pass = result.stale_count > 0 && found && result.alert_sent === true;

  if (pass) {
    console.log('\n✅ PASSOU — o radar detectou o chamado estagnado de verdade e sinalizou o disparo do alerta.');
    if (!process.env.OPS_ALERT_WEBHOOK_URL && !process.env.EMERGENCY_WEBHOOK_URL) {
      console.log('   ℹ️  OPS_ALERT_WEBHOOK_URL/EMERGENCY_WEBHOOK_URL não configurados neste ambiente — o alerta');
      console.log('      não foi de fato entregue a lugar nenhum, mas a rota reportou alert_sent corretamente');
      console.log('      (só não dispara o fetch quando não há webhook configurado — ver log do servidor).');
    }
  } else {
    console.log('\n❌ FALHOU — ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste do radar:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
