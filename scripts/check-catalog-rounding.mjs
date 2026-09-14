#!/usr/bin/env node
// =============================================================================
// scripts/check-catalog-rounding.mjs
// Camada 8, item i3 do plano de validação: confere, contra o catálogo REAL
// (não um fixture), que provider_cut = total_price - platform_fee bate
// exatamente (sem erro de ponto flutuante) e que nenhum serviço fere o piso
// de remuneração de R$ 50,00 líquidos ao prestador (AGENTS.md seção 2).
//
// provider_cut não é armazenado em quick_services — é calculado em cada
// lugar que cria um service_call (app/api/calls/create/route.ts) a partir de
// total_price e platform_fee do catálogo. Este script recalcula a mesma
// conta pra cada serviço do catálogo e verifica a consistência ali, na
// origem, antes de qualquer chamado ser criado.
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local scripts/check-catalog-rounding.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MIN_PROVIDER_CUT = 50;

// Arredondamento bancário pra 2 casas decimais, evitando erro de ponto
// flutuante binário (ex: 0.1 + 0.2 !== 0.3) — mesma técnica que qualquer
// código de dinheiro sério precisa usar.
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function run() {
  console.log('🏁 Conferindo arredondamento e piso de R$50 em todo o catálogo (quick_services)');
  console.log(`   Projeto Supabase: ${SUPABASE_URL}`);

  const { data: services, error } = await admin
    .from('quick_services')
    .select('id, name, category, fixed_price, platform_fee, is_active')
    .order('name');

  if (error) throw new Error(`Falha ao buscar catálogo: ${error.message}`);
  if (!services || services.length === 0) throw new Error('Catálogo vazio — nada pra conferir');

  console.log(`\n📋 ${services.length} serviço(s) no catálogo (ativos e inativos):\n`);

  const problems = [];

  for (const s of services) {
    const totalPrice = Number(s.fixed_price);
    const platformFee = Number(s.platform_fee);
    const providerCut = round2(totalPrice - platformFee);

    const flags = [];

    if (!Number.isFinite(totalPrice) || !Number.isFinite(platformFee)) {
      flags.push('fixed_price ou platform_fee não é um número válido');
    }
    if (providerCut < MIN_PROVIDER_CUT) {
      flags.push(`repasse R$ ${providerCut.toFixed(2)} abaixo do piso de R$ ${MIN_PROVIDER_CUT.toFixed(2)}`);
    }
    if (platformFee >= totalPrice) {
      flags.push('taxa da plataforma maior ou igual ao preço total');
    }
    // Confere se fixed_price/platform_fee já vêm com mais de 2 casas decimais
    // no banco (sinal de erro de digitação ou de cálculo anterior malfeito)
    if (Math.round(totalPrice * 100) !== totalPrice * 100) {
      flags.push(`fixed_price com mais de 2 casas decimais: ${totalPrice}`);
    }
    if (Math.round(platformFee * 100) !== platformFee * 100) {
      flags.push(`platform_fee com mais de 2 casas decimais: ${platformFee}`);
    }

    const status = flags.length === 0 ? '✅' : '❌';
    const activeTag = s.is_active ? '' : ' [inativo]';
    console.log(
      `   ${status} ${s.name}${activeTag} — total=R$${totalPrice.toFixed(2)} taxa=R$${platformFee.toFixed(2)} repasse=R$${providerCut.toFixed(2)}`
    );
    for (const f of flags) {
      console.log(`      ⚠ ${f}`);
      problems.push({ service: s.name, id: s.id, issue: f });
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   Serviços conferidos: ${services.length}`);
  console.log(`   Problemas encontrados: ${problems.length}`);

  if (problems.length === 0) {
    console.log('\n✅ PASSOU — provider_cut = total_price - platform_fee bate em todo o catálogo, sem erro de arredondamento, e nenhum serviço fere o piso de R$50.');
  } else {
    console.log('\n❌ FALHOU — ver problemas listados acima.');
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('\n💥 Erro ao conferir o catálogo:', err);
  process.exitCode = 1;
});
