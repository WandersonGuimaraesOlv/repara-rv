-- =============================================================================
-- Migration: 20260923_call_route_cache  (rodar ANTES do deploy)
-- Descrição: Rota do técnico até o cliente + tempo estimado no mapa de
--            acompanhamento (pedido do dono, 23/09/2026), calculados pela
--            Google Routes API em /api/calls/tracking. Cada cálculo é cobrado
--            pelo Google, então a última rota de cada chamado fica guardada
--            aqui e só é recalculada quando o técnico andou ou o tempo passou
--            (lib/tracking.ts::shouldRecomputeRoute) — cliente e técnico
--            olhando o mesmo chamado usam a mesma rota.
--
--            Só o servidor (Service Role) lê e grava: sem política pra
--            anon/authenticated.
-- =============================================================================

CREATE TABLE IF NOT EXISTS call_route_cache (
  call_id          UUID PRIMARY KEY REFERENCES service_calls(id) ON DELETE CASCADE,
  origin_lat       DOUBLE PRECISION NOT NULL,
  origin_lng       DOUBLE PRECISION NOT NULL,
  -- NULL = a última tentativa falhou (a rota espera antes de tentar de novo)
  encoded_polyline TEXT,
  duration_seconds INT,
  distance_meters  INT,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_route_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON call_route_cache FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
