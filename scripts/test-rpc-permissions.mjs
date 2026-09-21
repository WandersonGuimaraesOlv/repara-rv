#!/usr/bin/env node
// =============================================================================
// scripts/test-rpc-permissions.mjs
// Confere QUEM pode executar as funções SECURITY DEFINER internas do banco via
// API REST (/rest/v1/rpc/*), usando só a chave pública do navegador:
//   - anon (sem login) e usuário autenticado comum → precisam receber
//     "permission denied" (42501);
//   - Service Role (o que as rotas do app usam) → continua executando.
//
// Achado de 21/09/2026: o Postgres dá EXECUTE a PUBLIC por padrão, então
// claim_queued_call, find_nearest_provider, reorder_legal_clauses e
// deactivate_expired_bans eram chamáveis por qualquer pessoa. Correção em
// supabase/migrations/20260921_rpc_permissions_and_reorder_fix.sql (aplicada
// manualmente no SQL Editor do Supabase). Este teste falha enquanto a
// migration não estiver aplicada.
//
// Só usa argumentos inofensivos (UUIDs inexistentes, lista vazia): nenhuma
// linha real é alterada, mesmo se a permissão estiver aberta.
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-rpc-permissions.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const anon = createClient(URL, ANON_KEY, opts);
const admin = createClient(URL, SERVICE_KEY, opts);

const GHOST = '00000000-0000-4000-8000-00000000dead';
const RUN_ID = Date.now().toString(36);

// Argumentos que não encontram nenhuma linha real.
const RPCS = [
  { name: 'claim_queued_call', args: { p_call_id: GHOST, p_provider_id: GHOST } },
  { name: 'find_nearest_provider', args: { call_location: 'SRID=4326;POINT(-50.9264 -17.7943)', excluded_ids: [] } },
  { name: 'reorder_legal_clauses', args: { p_document_slug: 'contrato', p_ordered_ids: [GHOST] } },
  // Idempotente: só desativa bans que já venceram (o que o cron faria).
  { name: 'deactivate_expired_bans', args: {} },
];

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const isDenied = (error) => Boolean(error) && (error.code === '42501' || /permission denied/i.test(error.message ?? ''));

let testUserId = null;

async function cleanup() {
  if (testUserId) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
}

async function main() {
  console.log('🔐 Permissões de execução das RPCs internas (SECURITY DEFINER)');
  console.log(`   Projeto: ${URL}`);

  // Usuário autenticado comum (sem perfil, sem papel — só uma sessão válida)
  const email = `rpc-perm-${RUN_ID}@repararv-test.local`;
  const password = `Perm!${RUN_ID}-Aa1`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) throw createError;
  testUserId = created.user.id;

  const authed = createClient(URL, ANON_KEY, opts);
  const { error: signInError } = await authed.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  for (const [label, client] of [['anon (sem login)', anon], ['usuário autenticado comum', authed]]) {
    console.log(`\n👤 ${label} — deve receber permission denied:`);
    for (const rpc of RPCS) {
      const { error } = await client.rpc(rpc.name, rpc.args);
      record(`${rpc.name} bloqueada`, isDenied(error), isDenied(error) ? undefined : error ? `erro inesperado: ${error.message}` : 'EXECUTOU — permissão aberta!');
    }
  }

  console.log('\n🛠️  Service Role (rotas do app) — deve continuar executando:');
  for (const rpc of RPCS) {
    const { error } = await admin.rpc(rpc.name, rpc.args);
    record(`${rpc.name} executa`, !error, error?.message);
  }

  await cleanup();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? '✅ PASSOU' : `❌ FALHOU (${failed.length} de ${results.length})`} — ${failed.length === 0 ? 'só a Service Role executa as RPCs internas.' : 'aplicar supabase/migrations/20260921_rpc_permissions_and_reorder_fix.sql e rodar de novo.'}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\n💥 Erro fatal no teste:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
