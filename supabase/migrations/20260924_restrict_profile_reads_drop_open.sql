-- =============================================================================
-- Migration: 20260924_restrict_profile_reads_drop_open  (PASSO 2 de 2 — rodar DEPOIS do deploy)
-- Descrição: Tira a política que deixava qualquer pessoa logada ler o perfil
--            (CPF, telefone, e-mail) de todo mundo — achado A5. Depois do
--            passo 1 (20260924_restrict_profile_reads.sql) e do deploy que
--            passa a usar call_party_profiles(), ficam só: o próprio perfil,
--            admin vê todos.
--
--            ⚠️ Se supabase/schema.sql for rodado de novo, esta política
--            volta — foi o que aconteceu em 22/09/2026.
-- =============================================================================

DROP POLICY IF EXISTS "Perfis visíveis para usuários autenticados" ON profiles;

NOTIFY pgrst, 'reload schema';
