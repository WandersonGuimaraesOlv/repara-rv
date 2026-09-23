-- =============================================================================
-- Migration: 20260924_provider_reads_after_accept  (rodar DEPOIS do deploy)
-- Descrição: Achado J1 do plano de lançamento (23/09/2026): a política
--            "Prestador vê chamados atribuídos a ele" (auth.uid() = provider_id)
--            valia também pra OFERTA ainda não aceita (status 'searching' já
--            apontado pro técnico) — ele lia a linha inteira, com endereço e
--            coordenadas do cliente, antes de decidir. A tela escondia, mas o
--            dado chegava ao celular (SELECT direto e Realtime).
--
--            Agora o técnico só lê o chamado depois do aceite: accepted_at
--            preenchido (aceite pela rota ou pela fila) ou status pós-aceite
--            (cobre chamados antigos de teste sem accepted_at). A oferta vem de
--            /api/calls/offer, só com serviço, bairro e valores — o deploy
--            dessa rota tem que vir ANTES desta migration.
--
--            Chat, histórico, SOS e PIN (políticas que conferem o chamado via
--            service_calls) passam a valer pro técnico só depois do aceite —
--            que é quando existem.
-- =============================================================================

DROP POLICY IF EXISTS "Prestador vê chamados atribuídos a ele" ON service_calls;
DROP POLICY IF EXISTS "Prestador vê chamados que aceitou" ON service_calls;
CREATE POLICY "Prestador vê chamados que aceitou"
  ON service_calls FOR SELECT TO authenticated
  USING (
    auth.uid() = provider_id
    AND (accepted_at IS NOT NULL OR status IN ('accepted', 'on_the_way', 'in_progress', 'completed'))
  );

NOTIFY pgrst, 'reload schema';
