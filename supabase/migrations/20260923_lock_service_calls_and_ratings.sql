-- =============================================================================
-- Migration: 20260923_lock_service_calls_and_ratings
-- Descrição: Fecha escritas que as políticas antigas de supabase/schema.sql
--            deixavam abertas. Elas voltaram a valer em produção quando o
--            schema.sql foi rodado lá por engano em 22/09/2026 (os 2 serviços
--            extras daquele dia são exatamente o seed dele) e continuaram
--            depois das correções de 23/09.
--
--            Provado no staging (mesmas políticas de produção) em 23/09:
--            - qualquer pessoa sem login criava, alterava e apagava avaliações
--              de qualquer chamado ("Avaliações visíveis para os envolvidos",
--              FOR ALL USING (true));
--            - cliente logado marcava o próprio chamado como pago e trocava o
--              preço pra R$0,01 — e /api/pix/create cobra o total_price gravado
--              ("Cliente vê e cria seus chamados", FOR ALL);
--            - cliente logado criava chamado direto pela API com preço
--              inventado ("Cliente cria chamados", INSERT);
--            - prestador logado aumentava o próprio repasse e marcava como pago
--              (a política de UPDATE do prestador é por linha, não por coluna).
--
--            O que o app faz de verdade pelo navegador (conferido no código):
--            o cliente nunca escreve em service_calls (criar e cancelar passam
--            por /api/calls/create e /api/calls/cancel, com Service Role) e só
--            insere avaliação de chamado concluído (app/acompanhar). O prestador
--            grava status, accepted_at, arrival_pin, completed_at e
--            payment_status='pending' (app/painel, app/chamado) — esse último já
--            é o valor padrão, então travar a coluna não muda nada pra ele. O
--            webhook e as rotas de servidor usam Service Role e não são afetados.
--            Admin logado no navegador também fica travado nessas colunas (o
--            painel admin só lê service_calls); o SQL Editor não é afetado.
-- =============================================================================

-- 1. Cliente: fica só a leitura dos próprios chamados ("Cliente vê seus próprios chamados")
DROP POLICY IF EXISTS "Cliente vê e cria seus chamados" ON service_calls;
DROP POLICY IF EXISTS "Cliente cria chamados" ON service_calls;
DROP POLICY IF EXISTS "Cliente cancela chamado em 'searching'" ON service_calls;

-- 2. Avaliações: fica só "Cliente avalia seu próprio chamado" (INSERT, chamado próprio concluído)
DROP POLICY IF EXISTS "Avaliações visíveis para os envolvidos" ON service_ratings;

-- 3. Colunas financeiras só mudam pelo servidor (mesmo padrão de protect_sensitive_profile_fields)
CREATE OR REPLACE FUNCTION protect_service_call_financials()
RETURNS TRIGGER AS $$
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
    -- O prestador manda 'pending' na conclusão, que já é o padrão desde a
    -- criação; mudar de verdade (paid/refunded) é só o webhook.
    NEW.payment_status := OLD.payment_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_service_call_financials ON service_calls;
CREATE TRIGGER trg_protect_service_call_financials
  BEFORE UPDATE ON service_calls
  FOR EACH ROW
  EXECUTE FUNCTION protect_service_call_financials();

NOTIFY pgrst, 'reload schema';
