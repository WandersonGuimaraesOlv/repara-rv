#!/usr/bin/env node
// =============================================================================
// scripts/diagnose-skip-race.mjs
// Diagnóstico pontual pra entender por que find_nearest_provider() não achou
// nenhum dos 10 prestadores de teste (todos online, com gateway e localização)
// criados por test-skip-provider-race.mjs — eles ficaram permanentes no banco
// (imutabilidade do service_audit_logs), então dá pra inspecionar direto sem
// recriar nada.
//
// Rodar: node --env-file=.env.local --env-file=.dev.vars scripts/diagnose-skip-race.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// IDs impressos no relatório de limpeza da última rodada (permanentes no banco)
const LEFTOVER_PROVIDER_IDS = [
  '4f7ba67b-ebf8-4022-a17c-8ae9fd98ace7', // "atual" do chamado
  '0482c5e5-df92-4a84-a346-4b0cfc950831',
  '6b07cca1-0b92-49d5-8051-cea71207fefd',
  '1127ffde-1394-476b-bc13-0407ba57d31c',
  'd067ab96-67ef-4059-8401-ab6c3c1d8893',
  'b2b64fa3-f33c-4f96-8cc8-7e52b8f0cb94',
  '89128ca7-41ad-4230-a438-abc7e80e623c',
  '2da95034-6002-42f4-98bd-28be4eda080b',
  'f0ab1d78-8b08-41ab-a87b-ed431f2ffea7',
  '98dfb044-59e4-4e8d-8418-69c223d666ee',
  'd17eae31-785b-4edc-844e-43a9230f734b',
];
const CALL_ID = '5252e6d7-8864-4bdd-a8b4-f3be4b7a4cc8';

async function main() {
  console.log('1) Estado bruto de provider_status pros 11 prestadores de teste:');
  const { data: rows, error: rowsErr } = await admin
    .from('provider_status')
    .select('provider_id, is_online, recipient_gateway_id, current_location, pix_key, updated_at')
    .in('provider_id', LEFTOVER_PROVIDER_IDS);
  if (rowsErr) {
    console.error('   ❌ Erro ao ler provider_status:', rowsErr.message);
  } else {
    rows.forEach((r) => {
      console.log(`   - ${r.provider_id.slice(0, 8)}  online=${r.is_online}  gateway="${r.recipient_gateway_id}"  location=${JSON.stringify(r.current_location)}`);
    });
    console.log(`   Total de linhas encontradas: ${rows.length} (esperado: ${LEFTOVER_PROVIDER_IDS.length})`);
  }

  console.log('\n2) Estado do chamado de teste (client_location bruto, como o route.ts vai ler):');
  const { data: call, error: callErr } = await admin
    .from('service_calls')
    .select('id, status, provider_id, client_location, cancel_metadata')
    .eq('id', CALL_ID)
    .single();
  if (callErr) {
    console.error('   ❌ Erro ao ler o chamado:', callErr.message);
  } else {
    console.log(`   status=${call.status}  provider_id=${call.provider_id}`);
    console.log(`   client_location = ${JSON.stringify(call.client_location)}`);
    console.log(`   cancel_metadata = ${JSON.stringify(call.cancel_metadata)}`);
  }

  console.log('\n3) Chamando find_nearest_provider() diretamente via RPC, com o client_location LIDO do banco (exatamente como a rota faz):');
  if (call?.client_location) {
    const { data: found1, error: err1 } = await admin.rpc('find_nearest_provider', {
      call_location: call.client_location,
      excluded_ids: [],
    });
    console.log(`   Resultado: ${found1 ?? 'null'}${err1 ? `  ❌ ERRO: ${err1.message}` : ''}`);
  }

  console.log('\n4) Chamando find_nearest_provider() com client_location em WKT puro (texto fixo, mesmo formato usado na criação do chamado):');
  const { data: found2, error: err2 } = await admin.rpc('find_nearest_provider', {
    call_location: 'POINT(-50.9264 -17.7943)',
    excluded_ids: [],
  });
  console.log(`   Resultado: ${found2 ?? 'null'}${err2 ? `  ❌ ERRO: ${err2.message}` : ''}`);

  console.log('\n5) Mesma chamada, mas excluindo só o prestador "atual" (como a 1ª tentativa real fez):');
  const { data: found3, error: err3 } = await admin.rpc('find_nearest_provider', {
    call_location: 'POINT(-50.9264 -17.7943)',
    excluded_ids: ['4f7ba67b-ebf8-4022-a17c-8ae9fd98ace7'],
  });
  console.log(`   Resultado: ${found3 ?? 'null'}${err3 ? `  ❌ ERRO: ${err3.message}` : ''}`);
}

main().catch((err) => {
  console.error('💥 Erro no diagnóstico:', err);
  process.exitCode = 1;
});
