-- Migration: Mercado Pago Marketplace Split e Conexão de Subcontas de Prestadores
-- Data: 2026-09-09
-- Autor: Equipe Repara RV

-- 1. Garante a coluna recipient_gateway_id na tabela provider_status
ALTER TABLE IF EXISTS provider_status 
  ADD COLUMN IF NOT EXISTS recipient_gateway_id TEXT;

-- 2. Tabela segura para credenciais de subcontas Mercado Pago (OAuth)
CREATE TABLE IF NOT EXISTS provider_gateway_accounts (
  provider_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  gateway             TEXT NOT NULL DEFAULT 'mercadopago',
  mp_user_id          TEXT NOT NULL,
  mp_access_token     TEXT NOT NULL,
  mp_refresh_token    TEXT,
  mp_public_key       TEXT,
  live_mode           BOOLEAN DEFAULT TRUE,
  connected_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilita Row Level Security (RLS)
ALTER TABLE provider_gateway_accounts ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso
DROP POLICY IF EXISTS "Prestador visualiza seu proprio vinculo de gateway" ON provider_gateway_accounts;
CREATE POLICY "Prestador visualiza seu proprio vinculo de gateway"
  ON provider_gateway_accounts FOR SELECT
  USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Prestador remove seu proprio vinculo de gateway" ON provider_gateway_accounts;
CREATE POLICY "Prestador remove seu proprio vinculo de gateway"
  ON provider_gateway_accounts FOR DELETE
  USING (auth.uid() = provider_id);

-- Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_provider_gateway_mp_user_id ON provider_gateway_accounts(mp_user_id);
