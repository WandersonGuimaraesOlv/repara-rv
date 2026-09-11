-- Migration: Fila de Espera Prioritária ('queued') e Aceite Atômico Concorrente
-- Data: 2026-09-11
-- Autor: Repara RV

-- 1. Garante que o status 'queued' e 'expired' existam no tipo ride_status
DO $$ BEGIN
  ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'queued';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Atualizar ou remover constraint caso exista como check constraint de texto
ALTER TABLE service_calls DROP CONSTRAINT IF EXISTS service_calls_status_check;

-- 3. Adicionar campos de expiração e atualização
ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours');

ALTER TABLE service_calls 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Adicionar coluna mercado_pago_connected em profiles para acesso direto
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS mercado_pago_connected BOOLEAN DEFAULT FALSE;

-- Sincroniza flag mercado_pago_connected para prestadores com gateway ativo
UPDATE profiles p
SET mercado_pago_connected = TRUE
FROM provider_status ps
WHERE ps.provider_id = p.id 
  AND ps.recipient_gateway_id IS NOT NULL 
  AND TRIM(ps.recipient_gateway_id) <> '';

-- 5. Cria índice para busca ultrarrápida da fila
CREATE INDEX IF NOT EXISTS idx_service_calls_queued 
  ON service_calls(status, created_at DESC) 
  WHERE status = 'queued';

-- 6. Função RPC para aceite atômico na fila (elimina corrida/concorrência de técnicos)
CREATE OR REPLACE FUNCTION claim_queued_call(p_call_id UUID, p_provider_id UUID)
RETURNS SETOF service_calls AS $$
BEGIN
  RETURN QUERY
  UPDATE service_calls
  SET 
    provider_id = p_provider_id,
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_call_id 
    AND status = 'queued'
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
