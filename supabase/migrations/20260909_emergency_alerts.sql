-- ============================================================
-- REPARA RV — Migration: Central de Segurança & Alertas de Emergência (SOS)
-- Arquivo : supabase/migrations/20260909_emergency_alerts.sql
-- Etapa   : 4 (Plano de Desenvolvimento Faseado)
-- Data    : 2026-09-09
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABELA DE ALERTAS DE EMERGÊNCIA (emergency_alerts)
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id         UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  triggered_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_role       user_role NOT NULL,
  latitude        NUMERIC(10, 8),
  longitude       NUMERIC(11, 8),
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_notes  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de auditoria e monitoramento em tempo real
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_call ON emergency_alerts(call_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user ON emergency_alerts(triggered_by);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created ON emergency_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_resolved ON emergency_alerts(resolved);

COMMENT ON TABLE emergency_alerts IS 'Registros imediatos de incidentes acionados pelo botão SOS durante atendimento.';

-- ============================================================
-- 2. POLÍTICAS RLS (Row Level Security)
-- ============================================================

ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários envolvidos podem acionar emergência" ON emergency_alerts;
CREATE POLICY "Usuários envolvidos podem acionar emergência"
  ON emergency_alerts FOR INSERT
  WITH CHECK ( auth.uid() = triggered_by );

DROP POLICY IF EXISTS "Usuários envolvidos podem visualizar seus alertas" ON emergency_alerts;
CREATE POLICY "Usuários envolvidos podem visualizar seus alertas"
  ON emergency_alerts FOR SELECT
  USING (
    auth.uid() = triggered_by
    OR EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.id = emergency_alerts.call_id
        AND (sc.client_id = auth.uid() OR sc.provider_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins podem atualizar alertas de emergência" ON emergency_alerts;
CREATE POLICY "Admins podem atualizar alertas de emergência"
  ON emergency_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 3. HABILITAR SUPABASE REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
