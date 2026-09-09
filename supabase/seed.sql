-- ==============================================================================
-- Seed: 16 Serviços Essenciais do Repara RV (Rio Verde - GO)
-- ==============================================================================

-- Limpeza prévia da tabela de serviços rápidos (se necessário)
TRUNCATE TABLE quick_services CASCADE;

INSERT INTO quick_services (id, name, category, fixed_price, platform_fee, icon, is_active) VALUES
  -- Elétrica
  (uuid_generate_v4(), 'Troca de Chuveiro / Resistência', 'Elétrica', 70.00, 12.00, 'ShowerHead', true),
  (uuid_generate_v4(), 'Troca de Tomada / Interruptor / Lâmpada', 'Elétrica', 50.00, 12.00, 'Plug', true),
  (uuid_generate_v4(), 'Instalação de Ventilador de Teto', 'Elétrica', 120.00, 12.00, 'Fan', true),
  (uuid_generate_v4(), 'Instalação de Plafon / Painel LED', 'Elétrica', 60.00, 12.00, 'Lightbulb', true),

  -- Hidráulica
  (uuid_generate_v4(), 'Troca de Torneira / Sifão de Pia', 'Hidráulica', 60.00, 12.00, 'Droplet', true),
  (uuid_generate_v4(), 'Desentupimento de Ralo / Vaso Sanitário', 'Hidráulica', 100.00, 12.00, 'Pipette', true),
  (uuid_generate_v4(), 'Reparo de Caixa Acoplada', 'Hidráulica', 70.00, 12.00, 'Wrench', true),
  (uuid_generate_v4(), 'Vedação de Box / Pia com Silicone', 'Hidráulica', 60.00, 12.00, 'ShieldCheck', true),

  -- Montagem & Fixação
  (uuid_generate_v4(), 'Fixação de Suporte de TV / Cortina / Quadro', 'Montagem', 70.00, 12.00, 'Tv', true),
  (uuid_generate_v4(), 'Montagem / Desmontagem Móvel Pequeno', 'Montagem', 90.00, 12.00, 'Hammer', true),
  (uuid_generate_v4(), 'Instalação de Varal de Teto / Parede', 'Montagem', 80.00, 12.00, 'Shirt', true),
  (uuid_generate_v4(), 'Regulagem de Dobradiças e Gavetas', 'Montagem', 60.00, 12.00, 'Settings2', true),

  -- Chaveiro & Segurança
  (uuid_generate_v4(), 'Abertura de Porta (Bateu-Fechou)', 'Chaveiro', 100.00, 12.00, 'Key', true),
  (uuid_generate_v4(), 'Troca de Fechadura / Miolo de Porta', 'Chaveiro', 80.00, 12.00, 'Lock', true),

  -- Eletro & Cozinha
  (uuid_generate_v4(), 'Instalação de Máquina de Lavar', 'Instalação', 70.00, 12.00, 'WashingMachine', true),
  (uuid_generate_v4(), 'Troca de Mangueira e Registro de Gás', 'Instalação', 50.00, 12.00, 'Flame', true);
