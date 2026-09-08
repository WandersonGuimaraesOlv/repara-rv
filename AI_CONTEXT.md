# Repara RV — Especificação Técnica e Diretrizes de Engenharia (AI_CONTEXT)

Documento mestre de arquitetura, padrões de engenharia, modelo de conformidade ágil e diretrizes de SQA para o desenvolvimento do **Repara RV**.

---

## 1. Visão do Produto & Regras de Negócio
- **Produto:** PWA sob demanda estilo Uber para serviços residenciais rápidos em Rio Verde (GO).
- **Modelo Operacional:** Preço fixo tabelado (exclusivo mão de obra). Chamada instantânea por geolocalização.
- **Ciclo do Chamado:** O prestador mais próximo recebe alerta sonoro/vibração e tem até 30 segundos para aceitar antes do repasse automático ao próximo do radar.
- **Monetização:** Taxa fixa retida via Split automático na API de Pix (média de R$ 12,00 por serviço). Sem venda de leads ou recarga prévia de créditos.

---

## 2. Onboarding Ágil & Modelo Jurídico Sem Atrito (MVP)

Para maximizar a captação de prestadores sem infligir a legislação brasileira:

* **Cadastro Pessoa Física (CPF):** Dispensa exigência de MEI ou abertura de empresa. Split de Pix liquidado diretamente na conta bancária vinculada ao CPF do profissional.
* **Autodeclaração em Substituição a Certidões:** Dispensa envio prévio de certidão de antecedentes criminais e comprovante de endereço. O prestador aceita o checkbox vinculante no primeiro acesso:
  > *"Declaro, sob as penas da lei, ser profissional autônomo capacitado, não possuir antecedentes criminais e assumir responsabilidade civil direta pelos serviços executados."*
* **SAC Minimalista Conforme Decreto 7.962/13:** Link direto para WhatsApp de suporte e e-mail no rodapé e na tela de acompanhamento de chamados.
* **Mascaramento de Dados (LGPD):** O prestador no radar enxerga apenas `neighborhood` (bairro) e `approximate_distance_km`. Endereço exato e coordenadas só são liberados após transição para status `accepted`.
* **Zero Subordinação Trabalhista:** O algoritmo não aplica advertências, suspensões ou rebaixamento de conta para prestadores que recusarem chamados ou ficarem inativos.

### D. Central de Segurança & Botão SOS
- **Visibilidade:** Durante os status `accepted`, `on_the_way` e `in_progress`, exibir um ícone discreto de escudo/segurança no topo da tela do cliente e do prestador.
- **Ação do Botão:**
  1. Registra o evento na tabela `emergency_alerts` com coordenadas atuais.
  2. Dispara a rota `/api/emergency/notify` enviando dados completos do chamado para o WhatsApp/Telegram de suporte dos fundadores.
  3. Redireciona o usuário para `tel:190` via deep link nativo.
- **Blindagem Jurídica & Confiança:** Cumpre o dever de vigilância e cuidado (CDC) e reduz a barreira de entrada para clientes (especialmente mulheres e idosos) e prestadores em domicílio desconhecido.

---

## 3. Stack Tecnológica & Infraestrutura
- **Front-end:** Next.js (App Router), React, TypeScript (`strict: true`), Tailwind CSS e Shadcn/ui.
- **Design System:** Inspirado na Triider (fundo limpo `#F8FAFC`, tipografia Inter, CTAs vibrantes `#F97316`, cantos arredondados e navegação mobile-first).
- **Hospedagem:** Cloudflare Workers via `@opennextjs/cloudflare` e `wrangler`.
  - Configuração: `compatibility_flags = ["nodejs_compat"]`.
  - Chamadas de API Pix via `fetch` REST nativo para compatibilidade com o runtime Edge.
- **Banco de Dados & Realtime:** Supabase (PostgreSQL 15+, PostGIS e Supabase Realtime).
- **PWA:** `@ducanh2912/next-pwa`, `manifest.json` com `display: standalone`.

---

## 4. Schema do Banco de Dados (Supabase)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TYPE user_role AS ENUM ('client', 'provider', 'admin');
CREATE TYPE ride_status AS ENUM (
  'searching',
  'accepted',
  'on_the_way',
  'in_progress',
  'completed',
  'cancelled'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');

-- Perfis (Fluxo Simplificado para PF e MEI)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf_or_cnpj TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ DEFAULT NOW(),
  self_declaration_signed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estado Operacional do Prestador (Radar / GPS)
CREATE TABLE provider_status (
  provider_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  current_location GEOMETRY(Point, 4326),
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  recipient_gateway_id TEXT, -- ID do recebedor para split na API
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_location ON provider_status USING GIST(current_location);

-- Catálogo de Serviços Fechados
CREATE TABLE quick_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  fixed_price NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 12.00,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Chamados
CREATE TABLE service_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  provider_id UUID REFERENCES profiles(id),
  service_id UUID NOT NULL REFERENCES quick_services(id),
  
  total_price NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  provider_cut NUMERIC(10, 2) NOT NULL,
  
  status ride_status DEFAULT 'searching',
  
  -- Localização
  neighborhood TEXT NOT NULL, -- Exibido no radar público
  client_address TEXT NOT NULL, -- Liberado apenas pós-aceite
  client_location GEOMETRY(Point, 4326) NOT NULL,
  
  payment_status payment_status DEFAULT 'pending',
  pix_payment_id TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_service_calls_location ON service_calls USING GIST(client_location);

-- Políticas RLS
ALTER TABLE service_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes gerenciam seus chamados"
ON service_calls FOR ALL
USING (auth.uid() = client_id);

CREATE POLICY "Prestadores visualizam chamados abertos ou próprios"
ON service_calls FOR SELECT
USING (
  (status = 'searching') OR (provider_id = auth.uid())
);

-- Tabela de Alertas de Emergência (Central de Segurança / Botão SOS)
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES service_calls(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES profiles(id),
  user_role user_role NOT NULL,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários envolvidos podem acionar emergência"
ON emergency_alerts FOR INSERT
WITH CHECK ( auth.uid() = triggered_by );
```

