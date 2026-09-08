-- ============================================================
-- REPARA RV — Schema Supabase / PostgreSQL (Idempotente)
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENUMS (Criação segura / Idempotente)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM (
    'searching',
    'accepted',
    'on_the_way',
    'in_progress',
    'completed',
    'cancelled',
    'no_providers_available'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cancel_reason AS ENUM (
    'client_request',
    'provider_absent',
    'wrong_address',
    'technical_issue',
    'no_provider_found',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABELAS
-- ============================================================

-- 1. Perfis
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'client',
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin vê todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Usuário vê e edita o próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Perfis visíveis para leitura" ON profiles;
DROP POLICY IF EXISTS "Usuário edita o próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuário insere o próprio perfil" ON profiles;

-- Leitura de perfis aberta para participantes (cliente vê prestador e vice-versa)
CREATE POLICY "Perfis visíveis para leitura"
  ON profiles FOR SELECT
  USING (TRUE);

CREATE POLICY "Usuário edita o próprio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Usuário insere o próprio perfil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Status do Prestador (Radar / GPS)
CREATE TABLE IF NOT EXISTS provider_status (
  provider_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online         BOOLEAN DEFAULT FALSE,
  current_location  GEOMETRY(Point, 4326),
  pix_key           TEXT NOT NULL,
  pix_key_type      TEXT NOT NULL, -- 'cpf' | 'phone' | 'email' | 'random'
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_location ON provider_status USING GIST(current_location);

ALTER TABLE provider_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prestador gerencia seu próprio status" ON provider_status;
CREATE POLICY "Prestador gerencia seu próprio status"
  ON provider_status FOR ALL
  USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Prestadores online visíveis para clientes autenticados" ON provider_status;
CREATE POLICY "Prestadores online visíveis para clientes autenticados"
  ON provider_status FOR SELECT
  USING (
    is_online = TRUE
    AND auth.uid() IS NOT NULL
  );

-- 3. Catálogo de Serviços
CREATE TABLE IF NOT EXISTS quick_services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  fixed_price   NUMERIC(10, 2) NOT NULL,
  platform_fee  NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  icon          TEXT,
  color         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0
);

ALTER TABLE quick_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Serviços ativos visíveis a todos" ON quick_services;
CREATE POLICY "Serviços ativos visíveis a todos"
  ON quick_services FOR SELECT
  USING (TRUE);

-- 4. Chamados
CREATE TABLE IF NOT EXISTS service_calls (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES profiles(id),
  provider_id      UUID REFERENCES profiles(id),
  service_id       UUID NOT NULL REFERENCES quick_services(id),
  total_price      NUMERIC(10, 2) NOT NULL,
  platform_fee     NUMERIC(10, 2) NOT NULL,
  provider_cut     NUMERIC(10, 2) NOT NULL,
  status           ride_status DEFAULT 'searching',
  client_address   TEXT NOT NULL,
  client_location  GEOMETRY(Point, 4326) NOT NULL,
  cancel_reason    cancel_reason,
  cancel_note      TEXT,
  payment_status   payment_status DEFAULT 'pending',
  pix_payment_id   TEXT,
  pix_qr_code      TEXT,
  pix_copy_paste   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_service_calls_location ON service_calls USING GIST(client_location);
CREATE INDEX IF NOT EXISTS idx_service_calls_status ON service_calls (status);
CREATE INDEX IF NOT EXISTS idx_service_calls_client ON service_calls (client_id);
CREATE INDEX IF NOT EXISTS idx_service_calls_provider ON service_calls (provider_id);

ALTER TABLE service_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cliente vê e cria seus chamados" ON service_calls;
CREATE POLICY "Cliente vê e cria seus chamados"
  ON service_calls FOR ALL
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Prestador vê chamados 'searching' e os seus" ON service_calls;
CREATE POLICY "Prestador vê chamados 'searching' e os seus"
  ON service_calls FOR SELECT
  USING (
    status = 'searching'
    OR auth.uid() = provider_id
  );

DROP POLICY IF EXISTS "Prestador atualiza chamados atribuídos" ON service_calls;
CREATE POLICY "Prestador atualiza chamados atribuídos"
  ON service_calls FOR UPDATE
  USING (auth.uid() = provider_id);

-- 5. Avaliações
CREATE TABLE IF NOT EXISTS service_ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id     UUID UNIQUE REFERENCES service_calls(id) ON DELETE CASCADE,
  rating      INT CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Avaliações visíveis para os envolvidos" ON service_ratings;
CREATE POLICY "Avaliações visíveis para os envolvidos"
  ON service_ratings FOR ALL
  USING (TRUE);

-- ============================================================
-- FUNCTION: Buscar prestador mais próximo disponível
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearest_provider(
  call_location GEOMETRY(Point, 4326),
  excluded_ids  UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  nearest_provider_id UUID;
BEGIN
  SELECT ps.provider_id INTO nearest_provider_id
  FROM provider_status ps
  WHERE ps.is_online = TRUE
    AND ps.current_location IS NOT NULL
    AND NOT (ps.provider_id = ANY(excluded_ids))
    AND NOT EXISTS (
      SELECT 1 FROM service_calls sc
      WHERE sc.provider_id = ps.provider_id
        AND sc.status IN ('accepted', 'on_the_way', 'in_progress')
    )
  ORDER BY ps.current_location <-> call_location
  LIMIT 1;

  RETURN nearest_provider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME: Habilitar tabelas
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE service_calls;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE provider_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SEED: Catálogo Inicial de Serviços em Rio Verde
-- ============================================================
INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Troca de Chuveiro / Resistência', 'Elétrica', 'Substituição de chuveiro ou resistência elétrica com teste de funcionamento.', 70.00, 10.00, 'zap', '#6366F1', 1
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Troca de Chuveiro / Resistência');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Troca de Tomada / Interruptor / Lâmpada', 'Elétrica', 'Instalação ou substituição de tomadas, interruptores e lâmpadas residenciais.', 50.00, 10.00, 'plug', '#6366F1', 2
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Troca de Tomada / Interruptor / Lâmpada');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Instalação de Ventilador de Teto', 'Elétrica', 'Montagem e instalação elétrica de ventilador de teto com suporte.', 120.00, 15.00, 'wind', '#6366F1', 3
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Instalação de Ventilador de Teto');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Troca de Torneira / Sifão de Pia', 'Hidráulica', 'Substituição de torneira ou sifão com vedação e teste de estanqueidade.', 60.00, 10.00, 'droplets', '#06B6D4', 4
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Troca de Torneira / Sifão de Pia');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Desentupimento Ralo / Vaso Sanitário', 'Hidráulica', 'Desentupimento mecânico de ralos, pias e vasos sanitários.', 100.00, 15.00, 'waves', '#06B6D4', 5
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Desentupimento Ralo / Vaso Sanitário');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Fixação de Suporte de TV / Cortina / Quadro', 'Montagem', 'Instalação de suportes, varões de cortina e quadros com furação adequada.', 70.00, 10.00, 'tv-2', '#F59E0B', 6
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Fixação de Suporte de TV / Cortina / Quadro');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Montagem / Desmontagem Móvel Pequeno', 'Montagem', 'Montagem ou desmontagem de estantes, gaveteiros, berços e móveis pequenos.', 90.00, 10.00, 'package', '#F59E0B', 7
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Montagem / Desmontagem Móvel Pequeno');

INSERT INTO quick_services (name, category, description, fixed_price, platform_fee, icon, color, sort_order)
SELECT 'Visita Diagnóstico / Socorro Geral 24h', 'Emergência', 'Visita emergencial para diagnóstico e primeiros reparos. Disponível 24 horas.', 50.00, 10.00, 'ambulance', '#EF4444', 8
WHERE NOT EXISTS (SELECT 1 FROM quick_services WHERE name = 'Visita Diagnóstico / Socorro Geral 24h');
