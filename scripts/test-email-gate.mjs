#!/usr/bin/env node
// =============================================================================
// scripts/test-email-gate.mjs
// Teste empírico, contra o banco Supabase real, do gate de e-mail retroativo
// (achado de 16/09/2026): contas criadas antes do e-mail virar obrigatório no
// cadastro ficaram com profiles.email nulo pra sempre, sem nenhum jeito de
// serem forçadas a preencher — nem o login nem /painel checavam isso.
//
// Este script não chama as rotas HTTP/páginas Next.js diretamente (login é
// client-side, depende de DOM) — em vez disso reproduz exatamente a mesma
// leitura que app/login/page.tsx e app/painel/page.tsx fazem
// (profiles.select incluindo email) e confirma:
//   1. Um perfil legado (email=null) é identificado corretamente como
//      "precisa completar" pela mesma condição usada nas duas páginas
//      (!profile.email).
//   2. A escrita que app/completar-email/page.tsx faz (update direto via
//      client autenticado, não Service Role) realmente persiste o e-mail —
//      autenticado como o próprio usuário via chave anon, mesma forma que o
//      navegador faz.
//   3. Depois de preenchido, a mesma condição (!profile.email) passa a ser
//      false — o gate libera o usuário.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-email-gate.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam variáveis de ambiente. Rode assim:');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-email-gate.mjs');
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
  for (const id of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`  ⚠ Não consegui apagar o usuário de teste ${id}: ${error.message}`);
  }
  log('   Limpeza concluída.');
}

async function run() {
  log('🏁 Teste do gate de e-mail retroativo — contra o banco real');
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  // ── Simula uma conta legada, criada antes do e-mail virar obrigatório ──
  const email = `email-gate-${RUN_ID}@repararv-test.local`;
  const password = `Gate!${RUN_ID}-Aa`;
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !userData?.user) throw new Error(`Falha ao criar usuário: ${createErr?.message}`);
  const userId = userData.user.id;
  createdUserIds.push(userId);

  const { error: profileErr } = await admin.from('profiles').insert({
    id: userId,
    role: 'client',
    full_name: '[TESTE GATE EMAIL] Cliente legado',
    phone: `62995${RUN_ID.slice(-6)}`,
    cpf_or_cnpj: '',
    // email de propósito OMITIDO — simula conta criada antes do campo existir
  });
  if (profileErr) throw new Error(`Falha ao criar profile: ${profileErr.message}`);
  log(`\n👤 Perfil legado criado (sem e-mail): ${userId}`);

  // ── Passo 1: mesma leitura de app/login/page.tsx e app/painel/page.tsx ──
  const { data: legacyProfile } = await admin
    .from('profiles')
    .select('id, role, full_name, phone, email')
    .eq('id', userId)
    .maybeSingle();
  const step1Pass = !legacyProfile?.email;
  log(`\n🚫 Passo 1: !profile.email identifica perfil legado como pendente: ${step1Pass ? 'sim' : 'não'} (esperado: sim)`);
  log(`   email lido do banco: ${JSON.stringify(legacyProfile?.email)}`);

  // ── Passo 2: mesma escrita de app/completar-email/page.tsx (client autenticado, não Service Role) ──
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`Falha ao logar como usuário de teste: ${signInErr.message}`);

  const newEmail = `updated-${RUN_ID}@example.com`;
  const { error: updateErr } = await anon.from('profiles').update({ email: newEmail }).eq('id', userId);
  const step2Pass = !updateErr;
  log(`\n✅ Passo 2: update de email pelo próprio usuário (chave anon): ${step2Pass ? 'sim' : `não — ${updateErr?.message}`} (esperado: sim)`);

  // ── Passo 3: gate libera depois do preenchimento ──
  const { data: updatedProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  const step3Pass = updatedProfile?.email === newEmail;
  log(`\n✅ Passo 3: gate libera depois do preenchimento: ${step3Pass ? 'sim' : 'não'} (esperado: sim)`);
  log(`   email lido do banco: ${JSON.stringify(updatedProfile?.email)}`);

  const pass = step1Pass && step2Pass && step3Pass;
  log('\n📊 Resultado:');
  log(`   1. Perfil legado (sem email) é sinalizado como pendente: ${step1Pass ? 'sim' : 'não'}`);
  log(`   2. Usuário consegue gravar o próprio email (RLS permite):  ${step2Pass ? 'sim' : 'não'}`);
  log(`   3. Gate libera depois de preenchido:                       ${step3Pass ? 'sim' : 'não'}`);

  if (pass) {
    log('\n✅ PASSOU — gate de e-mail retroativo confirmado de ponta a ponta contra o banco real.');
  } else {
    log('\n❌ FALHOU — ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste do gate de e-mail:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
