-- =============================================================================
-- Migration: 20260914_compliance_bans
-- Descrição: Bans, bloqueios e punições para compliance anti-abuso
-- LGPD: documentos armazenados APENAS sob hash irreversível (SHA-256)
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_bans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- profile_id é nullable: ban pode ser aplicado antes de criar conta
  profile_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- Telefone limpo (apenas dígitos) para detecção pré-cadastro
  phone_clean     TEXT,
  -- Hash SHA-256 do CPF/CNPJ — nunca armazenar o documento em claro
  document_hash   TEXT,
  -- Motivo obrigatório para auditoria interna
  reason          TEXT        NOT NULL,
  -- Admin que aplicou o ban
  banned_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- NULL = ban permanente; preenchido = ban temporário
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices parciais (filtram apenas bans ativos — performance máxima)
CREATE INDEX IF NOT EXISTS idx_compliance_bans_phone
  ON compliance_bans(phone_clean)
  WHERE is_active = TRUE AND phone_clean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_bans_profile
  ON compliance_bans(profile_id)
  WHERE is_active = TRUE AND profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_bans_document
  ON compliance_bans(document_hash)
  WHERE is_active = TRUE AND document_hash IS NOT NULL;

-- RLS: apenas admins leem/escrevem bans
ALTER TABLE compliance_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins gerenciam bans"
  ON compliance_bans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Função utilitária: desativa bans expirados (chamada pelo cron worker)
CREATE OR REPLACE FUNCTION deactivate_expired_bans()
RETURNS INTEGER AS $$
DECLARE
  deactivated_count INTEGER;
BEGIN
  UPDATE compliance_bans
  SET is_active = FALSE
  WHERE is_active = TRUE
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deactivated_count = ROW_COUNT;
  RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
