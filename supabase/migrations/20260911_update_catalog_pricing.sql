-- ============================================================
-- Migration: Atualização de Piso de Preços do Catálogo de Serviços
-- Data: 2026-09-11
-- Localidade: Rio Verde - GO
-- ============================================================

-- 1. Eleva o piso de preços comerciais e repasse aos técnicos
UPDATE quick_services
SET 
  fixed_price = 75.00,
  platform_fee = 12.00,
  is_active = TRUE
WHERE name ILIKE '%chuveiro%' OR name ILIKE '%resistência%';

UPDATE quick_services
SET 
  fixed_price = 60.00,
  platform_fee = 10.00,
  is_active = TRUE
WHERE name ILIKE '%tomada%' OR name ILIKE '%interruptor%' OR name ILIKE '%lâmpada%';

UPDATE quick_services
SET 
  fixed_price = 130.00,
  platform_fee = 20.00,
  is_active = TRUE
WHERE name ILIKE '%ventilador%';

UPDATE quick_services
SET 
  fixed_price = 70.00,
  platform_fee = 12.00,
  is_active = TRUE
WHERE name ILIKE '%torneira%' OR name ILIKE '%sifão%';

UPDATE quick_services
SET 
  fixed_price = 110.00,
  platform_fee = 18.00,
  is_active = TRUE
WHERE name ILIKE '%desentupimento%';

UPDATE quick_services
SET 
  fixed_price = 75.00,
  platform_fee = 12.00,
  is_active = TRUE
WHERE name ILIKE '%suporte de tv%' OR name ILIKE '%cortina%' OR name ILIKE '%quadro%';

UPDATE quick_services
SET 
  fixed_price = 95.00,
  platform_fee = 15.00,
  is_active = TRUE
WHERE name ILIKE '%montagem%' OR name ILIKE '%móvel%';

UPDATE quick_services
SET 
  fixed_price = 120.00,
  platform_fee = 20.00,
  is_active = TRUE
WHERE name ILIKE '%abertura de porta%' OR name ILIKE '%bateu-fechou%';

UPDATE quick_services
SET 
  fixed_price = 85.00,
  platform_fee = 15.00,
  is_active = TRUE
WHERE name ILIKE '%fechadura%' OR name ILIKE '%miolo%';

UPDATE quick_services
SET 
  fixed_price = 70.00,
  platform_fee = 12.00,
  is_active = TRUE
WHERE name ILIKE '%visita%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%socorro%';

-- 2. Trava de segurança: impede que qualquer serviço ativo tenha valor inferior a R$ 60,00
UPDATE quick_services
SET 
  fixed_price = 70.00,
  platform_fee = 12.00
WHERE fixed_price < 50.00;
