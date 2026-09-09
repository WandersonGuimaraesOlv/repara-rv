-- ============================================================
-- REPARA RV — MIGRATION CONSOLIDADA DE PRODUÇÃO (ETAPAS 1 A 4)
-- Arquivo : supabase/migrations/20260909_consolidated_migration.sql
-- Data    : 2026-09-09
-- 
-- INSTRUÇÕES:
-- 1. Abra o Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Selecione o projeto Repara RV (lvjahufllclmkqcbbrcu)
-- 3. Clique em "SQL Editor" na barra lateral esquerda
-- 4. Cole todo o conteúdo deste arquivo e clique em "RUN"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- PARTE 1: NOVAS COLUNAS EM service_calls & AUDITORIA UNIVERSAL
-- ============================================================

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancelled_by_role user_role;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancellation_stage TEXT;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancel_by TEXT;

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS cancel_metadata JSONB DEFAULT '{}'::jsonb;

-- Tabela de Auditoria Imutável
CREATE TABLE IF NOT EXISTS service_audit_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id              UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  action               TEXT NOT NULL DEFAULT 'UPDATE',
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

CREATE INDEX IF NOT EXISTS idx_service_audit_call_id ON service_audit_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_service_audit_created_at ON service_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_audit_changed_by ON service_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_service_audit_new_status ON service_audit_logs(new_status);

-- Blindagem Imutável (Append-only)
CREATE OR REPLACE FUNCTION prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'service_audit_logs é estritamente imutável. UPDATE e DELETE são proibidos.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_audit_logs_mutation ON service_audit_logs;
CREATE TRIGGER trigger_prevent_audit_logs_mutation
  BEFORE UPDATE OR DELETE ON service_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_logs_mutation();

REVOKE UPDATE, DELETE ON service_audit_logs FROM public, anon, authenticated;

-- Trigger Function de Auditoria
CREATE OR REPLACE FUNCTION log_service_call_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  reason_text TEXT;
  stage_text TEXT;
BEGIN
  BEGIN
    current_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    reason_text := COALESCE(NEW.cancellation_reason, NEW.cancel_note, NEW.cancel_reason::text);
    stage_text := COALESCE(NEW.cancellation_stage, NEW.status::text);

    INSERT INTO service_audit_logs (
      call_id, action, previous_status, new_status, changed_by,
      cancellation_reason, cancellation_stage, old_payload, new_payload, metadata, created_at
    ) VALUES (
      NEW.id, 'INSERT', NULL, NEW.status, COALESCE(current_user_id, NEW.client_id),
      reason_text, stage_text, NULL, to_jsonb(NEW), COALESCE(NEW.cancel_metadata, '{}'::jsonb), NOW()
    );

  ELSIF (TG_OP = 'UPDATE') THEN
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
        call_id, action, previous_status, new_status, changed_by,
        cancellation_reason, cancellation_stage, old_payload, new_payload, metadata, created_at
      ) VALUES (
        NEW.id, 'UPDATE', OLD.status, NEW.status,
        COALESCE(current_user_id, NEW.cancelled_by, NEW.provider_id, NEW.client_id),
        reason_text, stage_text, to_jsonb(OLD), to_jsonb(NEW), COALESCE(NEW.cancel_metadata, '{}'::jsonb), NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_service_calls ON service_calls;
CREATE TRIGGER trigger_audit_service_calls
  AFTER INSERT OR UPDATE ON service_calls
  FOR EACH ROW
  EXECUTE FUNCTION log_service_call_changes();

-- RLS
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

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE service_audit_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PARTE 2: SEED DOS 20 SERVIÇOS RESIDENCIAIS (R$ 12,00 RETENÇÃO)
-- ============================================================

ALTER TABLE quick_services 
  ALTER COLUMN platform_fee SET DEFAULT 12.00;

-- 1. Elétrica
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('8b5c4095-e56f-4066-80c4-37f359ee47c2', 'Troca de Chuveiro / Resistência', 'Elétrica', 'Substituição de chuveiro ou resistência elétrica com teste de funcionamento e vedação.', 70.00, 12.00, 'ShowerHead', '#F59E0B', 1, true),
  ('88b9104b-be4f-4b44-a6cf-5eff3748b60b', 'Troca de Tomada / Interruptor / Lâmpada', 'Elétrica', 'Instalação ou substituição de tomadas, interruptores e lâmpadas residenciais.', 50.00, 12.00, 'Plug', '#F59E0B', 2, true),
  ('2a09df38-84b4-4853-bdff-338e27981930', 'Instalação de Ventilador de Teto', 'Elétrica', 'Montagem e instalação elétrica de ventilador de teto com suporte e balanceamento.', 120.00, 12.00, 'Fan', '#F59E0B', 3, true),
  ('c6663a89-bab1-465f-937e-a4b366350cc7', 'Instalação de Plafon / Painel LED', 'Elétrica', 'Fixação e ligação elétrica de luminárias de sobrepor ou embutir tipo plafon / LED.', 60.00, 12.00, 'Lightbulb', '#F59E0B', 4, true),
  ('4b58ef09-8b01-49b8-a621-eef671239920', 'Troca de Disjuntor / Pane Elétrica', 'Elétrica', 'Diagnóstico de sobrecarga, substituição de disjuntor defeituoso no quadro geral.', 80.00, 12.00, 'zap', '#F59E0B', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price, platform_fee = EXCLUDED.platform_fee, icon = EXCLUDED.icon,
  color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 2. Hidráulica
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('1e6d94df-5e8d-49ec-9c1b-6d30f99b9529', 'Troca de Torneira / Sifão de Pia', 'Hidráulica', 'Substituição de torneira, flexível ou sifão de pia com fita veda-rosca e teste de estanqueidade.', 60.00, 12.00, 'Droplet', '#06B6D4', 6, true),
  ('f1698097-5802-4a0f-b529-5003490c2855', 'Desentupimento de Ralo / Vaso Sanitário', 'Hidráulica', 'Desobstrução rápida de encanamento de ralo, pia ou vaso sanitário com equipamento manual.', 100.00, 12.00, 'Pipette', '#06B6D4', 7, true),
  ('4cf805b2-09f3-4ecb-8623-11a687e0ae39', 'Reparo de Caixa Acoplada', 'Hidráulica', 'Ajuste ou troca de mecanismo de entrada/saída, boia e vedação de caixa acoplada.', 70.00, 12.00, 'Wrench', '#06B6D4', 8, true),
  ('5ed20888-b613-47e6-8ae7-83020a3c0914', 'Vedação de Box / Pia com Silicone', 'Hidráulica', 'Aplicação de silicone antifungo para vedação perfeita contra infiltração em pias e box.', 60.00, 12.00, 'ShieldCheck', '#06B6D4', 9, true),
  ('7a1e5052-19e4-4d89-b873-12502ef56291', 'Reparo de Válvula de Descarga (Hydra/Docol)', 'Hidráulica', 'Substituição do cartucho e vedação de válvula de descarga embutida com regulagem.', 80.00, 12.00, 'Droplet', '#06B6D4', 10, true),
  ('3f990145-2e6b-4e12-870e-3fa128cd6109', 'Troca / Reparo Torneira com Misturador', 'Hidráulica', 'Instalação ou conserto de torneira monocomando ou misturador de água quente/fria.', 80.00, 12.00, 'Droplet', '#06B6D4', 11, true),
  ('9d82136e-5a7c-47b2-bdcf-8869c9b13922', 'Troca ou Instalação de Vaso Sanitário', 'Hidráulica', 'Remoção de louça antiga, fixação de novo vaso com anel de cera, bolsa e vedação de silicone.', 120.00, 12.00, 'Wrench', '#06B6D4', 12, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price, platform_fee = EXCLUDED.platform_fee, icon = EXCLUDED.icon,
  color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 3. Montagem e Fixação
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('db0b0819-8a5a-49bc-8faa-a393c2b65cc4', 'Fixação de Suporte de TV / Cortina / Quadro', 'Montagem', 'Perfuração precisa em alvenaria e fixação segura de suporte de TV, varão de cortina ou nichos.', 70.00, 12.00, 'Tv', '#8B5CF6', 13, true),
  ('966fea9b-d7eb-483f-9309-c971d64d2b77', 'Montagem / Desmontagem Móvel Pequeno', 'Montagem', 'Montagem de móveis avulsos como mesas de cabeceira, cadeiras de escritório, sapateiras e mesas.', 90.00, 12.00, 'Hammer', '#8B5CF6', 14, true),
  ('fb25cfbe-3e7c-4107-bcbe-f40124e09599', 'Instalação de Varal de Teto / Parede', 'Montagem', 'Fixação firme e alinhamento de varal articulado ou de teto com cordas e roldanas.', 80.00, 12.00, 'Shirt', '#8B5CF6', 15, true),
  ('bc59db09-9149-4eb8-a57c-659f195ff8d5', 'Regulagem de Dobradiças e Gavetas', 'Montagem', 'Alinhamento de portas de armários desreguladas, troca de puxadores e ajuste de trilhos de gaveta.', 60.00, 12.00, 'Settings2', '#8B5CF6', 16, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price, platform_fee = EXCLUDED.platform_fee, icon = EXCLUDED.icon,
  color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 4. Chaveiro
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('15dc3813-d19e-4c09-9dc9-7690a3141a1b', 'Abertura de Porta (Bateu-Fechou)', 'Chaveiro', 'Abertura rápida e sem danos de portas residenciais trancadas acidentalmente.', 100.00, 12.00, 'Key', '#EAB308', 17, true),
  ('d8505766-6373-460c-acd2-34bfb0372b46', 'Troca de Fechadura / Miolo de Porta', 'Chaveiro', 'Substituição completa de fechadura de sobrepor ou miolo de cilindro para nova chave.', 80.00, 12.00, 'Lock', '#EAB308', 18, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price, platform_fee = EXCLUDED.platform_fee, icon = EXCLUDED.icon,
  color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- 5. Instalação & Eletrodomésticos
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('65943f94-fdd6-48a1-a3d0-ffbb6dd88def', 'Instalação de Máquina de Lavar', 'Instalação', 'Conexão hidráulica (entrada/saída de água), nivelamento dos pés e teste de centrifugação.', 70.00, 12.00, 'WashingMachine', '#10B981', 19, true),
  ('53102e50-835e-4132-a4f3-02929e52e44b', 'Troca de Mangueira e Registro de Gás', 'Instalação', 'Troca preventiva de mangueira trançada e regulador de pressão de gás com teste de espuma de sabão.', 50.00, 12.00, 'Flame', '#10B981', 20, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price, platform_fee = EXCLUDED.platform_fee, icon = EXCLUDED.icon,
  color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;

-- ============================================================
-- PARTE 3: CENTRAL DE SEGURANÇA & BOTÃO SOS (emergency_alerts)
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

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_call ON emergency_alerts(call_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user ON emergency_alerts(triggered_by);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_created ON emergency_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_resolved ON emergency_alerts(resolved);

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

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
