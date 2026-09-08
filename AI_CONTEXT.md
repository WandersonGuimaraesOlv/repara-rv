# Repara RV — Especificação Técnica e Diretrizes de Engenharia (AI_CONTEXT)

Documento mestre de arquitetura, padrões de engenharia, conformidade jurídica/LGPD e diretrizes de SQA para o desenvolvimento do **Repara RV**.

---

## 1. Visão do Produto & Regras de Negócio
- **Produto:** PWA sob demanda estilo Uber para serviços residenciais em Rio Verde (GO).
- **Modelo Operacional:** Preço fixo tabelado (exclusivo mão de obra). Chamada instantânea por GPS.
- **Ciclo do Chamado:** O prestador mais próximo recebe alerta sonoro e tem 30 segundos para aceitar antes de pular para o próximo da fila.
- **Monetização:** Taxa fixa de intermediação retida via Split automático na API de pagamento Pix (média de R$ 12,00 por serviço finalizado). Sem venda de leads ou recarga prévia de créditos.

---

## 2. Stack Tecnológica & Infraestrutura
- **Front-end / Framework:** Next.js (App Router), React, TypeScript (modo estrito), Tailwind CSS e Shadcn/ui.
- **Design System:** Inspirado na Triider (fundo limpo `#F8FAFC`, texto `#0F172A`, CTAs vibrantes `#F97316`, cantos arredondados, visual de app nativo mobile-first).
- **Hospedagem & Runtime:** 100% Cloudflare Workers via `@opennextjs/cloudflare` e `wrangler`.
  - Configuração obrigatória: `compatibility_flags = ["nodejs_compat"]`.
  - Chamadas de pagamento via `fetch` REST nativo para evitar incompatibilidades de rede no runtime Edge.
- **Banco de Dados & Realtime:** Supabase (PostgreSQL 15+, PostGIS para geolocalização e Realtime para escuta de status).
- **PWA:** `@ducanh2912/next-pwa`, `manifest.json` configurado como `standalone`, assets estáticos servidos diretamente.

---

## 3. Conformidade Jurídica & Segurança no Código (CDC, LGPD e Risco Trabalhista)

### A. Mascaramento de Endereço (LGPD & Segurança do Cliente)
O prestador que está no radar **nunca** tem acesso ao endereço completo ou coordenadas exatas antes do aceite.
- Enquanto o chamado estiver com status `searching`, a API/RLS expõe apenas `neighborhood` (bairro) e `approximate_distance_km`.
- Apenas após a transição para `accepted` pelo prestador autenticado, os campos `client_address` e `client_location` são descriptografados/liberados.

### B. Proteção contra Vínculo Trabalhista (Zero Subordinação Algorítmica)
- Proibido aplicar penalidades, taxas de suspensão ou quedas punitivas de score para prestadores que recusarem chamados ou ficarem inativos.
- O timer de 30 segundos apenas remove a atribuição transitória e dispara para o próximo candidato.

### C. Split de Pagamento Automatizado (Blindagem Fiscal)
- As requisições de geração de Pix (`/api/pix/create`) devem incluir os metadados de marketplace split:
  - `fee_amount`: Taxa de intermediação destinada à conta da plataforma (ex: R$ 12,00).
  - `provider_amount`: Valor líquido destinado à subconta do prestador (ex: R$ 68,00).
  - `idempotency_key`: Chave única por chamado para evitar cobranças ou repasses em duplicidade.

---

## 4. Schema do Banco de Dados Atualizado (Supabase)

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

-- Perfis
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  document_number TEXT, -- CPF ou CNPJ MEI
  is_verified BOOLEAN DEFAULT FALSE, -- Validação de antecedentes criminais
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estado do Prestador (Radar / GPS)
CREATE TABLE provider_status (
  provider_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  current_location GEOMETRY(Point, 4326),
  pix_key TEXT NOT NULL,
  pix_key_type TEXT NOT NULL,
  recipient_gateway_id TEXT, -- ID da subconta no gateway para split
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_location ON provider_status USING GIST(current_location);

-- Catálogo de Serviços com Preço Fixo (Mão de Obra)
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
  
  -- Localização com mascaramento
  neighborhood TEXT NOT NULL, -- Visível no radar
  client_address TEXT NOT NULL, -- Protegido por RLS até o aceite
  client_location GEOMETRY(Point, 4326) NOT NULL,
  
  payment_status payment_status DEFAULT 'pending',
  pix_payment_id TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_service_calls_location ON service_calls USING GIST(client_location);

-- Políticas RLS (Segurança de Acesso)
ALTER TABLE service_calls ENABLE ROW LEVEL SECURITY;

-- Clientes acessam apenas seus próprios chamados
CREATE POLICY "Clientes gerenciam seus chamados"
ON service_calls FOR ALL
USING (auth.uid() = client_id);

-- Prestadores visualizam chamados abertos no radar (com endereço protegido por view/função) ou seus próprios
CREATE POLICY "Prestadores visualizam chamados aceitos ou abertos"
ON service_calls FOR SELECT
USING (
  (status = 'searching') OR (provider_id = auth.uid())
);
```

---

## 5. Requisitos de Frontend & UX Crítica

* **Alerta do Prestador:** Tocar arquivo de áudio em loop (`/sounds/alert.mp3`) e acionar `navigator.vibrate([200, 100, 200])` ao receber evento de novo chamado via Supabase Realtime.
* **Timer de Aceite:** Componente de barra regressiva de 30 segundos na tela do prestador. Se expirar, limpa o chamado da tela sem punição.
* **Deep Link de Navegação:** Botão na tela de chamado aceito apontando para:
  * Google Maps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  * Waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
* **Aviso Obrigatório de Material:** Inserir card visível na confirmação: *"Atenção: Os valores cobrem estritamente a mão de obra. Peças e conectores novos devem ser fornecidos pelo cliente."*
* **Rodapé Institucional Obrigatório (Decreto 7.962/13):** Exibição de Razão Social, CNPJ, endereço da sede em Rio Verde e link de SAC.

---

## 6. SQA & Pipeline de Qualidade (Sommerville & Pressman)

* **TypeScript:** Flag `"strict": true` sem permissão de `any`.
* **Análise Estática:** ESLint com regras do Next.js e verificação de complexidade ciclomática $\le 10$.
* **Testes Automatizados:**
  * Testes unitários para cálculo de split e utilitários de coordenadas (Vitest).
  * Testes de integração para idempotência do Webhook Pix.
* **Deploy:** Build automatizado com Wrangler via GitHub Actions / CLI para Cloudflare Workers.
