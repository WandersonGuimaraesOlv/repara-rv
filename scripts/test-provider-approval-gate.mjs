#!/usr/bin/env node
// =============================================================================
// scripts/test-provider-approval-gate.mjs
// Teste empírico, contra o banco Supabase real, do gate de verificação de
// identidade do prestador (Parte 1 do plano aprovado) — ver
// supabase/migrations/20260918_provider_identity_verification.sql.
//
// Confirma, contra o Postgres de verdade (não mock):
//   1. Um prestador novo entra com background_check_status='pending' (mesmo
//      comportamento de app/onboarding/page.tsx) e NÃO consegue ficar online
//      — o trigger trg_check_provider_online_verification bloqueia o UPDATE
//      direto em provider_status.is_online=true, autenticado como o próprio
//      prestador via chave anon (não Service Role), exatamente como
//      app/painel/page.tsx faz o toggle "Ficar Online" hoje.
//   2. find_nearest_provider() nunca retorna um prestador 'pending', mesmo
//      que ele burle o passo 1 e force is_online=true via Service Role
//      diretamente no banco (simula um bypass hipotético do trigger).
//   3. Depois de aprovado (background_check_status='approved', mesma escrita
//      que updateBackgroundCheckStatusAction faz), o mesmo UPDATE de
//      is_online=true — ainda autenticado como o prestador, chave anon —
//      passa a funcionar normalmente.
//   4. find_nearest_provider() passa a encontrar o prestador depois de
//      aprovado e online.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-provider-approval-gate.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam variáveis de ambiente. Rode assim:');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-provider-approval-gate.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const createdUserIds = [];

function log(...args) {
  console.log(...args);
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');
  const leftoverIds = [];
  for (const id of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      leftoverIds.push(id);
      console.warn(`  ⚠ Não consegui apagar o usuário de teste ${id}: ${error.message}`);
    }
  }
  if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados (ver avisos acima).`);
  } else {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste do gate de verificação de identidade do prestador — contra o banco real');
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  // ── Setup: prestador de teste, autenticado via chave anon (igual ao navegador) ──
  const email = `approval-gate-${RUN_ID}@repararv-test.local`;
  const password = `Gate!${RUN_ID}-Aa`;
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !userData?.user) {
    throw new Error(`Falha ao criar usuário de teste: ${createErr?.message}`);
  }
  const providerId = userData.user.id;
  createdUserIds.push(providerId);
  log(`\n👤 Prestador de teste criado: ${providerId}`);

  const { error: profileErr } = await admin.from('profiles').insert({
    id: providerId,
    role: 'provider',
    full_name: '[TESTE GATE APROVAÇÃO] Prestador',
    phone: `62996${RUN_ID.slice(-6)}`,
    cpf_or_cnpj: '',
    background_check_status: 'pending', // mesmo default que app/onboarding/page.tsx grava hoje pra prestador novo
  });
  if (profileErr) throw new Error(`Falha ao criar profile: ${profileErr.message}`);

  const { error: statusErr } = await admin.from('provider_status').insert({
    provider_id: providerId,
    is_online: false,
    pix_key: '62996' + RUN_ID.slice(-6),
    pix_key_type: 'phone',
    recipient_gateway_id: 'TESTE-GATEWAY-OK', // já com Pix/gateway configurado — só falta a aprovação
  });
  if (statusErr) throw new Error(`Falha ao criar provider_status: ${statusErr.message}`);
  log('   background_check_status=pending, pix/gateway já configurados (só falta aprovação)');

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`Falha ao logar como prestador de teste: ${signInErr.message}`);
  log('   logado como o próprio prestador (chave anon, igual ao navegador)');

  // ── Passo 1: pending tenta ficar online — deve ser bloqueado pelo trigger ──
  log('\n🚫 Passo 1: prestador PENDING tenta is_online=true via escrita direta (chave anon)...');
  const { error: blockedErr } = await anon
    .from('provider_status')
    .update({ is_online: true, current_location: 'SRID=4326;POINT(-50.9264 -17.7943)' })
    .eq('provider_id', providerId);
  const step1Pass = !!blockedErr && /análise de segurança/i.test(blockedErr.message || '');
  log(`   ${blockedErr ? `Bloqueado como esperado: "${blockedErr.message}"` : 'NÃO foi bloqueado — FALHA'}`);

  // ── Passo 2: mesmo que alguém force is_online=true via Service Role (bypass
  // hipotético do trigger), find_nearest_provider() não deve encontrar ──
  log('\n🚫 Passo 2: forçando is_online=true via Service Role (simula bypass do trigger) e checando find_nearest_provider()...');
  await admin.from('provider_status').update({
    is_online: true,
    current_location: 'SRID=4326;POINT(-50.9264 -17.7943)',
  }).eq('provider_id', providerId);
  const { data: foundWhilePending } = await admin.rpc('find_nearest_provider', {
    call_location: 'SRID=4326;POINT(-50.9264 -17.7943)',
    excluded_ids: [],
  });
  const step2Pass = foundWhilePending !== providerId;
  log(`   find_nearest_provider() retornou: ${foundWhilePending ?? 'null'} (esperado: nunca ${providerId})`);
  // volta pro estado offline antes do passo 3, pra testar o fluxo real (aprovação → toggle)
  await admin.from('provider_status').update({ is_online: false }).eq('provider_id', providerId);

  // ── Passo 3: aprova o prestador (mesma escrita de updateBackgroundCheckStatusAction) ──
  log('\n✅ Passo 3: aprovando o prestador (admin)...');
  await admin.from('profiles').update({
    background_check_status: 'approved',
    verified_at: new Date().toISOString(),
    verified_by: providerId, // qualquer UUID válido de profiles serve pro teste
  }).eq('id', providerId);

  const { error: allowedErr } = await anon
    .from('provider_status')
    .update({ is_online: true, current_location: 'SRID=4326;POINT(-50.9264 -17.7943)' })
    .eq('provider_id', providerId);
  const step3Pass = !allowedErr;
  log(`   ${allowedErr ? `AINDA bloqueado — FALHA: ${allowedErr.message}` : 'is_online=true aceito normalmente após aprovação'}`);

  // ── Passo 4: find_nearest_provider() agora encontra o prestador aprovado+online ──
  log('\n✅ Passo 4: find_nearest_provider() depois da aprovação...');
  const { data: foundAfterApproval } = await admin.rpc('find_nearest_provider', {
    call_location: 'SRID=4326;POINT(-50.9264 -17.7943)',
    excluded_ids: [],
  });
  const step4Pass = foundAfterApproval === providerId;
  log(`   find_nearest_provider() retornou: ${foundAfterApproval ?? 'null'} (esperado: ${providerId})`);

  const pass = step1Pass && step2Pass && step3Pass && step4Pass;
  log('\n📊 Resultado:');
  log(`   1. Pending bloqueado no toggle (trigger):     ${step1Pass ? 'sim' : 'não'} (esperado: sim)`);
  log(`   2. Pending nunca aparece em find_nearest_provider mesmo online: ${step2Pass ? 'sim' : 'não'} (esperado: sim)`);
  log(`   3. Approved consegue ficar online:             ${step3Pass ? 'sim' : 'não'} (esperado: sim)`);
  log(`   4. Approved+online aparece em find_nearest_provider: ${step4Pass ? 'sim' : 'não'} (esperado: sim)`);

  if (pass) {
    log('\n✅ PASSOU — gate de verificação de identidade confirmado de ponta a ponta contra o banco real.');
  } else {
    log('\n❌ FALHOU — ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste do gate de aprovação:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
