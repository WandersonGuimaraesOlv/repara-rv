-- Migration: Adiciona colunas de escopo e duração estimada à tabela quick_services
-- Data: 2026-09-11
-- Autor: Repara RV

ALTER TABLE quick_services 
  ADD COLUMN IF NOT EXISTS included TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS not_included TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS duration_est TEXT DEFAULT '40 min';

-- Recarrega o cache do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
