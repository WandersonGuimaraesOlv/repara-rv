-- ============================================================
-- REPARA RV — Migration: Split Ágil por Chave Pix (Elimina trava de Mercado Pago)
-- Data: 2026-09-12
-- ============================================================

-- 1. Remove a trigger e função que bloqueavam is_online sem gateway Mercado Pago
DROP TRIGGER IF EXISTS trg_check_provider_online_gateway ON provider_status;
DROP FUNCTION IF EXISTS check_provider_online_gateway();

-- 2. Atualiza a busca do prestador mais próximo (PostGIS)
-- Exige apenas: is_online = true, localização ativa, chave Pix e não bloqueado
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

-- 3. Força atualização do cache do schema PostgREST
NOTIFY pgrst, 'reload schema';
