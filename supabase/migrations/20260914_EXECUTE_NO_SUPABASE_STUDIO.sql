-- =====================================================================
-- REPARA RV — Script de Migrations Consolidado
-- Execute ESTE ARQUIVO ÚNICO no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/lvjahufllclmkqcbbrcu/sql/new
--
-- Todas as instruções usam IF NOT EXISTS — seguro re-executar.
-- =====================================================================

-- ─── 1. PUSH_SUBSCRIPTIONS (Web Push VAPID para o PWA) ───────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  device_type TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions'
    AND policyname = 'Usuário gerencia suas subscrições push'
  ) THEN
    CREATE POLICY "Usuário gerencia suas subscrições push"
      ON push_subscriptions FOR ALL TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 2. COMPLIANCE_BANS (Anti-abuso com hash de documentos) ──────────

CREATE TABLE IF NOT EXISTS compliance_bans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  phone_clean     TEXT,
  document_hash   TEXT,
  reason          TEXT        NOT NULL,
  banned_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_bans_phone
  ON compliance_bans(phone_clean)
  WHERE is_active = TRUE AND phone_clean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_bans_profile
  ON compliance_bans(profile_id)
  WHERE is_active = TRUE AND profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_bans_document
  ON compliance_bans(document_hash)
  WHERE is_active = TRUE AND document_hash IS NOT NULL;

ALTER TABLE compliance_bans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'compliance_bans'
    AND policyname = 'Apenas admins gerenciam bans'
  ) THEN
    CREATE POLICY "Apenas admins gerenciam bans"
      ON compliance_bans FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Função utilitária: desativa bans expirados (chamada pelo cron)
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

-- ─── 3. DEVICE_TOKENS (Unificado: PWA + Flutter Android + Flutter iOS) ─

CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens(user_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_tokens_platform
  ON device_tokens(platform)
  WHERE is_active = TRUE;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'device_tokens'
    AND policyname = 'Usuário gerencia seus device tokens'
  ) THEN
    CREATE POLICY "Usuário gerencia seus device tokens"
      ON device_tokens FOR ALL TO authenticated
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'device_tokens'
    AND policyname = 'Service role lê todos os tokens para dispatch'
  ) THEN
    CREATE POLICY "Service role lê todos os tokens para dispatch"
      ON device_tokens FOR SELECT TO service_role
      USING (TRUE);
  END IF;
END $$;

-- ─── RECARREGA CACHE DO POSTGREST ────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─── VALIDAÇÃO FINAL: confirma as 3 tabelas criadas ─────────────────
SELECT 
  table_name,
  'OK ✅' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('push_subscriptions', 'compliance_bans', 'device_tokens')
ORDER BY table_name;
