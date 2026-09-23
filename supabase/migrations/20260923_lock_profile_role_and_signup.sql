-- =============================================================================
-- Migration: 20260923_lock_profile_role_and_signup
-- Descrição: ACHADO CRÍTICO, provado no staging (mesmas permissões e gatilhos
--            de produção) em 23/09/2026: a política "Usuário edita o próprio
--            perfil" é por linha, e protect_sensitive_profile_fields não
--            travava a coluna role. Com a própria sessão, um cliente:
--            1. virava ADMIN (UPDATE role='admin') — e com isso entrava no
--               painel administrativo (requireAdminAuth só confere
--               profiles.role);
--            2. virava prestador continuando "approved" (o gatilho mantinha o
--               background_check_status antigo, e cliente nasce 'approved'),
--               pulando a verificação de identidade;
--            3. ficava online e recebia chamados sem aprovação do admin.
--            Também dava pra criar o próprio perfil já como admin ou como
--            prestador aprovado (INSERT, antes do onboarding).
--
--            Regra nova, só pra quem não é o servidor (auth.role() <>
--            'service_role'; o painel admin e /api/auth/register usam Service
--            Role e não são afetados; o SQL Editor também não):
--            - UPDATE: role só muda de 'client' pra 'provider', e nesse caso o
--              cadastro volta pra 'pending' (é o que o "Quero ser
--              Profissional" faz via app/onboarding). Qualquer outra troca de
--              role é ignorada. verified_at/verified_by/rejection_reason e
--              avatar_url (selfie de verificação, gravada só por
--              /api/profile/selfie) passam a ser protegidos também.
--            - INSERT: role só pode ser 'client' ou 'provider'; prestador nasce
--              'pending', cliente 'approved'; bloqueio, nota, contagem,
--              verificação e selfie nascem com o valor padrão.
-- =============================================================================

CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.is_blocked := OLD.is_blocked;
    NEW.background_check_status := OLD.background_check_status;
    NEW.rating_avg := OLD.rating_avg;
    NEW.completed_orders_count := OLD.completed_orders_count;
    NEW.mercado_pago_connected := OLD.mercado_pago_connected;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.avatar_url := OLD.avatar_url;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF OLD.role = 'client' AND NEW.role = 'provider' THEN
        NEW.background_check_status := 'pending';
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
      ELSE
        NEW.role := OLD.role;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recria o gatilho valendo pra qualquer coluna (um UPDATE só de role precisa disparar)
DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_sensitive_profile_fields();

CREATE OR REPLACE FUNCTION protect_profile_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.role IS NULL OR NEW.role NOT IN ('client', 'provider') THEN
      NEW.role := 'client';
    END IF;
    NEW.background_check_status := CASE WHEN NEW.role = 'provider' THEN 'pending' ELSE 'approved' END;
    NEW.is_blocked := FALSE;
    NEW.rating_avg := 5.00;
    NEW.completed_orders_count := 0;
    NEW.mercado_pago_connected := FALSE;
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.avatar_url := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_on_insert ON profiles;
CREATE TRIGGER trg_protect_profile_on_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_on_insert();

NOTIFY pgrst, 'reload schema';
