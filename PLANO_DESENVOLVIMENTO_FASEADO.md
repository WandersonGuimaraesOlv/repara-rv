# Repara RV — Plano de Desenvolvimento Faseado e Estratégia de Deploy Seguro

Este guia estabelece o fluxo de trabalho técnico para implementar as novas funcionalidades (Painel Admin, Auditoria Universal, Botão SOS e Catálogo de 20 serviços) garantindo isolamento total do código de produção, testes contínuos e risco zero de indisponibilidade.

---

## Estratégia de Isolamento: Ambientes e Git Flow

Para nunca quebrar a versão funcional em produção (`https://repararv.com`), o ciclo de trabalho segue o modelo de branches protegidas e deploys de pré-visualização (Preview Deploys).

```plaintext
[feature/nome-da-tarefa] ──> [staging] ──> [main (Produção)]
│                     │
(Preview Worker)      (Homologação)
```

* **Branch `main`:** Exclusiva de produção. Bloqueada para commits diretos. Recebe código apenas via Pull Request aprovado.
* **Branch `staging`:** Ambiente de homologação idêntico a produção, conectado a uma base de dados espelho ou projeto de homologação do Supabase.
* **Branches de Feature (`feat/nome`, `fix/nome`):** Ramificações criadas a partir de `staging` para desenvolver cada etapa isoladamente.
* **Previews na Cloudflare:** Cada commit em uma branch de feature gera automaticamente uma URL temporária de teste (`https://feat-xyz.repararv.workers.dev`) sem afetar o domínio principal.

---

## Matriz de Execução por Etapas

| Etapa | Foco | Risco em Produção | Critério de Aceite / Teste |
| :---: | :--- | :---: | :--- |
| **0** | Blindagem Git, Ambientes & Migrations | Zero | Preview deploys ativos e CLI do Supabase pareada |
| **1** | Banco de Dados, Triggers e Auditoria | Baixo | Trigger grava `service_audit_logs` sem falha em inserts manuais |
| **2** | Seed dos 20 Serviços & Tipagem Estrita | Baixo | Script de seed roda com sucesso e `types/supabase.ts` atualizado |
| **3** | Backoffice: CRUD de Serviços (`/admin`) | Baixo | Edição de preços e ativação de serviços funcionando sem downtime |
| **4** | Módulo de Segurança SOS & Auditoria | Baixo | Clique no botão abre discador 190 e grava log de emergência |
| **5** | Radar de Cancelamentos & Analytics | Médio | Filtros de cancelamento exibindo métricas precisas no dashboard |
| **6** | Homologação Integrada (End-to-End) | Alto (pré-deploy) | Fluxo completo testado no ambiente Staging |
| **7** | Deploy em Produção & Rollback Plan | Crítico | Merge para `main` sem regressões visuais ou de banco |

---

## Detalhamento das Etapas

### Etapa 0: Configuração de Branches e Migrações Seguras
- [ ] Criar a branch `staging` a partir da `main`:
  ```bash
  git checkout -b staging
  git push origin staging
  ```
- [ ] Configurar o projeto no painel da Cloudflare para que deploys da branch `main` vão para produção e qualquer outra branch receba uma URL de Preview.
- [ ] Garantir que toda alteração de banco seja versionada exclusivamente via arquivos `.sql` na pasta `supabase/migrations/` (nunca alterar tabelas manualmente pela interface do Supabase em produção).

---

### Etapa 1: Infraestrutura de Banco e Trigger de Auditoria Universal
**Branch**: `feat/db-audit-and-cancellations`

- [ ] Criar a migration `supabase/migrations/20260909_audit_and_cancellation.sql`:
  - Adicionar colunas em `service_calls` (`arrived_at`, `cancelled_by`, `cancelled_by_role`, `cancellation_reason`, `cancellation_stage`, `cancel_by`, `cancel_metadata`).
  - Criar a tabela `service_audit_logs` com integridade referencial, RLS e garantia de imutabilidade (append-only).
  - Criar a função `log_service_call_changes()` e o trigger `trigger_audit_service_calls`.
- [ ] **Teste da Etapa**:
  - Executar um INSERT e um UPDATE de teste no banco de desenvolvimento.
  - Validar se a linha correspondente apareceu na tabela `service_audit_logs` contendo os JSONs `old_payload` e `new_payload`.

---

### Etapa 2: Catálogo Expandido (20 Serviços) e Tipagem Estrita
**Branch**: `feat/catalog-expansion`

- [ ] Criar a migration `supabase/migrations/20260909_seed_20_services.sql` contendo o catálogo atualizado (16 originais + 4 novos: reparo de descarga, reparo de torneira, troca de vaso e pane em disjuntor).
- [ ] Rodar a extração dos tipos TypeScript para manter consistência:
  ```bash
  npm run types:db
  ```
- [ ] **Teste da Etapa**:
  - Rodar `npx tsc --noEmit` para garantir que nenhuma tela existente quebrou após a alteração dos tipos.

---

### Etapa 3: Gestão de Serviços no Admin (`/admin/servicos`)
**Branch**: `feat/admin-services-crud`

- [ ] Implementar o layout administrativo protegido (`app/(admin)/layout.tsx`) com validação de `role = 'admin'`.
- [ ] Criar a tela de tabela de serviços com badges de categoria e switch ativo/inativo.
- [ ] Criar o modal de edição de preço com cálculo dinâmico da taxa fixa de R$ 12,00.
- [ ] Implementar a Server Action de atualização protegida com Zod.
- [ ] **Teste da Etapa**:
  - Tentar acessar `/admin/servicos` logado como cliente normal (deve redirecionar para a home).
  - Acessar como admin, alterar o preço de um serviço e confirmar se o catálogo público da Home atualizou instantaneamente.

---

### Etapa 4: Botão de Emergência SOS
**Branch**: `feat/sos-emergency-modal`

- [ ] Criar a tabela `emergency_alerts` via migration com RLS restrito aos participantes da corrida.
- [ ] Criar o componente visual `<SosButton />` e o modal de confirmação em Tailwind.
- [ ] Implementar a rota `/api/emergency/notify` para logar o acionamento e gerar o link nativo `tel:190`.
- [ ] **Teste da Etapa**:
  - Em um chamado com status `in_progress`, disparar o SOS em ambiente de testes e verificar se o log foi inserido com as coordenadas corretas.

---

### Etapa 5: Dashboard de Analytics e Auditoria de Cancelamentos
**Branch**: `feat/admin-dashboard-metrics`

- [ ] Criar a rota `app/(admin)/admin/dashboard/page.tsx`.
- [ ] Montar os cards de KPI (Chamados Concluídos, Volume Transacionado, Receita Líquida).
- [ ] Criar o componente de Ranking (Top Clientes e Top Técnicos).
- [ ] Criar a tabela de Auditoria de Cancelamentos com filtros específicos:
  - Técnico chegou e cancelou (`arrived_at IS NOT NULL`).
  - Cliente cancelou após alocação (`provider_id IS NOT NULL`).
- [ ] **Teste da Etapa**:
  - Gerar chamados fictícios no ambiente de testes (simulando cancelamentos em diferentes etapas) e verificar se o radar de cancelamentos agrupou os dados corretamente.

---

### Etapa 6: Homologação Integrada (Staging)
- [ ] Fazer merge de todas as branches de feature na branch `staging`.
- [ ] Rodar a suíte completa de verificação arquitetural:
  ```bash
  npm run validate
  ```
- [ ] Realizar teste manual em um dispositivo móvel no deploy de Staging:
  - Abrir o app no celular como cliente.
  - Solicitar um serviço do novo catálogo (ex: reparo de válvula de descarga).
  - Aceitar o chamado em outro navegador como prestador.
  - Testar o botão de emergência SOS.
  - Cancelar o chamado e conferir se o motivo foi gravado no banco de logs.
  - Acessar o `/admin/dashboard` e validar se os eventos apareceram na timeline.

---

### Etapa 7: Deploy em Produção e Plano de Rollback

#### Procedimento de Deploy
1. Aplicar as migrations pendentes no banco Supabase de Produção.
2. Abrir Pull Request da branch `staging` para a `main`.
3. Validar se a pipeline de CI/CD (GitHub Actions / Cloudflare Pages) passou sem avisos.
4. Executar o merge da PR para a `main`.

#### Plano de Rollback (Contingência Imediata)
Caso ocorra qualquer erro imprevisto após o deploy em produção:

- **Rollback de Código (Instantâneo na Cloudflare)**:
  - Acesse o painel da Cloudflare Workers > Deployments.
  - Clique no deployment imediatamente anterior e selecione Rollback. O tráfego volta para a versão estável em menos de 5 segundos.
- **Rollback de Banco de Dados**:
  - Como todas as migrations foram aditivas (apenas criação de novas tabelas e adição de colunas opcionais), o banco antigo continua 100% compatível com a versão anterior do código. Nenhuma tabela principal sofrerá drop.
