-- Migration: Exigência Obrigatória de Mercado Pago Conectado para Prestadores Ficarem Online
-- Data: 2026-09-11
-- Autor: Repara RV

-- 1. Sanitiza prestadores que porventura estejam online sem subconta vinculada
UPDATE provider_status 
SET is_online = FALSE 
WHERE recipient_gateway_id IS NULL OR TRIM(recipient_gateway_id) = '';

-- 2. Atualiza a função de busca do radar (PostGIS) para filtrar estritamente prestadores com subconta ativa
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
  WHERE ps.is_online = TRUE
    AND ps.recipient_gateway_id IS NOT NULL
    AND TRIM(ps.recipient_gateway_id) <> ''
    AND ps.current_location IS NOT NULL
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

-- 3. Trigger para garantir integridade a nível de banco de dados
CREATE OR REPLACE FUNCTION check_provider_online_gateway()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_online = TRUE AND (NEW.recipient_gateway_id IS NULL OR TRIM(NEW.recipient_gateway_id) = '') THEN
    RAISE EXCEPTION 'Para ficar online e receber chamados, o prestador precisa conectar sua conta do Mercado Pago.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_provider_online_gateway ON provider_status;
CREATE TRIGGER trg_check_provider_online_gateway
  BEFORE INSERT OR UPDATE OF is_online, recipient_gateway_id ON provider_status
  FOR EACH ROW
  EXECUTE FUNCTION check_provider_online_gateway();
