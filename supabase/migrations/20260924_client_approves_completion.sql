-- =============================================================================
-- Migration: 20260924_client_approves_completion
-- Descrição: Pedido do dono (24/09/2026): o cliente confere e aprova o serviço
--            ANTES de o Pix aparecer (evita fraude: "o serviço não ficou
--            bacana" e o cliente já tinha que pagar). E o técnico só vai embora
--            depois do pagamento. Nada aprova sozinho.
--
--            Fluxo novo:
--              in_progress → (técnico conclui) → awaiting_approval
--              awaiting_approval → (cliente aprova) → completed → Pix
--              awaiting_approval → (cliente aponta problema) → in_progress
--            Em impasse, o admin aprova pelo cliente ou cancela
--            (app/actions/admin-calls.ts).
--
--            - ride_status ganha 'awaiting_approval'.
--            - service_calls ganha as colunas da conferência.
--            - find_nearest_provider passa a tratar como ocupado o técnico
--              esperando a conferência ou o pagamento (ele continua no local).
--              O pagamento pendente só segura o técnico por 1 h depois da
--              aprovação — se o cliente não pagar, o técnico volta a receber
--              chamados (a cobrança continua com o cliente).
--
--            Aditiva: roda ANTES do deploy do código. Idempotente.
--            Rodar em staging (rahjxxalusylxdknuiqq) e depois em produção
--            (lvjahufllclmkqcbbrcu).
-- =============================================================================

-- 1. Status novo (fica entre in_progress e completed)
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'awaiting_approval' BEFORE 'completed';

-- 2. Colunas da conferência — só o servidor grava (service role)
ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completion_issue TEXT,
  ADD COLUMN IF NOT EXISTS completion_issue_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN service_calls.completion_requested_at IS
  'Quando o técnico tocou em Concluir pela última vez (status awaiting_approval).';
COMMENT ON COLUMN service_calls.completion_approved_at IS
  'Quando a conclusão foi aprovada — pelo cliente ou por um admin (completion_approved_by).';
COMMENT ON COLUMN service_calls.completion_issue IS
  'Último problema apontado pelo cliente na conferência (o chamado volta pra in_progress).';
COMMENT ON COLUMN service_calls.completion_issue_count IS
  'Quantas vezes o cliente apontou problema na conferência deste chamado.';

-- 3. Técnico esperando conferência/pagamento não recebe outro chamado.
--    Mesma função de produção (lida em 24/09/2026), só muda o NOT EXISTS.
CREATE OR REPLACE FUNCTION public.find_nearest_provider(call_location geometry, excluded_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
        AND (
          sc.status::text IN ('accepted', 'on_the_way', 'in_progress', 'awaiting_approval')
          OR (
            sc.status = 'completed'
            AND sc.payment_status = 'pending'
            AND sc.completed_at > NOW() - INTERVAL '1 hour'
          )
        )
    )
  ORDER BY ps.current_location <-> call_location
  LIMIT 1;

  RETURN nearest_provider_id;
END;
$function$;

-- Mesma trava de permissão de antes (só service_role executa)
REVOKE EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) TO service_role;

NOTIFY pgrst, 'reload schema';
