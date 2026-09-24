-- =============================================================================
-- Migration: 20260924_payouts_warranty_ops_alerts
-- Descrição: Três pedidos do dono (24/09/2026), num SQL só:
--   1. Controle do repasse manual (plano de maturação §10): quando o Pix foi
--      confirmado (paid_at) e quando/quem/quanto foi repassado ao técnico.
--      O Contrato promete o repasse em até 48 h depois da confirmação.
--   2. Garantia pelo app (Termos: 7 dias corridos, serviço concluído e pago):
--      tabela warranty_claims. Só o servidor grava; cliente e técnico leem as
--      suas.
--   3. Alertas de erro por e-mail sem lotar a caixa: ops_alerts + a função
--      claim_ops_alert (no máximo 1 e-mail por tipo de erro a cada N minutos).
--   4. SOS resolvido no painel: quando e quem encerrou.
--   + protect_service_call_financials passa a proteger também os campos de
--     pagamento, repasse e conferência (só o servidor grava).
--
-- Aditiva: roda ANTES do deploy do código. Idempotente.
-- Rodar em staging (rahjxxalusylxdknuiqq) e depois em produção
-- (lvjahufllclmkqcbbrcu).
-- =============================================================================

-- ── 1. Repasse manual ────────────────────────────────────────────────────────
ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payout_reference TEXT;

COMMENT ON COLUMN service_calls.paid_at IS 'Quando o pagamento do serviço foi confirmado (webhook ou admin).';
COMMENT ON COLUMN service_calls.payout_at IS 'Quando a equipe fez o repasse manual por Pix ao técnico.';
COMMENT ON COLUMN service_calls.payout_amount IS 'Valor repassado (cópia do provider_cut no momento do repasse).';
COMMENT ON COLUMN service_calls.payout_reference IS 'Referência do Pix de repasse (ID da transação ou observação).';

-- Chamados já pagos antes desta coluna: melhor data disponível
UPDATE service_calls
SET paid_at = COALESCE(completed_at, updated_at)
WHERE payment_status = 'paid' AND paid_at IS NULL;

-- ── 2. Garantia ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranty_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES profiles(id),
  provider_id     UUID REFERENCES profiles(id),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uma garantia aberta por chamado
CREATE UNIQUE INDEX IF NOT EXISTS warranty_claims_one_open_per_call
  ON warranty_claims (call_id) WHERE status = 'open';

ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cliente vê as garantias que acionou" ON warranty_claims;
CREATE POLICY "Cliente vê as garantias que acionou"
  ON warranty_claims FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Técnico vê as garantias dos seus chamados" ON warranty_claims;
CREATE POLICY "Técnico vê as garantias dos seus chamados"
  ON warranty_claims FOR SELECT TO authenticated
  USING (auth.uid() = provider_id);

-- Sem política de INSERT/UPDATE: quem grava é o servidor
-- (app/api/calls/warranty e as ações de admin), com as regras dos Termos.

-- ── 3. Alertas de erro com limite de envio ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_alerts (
  alert_key        TEXT PRIMARY KEY,
  last_sent_at     TIMESTAMPTZ NOT NULL,
  suppressed_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só o servidor.

-- TRUE = pode mandar o e-mail agora (e marca o envio); FALSE = já mandou um
-- desse tipo na janela e só conta a ocorrência.
CREATE OR REPLACE FUNCTION public.claim_ops_alert(p_key TEXT, p_window_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  INSERT INTO ops_alerts (alert_key, last_sent_at)
  VALUES (p_key, NOW())
  ON CONFLICT (alert_key) DO UPDATE
    SET last_sent_at = NOW(), suppressed_count = 0
    WHERE ops_alerts.last_sent_at < NOW() - make_interval(mins => p_window_minutes)
  RETURNING TRUE INTO claimed;

  IF claimed IS NULL THEN
    UPDATE ops_alerts SET suppressed_count = suppressed_count + 1 WHERE alert_key = p_key;
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_ops_alert(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ops_alert(TEXT, INTEGER) TO service_role;

-- ── 4. SOS resolvido ─────────────────────────────────────────────────────────
ALTER TABLE emergency_alerts
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id);

-- ── Proteção dos campos financeiros (mesma função, com os campos novos) ─────
CREATE OR REPLACE FUNCTION public.protect_service_call_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.total_price := OLD.total_price;
    NEW.platform_fee := OLD.platform_fee;
    NEW.provider_cut := OLD.provider_cut;
    NEW.client_id := OLD.client_id;
    NEW.service_id := OLD.service_id;
    NEW.pix_payment_id := OLD.pix_payment_id;
    NEW.pix_qr_code := OLD.pix_qr_code;
    NEW.pix_copy_paste := OLD.pix_copy_paste;
    NEW.no_show_fee_status := OLD.no_show_fee_status;
    NEW.no_show_fee_payment_id := OLD.no_show_fee_payment_id;
    NEW.no_show_fee_pix_qr_code := OLD.no_show_fee_pix_qr_code;
    NEW.no_show_fee_pix_copy_paste := OLD.no_show_fee_pix_copy_paste;
    NEW.payment_status := OLD.payment_status;
    -- 24/09/2026: pagamento, repasse e conferência só pelo servidor
    NEW.paid_at := OLD.paid_at;
    NEW.payout_at := OLD.payout_at;
    NEW.payout_by := OLD.payout_by;
    NEW.payout_amount := OLD.payout_amount;
    NEW.payout_reference := OLD.payout_reference;
    NEW.completion_requested_at := OLD.completion_requested_at;
    NEW.completion_approved_at := OLD.completion_approved_at;
    NEW.completion_approved_by := OLD.completion_approved_by;
    NEW.completion_issue := OLD.completion_issue;
    NEW.completion_issue_count := OLD.completion_issue_count;
  END IF;
  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
