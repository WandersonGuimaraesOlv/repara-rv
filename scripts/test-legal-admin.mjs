#!/usr/bin/env node
// =============================================================================
// scripts/test-legal-admin.mjs
// Teste real de RLS pra legal_documents/legal_clauses — Fase A do plano de
// "Documentos legais editáveis pelo painel admin". Confirma contra o
// Supabase de produção (chave anon + JWT de sessão real, não só leitura de
// código) que:
//   1. Um visitante anônimo (sem login) CONSEGUE ler documentos/cláusulas —
//      as páginas /termos, /privacidade, /contrato precisam funcionar
//      deslogado.
//   2. Um usuário autenticado NÃO-admin NÃO CONSEGUE escrever direto na
//      tabela (insert/update/delete) — a única policy de leitura não dá
//      nenhuma brecha de escrita, então com RLS ligado e zero policy de
//      escrita o Postgres nega por padrão. Isso é defesa em profundidade:
//      mesmo que a checagem de admin da Server Action seja contornada, o
//      banco ainda recusa.
//   3. A Service Role (usada pela Server Action após requireAdminAuth)
//      consegue escrever normalmente — sem isso o admin não editaria nada.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-legal-admin.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-legal-admin.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const TEST_SECTION_ID = `teste-rls-${RUN_ID}`;
const createdUserIds = [];
const results = [];
let testClauseId = null;

function log(...args) { console.log(...args); }
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  log(`   ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function createNonAdminUser() {
  const email = `legal-test-${RUN_ID}@repararv-test.local`;
  const password = `LegalTest!${RUN_ID}-Aa`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`Falha ao criar usuário de teste: ${error?.message}`);
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: 'client',
    full_name: `[TESTE RLS LEGAL] ${RUN_ID}`,
    phone: `62994${String(Date.now()).slice(-6)}`,
    cpf_or_cnpj: '',
  });
  if (profileError) throw new Error(`Falha ao criar profile de teste: ${profileError.message}`);

  return { id: data.user.id, email, password };
}

async function signInAs(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Falha ao logar como ${email}: ${error?.message}`);
  return client;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');
  if (testClauseId) {
    const { error } = await admin.from('legal_clauses').delete().eq('id', testClauseId);
    log(error ? `   ⚠️  Falha ao remover cláusula de teste: ${error.message}` : '   ✅ Cláusula de teste removida');
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  log('   ✅ Usuário de teste removido');
}

async function main() {
  log(`\n🧪 Teste de RLS — legal_documents/legal_clauses (run ${RUN_ID})\n`);

  // 1. Leitura anônima (visitante deslogado nas páginas públicas)
  const { data: anonDocs, error: anonDocsError } = await anon.from('legal_documents').select('slug, title');
  record('Anon consegue ler legal_documents', !anonDocsError && Array.isArray(anonDocs), anonDocsError?.message);

  const { data: anonClauses, error: anonClausesError } = await anon.from('legal_clauses').select('id').limit(1);
  record('Anon consegue ler legal_clauses (sem erro de RLS)', !anonClausesError, anonClausesError?.message);

  // 2. Escrita direta como usuário autenticado NÃO-admin deve ser bloqueada pelo banco
  const nonAdmin = await createNonAdminUser();
  const client = await signInAs(nonAdmin.email, nonAdmin.password);

  const { error: insertError } = await client.from('legal_clauses').insert({
    document_slug: 'termos',
    order_index: 9999,
    section_id: TEST_SECTION_ID,
    title: '[TESTE RLS] Tentativa de insert não-admin',
    body_markdown: 'Não deveria conseguir gravar isso.',
  });
  record(
    'Usuário autenticado não-admin NÃO consegue inserir cláusula (RLS bloqueia no banco)',
    Boolean(insertError),
    insertError ? undefined : 'INSERT foi aceito — RLS não está protegendo a escrita!'
  );

  // Postgres com RLS ligado e SEM policy de UPDATE pro papel `authenticated` não
  // lança erro — ele só filtra a linha do USING implícito e afeta 0 linhas
  // silenciosamente. Por isso checamos o array `data` retornado (com .select()),
  // não só a ausência de `error`: bloqueio real = data vazio OU error presente.
  const { data: updateData, error: updateError } = await client
    .from('legal_documents')
    .update({ title: 'Hackeado' })
    .eq('slug', 'termos')
    .select();
  const updateBlocked = Boolean(updateError) || !updateData || updateData.length === 0;
  record(
    'Usuário autenticado não-admin NÃO consegue atualizar legal_documents (RLS bloqueia no banco)',
    updateBlocked,
    updateBlocked ? undefined : `UPDATE foi aceito e retornou ${updateData.length} linha(s) — RLS não está protegendo a escrita!`
  );

  // Confirmação definitiva lendo de volta via Service Role: o título real no
  // banco não pode ter mudado, independente do que a query anterior retornou.
  const { data: verifyDoc } = await admin.from('legal_documents').select('title').eq('slug', 'termos').single();
  record(
    'Título de legal_documents/termos permanece inalterado no banco (confirmado via Service Role)',
    verifyDoc?.title !== 'Hackeado',
    verifyDoc?.title === 'Hackeado' ? 'Título foi realmente sobrescrito no banco!' : undefined
  );

  // 3. Service Role (o que a Server Action usa após requireAdminAuth) consegue escrever normalmente
  const { data: adminInsert, error: adminInsertError } = await admin
    .from('legal_clauses')
    .insert({
      document_slug: 'termos',
      order_index: 9999,
      section_id: TEST_SECTION_ID,
      title: '[TESTE RLS] Cláusula via Service Role',
      body_markdown: 'Escrita de teste via service role — removida no cleanup.',
    })
    .select('id')
    .single();
  testClauseId = adminInsert?.id ?? null;
  record('Service Role consegue inserir cláusula normalmente', !adminInsertError && Boolean(testClauseId), adminInsertError?.message);

  if (testClauseId) {
    const { error: rpcError } = await admin.rpc('reorder_legal_clauses', {
      p_document_slug: 'termos',
      p_ordered_ids: [testClauseId],
    });
    record('RPC reorder_legal_clauses executa sem erro', !rpcError, rpcError?.message);
  }

  await cleanup();

  const failed = results.filter((r) => !r.pass);
  log(`\n${failed.length === 0 ? '✅ TODOS OS TESTES PASSARAM' : `❌ ${failed.length} TESTE(S) FALHARAM`} (${results.length} no total)\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\n💥 Erro fatal no teste:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
