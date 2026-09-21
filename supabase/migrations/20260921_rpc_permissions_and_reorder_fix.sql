-- =============================================================================
-- Migration: 20260921_rpc_permissions_and_reorder_fix
-- Descrição: Achados de 21/09/2026 ao rodar `npm run test:legal-admin` e
--            `npm run test:rpc-permissions` contra o banco de produção.
--
--   1. reorder_legal_clauses() estava quebrada: UNIQUE (document_slug,
--      order_index) não é DEFERRABLE e a função atualizava linha a linha, então
--      qualquer reordenação real (ex: trocar as 2 primeiras cláusulas)
--      esbarrava num índice ainda ocupado e falhava com "duplicate key value
--      violates unique constraint legal_clauses_document_slug_order_index_key".
--      Ou seja, o arrastar-e-soltar de /admin/juridico nunca funcionou depois
--      que os documentos foram carregados (a tabela vazia escondia o bug).
--      Correção: 2 fases — primeiro move as linhas listadas para índices
--      negativos temporários (únicos e fora da faixa em uso), depois para os
--      definitivos.
--
--   2. Funções SECURITY DEFINER executáveis por qualquer pessoa. O Postgres dá
--      EXECUTE a PUBLIC por padrão e o Supabase repassa a anon/authenticated,
--      então via API REST (`/rest/v1/rpc/<nome>`), só com a chave pública do
--      navegador, dava pra chamar — sem login — claim_queued_call (assumir um
--      chamado pra qualquer prestador, pulando aprovação, bloqueio e PIN da
--      rota), find_nearest_provider (consultar prestadores online por
--      coordenada), reorder_legal_clauses (mexer na ordem dos Termos) e
--      deactivate_expired_bans. Confirmado em 21/09/2026 chamando com UUIDs
--      inexistentes (nenhuma linha alterada). Toda chamada legítima já usa a
--      Service Role (create, skip-provider, claim-queued e legal-admin), então
--      revogar de PUBLIC/anon/authenticated não muda o comportamento do app.
--
-- Como aplicar: SQL Editor do Supabase (mesmo processo das migrations
-- anteriores; a Service Role não executa DDL). Depois rodar:
--   npm run test:rpc-permissions
--   npm run test:legal-admin
-- =============================================================================

-- 1. Reordenação atômica em 2 fases ------------------------------------------
CREATE OR REPLACE FUNCTION reorder_legal_clauses(p_document_slug TEXT, p_ordered_ids UUID[])
RETURNS VOID AS $$
BEGIN
  IF p_ordered_ids IS NULL OR COALESCE(array_length(p_ordered_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  -- Fase 1: índices temporários -1, -2, ... (únicos entre si e fora da faixa
  -- 0.. usada pelas cláusulas), sem colidir com nenhuma linha existente.
  UPDATE legal_clauses
  SET order_index = -array_position(p_ordered_ids, id)
  WHERE document_slug = p_document_slug
    AND id = ANY(p_ordered_ids);

  -- Fase 2: posição definitiva (0, 1, 2, ...): -(-pos) - 1 = pos - 1.
  UPDATE legal_clauses
  SET order_index = -order_index - 1,
      updated_at  = NOW()
  WHERE document_slug = p_document_slug
    AND id = ANY(p_ordered_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Só a Service Role executa as RPCs internas ------------------------------
REVOKE EXECUTE ON FUNCTION claim_queued_call(UUID, UUID)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reorder_legal_clauses(TEXT, UUID[])   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION deactivate_expired_bans()             FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION claim_queued_call(UUID, UUID)          TO service_role;
GRANT EXECUTE ON FUNCTION find_nearest_provider(geometry, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION reorder_legal_clauses(TEXT, UUID[])    TO service_role;
GRANT EXECUTE ON FUNCTION deactivate_expired_bans()              TO service_role;

NOTIFY pgrst, 'reload schema';
