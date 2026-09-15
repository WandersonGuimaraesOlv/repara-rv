-- =============================================================================
-- Migration: 20260915_legal_documents_clauses
-- Descrição: Torna editáveis por cláusula/seção os 3 documentos jurídicos hoje
--            hardcoded em app/termos, app/privacidade e app/contrato. Cada
--            cláusula é uma linha (título/ícone/corpo em Markdown), a ordem e
--            o id de âncora (TOC) vêm do banco. O layout visual (badge
--            numerado, shell .legal-card) permanece em código/React — NÃO é
--            reeditado pelo admin.
-- =============================================================================

CREATE TABLE IF NOT EXISTS legal_documents (
  slug            TEXT        PRIMARY KEY CHECK (slug IN ('termos', 'privacidade', 'contrato')),
  title           TEXT        NOT NULL,
  version         TEXT        NOT NULL DEFAULT '1.0',
  effective_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS legal_clauses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_slug   TEXT        NOT NULL REFERENCES legal_documents(slug) ON DELETE CASCADE,
  order_index     INT         NOT NULL,
  -- Âncora usada tanto pelo <section id="..."> quanto pelo link do Sumário (TOC)
  section_id      TEXT        NOT NULL CHECK (section_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           TEXT        NOT NULL,
  -- Chave de ícone lucide-react validada por allowlist em Zod
  -- (lib/validations/legal-admin.ts) e mapeada para componente em
  -- lib/legal-icons.ts — nunca import dinâmico livre.
  icon_key        TEXT,
  body_markdown   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_slug, order_index),
  UNIQUE (document_slug, section_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_clauses_document_order
  ON legal_clauses(document_slug, order_index);

-- RPC: reordenação atômica (evita N updates sequenciais parciais vindos do painel)
CREATE OR REPLACE FUNCTION reorder_legal_clauses(p_document_slug TEXT, p_ordered_ids UUID[])
RETURNS VOID AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1 .. array_length(p_ordered_ids, 1) LOOP
    UPDATE legal_clauses
    SET order_index = i - 1, updated_at = NOW()
    WHERE id = p_ordered_ids[i] AND document_slug = p_document_slug;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_clauses   ENABLE ROW LEVEL SECURITY;

-- Leitura pública (visitante deslogado precisa ler /termos, /privacidade, /contrato)
CREATE POLICY "Leitura pública de documentos legais"
  ON legal_documents FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "Leitura pública de cláusulas legais"
  ON legal_clauses FOR SELECT TO anon, authenticated USING (TRUE);

-- Sem policy de INSERT/UPDATE/DELETE para anon/authenticated: com RLS ligado e
-- nenhuma policy de escrita, o Postgres nega por padrão. Toda escrita passa
-- exclusivamente por app/actions/legal-admin.ts usando createServiceClient()
-- (service_role tem BYPASSRLS), atrás do requireAdminAuth() — mesmo padrão de
-- app/actions/service-admin.ts. Isso garante defesa em profundidade: mesmo que
-- alguém obtenha um JWT autenticado não-admin, a escrita direta ao Supabase
-- também é bloqueada no nível do banco, não só na Server Action.

-- Linhas de metadado dos 3 documentos (sem cláusulas ainda — o texto final
-- entra na Fase B, depois que o redesign visual em andamento for commitado).
-- Idempotente: não sobrescreve se a linha já existir.
INSERT INTO legal_documents (slug, title, version, effective_date) VALUES
  ('termos', 'Termos de Uso', '1.0', '2026-09-13'),
  ('privacidade', 'Política de Privacidade (LGPD)', '1.0', '2026-09-13'),
  ('contrato', 'Contrato do Técnico Parceiro', '1.0', '2026-09-13')
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
