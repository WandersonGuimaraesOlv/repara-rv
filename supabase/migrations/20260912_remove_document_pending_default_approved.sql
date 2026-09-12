-- ============================================================
-- REPARA RV — Migration: Dispensar Pendência de Documentos & Default Aprovado
-- Data: 2026-09-12
-- ============================================================

-- 1. Altera o valor padrão da coluna background_check_status para 'approved'
-- No MVP de Rio Verde, o onboarding com autodeclaração vinculante dispensa
-- envio prévio de certidões e comprovantes. Todos os prestadores entram liberados.
ALTER TABLE profiles 
  ALTER COLUMN background_check_status SET DEFAULT 'approved';

-- 2. Atualiza quaisquer registros legados ou pendentes para 'approved'
UPDATE profiles 
SET background_check_status = 'approved' 
WHERE background_check_status IS NULL OR background_check_status = 'pending';

-- 3. Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
