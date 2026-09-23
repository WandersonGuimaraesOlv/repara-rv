-- =============================================================================
-- Migration: 20260923_provider_writes_via_server_only  (PASSO 2 de 2 — rodar DEPOIS do deploy)
-- Descrição: O prestador escrevia direto em service_calls pelo navegador
--            (aceite em app/painel, "a caminho" e conclusão em app/chamado).
--            As duas políticas de UPDATE abaixo liberavam qualquer coluna não
--            financeira da linha dele — dava pra pular de on_the_way direto
--            pra completed sem o PIN de chegada, ou reescrever o endereço.
--            Desde o deploy de 23/09/2026 essas transições passam por
--            /api/calls/advance e /api/calls/verify-arrival-pin (Service
--            Role, com a máquina de estados em lib/call-transitions.ts), então
--            o prestador não precisa mais de UPDATE nenhum na tabela.
--
--            Também tira o PIN de service_calls.arrival_pin (a coluna que o
--            prestador lê) depois de copiar os que faltam pra call_arrival_pins
--            (chamados aceitos pelo código antigo entre o passo 1 e o deploy).
-- =============================================================================

INSERT INTO call_arrival_pins (call_id, pin)
SELECT id, arrival_pin FROM service_calls
WHERE arrival_pin ~ '^[0-9]{4}$' AND status IN ('accepted', 'on_the_way')
ON CONFLICT (call_id) DO NOTHING;

UPDATE service_calls SET arrival_pin = NULL WHERE arrival_pin IS NOT NULL;

DROP POLICY IF EXISTS "Prestador atualiza chamados aceitos por ele" ON service_calls;
DROP POLICY IF EXISTS "Prestador atualiza chamados atribuídos" ON service_calls;

NOTIFY pgrst, 'reload schema';
