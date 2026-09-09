-- ============================================================
-- REPARA RV — CHAT EM TEMPO REAL PÓS-ACEITE (ALINHAMENTO DE MATERIAIS)
-- Arquivo : supabase/migrations/20260909_call_messages_chat.sql
-- Data    : 2026-09-09
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Criação da tabela de mensagens do chamado
CREATE TABLE IF NOT EXISTS call_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_role user_role NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índice para consultas rápidas por chamado
CREATE INDEX IF NOT EXISTS idx_call_messages_call_id ON call_messages(call_id);
CREATE INDEX IF NOT EXISTS idx_call_messages_created_at ON call_messages(created_at ASC);

-- 3. Ativar escuta em tempo real no Supabase Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'call_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE call_messages;
  END IF;
END $$;

-- 4. RLS: Apenas cliente e prestador daquele chamado específico podem ler e enviar mensagens
ALTER TABLE call_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participantes do chamado acessam o chat" ON call_messages;

CREATE POLICY "Participantes do chamado acessam o chat"
ON call_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = call_messages.call_id
      AND (sc.client_id = auth.uid() OR sc.provider_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM service_calls sc
    WHERE sc.id = call_messages.call_id
      AND (sc.client_id = auth.uid() OR sc.provider_id = auth.uid())
  )
);
