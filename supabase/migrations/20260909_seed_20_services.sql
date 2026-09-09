-- ============================================================
-- REPARA RV — Migration: Seed do Catálogo Expandido (20 Serviços)
-- Arquivo : supabase/migrations/20260909_seed_20_services.sql
-- Etapa   : 2 (Plano de Desenvolvimento Faseado)
-- Data    : 2026-09-09
-- ============================================================

-- Garante que o platform_fee default seja R$ 12.00 conforme AI_GUARDRAILS
ALTER TABLE quick_services 
  ALTER COLUMN platform_fee SET DEFAULT 12.00;

-- Atualização e Inserção Idempotente dos 20 Serviços Oficiais
-- (16 originais padronizados + 4 novos essenciais)

-- ── 1. Elétrica ──
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('8b5c4095-e56f-4066-80c4-37f359ee47c2', 'Troca de Chuveiro / Resistência', 'Elétrica', 'Substituição de chuveiro ou resistência elétrica com teste de funcionamento e vedação.', 70.00, 12.00, 'ShowerHead', '#F59E0B', 1, true),
  ('88b9104b-be4f-4b44-a6cf-5eff3748b60b', 'Troca de Tomada / Interruptor / Lâmpada', 'Elétrica', 'Instalação ou substituição de tomadas, interruptores e lâmpadas residenciais.', 50.00, 12.00, 'Plug', '#F59E0B', 2, true),
  ('2a09df38-84b4-4853-bdff-338e27981930', 'Instalação de Ventilador de Teto', 'Elétrica', 'Montagem e instalação elétrica de ventilador de teto com suporte e balanceamento.', 120.00, 12.00, 'Fan', '#F59E0B', 3, true),
  ('c6663a89-bab1-465f-937e-a4b366350cc7', 'Instalação de Plafon / Painel LED', 'Elétrica', 'Fixação e ligação elétrica de luminárias de sobrepor ou embutir tipo plafon / LED.', 60.00, 12.00, 'Lightbulb', '#F59E0B', 4, true),
  ('4b58ef09-8b01-49b8-a621-eef671239920', 'Troca de Disjuntor / Pane Elétrica', 'Elétrica', 'Diagnóstico de sobrecarga, substituição de disjuntor defeituoso no quadro geral.', 80.00, 12.00, 'zap', '#F59E0B', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price,
  platform_fee = EXCLUDED.platform_fee,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ── 2. Hidráulica ──
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('1e6d94df-5e8d-49ec-9c1b-6d30f99b9529', 'Troca de Torneira / Sifão de Pia', 'Hidráulica', 'Substituição de torneira, flexível ou sifão de pia com fita veda-rosca e teste de estanqueidade.', 60.00, 12.00, 'Droplet', '#06B6D4', 6, true),
  ('f1698097-5802-4a0f-b529-5003490c2855', 'Desentupimento de Ralo / Vaso Sanitário', 'Hidráulica', 'Desobstrução rápida de encanamento de ralo, pia ou vaso sanitário com equipamento manual.', 100.00, 12.00, 'Pipette', '#06B6D4', 7, true),
  ('4cf805b2-09f3-4ecb-8623-11a687e0ae39', 'Reparo de Caixa Acoplada', 'Hidráulica', 'Ajuste ou troca de mecanismo de entrada/saída, boia e vedação de caixa acoplada.', 70.00, 12.00, 'Wrench', '#06B6D4', 8, true),
  ('5ed20888-b613-47e6-8ae7-83020a3c0914', 'Vedação de Box / Pia com Silicone', 'Hidráulica', 'Aplicação de silicone antifungo para vedação perfeita contra infiltração em pias e box.', 60.00, 12.00, 'ShieldCheck', '#06B6D4', 9, true),
  ('7a1e5052-19e4-4d89-b873-12502ef56291', 'Reparo de Válvula de Descarga (Hydra/Docol)', 'Hidráulica', 'Substituição do cartucho e vedação de válvula de descarga embutida com regulagem.', 80.00, 12.00, 'Droplet', '#06B6D4', 10, true),
  ('3f990145-2e6b-4e12-870e-3fa128cd6109', 'Troca / Reparo Torneira com Misturador', 'Hidráulica', 'Instalação ou conserto de torneira monocomando ou misturador de água quente/fria.', 80.00, 12.00, 'Droplet', '#06B6D4', 11, true),
  ('9d82136e-5a7c-47b2-bdcf-8869c9b13922', 'Troca ou Instalação de Vaso Sanitário', 'Hidráulica', 'Remoção de louça antiga, fixação de novo vaso com anel de cera, bolsa e vedação de silicone.', 120.00, 12.00, 'Wrench', '#06B6D4', 12, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price,
  platform_fee = EXCLUDED.platform_fee,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ── 3. Montagem e Fixação ──
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('db0b0819-8a5a-49bc-8faa-a393c2b65cc4', 'Fixação de Suporte de TV / Cortina / Quadro', 'Montagem', 'Perfuração precisa em alvenaria e fixação segura de suporte de TV, varão de cortina ou nichos.', 70.00, 12.00, 'Tv', '#8B5CF6', 13, true),
  ('966fea9b-d7eb-483f-9309-c971d64d2b77', 'Montagem / Desmontagem Móvel Pequeno', 'Montagem', 'Montagem de móveis avulsos como mesas de cabeceira, cadeiras de escritório, sapateiras e mesas.', 90.00, 12.00, 'Hammer', '#8B5CF6', 14, true),
  ('fb25cfbe-3e7c-4107-bcbe-f40124e09599', 'Instalação de Varal de Teto / Parede', 'Montagem', 'Fixação firme e alinhamento de varal articulado ou de teto com cordas e roldanas.', 80.00, 12.00, 'Shirt', '#8B5CF6', 15, true),
  ('bc59db09-9149-4eb8-a57c-659f195ff8d5', 'Regulagem de Dobradiças e Gavetas', 'Montagem', 'Alinhamento de portas de armários desreguladas, troca de puxadores e ajuste de trilhos de gaveta.', 60.00, 12.00, 'Settings2', '#8B5CF6', 16, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price,
  platform_fee = EXCLUDED.platform_fee,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ── 4. Chaveiro ──
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('15dc3813-d19e-4c09-9dc9-7690a3141a1b', 'Abertura de Porta (Bateu-Fechou)', 'Chaveiro', 'Abertura rápida e sem danos de portas residenciais trancadas acidentalmente.', 100.00, 12.00, 'Key', '#EAB308', 17, true),
  ('d8505766-6373-460c-acd2-34bfb0372b46', 'Troca de Fechadura / Miolo de Porta', 'Chaveiro', 'Substituição completa de fechadura de sobrepor ou miolo de cilindro para nova chave.', 80.00, 12.00, 'Lock', '#EAB308', 18, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price,
  platform_fee = EXCLUDED.platform_fee,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ── 5. Instalação & Eletrodomésticos ──
INSERT INTO quick_services (id, name, category, description, fixed_price, platform_fee, icon, color, sort_order, is_active)
VALUES 
  ('65943f94-fdd6-48a1-a3d0-ffbb6dd88def', 'Instalação de Máquina de Lavar', 'Instalação', 'Conexão hidráulica (entrada/saída de água), nivelamento dos pés e teste de centrifugação.', 70.00, 12.00, 'WashingMachine', '#10B981', 19, true),
  ('53102e50-835e-4132-a4f3-02929e52e44b', 'Troca de Mangueira e Registro de Gás', 'Instalação', 'Troca preventiva de mangueira trançada e regulador de pressão de gás com teste de espuma de sabão.', 50.00, 12.00, 'Flame', '#10B981', 20, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  fixed_price = EXCLUDED.fixed_price,
  platform_fee = EXCLUDED.platform_fee,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
