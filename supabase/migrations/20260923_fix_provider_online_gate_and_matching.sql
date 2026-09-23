-- =============================================================================
-- Migration: 20260923_fix_provider_online_gate_and_matching
-- Descrição: Achado em 23/09/2026 ao comparar produção com uma reconstrução
--            fiel do schema a partir das migrations rastreadas: o trigger que
--            exige conta Mercado Pago conectada (check_provider_online_gateway
--            / trg_check_provider_online_gateway) nunca foi removido de fato
--            em produção, mesmo a migration 20260912_allow_online_with_pix_key_only.sql
--            tendo o DROP TRIGGER/DROP FUNCTION correspondente — e o
--            find_nearest_provider que roda em produção hoje é a versão MAIS
--            ANTIGA de todas (schema.sql/20260911), que também exige
--            recipient_gateway_id, não pix_key.
--
--            Sintoma real, confirmado com dados de produção: existe hoje 1
--            prestador com Chave Pix cadastrada e sem Mercado Pago conectado.
--            Se ele tentar "Ficar Online", o UPDATE em provider_status é
--            recusado pelo trigger (RAISE EXCEPTION) — mas
--            app/painel/page.tsx não checa o retorno da escrita, então a tela
--            mostraria "Online" com o banco tendo rejeitado a mudança:
--            prestador nunca apareceria pro radar, sem nenhum erro visível.
--
--            Achado colateral: mesmo a migration 20260918_provider_identity_verification.sql
--            (mais recente) redefiniu find_nearest_provider ainda exigindo
--            recipient_gateway_id em vez de pix_key — regressão não
--            intencional daquela migration, não só drift de produção. Esta
--            migration corrige a fonte: junta a exigência de Pix (2026-09-12)
--            com a de antecedentes aprovados (2026-09-18) na mesma função, e
--            remove de vez o gate de Mercado Pago.
-- =============================================================================

-- 1. Remove o gate de Mercado Pago (Pix é a via oficial desde 12/09/2026)
DROP TRIGGER IF EXISTS trg_check_provider_online_gateway ON provider_status;
DROP FUNCTION IF EXISTS check_provider_online_gateway();

-- 2. find_nearest_provider correto: exige Pix (não gateway), não bloqueado,
--    antecedentes aprovados — mesma assinatura de sempre (call_location,
--    excluded_ids), CREATE OR REPLACE não quebra as chamadas existentes em
--    app/api/calls/create e app/api/calls/skip-provider.
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
    AND ps.pix_key IS NOT NULL
    AND TRIM(ps.pix_key) <> ''
    AND ps.current_location IS NOT NULL
    AND p.is_blocked = FALSE
    AND p.background_check_status = 'approved'
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

-- 3. Como só a Service Role deve executar isso (ver migration 20260921),
--    reaplica a mesma trava de permissão pra essa redefinição não reabrir
--    execução pública por engano.
REVOKE EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) TO service_role;

NOTIFY pgrst, 'reload schema';
