-- ============================================================
-- Migration: Blindagem Anti-Auto-Atribuição
-- Regra de Negócio: O cliente que abre o chamado JAMAIS pode
-- ser o prestador que o executa, mesmo que ambos os cadastros
-- existam no mesmo user_id (conta dual role).
--
-- Criado em: 2026-09-13
-- Impacto: Segurança de atribuição de chamados
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASSO 0: Corrige dados históricos inválidos ANTES do constraint
--
-- Chamados onde client_id = provider_id são o bug que estamos
-- corrigindo. Resetamos o provider_id para NULL e voltamos o
-- status para 'queued' para que o sistema encontre um técnico
-- diferente para esses chamados.
-- ──────────────────────────────────────────────────────────────
UPDATE service_calls
SET
  provider_id = NULL,
  status      = CASE
                  WHEN status IN ('completed', 'cancelled') THEN status
                  ELSE 'queued'
                END,
  updated_at  = NOW()
WHERE client_id = provider_id;


-- ──────────────────────────────────────────────────────────────
-- PASSO 1: Atualiza find_nearest_provider para aceitar p_client_id
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_nearest_provider(
  call_location   GEOMETRY,
  excluded_ids    UUID[]  DEFAULT '{}',
  p_client_id     UUID    DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  SELECT ps.provider_id
  INTO   v_provider_id
  FROM   provider_status ps
  JOIN   profiles p ON p.id = ps.provider_id
  WHERE  ps.is_online  = TRUE
    AND  ps.location   IS NOT NULL
    AND  p.is_blocked  = FALSE
    AND  p.pix_key     IS NOT NULL
    AND  TRIM(p.pix_key) <> ''
    AND  ps.provider_id <> ALL(COALESCE(excluded_ids, '{}'))
    AND  ps.provider_id IS DISTINCT FROM p_client_id
    AND  ST_DWithin(
           ps.location,
           call_location::geography,
           25000
         )
  ORDER BY ps.location <-> call_location
  LIMIT 1;

  RETURN v_provider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────────────────────────
-- PASSO 2: Constraint CHECK — agora seguro pois PASSO 0 limpou
--          todas as linhas inválidas.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE service_calls
  DROP CONSTRAINT IF EXISTS chk_client_ne_provider;

ALTER TABLE service_calls
  ADD CONSTRAINT chk_client_ne_provider
  CHECK (
    provider_id IS NULL
    OR client_id <> provider_id
  );

COMMENT ON CONSTRAINT chk_client_ne_provider ON service_calls IS
  'Regra de negócio absoluta: o cliente que abre o chamado jamais '
  'pode ser o prestador que o executa. Dados históricos corrigidos no PASSO 0.';


-- ──────────────────────────────────────────────────────────────
-- PASSO 3: Recarga do cache PostgREST
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
