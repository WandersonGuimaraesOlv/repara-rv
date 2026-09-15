-- =============================================================================
-- Migration: 20260915_profile_cep_neighborhood
-- Descrição: Adiciona CEP e bairro ao perfil do cliente, informados no cadastro.
--            O bairro é derivado automaticamente do CEP via ViaCEP no frontend
--            (mesmo serviço já usado em components/endereco-form.tsx) — aqui só
--            armazenamos o resultado. Usado para exibir "Você está em: <bairro>"
--            na home sem precisar que o cliente já tenha feito algum chamado.
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

COMMENT ON COLUMN profiles.cep IS 'CEP informado pelo cliente no cadastro (somente dígitos, 8 caracteres). Opcional.';
COMMENT ON COLUMN profiles.neighborhood IS 'Bairro resolvido a partir do CEP via ViaCEP no momento do cadastro. Opcional.';

-- Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
