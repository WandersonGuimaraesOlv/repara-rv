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

## 2. Gateway de Pagamento & Automação de Split Pix (Pix In / Pix Out)
- [ ] **Abrir Conta PJ no Gateway Escolhido (Assim que o CNPJ for emitido):**
  - Utilizar a conta bancária/PJ do Repara RV recém-aberta.
  - Solicitar liberação de **Transferências Pix via API (Pix Out)** para automatizar 100% o repasse aos técnicos.
- [ ] **Ativar API de Pix Out Automático (Envio Pix para a Chave do Prestador):**
  - **Opção 1 (Recomendada - Efí Bank / antiga Gerencianet):** Criar conta PJ gratuita e gerar credenciais com certificado digital A1. Possui o melhor endpoint oficial de Pix Out do Brasil (`POST /v2/gn/pix`). No mesmo segundo em que o cliente paga o serviço, o backend dispara o Pix líquido direto para a chave do prestador (Nubank, Inter, Caixa, etc.).
  - **Opção 2 (Asaas):** Habilitar API de transferências Pix (`POST /v3/transfers`) da conta PJ do marketplace.
  - **Opção 3 (Mercado Pago Payouts):** Solicitar liberação formal do produto **Payouts / Transferências Pix via API** com o suporte comercial PJ do Mercado Pago.
- [x] **Operação Atual de MVP (Transição Ágil Ativa):**
  - **Entrada (Pix In):** Morador paga via QR Code Pix dinâmico do Mercado Pago (cai na conta da plataforma).
  - **Retenção:** Taxa da plataforma (R$ 10 a R$ 20) fica retida na conta Repara RV.
  - **Repasse Manual/1 Clique:** O fundador copia a Chave Pix cadastrada do técnico no painel admin ([`/admin/usuarios`](file:///c:/Users/kravb/Downloads/REPARA%20RV/repara-rv/app/(admin)/admin/usuarios/page.tsx)) e faz o Pix direto pelo app do banco enquanto a API com CNPJ é homologada.

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

## 6. Alertas e Notificações (sem gateway de WhatsApp)
- [x] **Decisão (21/09/2026): não usar gateway de WhatsApp (Evolution API / Z-API).** O risco de banimento dos números da plataforma é maior que o ganho.
  - Prestadores são avisados de chamado novo por **notificação push** dentro do app: cada prestador aprovado toca em "Ativar notificações" no `/painel`.
  - O cliente acompanha o status em `/acompanhar` (atualiza na hora); a tela da fila pede pra manter o app aberto.
  - Não é mais necessário: chip exclusivo pra disparo, instância da Evolution/Z-API, `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`.
  - Continuam existindo os links `wa.me` de clique manual (despacho pelo admin em `/admin/dashboard` e botão de suporte) — não são envio automático.
- [ ] **Pendente:** ativar as notificações no celular de cada prestador e testar com o botão "Testar" do painel.

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