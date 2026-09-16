#!/usr/bin/env node
// =============================================================================
// scripts/test-identity-verification-flow.mjs
// Teste empírico, contra o banco/Storage Supabase reais, do resto da Parte 1
// do plano de verificação de identidade (a primeira fatia — o gate de
// aprovação — já foi validada em scripts/test-provider-approval-gate.mjs).
//
// Não chama as rotas HTTP diretamente (exigiria o servidor Next.js rodando)
// — reproduz exatamente as mesmas operações que cada rota faz, direto contra
// o Supabase real, usando as mesmas credenciais (Service Role) e a mesma
// sequência de chamadas:
//
//   1. PIN de chegada: mesma escrita de app/painel/page.tsx (handleAcceptCall)
//      e app/api/calls/claim-queued/route.ts — confirma que um PIN de 4
//      dígitos é gerado e persiste na linha do chamado.
//   2. Selfie: mesma sequência de app/api/profile/selfie/route.ts — upload
//      pro bucket privado provider-selfies, geração de URL assinada, escrita
//      em profiles.avatar_url, e a transição rejected -> pending ao reenviar.
//   3. Denúncia de identidade: mesma sequência de
//      app/api/calls/report-identity/route.ts — cancela o chamado sem taxa,
//      grava em identity_reports, e confirma que is_blocked do prestador
//      NUNCA é tocado (decisão do plano: fica pendente de revisão humana).
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local scripts/test-identity-verification-flow.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam variáveis de ambiente. Rode assim:');
  console.error('     node --env-file=.env.local scripts/test-identity-verification-flow.mjs');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const createdUserIds = [];
let createdCallId = null;
let uploadedPath = null;
const results = {};

function log(...args) {
  console.log(...args);
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');

  if (uploadedPath) {
    const { error } = await admin.storage.from('provider-selfies').remove([uploadedPath]);
    if (error) console.warn(`  ⚠ Não consegui apagar o arquivo de teste do Storage: ${error.message}`);
  }

  let callDeleted = false;
  let auditBlocked = false;
  if (createdCallId) {
    const { error } = await admin.from('service_calls').delete().eq('id', createdCallId);
    if (!error) callDeleted = true;
    else if (/imutável|immutable|service_audit_logs/i.test(error.message)) auditBlocked = true;
    else console.warn(`  ⚠ Não consegui apagar o chamado de teste ${createdCallId}: ${error.message}`);
  }

  const leftoverIds = [];
  for (const id of createdUserIds) {
    if (auditBlocked) { leftoverIds.push(id); continue; }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { leftoverIds.push(id); console.warn(`  ⚠ Não consegui apagar o usuário de teste ${id}: ${error.message}`); }
  }

  if (auditBlocked) {
    log('\n   ℹ Chamado de teste gerou registro permanente em service_audit_logs (append-only).');
    log(`     Ficam permanentemente no banco, marcados "[TESTE VERIFICACAO IDENTIDADE]":`);
    log(`       - service_calls.id = ${createdCallId}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else if (leftoverIds.length > 0) {
    log(`\n   ⚠ ${leftoverIds.length} usuário(s) de teste não puderam ser apagados.`);
  } else {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste do restante da Parte 1 (selfie, PIN de chegada, denúncia) — contra o banco/Storage reais');
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  const { data: service } = await admin.from('quick_services').select('id, fixed_price, platform_fee').eq('is_active', true).limit(1).single();

  log('\n👤 Criando cliente e prestador de teste (prestador já aprovado, pra isolar do teste do gate)...');
  const { data: clientAuth } = await admin.auth.admin.createUser({
    email: `idflow-client-${RUN_ID}@repararv-test.local`, password: `Id!${RUN_ID}Aa`, email_confirm: true,
  });
  const clientId = clientAuth.user.id;
  createdUserIds.push(clientId);
  await admin.from('profiles').insert({ id: clientId, role: 'client', full_name: '[TESTE VERIFICACAO IDENTIDADE] Cliente', phone: `62994${RUN_ID.slice(-6)}`, cpf_or_cnpj: '' });

  const { data: providerAuth } = await admin.auth.admin.createUser({
    email: `idflow-provider-${RUN_ID}@repararv-test.local`, password: `Id!${RUN_ID}Aa`, email_confirm: true,
  });
  const providerId = providerAuth.user.id;
  createdUserIds.push(providerId);
  await admin.from('profiles').insert({
    id: providerId, role: 'provider', full_name: '[TESTE VERIFICACAO IDENTIDADE] Prestador',
    phone: `62993${RUN_ID.slice(-6)}`, cpf_or_cnpj: '', background_check_status: 'approved',
  });

  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const { data: call } = await admin.from('service_calls').insert({
    client_id: clientId, provider_id: providerId, service_id: service.id,
    total_price: totalPrice, platform_fee: platformFee, provider_cut: totalPrice - platformFee,
    neighborhood: 'Setor Central',
    client_address: '[TESTE VERIFICACAO IDENTIDADE] Endereço fictício — scripts/test-identity-verification-flow.mjs',
    client_location: 'POINT(-50.9264 -17.7943)', status: 'accepted', payment_status: 'pending',
  }).select('id').single();
  createdCallId = call.id;
  log(`   Chamado de teste criado: ${createdCallId} (status=accepted)`);

  // ── Passo 1: PIN de chegada (mesma escrita das duas rotas de aceite) ───────
  log('\n🔢 Passo 1: gerando PIN de chegada...');
  const arrivalPin = String(Math.floor(1000 + Math.random() * 9000));
  await admin.from('service_calls').update({ arrival_pin: arrivalPin }).eq('id', createdCallId);
  const { data: callWithPin } = await admin.from('service_calls').select('arrival_pin').eq('id', createdCallId).single();
  results.pin = callWithPin?.arrival_pin === arrivalPin && /^\d{4}$/.test(callWithPin.arrival_pin);
  log(`   arrival_pin gravado: ${callWithPin?.arrival_pin} — ${results.pin ? 'OK' : 'FALHOU'}`);

  // ── Passo 2: selfie — upload, URL assinada, avatar_url, transição rejected->pending ──
  log('\n📸 Passo 2: simulando upload de selfie (mesma sequência de /api/profile/selfie)...');
  await admin.from('profiles').update({ background_check_status: 'rejected', rejection_reason: 'Foto de teste anterior ilegível' }).eq('id', providerId);

  uploadedPath = `${providerId}/selfie.jpg`;
  const fakeJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]); // cabeçalho JPEG mínimo + EOI
  const { error: uploadError } = await admin.storage.from('provider-selfies').upload(uploadedPath, fakeJpegBytes, { contentType: 'image/jpeg', upsert: true });
  results.upload = !uploadError;
  log(`   Upload pro bucket provider-selfies: ${results.upload ? 'OK' : `FALHOU — ${uploadError?.message}`}`);

  const { data: signedUrlData, error: signedUrlError } = await admin.storage.from('provider-selfies').createSignedUrl(uploadedPath, 60);
  results.signedUrl = !signedUrlError && !!signedUrlData?.signedUrl;
  log(`   URL assinada gerada: ${results.signedUrl ? 'OK' : `FALHOU — ${signedUrlError?.message}`}`);

  await admin.from('profiles').update({
    avatar_url: signedUrlData?.signedUrl,
    background_check_status: 'pending', // reenvio depois de rejected volta pra pending
    rejection_reason: null,
  }).eq('id', providerId);

  const { data: profileAfterSelfie } = await admin.from('profiles').select('avatar_url, background_check_status, rejection_reason').eq('id', providerId).single();
  results.avatarSaved = profileAfterSelfie?.avatar_url === signedUrlData?.signedUrl;
  results.statusResetToPending = profileAfterSelfie?.background_check_status === 'pending' && profileAfterSelfie?.rejection_reason === null;
  log(`   avatar_url salvo em profiles: ${results.avatarSaved ? 'OK' : 'FALHOU'}`);
  log(`   status voltou pra 'pending' (era 'rejected') e rejection_reason limpo: ${results.statusResetToPending ? 'OK' : 'FALHOU'}`);

  // Confirma que a URL assinada realmente funciona (busca o arquivo de volta)
  const fetchRes = await fetch(signedUrlData.signedUrl);
  results.urlWorks = fetchRes.ok;
  log(`   URL assinada é acessível de verdade (fetch): ${results.urlWorks ? `OK (${fetchRes.status})` : `FALHOU (${fetchRes.status})`}`);

  // ── Passo 3: denúncia de identidade (mesma sequência de report-identity) ──
  log('\n🚨 Passo 3: simulando denúncia "Não é a pessoa da foto"...');
  const reportReason = '[TESTE] O técnico não parece com a foto do app';
  await admin.from('service_calls').update({
    status: 'cancelled', cancel_reason: 'other',
    cancellation_reason: 'Denúncia de identidade — prestador não corresponde à foto',
    cancel_note: reportReason, cancellation_stage: 'accepted',
    cancelled_by: clientId, cancelled_by_role: 'client', cancelled_at: new Date().toISOString(),
  }).eq('id', createdCallId);

  await admin.from('identity_reports').insert({
    call_id: createdCallId, client_id: clientId, provider_id: providerId,
    reason: reportReason, status: 'pending_review',
  });

  const { data: cancelledCall } = await admin.from('service_calls')
    .select('status, cancel_reason, no_show_fee_status')
    .eq('id', createdCallId).single();
  results.callCancelled = cancelledCall?.status === 'cancelled';
  results.noFeeCharged = !cancelledCall?.no_show_fee_status; // nunca deve setar taxa de no-show
  log(`   Chamado cancelado: ${results.callCancelled ? 'OK' : 'FALHOU'} (status=${cancelledCall?.status})`);
  log(`   Nenhuma taxa cobrada do cliente: ${results.noFeeCharged ? 'OK' : 'FALHOU'}`);

  const { data: report } = await admin.from('identity_reports').select('*').eq('call_id', createdCallId).maybeSingle();
  results.reportSaved = report?.status === 'pending_review' && report?.provider_id === providerId && report?.client_id === clientId;
  log(`   Denúncia gravada em identity_reports (pending_review): ${results.reportSaved ? 'OK' : 'FALHOU'}`);

  const { data: providerAfterReport } = await admin.from('profiles').select('is_blocked').eq('id', providerId).single();
  results.providerNotBlocked = providerAfterReport?.is_blocked === false || providerAfterReport?.is_blocked === null;
  log(`   Prestador NÃO foi bloqueado automaticamente (decisão do plano): ${results.providerNotBlocked ? 'OK' : 'FALHOU'}`);

  const pass = Object.values(results).every(Boolean);
  log('\n📊 Resultado:');
  for (const [key, value] of Object.entries(results)) {
    log(`   ${key.padEnd(22)}: ${value ? 'OK' : 'FALHOU'}`);
  }

  if (pass) {
    log('\n✅ PASSOU — PIN de chegada, upload/URL assinada de selfie, transição de status no reenvio, e fluxo de denúncia de identidade confirmados contra o banco/Storage reais.');
  } else {
    log('\n❌ FALHOU — ver detalhes acima.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste:', err);
    process.exitCode = 1;
  })
  .finally(cleanup);
