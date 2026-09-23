-- =============================================================================
-- Migration: 20260923_staging_parity_hand_applied_hardening
-- Descrição: Captura em migration, pela primeira vez, um conjunto de
--            reforços de segurança que existiam só em produção — aplicados à
--            mão no SQL Editor ao longo do tempo, nunca antes salvos em
--            arquivo. Achado comparando produção com uma reconstrução fiel
--            do schema a partir das migrations rastreadas (23/09/2026).
--
--            1. protect_sensitive_profile_fields(): trigger em profiles que
--               impede qualquer sessão que não seja service_role de alterar
--               is_blocked, background_check_status, rating_avg,
--               completed_orders_count, mercado_pago_connected — defesa em
--               profundidade contra um usuário se auto-aprovar/desbloquear
--               escrevendo direto via client Supabase.
--
--            2. rls_auto_enable() + event trigger ensure_rls: toda tabela
--               nova criada no schema public tem RLS habilitado
--               automaticamente, mesmo que a migration que a criou esqueça
--               do ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
--
--            3. Conjunto de políticas RLS mais granulares em profiles,
--               quick_services, service_calls e service_ratings, que
--               substituíam na prática (via política adicional, nunca um
--               ALTER/DROP+CREATE da política original) as políticas amplas
--               de schema.sql. Nomes e condições exatas capturados por
--               introspecção direta de produção.
-- =============================================================================

-- 1. Proteção de campos sensíveis em profiles ---------------------------------
CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.is_blocked := OLD.is_blocked;
    NEW.background_check_status := OLD.background_check_status;
    NEW.rating_avg := OLD.rating_avg;
    NEW.completed_orders_count := OLD.completed_orders_count;
    NEW.mercado_pago_connected := OLD.mercado_pago_connected;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_sensitive_profile_fields();

-- 2. RLS automático em toda tabela nova ---------------------------------------
CREATE OR REPLACE FUNCTION rls_auto_enable()
RETURNS event_trigger AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog';

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION rls_auto_enable();

-- 3. Políticas RLS granulares --------------------------------------------------

DROP POLICY IF EXISTS "Perfis visíveis para usuários autenticados" ON profiles;
CREATE POLICY "Perfis visíveis para usuários autenticados"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin gerencia catálogo" ON quick_services;
CREATE POLICY "Admin gerencia catálogo"
  ON quick_services FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "Serviços ativos visíveis a todos autenticados" ON quick_services;
CREATE POLICY "Serviços ativos visíveis a todos autenticados"
  ON quick_services FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin vê tudo" ON service_calls;
CREATE POLICY "Admin vê tudo"
  ON service_calls FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "Cliente cancela chamado em 'searching'" ON service_calls;
CREATE POLICY "Cliente cancela chamado em 'searching'"
  ON service_calls FOR UPDATE
  USING (auth.uid() = client_id AND status = 'searching'::ride_status);

DROP POLICY IF EXISTS "Cliente cria chamados" ON service_calls;
CREATE POLICY "Cliente cria chamados"
  ON service_calls FOR INSERT
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Cliente vê seus próprios chamados" ON service_calls;
CREATE POLICY "Cliente vê seus próprios chamados"
  ON service_calls FOR SELECT
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Prestador atualiza chamados aceitos por ele" ON service_calls;
CREATE POLICY "Prestador atualiza chamados aceitos por ele"
  ON service_calls FOR UPDATE
  USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Prestador vê chamados atribuídos a ele" ON service_calls;
CREATE POLICY "Prestador vê chamados atribuídos a ele"
  ON service_calls FOR SELECT
  USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Cliente avalia seu próprio chamado" ON service_ratings;
CREATE POLICY "Cliente avalia seu próprio chamado"
  ON service_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.id = service_ratings.call_id
        AND sc.client_id = auth.uid()
        AND sc.status = 'completed'::ride_status
    )
  );

NOTIFY pgrst, 'reload schema';
