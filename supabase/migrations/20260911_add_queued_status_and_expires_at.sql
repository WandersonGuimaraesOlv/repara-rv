-- Migration: Fila de Espera Prioritária ('queued') e Expiração de Chamados
-- Data: 2026-09-11
-- Autor: Repara RV

-- 1. Adiciona o status 'queued' ao tipo enum ride_status (se ainda não existir)
DO $$ BEGIN
  ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'queued';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adiciona a coluna expires_at em service_calls
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours');

-- 3. Cria índice para busca rápida de chamados ativos na fila de espera
CREATE INDEX IF NOT EXISTS idx_service_calls_queued 
  ON service_calls(status, created_at DESC) 
  WHERE status = 'queued';

-- 4. Função auxiliar para expirar chamados da fila que ultrapassaram expires_at
CREATE OR REPLACE FUNCTION expire_stale_queued_calls()
RETURNS INT AS $$
DECLARE
  expired_count INT;
BEGIN
  WITH updated AS (
    UPDATE service_calls
    SET status = 'cancelled',
        cancel_reason = 'no_provider_found',
        cancel_note = 'Tempo limite na fila de espera prioritária expirado (2 horas)',
        cancelled_at = NOW()
    WHERE status = 'queued'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM updated;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
