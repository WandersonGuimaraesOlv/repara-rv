-- =============================================================================
-- Migration: 20260923_final_parity_and_admin_sos_visibility
-- Descrição: Últimos achados da comparação completa produção x staging
--            (23/09/2026), depois das correções anteriores do mesmo dia.
--
--   1. ACHADO REAL, EM PRODUÇÃO: a política de SELECT de emergency_alerts
--      ("Usuários envolvidos podem visualizar seus alertas") estava sem a
--      cláusula de admin que existe nas migrations rastreadas
--      (20260909_emergency_alerts.sql e 20260909_consolidated_migration.sql).
--      Causa provável: supabase/schema.sql, rodado por engano em produção em
--      22/09/2026, recria essa política na versão sem admin. app/(admin)/admin/dashboard/page.tsx
--      lê emergency_alerts com o client comum (lib/supabase/client, sujeito
--      a RLS, não Service Role) — sem a cláusula de admin, a seção
--      "Registro de Incidentes de Segurança" (botão SOS) só mostra alertas
--      onde o próprio admin logado é triggered_by/cliente/prestador, ou
--      seja, na prática sempre vazia pra um admin real. Corrige o mesmo
--      bug que os achados de RLS de hoje mais cedo — política nova nunca
--      substituiu a antiga de fato.
--
--   2. push_subscriptions não tinha o trigger de updated_at em produção
--      (a tabela e a policy existem, só o trigger de touch automático
--      faltava) — cosmético (timestamp fica parado), sem risco, replicando
--      só por completude.
--
--   3. service_calls tinha índices diferentes em cada banco: produção usa
--      um índice mais amplo (status, created_at DESC, sem WHERE) que nunca
--      virou migration; staging só tinha o índice parcial de
--      20260911_add_queued_status_and_expires_at.sql (status='queued').
--      Adiciona os dois lados nos dois bancos — são independentes e nenhum
--      substitui o outro.
-- =============================================================================

-- 1. Admin volta a ver os alertas SOS
DROP POLICY IF EXISTS "Usuários envolvidos podem visualizar seus alertas" ON emergency_alerts;
CREATE POLICY "Usuários envolvidos podem visualizar seus alertas"
  ON emergency_alerts FOR SELECT
  USING (
    auth.uid() = triggered_by
    OR EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.id = emergency_alerts.call_id
        AND (sc.client_id = auth.uid() OR sc.provider_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 2. Trigger de updated_at em push_subscriptions
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- 3. Índice amplo de service_calls (status, created_at) — complementa o
--    parcial de 'queued', não substitui.
CREATE INDEX IF NOT EXISTS idx_service_calls_status_created
  ON service_calls (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_calls_queued
  ON service_calls (status, created_at DESC)
  WHERE status = 'queued';

NOTIFY pgrst, 'reload schema';
