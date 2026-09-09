# Checklist de Regularização Operacional e Jurídica — Repara RV

Tarefas administrativas, fiscais e legais sob responsabilidade dos fundadores para operação em Rio Verde (GO).

---

## 1. Estrutura Jurídica e Fiscal (Contabilidade)
- [ ] **Contratar escritório de contabilidade em Rio Verde:** Explicar o modelo de *Marketplace de Intermediação de Serviços*.
- [ ] **Abertura do CNPJ:**
  - Enquadramento: Simples Nacional (Microempresa - ME).
  - CNAE Principal: `7490-1/04` (*Atividades de intermediação e agenciamento de serviços e negócios em geral*).
  - CNAE Secundário: `6311-9/00` (*Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet*).
- [ ] **Inscrição Municipal na Prefeitura de Rio Verde:** Obter liberação para emissão de Nota Fiscal de Serviços Eletrônica (NFS-e).
- [ ] **Alinhamento da Emissão de NFS-e:** Configurar com o contador a emissão de notas fiscais incidentes **estritamente sobre a taxa retida de R$ 12,00**, e nunca sobre o valor total da mão de obra.

---

## 2. Gateway de Pagamento & Split de Pix
- [ ] **Abrir Conta PJ no Gateway Escolhido (Mercado Pago ou Asaas):**
  - Utilizar a conta jurídica do Repara RV recém-aberta.
  - Solicitar liberação formal do recurso de **Marketplace / Split de Pagamentos**.
- [x] **Obter Credenciais de Produção:**
  - Salvar `ACCESS_TOKEN` de produção e chave secreta do Webhook (`MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` configurados no `.env.local`).
- [ ] **Definir Fluxo do Prestador:** Definir se o profissional receberá via subconta do gateway ou direto por transferência Pix automática gerada pelo backend.

---

## 3. Termos Legais & Compliance (Site e App)
- [ ] **Redigir Termos de Uso da Plataforma:**
  - Deixar explícito que o Repara RV é uma intermediadora de tecnologia e não empregadora direta.
  - Regra de peças: deixar documentado que o cliente é responsável pelo fornecimento de materiais.
  - Regras de cancelamento e no-show (cliente ausente por mais de 10 min).
- [ ] **Redigir Política de Privacidade (LGPD):**
  - Justificativa do uso da geolocalização e retenção de logs de chamados.
  - Canal para o usuário solicitar exclusão definitiva de dados.
- [ ] **Acordo de Sócios & Contrato da Agência:**
  - Formalizar o percentual de 15% da agência de marketing com cláusula de Vesting atrelada a entregas (vídeo institucional 2D + ativação dos primeiros prestadores).

---

## 4. Validação e Segurança dos Prestadores (Filtro de Campo)
- [ ] **Critérios Mínimos de Entrada:**
  - Cópia do RG/CNH.
  - Comprovante de residência em Rio Verde.
  - CNPJ MEI ativo na categoria do serviço prestado.
  - **Certidão Negativa de Antecedentes Criminais** (orientar o prestador a emitir de graça no site da Polícia Civil de Goiás e da Polícia Federal).
- [ ] **Canal de Atendimento Local (SAC):**
  - Ativar um número de WhatsApp Business exclusivo para suporte a chamados em andamento e mediação de conflitos.

---

## 5. Lançamento e Presença Física
- [ ] **Inserir Dados Oficiais no Rodapé:**
  - Inserir no PWA: Razão Social, CNPJ, endereço comercial da sede e e-mail/WhatsApp do SAC.
- [ ] **Parceria Piloto com Lojas Locais:**
  - Visitar 2 ou 3 lojas tradicionais de materiais elétricos e hidráulicos da cidade para apresentar o app e colocar cartazes/adesivos informativos para os profissionais que compram materiais lá.
