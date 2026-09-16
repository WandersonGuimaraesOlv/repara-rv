-- =============================================================================
-- Migration: 20260916_profile_email
-- Descrição: Adiciona e-mail de contato ao perfil (cliente e prestador),
--            agora obrigatório no cadastro. NÃO é usado para login — a
--            autenticação continua celular + PIN (e-mail sintético
--            `${telefone}@repararv.com` no Supabase Auth, inalterado). Serve
--            como dado de contato/recuperação e alimenta a futura Central de
--            Conta (Dados Pessoais).
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN profiles.email IS 'E-mail de contato informado no cadastro. Não é usado para login (isso continua sendo celular + PIN via e-mail sintético no Supabase Auth).';

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
