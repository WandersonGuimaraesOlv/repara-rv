-- =============================================================================
-- Migration: 20260917_no_show_fee
-- Descrição: Taxa de deslocamento de R$25 (no-show) — já prometida no texto
--            publicado em /termos ("Do Cancelamento e do No-Show"), sem
--            nenhum código por trás até agora. Cobrada quando o prestador
--            cancela um chamado já aceito com motivo 'provider_absent'
--            ("Cliente ausente após 10 min"). Vai 100% para a plataforma —
--            não há repasse de prestador nessa cobrança.
-- =============================================================================

ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS no_show_fee_status TEXT
    CHECK (no_show_fee_status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS no_show_fee_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS no_show_fee_pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS no_show_fee_pix_copy_paste TEXT;

COMMENT ON COLUMN service_calls.no_show_fee_status IS 'NULL = não se aplica. pending = prestador cancelou com provider_absent, aguardando pagamento da taxa de R$25. paid = taxa quitada.';
COMMENT ON COLUMN service_calls.no_show_fee_payment_id IS 'ID do pagamento Pix no Mercado Pago para a taxa de no-show (campo próprio, não reaproveita pix_payment_id do serviço em si).';

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
