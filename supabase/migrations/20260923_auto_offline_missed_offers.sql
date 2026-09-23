-- =============================================================================
-- Migration: 20260923_auto_offline_missed_offers  (rodar ANTES do deploy)
-- Descrição: Técnico que fica "online" e para de olhar o app (fechou sem
--            ficar offline) segurava cada chamado por 30 s antes de passar
--            pro próximo — achado em 23/09/2026 (chamado #9804049D esperou o
--            técnico parado desde 17:42). Decisão do dono em 23/09/2026:
--            2 ofertas seguidas sem resposta = offline automático, com aviso
--            por push (lib/missed-offers.ts, app/api/calls/skip-provider).
--
--            missed_offers: ofertas seguidas que venceram sem resposta. Zera
--            quando o técnico aceita, recusa ou volta a ficar online.
--            register_missed_offer(): soma 1 de forma atômica e, no limite,
--            tira do ar (e apaga a última posição, como o botão Offline).
--
--            Aditiva: o código em produção hoje continua funcionando depois
--            dela; o código novo precisa dela (o painel grava missed_offers).
-- =============================================================================

ALTER TABLE provider_status
  ADD COLUMN IF NOT EXISTS missed_offers INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION register_missed_offer(p_provider_id UUID, p_limit INT)
RETURNS BOOLEAN AS $$
DECLARE
  v_missed INT;
BEGIN
  UPDATE provider_status
  SET missed_offers = missed_offers + 1
  WHERE provider_id = p_provider_id AND is_online = TRUE
  RETURNING missed_offers INTO v_missed;

  IF v_missed IS NULL OR v_missed < p_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE provider_status
  SET is_online = FALSE, current_location = NULL, missed_offers = 0, updated_at = NOW()
  WHERE provider_id = p_provider_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION register_missed_offer(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_missed_offer(UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
