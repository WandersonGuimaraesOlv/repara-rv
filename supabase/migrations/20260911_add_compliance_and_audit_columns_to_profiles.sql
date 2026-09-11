-- ============================================================
-- REPARA RV — Migration: Colunas de Compliance, Antecedentes e Auditoria em profiles
-- Data: 2026-09-11
-- ============================================================

-- 1. Garante as colunas de compliance e auditoria na tabela profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'pending' 
    CHECK (background_check_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_orders_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 5.00;

-- 2. Índice para consultas rápidas por status de compliance e bloqueio
CREATE INDEX IF NOT EXISTS idx_profiles_compliance 
  ON profiles (background_check_status, is_blocked);

-- 3. Força o PostgREST a recarregar o schema cache imediatamente
NOTIFY pgrst, 'reload schema';
