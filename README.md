# Repara RV — O Uber de Serviços Residenciais de Rio Verde 🛠️⚡

> Progressive Web App (PWA) de alta performance para conectar moradores de Rio Verde (GO) a prestadores de serviços locais em tempo real, com catálogo de preço fechado padronizado, motor geoespacial PostGIS e repasse financeiro automatizado via Pix.

[![Next.js 16](https://img.shields.io/badge/Next.js-16%20(Turbopack)-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.x%20Strict-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%204-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase PostGIS](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20PostGIS-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Mercado Pago Pix](https://img.shields.io/badge/Mercado%20Pago-Pix%20Split-009EE3?style=flat&logo=mercadopago)](https://www.mercadopago.com.br/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest%20SQA-729B1B?style=flat&logo=vitest)](https://vitest.dev/)

---

## 🚀 Proposta de Valor

* **Sem Orçamentos Demorados:** Catálogo tabelado de serviços essenciais (Elétrica, Hidráulica, Pequenos Reparos, Montagem, Pintura e Emergência 24h).
* **Chamada no Radar (PostGIS):** O sistema busca automaticamente o profissional online mais próximo em Rio Verde via cálculo KNN (`<->`).
* **Design Triider:** Experiência mobile-first limpa (`slate-50`), cards arredondados (`rounded-3xl`), busca instantânea com autocomplete e selos de confiança.
* **Garantia de 30 Dias:** Cobertura de garantia para o cliente e profissionais locais rigorosamente verificados.
* **Zero Moedas / Sem Venda de Leads:** Sem cobrança antecipada para o trabalhador autônomo. Retenção de taxa fixa apenas no ato do pagamento concluído.

---

## 📱 Os 5 Requisitos de Sobrevivência de Campo (Modo Moto)

1. **Alerta Sonoro & Vibração Contínuos:** Sintetizador via Web Audio API e vibração em loop (`navigator.vibrate([300, 100, 300])`) para o prestador em trânsito de moto.
2. **Janela de Aceite de 45 Segundos:** Timer regressivo com SVG circular animado; se o prestador não aceitar a tempo, o chamado pula automaticamente para o próximo no radar.
3. **Deep Links para GPS:** Botões com links diretos para Waze (`&navigate=yes`) e Google Maps com as coordenadas exatas do imóvel.
4. **Alerta Ostensivo de Peças & Materiais:** Inserido no card, na tela de chamada com checkbox de confirmação obrigatória e no painel do prestador.
5. **Cancelamento com Justificativa Estruturada:** Justificativas documentadas (`provider_absent`, `wrong_address`, `technical_issue`, `other`).

---

## 🏗️ Arquitetura & Tecnologias

```
repara-rv/
├── app/
│   ├── (client)/page.tsx       # Home estilo Triider (busca, categorias, garantias)
│   ├── acompanhar/[callId]/    # Tracker do chamado em tempo real + modal Pix
│   ├── chamado/[callId]/       # Painel do prestador com Waze/Maps e finalização
│   ├── chamar/[serviceId]/     # Endereço, GPS e confirmação de materiais
│   ├── login/                  # Login OTP com modo demonstração em 1 clique
│   ├── onboarding/             # Cadastro de clientes e prestadores com chave Pix
│   ├── painel/                 # Radar do prestador com toggle online/offline
│   └── api/                    # Endpoints para PostGIS, skip-provider e Pix
├── components/                 # Componentes compartilhados e primitivos UI
├── hooks/                      # useAcceptTimer, useCallAlert, useGeolocation
├── lib/
│   ├── catalog.ts              # Catálogo padronizado de serviços de Rio Verde
│   ├── types.ts                # Tipagem centralizada TypeScript
│   └── supabase/               # Clientes Browser, Server e Service Role
├── supabase/
│   └── schema.sql              # Schema idempotente com PostGIS, RLS e Realtime
└── __tests__/                  # Suíte de testes unitários SQA (Vitest)
```

---

## 🛠️ Como Executar Localmente

### 1. Clonar o repositório e instalar dependências
```bash
git clone https://github.com/WandersonGuimaraesOlv/repara-rv.git
cd repara-rv
npm install
```

### 2. Configurar as variáveis de ambiente
Copie o arquivo de exemplo:
```bash
cp .env.local.example .env.local
```
Preencha com suas credenciais do Supabase e Mercado Pago.

### 3. Rodar a suíte de testes (Garantia de Qualidade - SQA)
```bash
npm test
```

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🧪 Modo Demonstração Instantâneo

Para testar a experiência sem depender de chaves de SMS na nuvem:
1. Acesse `http://localhost:3000/login`
2. Clique em **`⚡ Modo Prestador (Moto)`** para testar o radar, o alarme sonoro de 45s e os links do Waze/Maps.
3. Ou clique em **`🏠 Modo Morador / Cliente`** para testar a seleção de bairros de Rio Verde, catálogo Triider e geração de Pix.

---

## 📄 Licença

Projeto desenvolvido para a comunidade de prestadores e moradores de **Rio Verde (GO)**.
Todos os direitos reservados © 2026.
