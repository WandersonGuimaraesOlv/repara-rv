<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repara RV — Instruções Completas de Engenharia, Segurança e Controle de Alucinações

Documento operacional para desenvolvimento, auditoria, refatoração, compliance e evolução segura da plataforma Repara RV.

**Ambiente:** Produção (https://repararv.com)  
**Praça de Atuação:** Rio Verde — GO  
**Stack Principal:** Next.js (App Router), TypeScript Estrito, Tailwind CSS, Supabase (PostgreSQL / PostGIS / Realtime), Cloudflare Workers via OpenNext (@opennextjs/cloudflare).

---

## 1. Princípio Central e Filosofia de Engenharia

O Repara RV conecta moradores de Rio Verde (GO) a prestadores de serviços residenciais de reparo rápido sob demanda (eletricistas, encanadores, montadores e chaveiros).

A meta da engenharia não é volume de código, mas **corretude estrita, estabilidade em produção, rastreabilidade e eliminação de alucinações técnicas**.

> **Regra de Ouro (Zero Alucinação):** Se uma tabela, coluna, enum, rota de API, variável de ambiente ou método de biblioteca não existe no repositório, nos schemas de migration, em `types/supabase.ts` ou no `package.json`, o agente está **proibido de supor sua existência**.

> **Proibição de Código Preguiçoso:** É vedado o uso de comentários como `// ... restante do código continua aqui` ou blocos incompletos. Toda alteração deve manter a integridade sintática do arquivo modificado.

> **Critério de Aceite Técnico:** Nenhuma alteração é considerada concluída se falhar em `npm run check:types`, na suíte de testes (`npx vitest run`) ou no build (`npm run build`).

---

## 2. Decisões de Negócio Consolidadas em Produção

Conflitos de versões anteriores foram superados e validados nas migrations e deploys ativos:

| Tema | Definição Oficial em Produção | Justificativa / Implementação |
| :--- | :--- | :--- |
| **Split de Pagamentos** | Via Chave Pix (Sem trava OAuth do Mercado Pago) | O morador paga via Pix no QR Code dinâmico do MP gerado pela plataforma; a Repara RV retém o Take Rate (R$ 10 a R$ 20) e repassa o valor líquido diretamente para a `pix_key` do prestador. A trava de OAuth foi removida. |
| **Garantia de Serviço** | 7 Dias Corridos | Reexecução gratuita da mão de obra em caso de falha de aperto, vedação ou fixação, expressa em `/termos` e no Comprovante de Manutenção. |
| **Responsabilidade de Peças** | Morador fornece peças e insumos | Blocos de escopo obrigatórios na interface: bloco verde "Incluso" (Mão de obra e testes técnicos) vs. bloco vermelho "Não Incluso" (Chuveiro novo, torneira, fiação, sifão), sempre com ícone lucide-react (`CheckCircle2` / `XCircle`) além da cor. Ícones na interface são lucide-react (traço 2, `aria-hidden`); emoji só em canais sem SVG (push, e-mail, mensagens do `wa.me`). |
| **Piso de Remuneração** | Mínimo R$ 50,00 líquidos ao prestador | Nenhum serviço ativo no catálogo remunera o técnico com menos de R$ 50 líquidos. A taxa da plataforma varia de R$ 10 a R$ 20 por chamado. |
| **Fila e Atribuição** | Fila Atômica (`queued`) com TTL de 2h | Chamados sem técnico imediato entram em `status = 'queued'` com `expires_at = NOW() + INTERVAL '2 hours'`. O aceite concorrente é travado no PostgreSQL via RPC `claim_queued_call`. |
| **Canal de Alertas** | Notificação dentro do app (push); **sem gateway de WhatsApp** | Decisão do dono em 21/09/2026: o risco de banimento dos números de WhatsApp da plataforma é maior que o ganho. Prestadores são avisados de chamado novo por push (`/painel` → "Ativar notificações", `modules/notifications/services/call-alerts.ts`); o cliente acompanha o status em `/acompanhar` (Realtime). Não integrar Z-API/Evolution nem outro disparo automático de WhatsApp. Continuam valendo os links `wa.me` de clique manual (despacho pelo admin e suporte), que não são envio automático. |
| **Radar de Ociosidade** | Alerta Vermelho > 5 minutos no Dashboard | Chamados na fila há mais de 5 minutos acionam o card de emergência em `/admin/dashboard` para acionamento manual via WhatsApp (`wa.me`). Em paralelo, um Cron Trigger de 1 minuto (`custom-worker.ts` → `/api/cron/stale-calls-radar`) manda e-mail ao time (`OPS_ALERT_EMAIL`, via Resend) quando um chamado cruza os 5 minutos. |
| **LGPD e Privacidade** | Mascaramento pré-aceite | Antes do aceite, o radar exibe apenas Bairro, Distância aproximada, Serviço e Valor Líquido. Endereço completo só é liberado após `status accepted`. |
| **Taxa de Deslocamento (No-Show)** | R$ 25,00 | Cobrada caso o morador não atenda o técnico no portão após 10 minutos de espera no local. |

---

## 3. Modelo de Dados e Banco (PostgreSQL / PostGIS / Supabase)

O schema remoto no projeto Supabase (`lvjahufllclmkqcbbrcu`) é a **única fonte da verdade**.

### Estrutura das Tabelas Críticas

**`service_calls`:**
- `id`: UUID (PK)
- `status`: Enum `ride_status` (`searching`, `queued`, `accepted`, `on_the_way`, `in_progress`, `completed`, `cancelled`, `expired`)
- `expires_at`: TIMESTAMPTZ (padrão de 2 horas para fila)
- `provider_id`: UUID (FK `profiles.id`, anulável enquanto na fila)
- `cancellation_reason`: TEXT (motivo registrado para alimentar métricas do dashboard)
- `total_price`: NUMERIC(10,2)
- `platform_fee`: NUMERIC(10,2) (taxa retida de R$ 10 a R$ 20)
- `provider_cut`: NUMERIC(10,2) (`total_price - platform_fee`)
- `neighborhood`, `client_address`, `latitude`, `longitude`

**`quick_services`:**
- `id`: UUID (PK)
- `name`, `category`, `fixed_price`, `platform_fee`, `is_active`
- `included`: TEXT[] (chips de escopo coberto)
- `not_included`: TEXT[] (chips de escopo não coberto)
- `duration_est`: TEXT (ex: `'40 min'`)

**`profiles`:**
- `id`: UUID (PK, vinculado a `auth.users`)
- `role`: `'client' | 'provider' | 'admin'`
- `pix_key`: TEXT (obrigatória para o técnico ficar online e receber chamados)
- `pix_key_type`: `'cpf' | 'cnpj' | 'email' | 'phone' | 'random'`
- `background_check_status`: `'pending' | 'approved' | 'rejected'`
- `is_blocked`: BOOLEAN (bloqueio preventivo imediato)
- `rating_avg`: NUMERIC(3,2) (padrão 5.00)
- `completed_orders_count`: INT

**`provider_status`:**
- `provider_id`: UUID (PK)
- `is_online`: BOOLEAN
- `location`: GEOGRAPHY(Point, 4326)

### Funções e Triggers Homologadas

**Aceite Atômico Anti-Corrida (`claim_queued_call`):**

```sql
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
```

**Busca Geoespacial Otimizada (`find_nearest_provider`):**
Exige estritamente `is_online = true`, GPS válido, `is_blocked = false` e `pix_key` preenchida.

```sql
CREATE OR REPLACE FUNCTION find_nearest_provider(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_service_id UUID DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 25.0
)
RETURNS TABLE (
  provider_id UUID,
  distance_km DOUBLE PRECISION,
  full_name TEXT,
  phone TEXT,
  pix_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.provider_id,
    (ST_Distance(ps.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0) AS distance_km,
    p.full_name,
    p.phone,
    p.pix_key
  FROM provider_status ps
  JOIN profiles p ON p.id = ps.provider_id
  WHERE ps.is_online = TRUE
    AND ps.location IS NOT NULL
    AND p.is_blocked = FALSE
    AND p.pix_key IS NOT NULL 
    AND TRIM(p.pix_key) <> ''
    AND ST_DWithin(ps.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000.0)
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Comando Obrigatório após Alteração de Schema:**

```sql
NOTIFY pgrst, 'reload schema';
```

---

## 4. Arquitetura de Aplicação e Runtime

A hospedagem é executada no Cloudflare Workers via OpenNext. As seguintes limitações de runtime são **inegociáveis**:

- **Incompatibilidade com Módulos Nativos do Node:** É proibido usar `fs`, `child_process`, `net`, `tls` ou sockets TCP brutos em rotas e ações.
- **Fetch Nativo:** Todas as requisições HTTP para APIs externas (Mercado Pago, Resend, push services) devem usar o `fetch()` nativo global.
- **Persistência e Expiração de Sessão SSR (`lib/auth-logout.ts`):** O encerramento de sessão deve sempre executar o ciclo triplo:
  1. Expiração forçada de cookies no `document.cookie` (`max-age=0`);
  2. Purga de chaves locais no `localStorage` e `sessionStorage` (`sb-*`, dados do usuário);
  3. Chamada à rota `/api/auth/signout` com resposta que aplica `Set-Cookie` expirados;
  4. Redirecionamento forçado via `window.location.href = '/'` para invalidar a memória em cache do PWA.
- **Suporte a Tema (Light / Dark Mode):** Gerenciado via `next-themes` com atributo de classe (`<html class="dark">`), com supressão de aviso de hidratação (`suppressHydrationWarning`) no layout raiz e verificação de montagem no componente de toggle.

---

## 5. A Trinca da Torre de Controle Operacional (`/admin`)

Toda manutenção ou adição ao módulo administrativo deve respeitar os seguintes contratos:

### `/admin/dashboard`
- **Radar de Chamados Estagnados:** Monitora chamados em `queued`. Se `Date.now() - created_at > 5 minutos`, exibe o alerta visual pulsante e botão de ação rápida para despacho emergencial.
- **Despacho via WhatsApp Seguro:** Monta links para `wa.me/5564...` higienizados com `encodeURIComponent()` contendo o link de resgate direto: `https://repararv.com/painel?claim=[CALL_ID]`.
- **Segregação Financeira:** Divide estritamente GMV (volume total transacionado), Receita da Plataforma (soma das taxas) e Repasse aos Prestadores.
- **Diagnóstico de Cancelamento:** Consolida os motivos de cancelamento prevenindo divisão por zero (`totalCancelled > 0 ? (count / totalCancelled) * 100 : 0`). Dispara alerta se "Demora" exceder 40%.
- **Cleanup do Supabase Realtime:** Todo listener em canal WebSocket da tabela `service_calls` deve obrigatoriamente chamar `supabase.removeChannel(channel)` no retorno do `useEffect`.

### `/admin/servicos`
- **Calculadora de Repasse:** Exibe em tempo real o valor líquido `Preço Fixo - Taxa da Plataforma`.
- **Trava do Piso de R$ 50:** Se o repasse resultar em valor inferior a R$ 50,00, exibe aviso âmbar alertando o risco de rejeição em Rio Verde.
- **Toggle Instantâneo (`is_active`):** Permite pausar serviços sem técnicos no plantão, ocultando-os imediatamente do catálogo do cliente.
- **Gestão de Escopo:** Permite manipular arrays de tags `included` e `not_included` que alimentam as caixas verde e vermelha no portão do cliente.

### `/admin/usuarios`
- **Gestão de Chave Pix:** Exibe a Chave Pix com botão de cópia rápida e badge "Pix Ativo".
- **Compliance e Antecedentes:** Seletor com persistência em `background_check_status` (`approved`, `pending`, `rejected`).
- **Bloqueio Preventivo:** Chave de suspensão direta (`is_blocked = true`), derrubando o prestador do radar em tempo real.
- **Comunicação 1-Clique:** Botão para abrir conversa administrativa pré-formatada no WhatsApp do prestador (DDD 64).

---

## 6. Diretrizes Anti-Alucinação e Rigor de Código

### TypeScript e Tipagem
- **Proibição de Tipos Fracos:** Vetado o uso de `any`, `as any`, `as unknown as T` ou interfaces duplicadas. Se um tipo não existe, deve ser inferido do schema do Supabase (`types/supabase.ts`) ou gerado via Zod.
- **Discriminated Unions:** Estados de chamados (`ride_status`) e pagamentos devem ser tratados exaustivamente. Não mascarar estados inexistentes com encadeamentos opcionais aleatórios (`call?.provider?.status?.something`).

### Validação de Entrada (Defesa na Borda)
Toda Server Action, Route Handler e Webhook deve validar parâmetros de entrada com esquemas Zod antes de qualquer chamada ao banco:

```typescript
import { z } from 'zod';

export const claimCallSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
  providerId: z.string().uuid('ID do prestador inválido'),
});
```

Respostas de erro devem ser semânticas (`400`, `401`, `403`, `404`, `409`, `422`, `500`) sem vazar detalhes internos do banco, tokens ou stack traces para o frontend.

---

## 7. Documentos Legais e Compliance (Atualizados em 13/09/2026)

| Documento | Rota | Arquivo |
| :--- | :--- | :--- |
| Termos de Uso (18 cláusulas) | `/termos` | `app/termos/page.tsx` |
| Política de Privacidade LGPD (10 seções) | `/privacidade` | `app/privacidade/page.tsx` |
| Contrato do Técnico Parceiro (9 cláusulas) | `/contrato` | `app/contrato/page.tsx` |

**Regras de compliance obrigatórias:**
- Checkbox de aceite de termos no cadastro: **sempre iniciar desmarcado** (`useState(false)`). Nunca pré-marcar.
- Os links de Termos, Privacidade e Contrato devem estar clicáveis e abrir em nova aba.
- O botão de submissão do cadastro deve bloquear enquanto `!termsAccepted`.
- A trilha de auditoria de aceite (`terms_accepted_at`) deve ser gravada no backend no momento do registro.

---

## 8. Protocolo de Auditoria e Limpeza em Duas Fases

### Fase 1 — Auditoria Somente Leitura
O agente não remove, move ou renomeia nenhum arquivo. Executa a análise de código morto, dependências órfãs no `package.json`, resquícios de migrações ou lógicas antigas (ex: travas antigas de OAuth do MP). Pode utilizar ferramentas de suporte como `npx knip`.

Produz um relatório categorizado em:
- `[Seguro para remover]`
- `[Requer confirmação]`
- `[Preservar]`
- `[Risco de produção]`

### Fase 2 — Execução Controlada
Só inicia após aprovação explícita do desenvolvedor humano. Deve ser executada em branch dedicada:

```bash
git checkout -b chore/code-cleanup-audit
```

Após cada lote de remoção, os seguintes testes devem ser validados sequencialmente:

```bash
npm run check:types
npx vitest run
npm run build
```

Se qualquer comando falhar, a remoção deve ser **revertida imediatamente**.

---

## 9. Checklist de Homologação Pré-Deploy

Antes de subir qualquer versão para o Cloudflare Workers, valide:

- [ ] `npm run check:types` executou com **0 erros**.
- [ ] `npx vitest run` passou em **100%** dos testes unitários e de integração.
- [ ] Nenhuma credencial ou chave privada está exposta em commits, arquivos `.env` commitados ou textos públicos.
- [ ] As alterações no banco foram salvas em arquivo de migration (`supabase/migrations/YYYYMMDD_*.sql`).
- [ ] A rotação de schema cache (`NOTIFY pgrst, 'reload schema'`) foi incluída caso novas colunas ou enums tenham sido criados.
- [ ] O radar de privacidade mascara o endereço completo e coordenadas antes do aceite do chamado (`status = 'accepted'`).
- [ ] O botão de logout realiza a purga completa de storage e cookies com redirecionamento limpo.
- [ ] O PWA manifesta comportamento estável em `standalone` (iOS Safari e Android Chrome).

---

## 10. Stack Tecnológica e Estrutura do Repositório

| Camada | Tecnologia |
| :--- | :--- |
| **Framework Web** | Next.js (App Router + Turbopack) |
| **Linguagem** | TypeScript 5 (Modo Estrito — `strict: true`) |
| **Estilização** | Tailwind CSS 4 + Lucide Icons |
| **Banco de Dados** | Supabase (PostgreSQL 15 / PostGIS / Realtime) — `sa-east-1` |
| **Hospedagem** | Cloudflare Workers via `@opennextjs/cloudflare` |
| **Pagamentos** | Mercado Pago Pix (QR Code dinâmico + Webhook) |
| **Testes** | Vitest (ESM nativo, fake timers, 15+ testes) |

```text
repara-rv/
├── AGENTS.md                   # Este arquivo — lido por todo agente ao iniciar
├── AI_CONTEXT.md               # Contexto adicional de produto e schema SQL
├── AI_GUARDRAILS.md            # Guardrails técnicos e padrões de código
├── TAREFAS_FUNDADOR.md         # Checklist operacional e jurídico dos fundadores
├── app/
│   ├── (client)/page.tsx       # Home estilo Triider
│   ├── termos/page.tsx         # Termos de Uso (18 cláusulas)
│   ├── privacidade/page.tsx    # Política de Privacidade LGPD (10 seções)
│   ├── contrato/page.tsx       # Contrato do Técnico Parceiro (9 cláusulas)
│   ├── cadastro/page.tsx       # Cadastro com aceite clickwrap LGPD
│   └── api/                   # Route Handlers (Zod validado, sem módulos Node)
├── lib/
│   ├── catalog.ts             # Catálogo de serviços com escopo incluso/não incluso
│   ├── types.ts               # Tipos centrais TypeScript
│   └── supabase/              # Clientes browser, server e admin
└── types/supabase.ts          # Tipos gerados do banco — ÚNICA fonte de verdade
```
