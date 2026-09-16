-- =============================================================================
-- Migration: 20260918_provider_identity_verification
-- Descrição: Parte 1 do plano de verificação de identidade do prestador
--            (Parte 2, taxa de no-show, já foi entregue na migration
--            20260917_no_show_fee.sql). background_check_status
--            ('pending'|'approved'|'rejected') já existe em profiles desde
--            20260911, mas é decorativo até aqui: app/onboarding/page.tsx
--            grava 'approved' direto no cadastro sem gate nenhum, e
--            find_nearest_provider() nunca chega a checar esse campo — só lê
--            provider_status. Esta migration fecha os dois lados: adiciona os
--            campos de auditoria da aprovação/reprovação, o PIN de chegada do
--            chamado, a tabela de denúncia de identidade, corrige o RPC de
--            busca de prestador e adiciona uma trava de defesa em
--            profundidade direto no banco (mesmo padrão de
--            check_provider_online_gateway, já existente).
-- =============================================================================

-- Auditoria da aprovação/reprovação de compliance (complementa
-- background_check_status, que já existe e já tem UI de admin).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- PIN de 4 dígitos gerado no aceite do chamado — o cliente confere que o
-- técnico que chegou na porta é o mesmo que aceitou o chamado. started_at é
-- campo novo de propósito: completed_at hoje é reaproveitado tanto pra
-- marcar o início quanto o fim do atendimento (app/chamado/[callId]/page.tsx,
-- handleComplete) — ambíguo, e a nova etapa "Iniciar Atendimento" (PIN-gated)
-- precisa de um timestamp próprio em vez de empilhar mais uso duplo em cima
-- de completed_at.
ALTER TABLE service_calls
  ADD COLUMN IF NOT EXISTS arrival_pin VARCHAR(4),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

COMMENT ON COLUMN service_calls.arrival_pin IS 'PIN de 4 dígitos gerado no aceite do chamado, exibido pro cliente e conferido pelo prestador ao iniciar o atendimento.';
COMMENT ON COLUMN service_calls.started_at IS 'Quando o prestador confirma o PIN de chegada e o status vira in_progress de verdade — não reaproveita completed_at.';

-- Denúncia "Não é a pessoa da foto" — cancela o chamado na hora (sem taxa pro
-- cliente) mas não suspende o prestador automaticamente; fica pendente de
-- revisão do admin em /admin/usuarios.
CREATE TABLE IF NOT EXISTS identity_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id      UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES profiles(id),
  provider_id  UUID NOT NULL REFERENCES profiles(id),
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_reports_provider ON identity_reports(provider_id);

ALTER TABLE identity_reports ENABLE ROW LEVEL SECURITY;
-- Sem política nenhuma pra anon/authenticated de propósito — só a Service
-- Role (rotas server-side) grava e lê essa tabela, nunca o cliente direto.

-- Corrige o gate que nunca existiu de fato: find_nearest_provider() passa a
-- exigir profiles.background_check_status = 'approved' (antes só lia
-- provider_status, nunca fazia JOIN com profiles). Mesma assinatura de
-- sempre (call_location, excluded_ids) — CREATE OR REPLACE não quebra as
-- duas chamadas já existentes em app/api/calls/create e
-- app/api/calls/skip-provider.
CREATE OR REPLACE FUNCTION find_nearest_provider(
  call_location GEOMETRY(Point, 4326),
  excluded_ids  UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  nearest_provider_id UUID;
BEGIN
  SELECT ps.provider_id INTO nearest_provider_id
  FROM provider_status ps
  JOIN profiles p ON p.id = ps.provider_id
  WHERE ps.is_online = TRUE
    AND ps.recipient_gateway_id IS NOT NULL
    AND TRIM(ps.recipient_gateway_id) <> ''
    AND ps.current_location IS NOT NULL
    AND p.background_check_status = 'approved'
    AND NOT (ps.provider_id = ANY(excluded_ids))
    AND NOT EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.provider_id = ps.provider_id
        AND sc.status IN ('accepted', 'on_the_way', 'in_progress')
    )
  ORDER BY ps.current_location <-> call_location
  LIMIT 1;

  RETURN nearest_provider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Defesa em profundidade: /painel/page.tsx já faz o toggle "Ficar Online"
-- como escrita direta ao Supabase (não passa por rota de API), então o gate
-- de aplicação sozinho não é suficiente — alguém podia contornar escrevendo
-- direto via client. Bloqueia is_online=TRUE se o prestador não estiver
-- 'approved', mesmo padrão de check_provider_online_gateway (trigger de Pix
-- já existente, que continua valendo em paralelo).
CREATE OR REPLACE FUNCTION check_provider_online_verification()
RETURNS TRIGGER AS $$
DECLARE
  provider_status_check TEXT;
BEGIN
  IF NEW.is_online = TRUE THEN
    SELECT background_check_status INTO provider_status_check
    FROM profiles WHERE id = NEW.provider_id;

    IF provider_status_check IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Cadastro ainda em análise de segurança — não é possível ficar online.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_provider_online_verification ON provider_status;
CREATE TRIGGER trg_check_provider_online_verification
  BEFORE INSERT OR UPDATE OF is_online ON provider_status
  FOR EACH ROW
  EXECUTE FUNCTION check_provider_online_verification();

NOTIFY pgrst, 'reload schema';
