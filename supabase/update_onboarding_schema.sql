-- Atualização de Onboarding Ágil e Conformidade Jurídica
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf_or_cnpj TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS self_declaration_signed BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE provider_status ADD COLUMN IF NOT EXISTS recipient_gateway_id TEXT;
ALTER TABLE service_calls ADD COLUMN IF NOT EXISTS neighborhood TEXT NOT NULL DEFAULT 'Setor Central';
