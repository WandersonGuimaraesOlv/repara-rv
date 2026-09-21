# Repara RV — Guardrails de Arquitetura, Controle de Contexto e Anti-Alucinação

Este documento define as regras inegociáveis de engenharia de software para o desenvolvimento do **Repara RV** (PWA sob demanda em Rio Verde/GO). Todo desenvolvedor e agente de IA deve seguir rigorosamente estes padrões para evitar quebras de arquitetura, perda de contexto e alucinações.

---

## 1. Plano de Ação Imediato (Tarefas para a IA Executar)

A IA responsável pelo projeto deve executar as seguintes configurações no repositório:

- [x] **Passo 1: Gerar os Tipos Estritos do Banco de Dados**
  - Exportar os tipos de schema do banco para `types/supabase.ts`.
  - Proibir interfaces manuais de tabelas em qualquer outro arquivo.
- [x] **Passo 2: Configurar Regras de Borda no ESLint**
  - Adicionar regras para proibir uso de módulos nativos do Node (`fs`, `child_process`, etc.) em rotas e componentes que rodam no Cloudflare Workers.
- [x] **Passo 3: Instalar e Configurar o Dependency Cruiser**
  - Instalar `dependency-cruiser` como dependência de desenvolvimento.
  - Criar o arquivo `.dependency-cruiser.cjs` bloqueando importações ilegais (ex: UI chamando diretamente instâncias server-side do Supabase).
- [x] **Passo 4: Atualizar Scripts do `package.json`**
  - Criar o script consolidado `npm run validate` para checagem obrigatória antes de qualquer commit ou deploy.

---

## 2. Guardrails de Arquitetura (Bloqueios Programáticos)

### A. Validação de Dependências e Runtime (`.dependency-cruiser.cjs`)
Crie este arquivo na raiz para impedir que a IA viole as camadas do software:

```javascript
module.exports = {
  forbidden: [
    {
      name: 'edge-runtime-compatibility',
      comment: 'Proíbe módulos nativos do Node no Edge/Cloudflare Workers',
      severity: 'error',
      from: { path: '^app' },
      to: { dependencyTypes: ['core'], pathNot: ['^(crypto|buffer)$'] }
    },
    {
      name: 'ui-cannot-bypass-server-boundary',
      comment: 'Componentes de UI nunca podem importar clients autenticados ou de admin diretamente',
      severity: 'error',
      from: { path: '^components' },
      to: { path: '^lib/supabase/(server|admin)' }
    }
  ]
};
```

### B. Scripts de Auditoria no package.json
Adicione os seguintes scripts:

```json
"scripts": {
  "types:db": "supabase gen types typescript --project-id lvjahufllclmkqcbbrcu > types/supabase.ts",
  "check:arch": "depcruise --config .dependency-cruiser.cjs app components lib",
  "check:types": "tsc --noEmit",
  "validate": "npm run check:types && npm run check:arch && npm run lint"
}
```
**Regra de Ouro**: Nenhuma PR ou alteração deve ser finalizada se `npm run validate` falhar.

---

## 3. Protocolo Anti-Alucinação (As 6 Leis Inegociáveis)
Qualquer agente de IA que atue neste projeto deve respeitar as seguintes restrições:

1. **Zero Adivinhação de Banco**:
   - NUNCA invente nomes de colunas ou tabelas.
   - SEMPRE consulte e use os tipos gerados em `types/supabase.ts`. Se o campo não existir lá, ele NÃO EXISTE.

2. **Runtime Cloudflare Workers**:
   - O projeto compila via `@opennextjs/cloudflare`.
   - NUNCA use bibliotecas baseadas em C++, sockets TCP brutos ou SDKs obsoletos. Toda comunicação externa (APIs de pagamento Pix, e-mail via Resend, push, webhooks) DEVE usar o `fetch()` nativo do JavaScript.

3. **Regra Financeira Imutável**:
   - A taxa retida da plataforma é SEMPRE R$ 12,00 por chamado finalizado.
   - O valor restante pertence integralmente ao prestador (`provider_cut = total_price - 12.00`).
   - Split realizado diretamente no gateway via metadados de marketplace.

4. **Validação Estrita de Bordas (Zod)**:
   - Nenhuma Server Action ou Route Handler (`/api/*`) pode processar dados sem validação com schema do Zod localizado em `lib/validations/`.

5. **Mascaramento Obrigatório de Dados (LGPD)**:
   - O endereço completo e as coordenadas exatas do cliente NUNCA devem ser enviados para prestadores no radar.
   - Antes do aceite (`status = 'searching'`), envie apenas neighborhood (bairro) e distância aproximada.

6. **Zero Punição ao Prestador**:
   - Nunca crie bloqueios punitivos, taxas ou quedas de reputação automática por chamados recusados ou expirados.

---

## 4. Padrões de Ouro (Golden Templates)
Siga rigorosamente estes modelos canônicos para manter consistência absoluta no código:

### Padrão para Validação com Zod (modelo ilustrativo — o arquivo `lib/validations/service-call.ts` foi removido por ser código morto; os schemas reais ficam em `lib/validations/`)
```typescript
import { z } from 'zod';

export const createServiceCallSchema = z.object({
  serviceId: z.string().uuid('ID de serviço inválido'),
  clientId: z.string().uuid('ID de cliente inválido'),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  clientAddress: z.string().min(5, 'Informe o endereço completo'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CreateServiceCallInput = z.infer<typeof createServiceCallSchema>;
```

### Padrão para Server Actions (modelo ilustrativo — o arquivo `app/actions/service-calls.ts` foi removido por ser código morto; as actions reais ficam em `app/actions/`)
```typescript
'use server';

import { createServerClient } from '@/lib/supabase/server';
import { createServiceCallSchema } from '@/lib/validations/service-call';
import { revalidatePath } from 'next/cache';

export async function createServiceCallAction(input: unknown) {
  // 1. Validação em tempo de execução
  const parsed = createServiceCallSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Dados inválidos', issues: parsed.error.format() };
  }

  const supabase = await createServerClient();

  // 2. Busca o serviço para validar preço fixo
  const { data: service, error: serviceError } = await supabase
    .from('quick_services')
    .select('fixed_price, platform_fee')
    .eq('id', parsed.data.serviceId)
    .single();

  if (serviceError || !service) {
    return { success: false, error: 'Serviço não localizado' };
  }

  const totalPrice = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee); // R$ 12.00
  const providerCut = totalPrice - platformFee;

  // 3. Inserção tipada no banco
  const { data, error } = await supabase
    .from('service_calls')
    .insert({
      client_id: parsed.data.clientId,
      service_id: parsed.data.serviceId,
      total_price: totalPrice,
      platform_fee: platformFee,
      provider_cut: providerCut,
      neighborhood: parsed.data.neighborhood,
      client_address: parsed.data.clientAddress,
      client_location: `POINT(${parsed.data.longitude} ${parsed.data.latitude})`,
      status: 'searching'
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Falha ao abrir chamado técnico' };
  }

  revalidatePath('/meus-pedidos');
  return { success: true, data };
}
```

---

## 5. Controle de Contexto da IA (Estrutura de Memória)
Para evitar que a IA esqueça regras de negócio entre sessões, mantenha na raiz a seguinte árvore documental:

```plaintext
repara-rv/
├── AI_GUARDRAILS.md         # Este arquivo (regras, proibições e guardrails)
├── AI_CONTEXT.md            # Estado atual, backlog de checkboxes e schema SQL
├── types/
│   └── supabase.ts          # Tipos gerados diretamente do banco Supabase
└── lib/
    └── validations/         # Schemas Zod que definem o formato real dos dados
```

**Comando de Início de Sessão**: Ao abrir qualquer nova sessão com uma IA de código, utilize a instrução:
*"Leia atentamente os arquivos AI_GUARDRAILS.md e AI_CONTEXT.md na raiz antes de sugerir ou modificar qualquer linha de código."*

---

## 6. Checklist de Validação Obrigatório (Pré-Deploy)
Antes de qualquer deploy ou encerramento de tarefa, siga o documento [CHECKLIST_DE_VALIDACAO.md](./CHECKLIST_DE_VALIDACAO.md) e certifique-se de que o comando `npm run validate` executou com sucesso (0 erros).
