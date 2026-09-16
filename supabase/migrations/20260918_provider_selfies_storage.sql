-- =============================================================================
-- Migration: 20260918_provider_selfies_storage
-- Descrição: Bucket privado do Supabase Storage pra selfie de verificação do
--            prestador (Parte 1 do plano de identidade). Documentado à parte
--            de 20260918_provider_identity_verification.sql porque mexe em
--            storage.buckets/storage.objects, não numa tabela comum do
--            schema público — mesmo commit, arquivo separado.
--
--            Confirmado antes de escrever isto: o projeto NUNCA usou Supabase
--            Storage até agora (grep no repositório inteiro não encontra
--            nenhuma referência a supabase.storage) — este é o primeiro
--            bucket criado.
--
--            Sem política nenhuma pra 'anon'/'authenticated' de propósito: o
--            upload (app/api/profile/selfie/route.ts) e qualquer leitura
--            (URL assinada gerada sob demanda) vão passar sempre pela Service
--            Role no servidor, nunca por escrita/leitura direta do
--            navegador — mesmo tratamento dado à tabela identity_reports na
--            outra migration deste commit.
--
--            storage.objects já vem com RLS habilitado por padrão em todo
--            projeto Supabase, e o SQL Editor não tem permissão de dono pra
--            alterar isso mesmo se quisesse (ERRO 42501 confirmado ao
--            tentar) — não precisa (e não dá pra) mexer nisso aqui.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-selfies', 'provider-selfies', false)
ON CONFLICT (id) DO NOTHING;
