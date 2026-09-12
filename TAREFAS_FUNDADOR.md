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
- [x] **Redigir e Publicar Termos de Uso da Plataforma:**
  - Ativo em produção: [`https://repararv.com/termos`](file:///c:/Users/kravb/Downloads/REPARA%20RV/repara-rv/app/termos/page.tsx)
  - Regra de peças explícita (mão de obra inclusa, peças novas pelo cliente).
  - Regras de cancelamento, no-show, garantia de 7 dias e foro de Rio Verde (GO).
- [x] **Redigir e Publicar Política de Privacidade (LGPD):**
  - Ativo em produção: [`https://repararv.com/privacidade`](file:///c:/Users/kravb/Downloads/REPARA%20RV/repara-rv/app/privacidade/page.tsx)
  - Justificativa do uso da geolocalização e canal de exclusão de dados.
  - Requisito obrigatório cumprido para aprovação do Meta Ads e WhatsApp Business API.
- [ ] **Acordo de Sócios & Contrato da Agência:**
  - Formalizar o percentual de 15% da agência de marketing com cláusula de Vesting atrelada a entregas (vídeo institucional 2D + ativação dos primeiros prestadores).

---

## 4. Validação e Segurança dos Prestadores (Filtro de Campo)
- [ ] **Critérios Mínimos de Entrada:**
  - Cópia ou conferência do RG/CNH.
  - Comprovante ou vínculo de residência em Rio Verde.
  - Chave Pix vinculada ao titular do cadastro.
  - **Autodeclaração Vinculante de Aptidão & Idoneidade** (aceita diretamente pelo prestador no primeiro acesso do app, dispensando envio prévio de certidões).
- [ ] **Canal de Atendimento Local (SAC):**
  - Ativar um número de WhatsApp Business exclusivo para suporte a chamados em andamento e mediação de conflitos.

---

## 5. Lançamento e Presença Física
- [x] **Inserir Dados Oficiais no Rodapé:**
  - Inserido no PWA: Razão Social, CNAE 7490-1/04, sede em Rio Verde (GO), links de Termos de Uso e Privacidade.
---

## 6. Infraestrutura de Mensageria (WhatsApp)
- [ ] **Conexão da Instância de Disparo (Evolution API / Z-API):**
  - Adquirir e ativar chip exclusivo para o Repara RV.
  - Conectar instância da Evolution API ou Z-API para disparo das notificações da fila prioritária (`notify-queue`) e confirmações pós-aceite (`notify-accepted`).
  - Configurar as variáveis no Cloudflare / `.dev.vars`:
    - `WHATSAPP_API_URL`
    - `WHATSAPP_API_KEY`
  - Validar entrega real do deep link no celular do prestador: `https://repararv.com/painel?claim=ID`.

---

## 7. Produção Audiovisual & Lançamento de Tráfego Pago
- [x] **Fechar Produção do Vídeo Institucional 9:16 (60 segundos):**
  - Roteiro segundo a segundo, locução, visual e estratégia no Meta Ads prontos em [`ROTEIRO_VIDEO_9_16_META_ADS.md`](file:///c:/Users/kravb/Downloads/REPARA%20RV/repara-rv/ROTEIRO_VIDEO_9_16_META_ADS.md).
- [ ] **Subir os Criativos no Meta Ads:**
  - Ativar campanha com geolocalização estrita para Rio Verde (GO) após ter no mínimo 8 prestadores online.

---

## 8. Formação da Base Reserva de Prestadores (Pré-Anúncios)
> 📘 **Playbook Completo de Abordagem e Roteiro de Balcão:** Consulte [`ROTEIRO_RECRUTAMENTO_TECNICOS_RV.md`](file:///c:/Users/kravb/Downloads/REPARA%20RV/repara-rv/ROTEIRO_RECRUTAMENTO_TECNICOS_RV.md) para os scripts de 90 segundos, quebra de objeções e checklist presencial de 5 minutos no celular do prestador.

- [ ] **Meta de Homologação Pré-Campanha (Mínimo 8 a 10 Profissionais Ativos):**
  - 3 Eletricistas
  - 3 Encanadores / Desentupidores
  - 2 Chaveiros
  - 2 Montadores de Móveis
  - Garantir que todos concluíram o fluxo OAuth do Mercado Pago (para não quebrar o split Pix automático).
  - Realizar chamada de alinhamento com cada um sobre o funcionamento do painel e o som de alerta contínuo.

---

### Mensagens-Chave para Prestadores e Parceiros:

**Para a contabilidade:** Nosso modelo é de agenciamento/marketplace. O cliente paga o serviço via Pix e o gateway realiza um split automático: o prestador recebe a mão de obra dele e nós retemos uma taxa fixa de comissão. Preciso abrir um CNPJ no Simples Nacional com os CNAEs adequados e orientações para emitir NFS-e apenas sobre a nossa comissão de intermediação.

**Para o jurídico:** Preciso da elaboração dos Termos de Uso da plataforma, Política de Privacidade (LGPD) e o contrato de prestação de serviços/parceria com a agência de marketing.