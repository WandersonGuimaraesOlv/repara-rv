-- Atualização de Onboarding Ágil e Conformidade Jurídica
--
-- HISTÓRICO (item J7 do plano de lançamento, 23/09/2026): script avulso,
-- fora de supabase/migrations/, sem ambiente-alvo. Todas as colunas já
-- existem nos dois bancos, e os padrões daqui (terms_accepted_at DEFAULT
-- NOW(), self_declaration_signed DEFAULT TRUE) marcariam aceite de termos
-- sozinhos num banco novo. O schema real está em supabase/migrations/.
DO $$ BEGIN
  RAISE EXCEPTION 'supabase/update_onboarding_schema.sql é histórico e não deve ser rodado — o schema real está em supabase/migrations/';
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf_or_cnpj TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS self_declaration_signed BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE provider_status ADD COLUMN IF NOT EXISTS recipient_gateway_id TEXT;
ALTER TABLE service_calls ADD COLUMN IF NOT EXISTS neighborhood TEXT NOT NULL DEFAULT 'Setor Central';
