-- =============================================================================
-- Migration: 20260923_arrival_pin_private_table  (PASSO 1 de 2 — rodar ANTES do deploy)
-- Descrição: O PIN de chegada saía de service_calls.arrival_pin, uma coluna
--            que o próprio prestador lê (select('*') em app/chamado e eventos
--            Realtime da linha) — ele sabia o PIN sem perguntar ao cliente, e
--            o PIN era gerado no navegador dele. RLS decide linha, não coluna,
--            então o PIN vai para uma tabela própria que só o CLIENTE do
--            chamado lê. Quem grava e confere é só o servidor (Service Role):
--            /api/calls/advance (aceite), /api/calls/claim-queued (fila) e
--            /api/calls/verify-arrival-pin (início do atendimento).
--
--            failed_attempts/locked_until: trava de 10 min a cada 5 PINs
--            errados no mesmo chamado — o limite por IP do proxy.ts é em
--            memória por isolate do Worker, não segura força bruta sozinho.
--
--            Aditiva: o código em produção hoje continua funcionando depois
--            dela. O passo 2 (20260923_provider_writes_via_server_only.sql)
--            só roda depois do deploy do código novo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS call_arrival_pins (
  call_id         UUID PRIMARY KEY REFERENCES service_calls(id) ON DELETE CASCADE,
  pin             VARCHAR(4) NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_arrival_pins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON call_arrival_pins FROM anon, authenticated;
GRANT SELECT ON call_arrival_pins TO authenticated;

DROP POLICY IF EXISTS "Cliente vê o PIN do próprio chamado" ON call_arrival_pins;
CREATE POLICY "Cliente vê o PIN do próprio chamado"
  ON call_arrival_pins FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = call_arrival_pins.call_id AND sc.client_id = auth.uid()
  ));

-- Chamados que já estão esperando o técnico chegar mantêm o mesmo PIN.
INSERT INTO call_arrival_pins (call_id, pin)
SELECT id, arrival_pin FROM service_calls
WHERE arrival_pin ~ '^[0-9]{4}$' AND status IN ('accepted', 'on_the_way')
ON CONFLICT (call_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
