-- ============================================================
-- REPARA RV — Reset Geral de Testes & Ativação de Split por Chave Pix
-- Data: 2026-09-12
-- ============================================================
-- JÁ APLICADO EM 12/09/2026 — NÃO RODAR DE NOVO. Desliga a proteção do log de
-- auditoria, apaga TODOS os chamados, mensagens, alertas e o próprio log, e
-- aprova todos os prestadores (desfaz a verificação de identidade). O bloco
-- abaixo aborta o script se ele for colado no SQL Editor.
DO $$ BEGIN
  RAISE EXCEPTION '20260912_reset_database_for_testing.sql já foi aplicado e apaga todos os chamados — não rode de novo';
END $$;

-- 1. Desativa temporariamente o trigger de imutabilidade para limpar chamados de teste
ALTER TABLE service_audit_logs DISABLE TRIGGER trigger_prevent_audit_logs_mutation;

-- 2. Limpa todos os dados operacionais de testes anteriores
DELETE FROM call_messages;
DELETE FROM emergency_alerts;
DELETE FROM service_audit_logs;
DELETE FROM service_calls;

-- 3. Reativa a proteção de imutabilidade dos logs de auditoria
ALTER TABLE service_audit_logs ENABLE TRIGGER trigger_prevent_audit_logs_mutation;

-- 4. Zera contadores de pedidos nos perfis e garante status aprovado
UPDATE profiles 
SET completed_orders_count = 0,
    background_check_status = 'approved';

-- 5. Remove o bloqueio de Mercado Pago para ficar online
DROP TRIGGER IF EXISTS trg_check_provider_online_gateway ON provider_status;
DROP FUNCTION IF EXISTS check_provider_online_gateway();

-- 6. Atualiza a busca de prestadores no radar (PostGIS)
-- Exige apenas: is_online = true, localização, chave Pix e não bloqueado
CREATE OR REPLACE FUNCTION find_nearest_provider(
  call_location GEOMETRY(Point, 4326),
  excluded_ids  UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  nearest_provider_id UUID;
BEGIN
  SELECT ps.provider_id INTO nearest_provider_id
  FROM provider_status ps
  JOIN profiles p ON p.id = ps.provider_id
  WHERE ps.is_online = TRUE
    AND ps.current_location IS NOT NULL
    AND ps.pix_key IS NOT NULL
    AND TRIM(ps.pix_key) <> ''
    AND p.is_blocked = FALSE
    AND NOT (ps.provider_id = ANY(excluded_ids))
    AND NOT EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.provider_id = ps.provider_id
        AND sc.status IN ('accepted', 'on_the_way', 'in_progress')
    )
  ORDER BY ps.current_location <-> call_location
  LIMIT 1;

  RETURN nearest_provider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
