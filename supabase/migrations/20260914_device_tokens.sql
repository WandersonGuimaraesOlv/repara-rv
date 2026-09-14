-- =============================================================================
-- Migration: 20260914_device_tokens
-- Descrição: Tabela unificada de tokens de notificação push para TODAS as
--            plataformas: PWA (web), Flutter Android (android), Flutter iOS (ios)
-- Dispatcher: modules/notifications/services/unified-dispatcher.ts roteia
--             automaticamente para VAPID ou FCM conforme o campo `platform`
-- =============================================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Token FCM (Flutter) ou endpoint Web Push resumido — identificador único por dispositivo
  token       TEXT        NOT NULL,
  -- Plataforma: determina qual dispatcher usar
  platform    TEXT        NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  -- Desativar sem deletar (útil para debug e auditoria)
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garante que um dispositivo não gere tokens duplicados por usuário
  UNIQUE (user_id, token)
);

-- Índice para busca de tokens ativos por usuário (hot path do dispatcher)
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens(user_id)
  WHERE is_active = TRUE;

-- Índice por plataforma (útil para broadcasts segmentados por plataforma)
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform
  ON device_tokens(platform)
  WHERE is_active = TRUE;

-- RLS: cada usuário gerencia apenas seus próprios tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia seus device tokens"
  ON device_tokens
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política separada para service role (dispatcher server-side pode ler todos)
CREATE POLICY "Service role lê todos os tokens para dispatch"
  ON device_tokens
  FOR SELECT
  TO service_role
  USING (TRUE);

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
