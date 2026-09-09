# Repara RV — Checklist de Validação e Homologação Pré-Deploy

Este checklist é o **protocolo de segurança obrigatório** que deve ser executado antes de qualquer alteração de código, pull request ou deploy em produção no **Repara RV**.

---

## 🚦 Portões de Bloqueio Automatizados (Gatekeepers)

Antes de qualquer deploy ou commit, execute no terminal da raiz (`repara-rv`):

```bash
npm run validate
```

Este comando executa em sequência:
1. `npm run check:types` (`tsc --noEmit`): Validação estrita de TypeScript.
2. `npm run check:arch` (`dependency-cruiser`): Impede importações proibidas entre UI e Servidor / Node nativo no Edge.
3. `npm run lint` (`eslint`): Auditoria de boas práticas e regras de runtime.

> ⛔ **REGRA INEGOCIÁVEL**: Se `npm run validate` retornar **qualquer erro**, a alteração está **rejeitada** e não pode ser enviada para produção.

---

## 📋 Checklist Passo a Passo para Toda Atualização

### 1. Banco de Dados & Tipagem
- [ ] **Zero Adivinhação de Schema**: Nenhuma coluna ou tabela foi inventada. Todos os campos utilizados existem em `types/supabase.ts`.
- [ ] **UUIDs Reais**: Nenhum ID numérico ou estático (`'1'`, `'2'`) foi inserido no catálogo ou nas buscas. Sempre usar UUIDs válidos.
- [ ] **Sincronização de Tipos**: Se houve alteração no SQL do banco (`schema.sql`), o arquivo `types/supabase.ts` foi atualizado.

### 2. Regras Financeiras & Pagamento
- [ ] **Regra dos R$ 12,00**: A taxa retida da plataforma é sempre exatamente `12.00` por serviço finalizado.
- [ ] **Repasse do Prestador**: `provider_cut = total_price - 12.00`.
- [ ] **Saldo do Prestador no Painel**: Apenas chamadas com `status = 'completed'` **E** `payment_status = 'paid'` entram no total de ganhos do dia. Se `payment_status = 'pending'`, exibir como valor pendente.
- [ ] **Gateways no Cloudflare Workers**: Toda variável de gateway (`MERCADOPAGO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) está espelhada em `wrangler.jsonc` no bloco `"vars"`.

### 3. Runtime Cloudflare Workers & Segurança Edge
- [ ] **Sem Módulos Nativos do Node**: Não utilizar `fs`, `child_process`, `net` ou sockets C++ nas rotas de API (`app/api/`).
- [ ] **Fetch Nativo**: Toda comunicação externa (Mercado Pago, Supabase, Webhooks) utiliza o `fetch()` padrão do JavaScript.
- [ ] **Proteção LGPD**: No status `searching`, enviar apenas o bairro (`neighborhood`) e distância para o prestador. Endereço completo só é visível após o status `accepted`.

### 4. Zero Fakes e Zero Simulações
- [ ] **Nenhum mock `demo-*`**: Nenhuma rota ou tela pode redirecionar para chamados simulados ou prestadores fictícios (`demo-call-101`, `Carlos Eletricista`).
- [ ] **Sem Botões de Simulação**: Telas de clientes e prestadores não possuem botões como "Simular Prestador Aceitando". O fluxo é 100% acionado por ações reais no banco.

---

## 🧪 Roteiro de Teste de Fumaça (Smoke Test Manual)

Antes de considerar a entrega finalizada, valide o fluxo real de 4 etapas:

1. **Etapa 1: Solicitação pelo Cliente**
   - Acesse [repararv.com](https://repararv.com) logado como cliente.
   - Selecione um serviço e confirme com endereço.
   - **Resultado esperado**: O chamado é gravado na tabela `service_calls` com status `searching` e direcionado ao prestador online mais próximo via PostGIS.

2. **Etapa 2: Alerta no Celular do Prestador**
   - Prestador online no [repararv.com/painel](https://repararv.com/painel).
   - **Resultado esperado**: Em até 3 segundos, abre o modal de alerta com alarme sonoro, nome do serviço, endereço e valor líquido.

3. **Etapa 3: Aceite e Rota**
   - Prestador toca em "Aceitar Chamado".
   - **Resultado esperado**: Chamado transiciona para `accepted` / `on_the_way`, botões do Waze e Google Maps ficam ativos.

4. **Etapa 4: Conclusão e Pagamento**
   - Prestador toca em "Serviço concluído — gerar Pix".
   - **Resultado esperado no Cliente**: Abre o modal com **Pix Copia e Cola**, **QR Code** e botão de **Cartão de Crédito/Débito** via Mercado Pago.
   - **Resultado esperado no Prestador**: Painel indica 1 serviço concluído aguardando confirmação do pagamento.

---

## 📦 Comandos Rápidos de Validação e Deploy

```powershell
# 1. Validar tipos, arquitetura e linter
npm run validate

# 2. Testar compilação do Next.js localmente
npm run build

# 3. Publicar em Produção Oficial no Cloudflare
$env:CLOUDFLARE_API_TOKEN="<SEU_CLOUDFLARE_API_TOKEN>"; npm run deploy
```
