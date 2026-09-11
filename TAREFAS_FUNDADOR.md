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
---

## 6. Infraestrutura de Mensageria (WhatsApp)
- [ ] **Conexão da Instância de Disparo (Evolution API / Z-API):**
  - Adquirir e ativar chip exclusivo para o Repara RV.
  - Conectar instância da Evolution API ou Z-API para disparo das notificações da fila prioritária (`notify-queue`) e confirmações pós-aceite (`notify-accepted`).
  - Configurar as variáveis no Cloudflare / `.dev.vars`:
    - `WHATSAPP_WEBHOOK_URL` ou `PROVIDER_ALERT_WEBHOOK_URL`
    - `CLIENT_ALERT_WEBHOOK_URL`
  - Validar entrega real do deep link no celular do prestador: `https://repararv.com/painel?claim=ID`.

---

## 7. Produção Audiovisual & Lançamento de Tráfego Pago
- [ ] **Fechar Produção do Vídeo Institucional 9:16 (60 segundos):**
  - Contratar/aprovar entrega do animador com o roteiro aprovado no enquadramento vertical (Stories/Reels).
  - Ter o arquivo final exportado em alta definição para subir os criativos das campanhas locais no Instagram/Facebook Ads direcionando para `https://repararv.com`.

---

## 8. Formação da Base Reserva de Prestadores (Pré-Anúncios)
- [ ] **Meta de Homologação Pré-Campanha (Mínimo 8 a 10 Profissionais Ativos):**
  - 2 Eletricistas
  - 2 Encanadores
  - 2 Montadores de Móveis
  - 2 Chaveiros
  - Garantir que todos concluíram o fluxo OAuth do Mercado Pago (para não quebrar o split Pix automático).
  - Realizar chamada de alinhamento com cada um sobre o funcionamento do painel e o som de alerta contínuo.

---

### Mensagens-Chave para Prestadores e Parceiros:

**Para a contabilidade:** Nosso modelo é de agenciamento/marketplace. O cliente paga o serviço via Pix e o gateway realiza um split automático: o prestador recebe a mão de obra dele e nós retemos uma taxa fixa de comissão. Preciso abrir um CNPJ no Simples Nacional com os CNAEs adequados e orientações para emitir NFS-e apenas sobre a nossa comissão de intermediação.

**Para o jurídico:** Preciso da elaboração dos Termos de Uso da plataforma, Política de Privacidade (LGPD) e o contrato de prestação de serviços/parceria com a agência de marketing.