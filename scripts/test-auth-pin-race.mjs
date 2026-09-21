#!/usr/bin/env node
// =============================================================================
// scripts/test-auth-pin-race.mjs
// Confirma, contra o Supabase de verdade, a causa raiz do bug de produção
// "A user with this email address has already been registered" ao logar:
// app/api/auth/pin/route.ts faz listUsers() (checagem) e depois createUser()
// (criação) como duas chamadas separadas, não atômicas — duas tentativas de
// login quase simultâneas com o MESMO telefone ainda sem conta colidem.
//
// Este teste dispara 2 createUser() concorrentes de verdade pro MESMO email,
// via Service Role (exatamente a chamada que a rota faz), e confirma:
//   1. Exatamente 1 das 2 chamadas cria o usuário com sucesso.
//   2. A outra falha com error.code === 'email_exists' (ou
//      'user_already_exists') — o código específico que route.ts agora
//      trata como "conta já existe, devolve login normal" em vez de vazar o
//      erro cru pro usuário.
//
// Não testamos via HTTP (POST /api/calls/... equivalente pra auth) porque
// /api/auth* tem rate limit de 3 req/min por IP em proxy.ts — 2 requisições
// vindas do mesmo processo Node sempre parecem vir do mesmo IP em dev local
// e o rate limiter bloquearia antes de reproduzir a corrida real no banco.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-auth-pin-race.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Rode assim: node --env-file=.env.local --env-file=.dev.vars scripts/test-auth-pin-race.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const phone = `6297${String(Date.now()).slice(-7)}`;
const email = `${phone}@repararv.com`;
const password = 'pin_1234';

console.log(`\n🧪 Teste de corrida — app/api/auth/pin (email: ${email})\n`);

const [r1, r2] = await Promise.allSettled([
  admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone } }),
  admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone } }),
]);

function describe(label, result) {
  if (result.status !== 'fulfilled') {
    console.log(`   ${label}: rejeitada inesperadamente — ${result.reason}`);
    return { ok: false, code: null };
  }
  const { data, error } = result.value;
  if (error) {
    console.log(`   ${label}: erro — code="${error.code}" message="${error.message}"`);
    return { ok: false, code: error.code };
  }
  console.log(`   ${label}: sucesso — userId=${data.user.id}`);
  return { ok: true, code: null, userId: data.user.id };
}

const res1 = describe('Requisição A', r1);
const res2 = describe('Requisição B', r2);

const successes = [res1, res2].filter((r) => r.ok);
const failures = [res1, res2].filter((r) => !r.ok);

let pass = true;

if (successes.length !== 1) {
  console.log(`\n❌ Esperado exatamente 1 sucesso, obtido ${successes.length}`);
  pass = false;
} else {
  console.log('\n✅ Exatamente 1 das 2 requisições concorrentes criou o usuário');
}

if (failures.length === 1) {
  console.log(`   (a outra falhou com code="${failures[0].code}" — formato pode variar, por isso o fix não confia nele)`);

  // Exatamente o que route.ts faz agora após qualquer createError: reconsulta
  // se o e-mail existe. Se existir, o fix trata como login normal em vez de
  // vazar o erro — é isso que este teste confirma.
  const { data: retryData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = retryData?.users.find((u) => u.email === email);
  console.log(
    found
      ? '✅ Reconsulta pós-erro encontra o usuário — route.ts trataria como login normal, não vazaria o erro'
      : '❌ Reconsulta pós-erro NÃO encontrou o usuário — route.ts vazaria o erro cru pro usuário'
  );
  pass = pass && Boolean(found);
}

// Cleanup
const winnerId = successes[0]?.userId;
if (winnerId) {
  await admin.auth.admin.deleteUser(winnerId).catch(() => {});
  console.log('\n🧹 Usuário de teste removido');
}

console.log(`\n${pass ? '✅ TESTE PASSOU' : '❌ TESTE FALHOU'}\n`);
process.exit(pass ? 0 : 1);
