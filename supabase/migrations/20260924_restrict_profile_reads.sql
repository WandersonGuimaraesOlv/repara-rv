-- =============================================================================
-- Migration: 20260924_restrict_profile_reads  (PASSO 1 de 2 — rodar ANTES do deploy)
-- Descrição: Achado A5 do plano de lançamento (confirmado em produção e no
--            staging em 23/09/2026): a política "Perfis visíveis para usuários
--            autenticados" (USING auth.uid() IS NOT NULL) deixava QUALQUER
--            pessoa logada ler CPF, telefone e e-mail de TODOS os usuários.
--
--            O app só precisa ver o perfil de outra pessoa em dois lugares —
--            o cliente vê o técnico (app/acompanhar) e o técnico vê o cliente
--            (app/chamado) — e só nome, foto e selo de verificado. Então:
--            - cada um lê o próprio perfil; admin lê todos (is_admin());
--            - o outro lado do chamado vem de call_party_profiles(), que
--              devolve só esses campos e só depois do aceite (antes do aceite
--              o técnico não vê nem o nome do cliente — regra de privacidade).
--
--            Aditiva: o código em produção hoje continua funcionando depois
--            dela. O passo 2 (20260924_restrict_profile_reads_drop_open.sql)
--            tira a política aberta, depois do deploy do código novo.
-- =============================================================================

-- Admin sem recursão: uma política em profiles não pode consultar profiles
-- (o Postgres acusa recursão infinita). SECURITY DEFINER lê como dono da tabela.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- O outro lado de um chamado: só nome, foto e selo, só para quem é parte do
-- chamado, e só depois do aceite (accepted_at). Admin vê os dois lados.
CREATE OR REPLACE FUNCTION public.call_party_profiles(p_call_id UUID)
RETURNS TABLE (party TEXT, id UUID, full_name TEXT, avatar_url TEXT, background_check_status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN p.id = sc.client_id THEN 'client' ELSE 'provider' END,
    p.id, p.full_name, p.avatar_url, p.background_check_status
  FROM service_calls sc
  JOIN profiles p ON p.id IN (sc.client_id, sc.provider_id)
  WHERE sc.id = p_call_id
    AND (
      public.is_admin()
      OR (
        sc.accepted_at IS NOT NULL
        AND auth.uid() IN (sc.client_id, sc.provider_id)
        AND p.id <> auth.uid()
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.call_party_profiles(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_party_profiles(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Usuário vê o próprio perfil" ON profiles;
CREATE POLICY "Usuário vê o próprio perfil"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin vê todos os perfis" ON profiles;
CREATE POLICY "Admin vê todos os perfis"
  ON profiles FOR SELECT TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
