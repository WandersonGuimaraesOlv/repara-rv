-- ============================================================
-- REPARA RV — Migration: Auditoria Universal & Cancelamentos
-- Arquivo : supabase/migrations/20260909_audit_and_cancellation.sql
-- Etapa   : 1 (Plano de Desenvolvimento Faseado)
-- Data    : 2026-09-09
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. NOVAS COLUNAS NA TABELA service_calls
-- ============================================================

-- arrived_at: Timestamp de quando o técnico chegou ao local do cliente
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- cancelled_by: UUID do usuário (cliente ou prestador) que solicitou cancelamento
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- cancelled_by_role: Papel de quem cancelou ('client', 'provider', 'admin')
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancelled_by_role user_role;

-- cancellation_reason: Justificativa em texto do cancelamento
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- cancellation_stage: Etapa em que o cancelamento ocorreu ('searching', 'allocated', 'on_the_way', 'arrived', 'in_progress')
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancellation_stage TEXT;

-- Compatibilidade com colunas complementares
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancel_by TEXT;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancel_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN service_calls.arrived_at IS 'Momento exato em que o prestador sinalizou chegada ao endereço';
COMMENT ON COLUMN service_calls.cancelled_by IS 'Perfil do usuário que acionou o cancelamento';
COMMENT ON COLUMN service_calls.cancelled_by_role IS 'Papel do usuário que acionou o cancelamento (client, provider, admin)';
COMMENT ON COLUMN service_calls.cancellation_reason IS 'Motivo detalhado ou código de justificativa do cancelamento';
COMMENT ON COLUMN service_calls.cancellation_stage IS 'Fase do ciclo operacional em que o chamado foi cancelado';

-- ============================================================
-- 2. TABELA DE AUDITORIA UNIVERSAL IMUTÁVEL (service_audit_logs)
-- ============================================================

CREATE TABLE IF NOT EXISTS service_audit_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id              UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  action               TEXT NOT NULL DEFAULT 'UPDATE', -- 'INSERT' ou 'UPDATE'
  previous_status      ride_status,
  new_status           ride_status NOT NULL,
  changed_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cancellation_reason  TEXT,
  cancellation_stage   TEXT,
  old_payload          JSONB,
  new_payload          JSONB,
  metadata             JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_service_audit_call_id ON service_audit_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_service_audit_created_at ON service_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_audit_changed_by ON service_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_service_audit_new_status ON service_audit_logs(new_status);

COMMENT ON TABLE service_audit_logs IS 'Tabela imutável (append-only) de auditoria de histórico operacional e transições de chamados.';

-- ============================================================
-- 3. GARANTIA DE IMUTABILIDADE (APPEND-ONLY)
-- Proíbe expressamente UPDATE e DELETE nesta tabela
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'service_audit_logs é estritamente imutável (append-only). Operações de UPDATE ou DELETE são proibidas.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_audit_logs_mutation ON service_audit_logs;
CREATE TRIGGER trigger_prevent_audit_logs_mutation
  BEFORE UPDATE OR DELETE ON service_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_logs_mutation();

REVOKE UPDATE, DELETE ON service_audit_logs FROM public, anon, authenticated;

-- ============================================================
-- 4. FUNÇÃO E TRIGGER DE AUDITORIA UNIVERSAL
-- log_service_call_changes() & trigger_audit_service_calls
-- ============================================================

CREATE OR REPLACE FUNCTION log_service_call_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  reason_text TEXT;
  stage_text TEXT;
BEGIN
  -- Tenta capturar o auth.uid() do Supabase; se ausente, captura do registro
  BEGIN
    current_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    reason_text := COALESCE(NEW.cancellation_reason, NEW.cancel_note, NEW.cancel_reason::text);
    stage_text := COALESCE(NEW.cancellation_stage, NEW.status::text);

    INSERT INTO service_audit_logs (
      call_id,
      action,
      previous_status,
      new_status,
      changed_by,
      cancellation_reason,
      cancellation_stage,
      old_payload,
      new_payload,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      'INSERT',
      NULL,
      NEW.status,
      COALESCE(current_user_id, NEW.client_id),
      reason_text,
      stage_text,
      NULL,
      to_jsonb(NEW),
      COALESCE(NEW.cancel_metadata, '{}'::jsonb),
      NOW()
    );

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Registra se houve alteração em status, cancelamento, prestador ou chegada
    IF (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.provider_id IS DISTINCT FROM NEW.provider_id OR
      OLD.arrived_at IS DISTINCT FROM NEW.arrived_at OR
      OLD.cancelled_by IS DISTINCT FROM NEW.cancelled_by OR
      OLD.cancellation_reason IS DISTINCT FROM NEW.cancellation_reason OR
      OLD.cancellation_stage IS DISTINCT FROM NEW.cancellation_stage OR
      OLD.cancel_reason IS DISTINCT FROM NEW.cancel_reason OR
      OLD.cancel_note IS DISTINCT FROM NEW.cancel_note
    ) THEN
      reason_text := COALESCE(NEW.cancellation_reason, NEW.cancel_note, NEW.cancel_reason::text);
      stage_text := COALESCE(NEW.cancellation_stage, NEW.status::text);

      INSERT INTO service_audit_logs (
        call_id,
        action,
        previous_status,
        new_status,
        changed_by,
        cancellation_reason,
        cancellation_stage,
        old_payload,
        new_payload,
        metadata,
        created_at
      ) VALUES (
        NEW.id,
        'UPDATE',
        OLD.status,
        NEW.status,
        COALESCE(current_user_id, NEW.cancelled_by, NEW.provider_id, NEW.client_id),
        reason_text,
        stage_text,
        to_jsonb(OLD),
        to_jsonb(NEW),
        COALESCE(NEW.cancel_metadata, '{}'::jsonb),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Instala o trigger em service_calls
DROP TRIGGER IF EXISTS trigger_audit_service_calls ON service_calls;
CREATE TRIGGER trigger_audit_service_calls
  AFTER INSERT OR UPDATE ON service_calls
  FOR EACH ROW
  EXECUTE FUNCTION log_service_call_changes();

-- ============================================================
-- 5. POLÍTICAS RLS (Row Level Security)
-- ============================================================

ALTER TABLE service_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participantes do chamado e admins visualizam logs" ON service_audit_logs;
CREATE POLICY "Participantes do chamado e admins visualizam logs"
  ON service_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.id = service_audit_logs.call_id
        AND (sc.client_id = auth.uid() OR sc.provider_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 6. HABILITAR SUPABASE REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE service_audit_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
