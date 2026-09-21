#!/usr/bin/env node
// =============================================================================
// scripts/test-realtime-reconnect.mjs
// Teste real de reconexão do Supabase Realtime (Camada 9, item i5 do plano de
// validação) — pré-requisito pra decidir se o polling de 3s/4s em
// app/painel/page.tsx é redundância de verdade (Camada 7, item i2) ou uma
// rede de segurança necessária.
//
// PERGUNTA QUE ESTE SCRIPT RESPONDE, CONTRA O REALTIME DE VERDADE (NÃO MOCK):
// Se a conexão WebSocket do prestador cair (sinal fraco, app em segundo
// plano, troca de rede) e um chamado for atribuído a ele NESSE INTERVALO,
// o evento chega quando a conexão volta? Ou ele é perdido pra sempre porque
// o Realtime do Supabase é um broadcast ao vivo, não uma fila durável com
// replay?
//
// MÉTODO:
//   1. Assina um canal postgres_changes filtrado por provider_id, exatamente
//      como app/painel/page.tsx faz (mesmo shape de filtro/evento).
//   2. Depois de confirmado SUBSCRIBED, derruba a conexão via
//      realtime.disconnect() — equivalente a perder o socket por sinal
//      fraco/troca de rede.
//   3. ENQUANTO DESCONECTADO, insere um chamado de teste com esse
//      provider_id e status='searching' (via um client ADMIN separado, que
//      nunca esteve inscrito) — simula um chamado sendo atribuído durante a
//      queda.
//   4. Reconecta via realtime.connect() e espera o canal voltar a
//      SUBSCRIBED.
//   5. Confirma se o evento do INSERT perdido chega depois da reconexão
//      (esperado: NÃO chega — Realtime não faz replay de eventos perdidos).
//   6. Prova que a reconexão em si funciona de verdade: insere um SEGUNDO
//      chamado DEPOIS de reconectado e confirma que esse sim chega — isola
//      o achado em "eventos perdidos durante a queda não voltam", não em
//      "reconexão está quebrada".
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local --env-file=.dev.vars scripts/test-realtime-reconnect.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTAGE_MS = Number(process.env.TEST_OUTAGE_MS || 4000);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('   Rode assim (carrega o .env.local automaticamente):');
  console.error('     node --env-file=.env.local --env-file=.dev.vars scripts/test-realtime-reconnect.mjs');
  process.exit(1);
}

// Cliente que assina o canal (equivalente ao app rodando no celular do prestador)
const subscriber = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// Cliente separado, nunca inscrito, só pra inserir os chamados de teste
// (equivalente ao servidor atribuindo um chamado enquanto o celular está sem sinal)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now().toString(36);
const createdUserIds = [];
const createdCallIds = [];
let providerId = null;
let clientId = null;

function log(...args) {
  console.log(...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTestUser(role) {
  const email = `realtime-test-${RUN_ID}-${role}@repararv-test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Realtime!${RUN_ID}-Aa`,
    email_confirm: true,
  });
  if (error || !data?.user) {
    throw new Error(`Falha ao criar usuário de teste (${role}): ${error?.message}`);
  }
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role,
    full_name: `[TESTE RECONEXAO REALTIME] ${role}`,
    phone: role === 'provider' ? '62997000000' : '62997000001',
    cpf_or_cnpj: '',
  });
  if (profileError) throw new Error(`Falha ao criar profile de teste (${role}): ${profileError.message}`);

  if (role === 'provider') {
    const { error: statusError } = await admin.from('provider_status').insert({
      provider_id: data.user.id,
      is_online: true,
      pix_key: '62997000000',
      pix_key_type: 'phone',
      recipient_gateway_id: `[TESTE RECONEXAO REALTIME] gw-${RUN_ID}`,
      current_location: 'POINT(-50.9264 -17.7943)',
    });
    if (statusError) throw new Error(`Falha ao criar provider_status de teste: ${statusError.message}`);
  }

  return data.user.id;
}

async function insertTestCall(label) {
  const { data: service, error: serviceError } = await admin
    .from('quick_services')
    .select('id, fixed_price, platform_fee')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (serviceError || !service) {
    throw new Error(`Não encontrei nenhum serviço ativo: ${serviceError?.message}`);
  }

  // Precisa de um client_id válido (FK) — reaproveita o próprio prestador de teste
  // como client_id fictício só pra satisfazer a constraint; não afeta o teste.
  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const { data: call, error } = await admin
    .from('service_calls')
    .insert({
      client_id: clientId,
      provider_id: providerId,
      service_id: service.id,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: totalPrice - platformFee,
      neighborhood: 'Setor Central',
      client_address: `[TESTE RECONEXAO REALTIME] ${label}`,
      client_location: 'POINT(-50.9264 -17.7943)',
      status: 'searching',
    })
    .select('id')
    .single();
  if (error || !call) throw new Error(`Falha ao inserir chamado de teste (${label}): ${error?.message}`);
  createdCallIds.push(call.id);
  return call.id;
}

async function cleanup() {
  log('\n🧹 Limpando dados de teste...');
  try {
    await subscriber.removeAllChannels();
  } catch {
    /* ignorado */
  }

  let anyBlocked = false;
  for (const callId of createdCallIds) {
    const { error } = await admin.from('service_calls').delete().eq('id', callId);
    if (error) {
      anyBlocked = true;
      if (!/imutável|immutable|service_audit_logs/i.test(error.message)) {
        console.warn(`  ⚠ Não consegui apagar o chamado de teste ${callId}: ${error.message}`);
      }
    }
  }

  const leftoverIds = [];
  for (const id of createdUserIds) {
    if (anyBlocked) {
      leftoverIds.push(id);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) leftoverIds.push(id);
  }

  if (anyBlocked) {
    log(`   ℹ INSERT nos chamados de teste gerou registros permanentes em service_audit_logs`);
    log(`     (append-only, por design). Ficam marcados "[TESTE RECONEXAO REALTIME]":`);
    for (const id of createdCallIds) log(`       - service_calls.id       = ${id}`);
    for (const id of leftoverIds) log(`       - profiles/auth.users.id = ${id}`);
  } else {
    log('   Limpeza concluída — nenhum dado de teste ficou para trás.');
  }
}

async function run() {
  log('🏁 Teste de reconexão do Supabase Realtime (postgres_changes)');
  log(`   Projeto Supabase: ${SUPABASE_URL}`);

  log('\n👤 Criando cliente e prestador de teste (prestador online, gateway conectado, localização válida)...');
  clientId = await createTestUser('client');
  providerId = await createTestUser('provider');
  log(`   client_id = ${clientId}`);
  log(`   provider_id = ${providerId}`);

  const receivedEvents = [];

  // Assina exatamente como app/painel/page.tsx: filtro por provider_id, event '*'
  log('\n📡 Assinando canal Realtime (mesmo filtro usado em app/painel/page.tsx)...');
  const channel = subscriber
    .channel(`provider-calls-${providerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_calls', filter: `provider_id=eq.${providerId}` },
      (payload) => {
        receivedEvents.push({ id: payload.new?.id, eventType: payload.eventType, at: Date.now() });
        log(`   📨 Evento recebido: ${payload.eventType} call=${payload.new?.id}`);
      }
    );

  await new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Falha ao inscrever: ${status}`));
    });
  });
  log('   ✅ Canal SUBSCRIBED.');

  // Prova de vida: insere ANTES da queda, confirma que chega normalmente
  log('\n1️⃣  Inserindo chamado ANTES da queda (prova de vida do canal)...');
  const beforeOutageCallId = await insertTestCall('antes da queda');
  await sleep(2500);
  const gotBefore = receivedEvents.some((e) => e.id === beforeOutageCallId);
  log(`   Evento recebido antes da queda? ${gotBefore ? 'sim' : 'não'}`);

  // Derruba a conexão — equivalente a perder sinal / trocar de rede / app em segundo plano
  log(`\n2️⃣  Derrubando a conexão Realtime (realtime.disconnect())...`);
  await subscriber.realtime.disconnect();
  log(`   Conexão derrubada. Aguardando ${OUTAGE_MS}ms "sem sinal"...`);

  // ENQUANTO DESCONECTADO: um chamado é atribuído a este prestador
  log('\n3️⃣  Inserindo chamado ENQUANTO desconectado (simula atribuição durante a queda)...');
  const duringOutageCallId = await insertTestCall('durante a queda');
  await sleep(OUTAGE_MS);

  // Reconecta — equivalente ao celular recuperar o sinal
  log('\n4️⃣  Reconectando (realtime.connect())...');
  subscriber.realtime.connect();

  // Espera o canal voltar a SUBSCRIBED (ou timeout)
  const reconnected = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 10000);
    const check = setInterval(() => {
      if (channel.state === 'joined') {
        clearInterval(check);
        clearTimeout(timeout);
        resolve(true);
      }
    }, 200);
  });
  log(`   Canal voltou a SUBSCRIBED? ${reconnected ? 'sim' : 'não (timeout de 10s)'}`);

  // Dá um tempo extra pro evento perdido chegar, se é que vai chegar
  await sleep(4000);
  const gotDuringOutage = receivedEvents.some((e) => e.id === duringOutageCallId);
  log(`   Evento do chamado inserido DURANTE a queda chegou depois de reconectar? ${gotDuringOutage ? 'sim' : 'não'}`);

  // Prova que a reconexão funciona de verdade: um evento DEPOIS de reconectado deve chegar
  log('\n5️⃣  Inserindo chamado DEPOIS de reconectado (prova que o canal voltou a funcionar)...');
  const afterReconnectCallId = await insertTestCall('depois de reconectar');
  await sleep(3000);
  const gotAfterReconnect = receivedEvents.some((e) => e.id === afterReconnectCallId);
  log(`   Evento recebido depois de reconectar? ${gotAfterReconnect ? 'sim' : 'não'}`);

  log('\n📊 Resumo:');
  log(`   1. Evento antes da queda (prova de vida):         ${gotBefore ? '✅ recebido' : '❌ não recebido'}`);
  log(`   2. Canal voltou a SUBSCRIBED após disconnect/connect: ${reconnected ? '✅ sim' : '❌ não'}`);
  log(`   3. Evento perdido durante a queda foi recuperado:  ${gotDuringOutage ? '⚠️  sim (inesperado)' : '❌ não (esperado)'}`);
  log(`   4. Evento pós-reconexão chegou normalmente:        ${gotAfterReconnect ? '✅ sim' : '❌ não'}`);

  const realtimeReconnectsButDoesNotBackfill =
    gotBefore && reconnected && !gotDuringOutage && gotAfterReconnect;

  if (realtimeReconnectsButDoesNotBackfill) {
    log('\n✅ CONFIRMADO — o Realtime reconecta e volta a entregar eventos normalmente, mas');
    log('   NÃO faz replay de eventos perdidos durante a queda. Um chamado atribuído nesse');
    log('   intervalo só é visto pelo prestador se algo além do Realtime buscar o estado');
    log('   atual depois — exatamente o papel que o polling de 3s/4s cumpre hoje.');
    log('   → O polling NÃO é redundância descartável: é a única rede de segurança contra');
    log('     esse gap real e mensurável do Realtime.');
  } else if (gotDuringOutage) {
    log('\n⚠️  INESPERADO — o evento perdido durante a queda chegou depois de reconectar.');
    log('   Reavaliar a suposição antes de decidir sobre o polling.');
    process.exitCode = 1;
  } else {
    log('\n❌ Reconexão não se comportou como esperado (ver detalhes acima) — investigar antes de mexer no polling.');
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Erro no teste de reconexão:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    process.exit(process.exitCode || 0);
  });
