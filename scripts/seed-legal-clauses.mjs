#!/usr/bin/env node
// =============================================================================
// scripts/seed-legal-clauses.mjs
// Fase B do plano "Documentos legais editáveis pelo painel admin": popula
// legal_clauses com o texto FINAL (pós-redesign, commit d38d9a5) das 3
// páginas legais, transcrito fielmente de app/termos|privacidade|contrato
// /page.tsx pra Markdown. Roda uma vez, é seguro rodar de novo (upsert por
// document_slug+section_id).
//
// Simplificações aceitas nesta transcrição (documentadas no plano):
// - Caixas coloridas de destaque/aviso (âmbar/azul/verde) -> blockquote (>)
// - Tabela de retenção de dados (privacidade §6) -> tabela Markdown nativa
// - Caixa de fórmula (contrato §4) -> negrito + trecho de código inline
// - Cards de 2 colunas CONTRATANTE/CONTRATADO (contrato §1) -> tabela Markdown
//
// PRÉ-REQUISITO:
//   node --env-file=.env.local scripts/seed-legal-clauses.mjs
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const termos = [
  { section_id: 'abertura', title: 'Da Abertura e da Identificação da Plataforma', icon_key: null, body: `Este instrumento eletrônico constitui os **Termos de Uso e Condições Gerais** aplicáveis ao acesso, à navegação e à utilização contínua da plataforma digital **Repara RV**. O presente documento tem por finalidade primordial estabelecer as bases jurídicas, as obrigações mútuas e as diretrizes operacionais que regem a interação entre a tecnologia fornecida e todos os indivíduos que nela ingressam.

A Repara RV é desenvolvida, mantida e operada pela empresa **Repara RV Tecnologia e Intermediação Ltda**, pessoa jurídica de direito privado, com sede e foro na cidade de **Rio Verde, Estado de Goiás, Brasil**, inscrita sob CNAE principal **7490-1/04** (Atividades de intermediação e agenciamento de serviços e negócios em geral) e CNAE secundário **6311-9/00** (Tratamento de dados, provedores de serviços de aplicação e hospedagem na internet).

Para fins deste instrumento, a Repara RV será doravante denominada simplesmente *"Plataforma"*. Dúvidas, solicitações e comunicações formais devem ser encaminhadas ao canal oficial de atendimento: **contato@repararv.com**.` },

  { section_id: 'definicoes', title: 'Das Definições', icon_key: null, body: `Para interpretação uniforme deste instrumento, adotam-se as seguintes definições:

- **Plataforma:** Aplicativo digital e ambiente web da Repara RV, disponível como Progressive Web App (PWA), desenvolvido em tecnologia Next.js hospedada em infraestrutura Cloudflare.
- **Cliente / Morador:** Pessoa física que, após devidamente cadastrada, utiliza a Plataforma para contratar serviços técnicos residenciais de reparo.
- **Prestador / Técnico Parceiro:** Profissional autônomo ou Microempreendedor Individual (MEI) credenciado na Plataforma que executa os serviços técnicos residenciais contratados pelo Cliente.
- **Chamado / Ordem de Serviço:** Requisição formal de serviço técnico aberta pelo Cliente na Plataforma, com endereço, localização geográfica e serviço selecionado do catálogo tabelado.
- **Radar Geoespacial:** Motor de busca por geolocalização (PostGIS/KNN) que identifica automaticamente o Técnico online mais próximo do endereço do Cliente em Rio Verde.
- **Preço Fixo Tabelado:** Valor em reais, pré-definido no catálogo da Plataforma para cada tipo de serviço, correspondente estritamente à mão de obra técnica especializada.
- **Taxa de Intermediação:** Valor retido pela Plataforma por chamado concluído para custeio operacional, infraestrutura e segurança, conforme informado no catálogo.
- **Split de Pagamento:** Tecnologia de divisão automática do pagamento Pix, via gateway parceiro (Mercado Pago / Efí Bank), que repassa instantaneamente o valor líquido da mão de obra ao Prestador e retém a Taxa de Intermediação na conta da Plataforma.
- **Autocertificação / Autodeclaração:** Declaração digital vinculante prestada pelo Técnico Parceiro no ato do cadastro, sob as penas da lei, certificando aptidão técnica e idoneidade.` },

  { section_id: 'objeto', title: 'Do Objeto e da Natureza dos Serviços (Intermediação Tecnológica)', icon_key: 'Wrench', body: `A Plataforma tem por objeto exclusivo a **intermediação tecnológica** entre Clientes e Técnicos Parceiros para a execução de serviços técnicos residenciais de reparo, manutenção e instalação, nas categorias disponíveis no catálogo: **Elétrica Residencial, Hidráulica, Montagem e Fixação, Chaveiro Residencial** e **Instalação de Eletrodomésticos**.

A Repara RV **não presta diretamente nenhum serviço técnico**, não é empregadora dos Técnicos Parceiros e não possui vínculo de subordinação trabalhista com qualquer profissional credenciado. A Plataforma atua exclusivamente como provedora da ferramenta digital de aproximação, geolocalização, precificação transparente e facilitação de pagamento.

> **Serviços cobertos pelo catálogo atual:** Elétrica (chuveiro, tomada, interruptor, lâmpada, ventilador de teto, painel LED, disjuntor), Hidráulica (torneira, sifão, desentupimento, caixa acoplada, vedação de box, válvula de descarga, vaso sanitário), Montagem (suporte de TV, fixação, móvel pequeno, varal, dobradiças), Chaveiro (abertura de porta, troca de fechadura) e Instalação (máquina de lavar, gás/mangueira).` },

  { section_id: 'cadastro', title: 'Do Cadastro, Aceite Eletrônico e Autodeclaração', icon_key: null, body: `O acesso às funcionalidades da Plataforma é condicionado ao cadastro prévio do usuário, mediante fornecimento de nome completo, número de celular com DDD e PIN de segurança pessoal. O cadastro implica aceitação integral destes Termos por meio de **aceite eletrônico (modelo clickwrap)**, com registro de data, hora e versão do documento.

Para cadastro de **Clientes**: fornecimento de nome, celular e PIN. Para cadastro de **Técnicos Parceiros**: adicionalmente, CPF ou CNPJ MEI, chave Pix para recebimentos e assinatura da Autocertificação vinculante abaixo:

> "Declaro, sob as penas da lei, ser profissional autônomo capacitado para a execução dos serviços técnicos residenciais disponíveis no catálogo da Plataforma, assumir integralmente a responsabilidade civil pelos serviços executados e estar ciente de que a Repara RV atua exclusivamente como intermediadora tecnológica, sem vínculo empregatício ou subordinação de qualquer natureza."

O cadastro é pessoal e intransferível. O usuário é o único responsável pela guarda do PIN de acesso e por todas as ações realizadas em sua conta. Em caso de suspeita de uso não autorizado, o usuário deve comunicar imediatamente a Plataforma pelo canal de atendimento oficial.

A Plataforma adota o modelo de **Cadastro Pessoa Física (CPF)**, dispensando a exigência prévia de MEI ou abertura de empresa para o início das atividades do Técnico Parceiro. O Split de Pix é liquidado diretamente na conta bancária vinculada ao CPF ou CNPJ informado.` },

  { section_id: 'materiais', title: 'Da Delimitação do Escopo: Materiais, Peças e Equipamentos', icon_key: null, body: `> **ATENÇÃO MORADOR — LEIA ANTES DE SOLICITAR:** O preço tabelado contratado na Plataforma refere-se **estritamente à mão de obra técnica especializada**. Materiais, peças e aparelhos novos **NÃO estão inclusos** e devem ser providenciados pelo Cliente com antecedência.

**✅ O que está incluso no preço tabelado:**

- Ferramental técnico completo necessário para a execução do serviço
- Diagnóstico técnico no local e testes operacionais de funcionamento
- Pequenos insumos de finalização: fita veda-rosca (teflon), conectores elétricos de engate e buchas padrão
- Limpeza básica do local de trabalho e descarte do material substituído
- Verificação de segurança e entrega do serviço com teste de validação

**❌ O que NÃO está incluso (responsabilidade do Cliente):**

- O aparelho, produto ou peça nova principal a ser instalada (ex: chuveiro, torneira, resistência, luminárias, ventilador, fechadura, vaso sanitário, máquina de lavar)
- Componentes elétricos de reposição: disjuntores novos, cabo flexível, tomadas e interruptores novos
- Componentes hidráulicos de reposição: flexíveis, caixas acopladas completas, boias, registros novos
- Obras civis: quebra de paredes, alvenaria, readequação estrutural de fiação ou encanamento interno
- Remoção de entulho de obra, pintura de paredes ou reforma de acabamento
- Serviços de responsabilidade da construtora, seguradora ou condomínio

O Cliente deve assegurar que o produto/peça nova a ser instalada esteja disponível e em embalagem original antes da chegada do Técnico. O Técnico Parceiro reserva-se o direito de recusar a execução caso os materiais necessários não estejam disponíveis no local, sem que isso gere qualquer ônus ou penalidade ao profissional.` },

  { section_id: 'contratacao', title: 'Do Fluxo de Contratação e do Ciclo do Chamado', icon_key: null, body: `A contratação de serviços na Plataforma segue o seguinte fluxo tecnológico:

1. **Seleção do Serviço:** O Cliente seleciona o serviço desejado no catálogo tabelado e confirma o preço fixo correspondente.
2. **Confirmação de Endereço e Localização:** O Cliente informa o endereço completo e permite a captura de coordenadas geográficas para o cálculo de rota preciso.
3. **Ciência sobre Materiais:** O Cliente confirma, mediante checkbox obrigatório, que tem plena ciência de que o preço tabelado refere-se exclusivamente à mão de obra e que materiais/peças novas devem ser providenciados por sua conta.
4. **Busca Geoespacial:** O Radar da Plataforma identifica e notifica automaticamente o Técnico online mais próximo via alerta sonoro, vibração e notificação push.
5. **Janela de Aceite:** O Técnico tem até **45 segundos** para aceitar o chamado. Caso não aceite dentro do prazo, o chamado é automaticamente repassado ao próximo profissional disponível no radar.
6. **Deslocamento e Execução:** Após o aceite, o endereço completo é liberado ao Técnico. O Cliente acompanha o status do chamado em tempo real na tela de rastreamento.
7. **Pagamento via Pix:** Ao concluir o serviço, o Técnico aciona a finalização na Plataforma. O Cliente realiza o pagamento via QR Code Pix dinâmico gerado pela Plataforma. O repasse automático ao Técnico ocorre após a confirmação do pagamento.

Antes do aceite do Técnico (status *searching*), o Técnico visualiza apenas o bairro e a distância aproximada do chamado, sem acesso ao endereço completo ou às coordenadas exatas do imóvel, em conformidade com a LGPD.` },

  { section_id: 'pagamentos', title: 'Dos Pagamentos, Split de Pix e Taxa de Intermediação', icon_key: 'CreditCard', body: `Todos os valores exibidos no catálogo são **fixos, pré-fixados e publicamente disponíveis** antes da contratação, eliminando orçamentos abusivos ou cobrança de visita técnica. O pagamento é realizado **exclusivamente via Pix**, por meio de QR Code dinâmico gerado pela Plataforma ao final do serviço.

**Fica expressamente proibido** qualquer pagamento em dinheiro, transferência bancária direta, cartão próprio do Técnico ou qualquer outra modalidade que não seja o Pix via Plataforma. O descumprimento desta regra por qualquer das partes configura violação destes Termos e sujeita o infrator ao descredenciamento imediato.

O processamento utiliza tecnologia de **Split de Pagamento**: no momento da liquidação do Pix, o valor líquido da mão de obra é repassado automaticamente à conta vinculada à chave Pix cadastrada pelo Técnico Parceiro. A **Taxa de Intermediação** (entre R$ 12,00 e R$ 25,00 por chamado, conforme catálogo) é retida pela Plataforma para custeio de infraestrutura tecnológica de nuvem, segurança de dados, suporte operacional e desenvolvimento contínuo.

Não há qualquer cobrança antecipada ao Técnico Parceiro para ingresso ou permanência na Plataforma. A retenção da Taxa de Intermediação ocorre **exclusivamente** no ato de cada chamado concluído e pago.` },

  { section_id: 'cancelamento', title: 'Do Cancelamento e do No-Show (Ausência no Local)', icon_key: 'Clock', body: `**Cancelamento sem custo:** O Cliente pode cancelar o chamado sem qualquer ônus enquanto o status estiver em *Buscando Profissional (searching)*, antes de qualquer Técnico aceitar o chamado.

**Cancelamento após aceite (taxa de deslocamento):** Uma vez que o Técnico Parceiro tenha aceito o chamado e iniciado o deslocamento, o cancelamento injustificado pelo Cliente ou a ausência do morador no endereço por mais de **10 (dez) minutos** após a chegada confirmada do Técnico poderá ensejar a cobrança de **taxa de deslocamento de até R$ 25,00 (vinte e cinco reais)**, destinada a ressarcir o profissional pelo combustível e tempo despendido.

**Cancelamento pelo Técnico:** O Técnico Parceiro pode cancelar o chamado mediante justificativa estruturada dentro da Plataforma (cliente ausente, endereço incorreto, problema técnico insuperável ou outra). Cancelamentos reiterados sem justificativa plausível serão analisados pela equipe de operações e podem resultar em inativação temporária do cadastro, sempre com direito à análise e contraditório.

**Serviço não executável:** Caso o Técnico chegue ao local e constate que a execução do serviço é impossível por razão não informada pelo Cliente (ex: falta do aparelho novo, defeito de fábrica não solucionável in loco, risco estrutural), o serviço poderá ser recusado sem cobrança do preço tabelado, mas a taxa de deslocamento poderá ser aplicada conforme previsto acima.` },

  { section_id: 'garantia', title: 'Da Garantia do Serviço de 7 Dias', icon_key: 'Shield', body: `Todos os reparos concluídos e devidamente quitados na Plataforma possuem **Garantia de 7 (sete) dias corridos** sobre a mão de obra executada, contados da data de conclusão registrada na Plataforma.

Caso o reparo venha a apresentar falha, vazamento, mau funcionamento ou desregulagem decorrente diretamente da execução técnica — e não causada por mau uso do morador, alteração posterior de terceiros, defeito de fábrica do aparelho fornecido pelo Cliente ou desgaste natural —, a Repara RV providenciará o retorno do mesmo profissional ou o envio de um Técnico Parceiro reserva, **sem qualquer custo adicional para o Cliente**.

O acionamento da garantia deve ser feito pelo canal de suporte da Plataforma (WhatsApp ou e-mail) dentro do prazo estabelecido, com breve descrição do problema e o número do chamado original. Problemas reportados após 7 dias corridos da conclusão não serão cobertos pela garantia da mão de obra e poderão ser orçados como novo chamado.` },

  { section_id: 'obrigacoes-cliente', title: 'Das Obrigações e Responsabilidades do Cliente', icon_key: null, body: `- Fornecer informações cadastrais verdadeiras, completas e atualizadas, sob pena de cancelamento do cadastro.
- Garantir que o aparelho, produto ou peça nova a ser instalada esteja disponível, na embalagem original e em perfeito estado, antes da chegada do Técnico.
- Estar presente no imóvel ou garantir a presença de um adulto responsável durante toda a execução do serviço.
- Proporcionar ao Técnico acesso seguro, iluminado e sem impedimentos ao local de execução do serviço.
- Retirar previamente do ambiente objetos de alto valor, documentos, joias e dinheiro em espécie que não sejam pertinentes ao serviço.
- Efetuar o pagamento exclusivamente via Pix pelo QR Code gerado pela Plataforma ao final do serviço, abstendo-se de qualquer negociação de preço ou forma de pagamento diretamente com o Técnico.
- Tratar o Técnico Parceiro com respeito e urbanidade durante toda a prestação do serviço.
- Não solicitar serviços fora do escopo do chamado aberto sem gerar um novo chamado na Plataforma.` },

  { section_id: 'obrigacoes-prestador', title: 'Das Obrigações e Responsabilidades do Técnico Parceiro', icon_key: null, body: `- Manter seus dados cadastrais (CPF/CNPJ, chave Pix e telefone) sempre atualizados na Plataforma.
- Portar ferramental técnico completo e adequado para a execução dos serviços do catálogo em que está credenciado.
- Apresentar-se ao endereço do Cliente dentro do prazo estimado informado na Plataforma após o aceite do chamado.
- Executar o serviço com qualidade técnica, zelando pela segurança do imóvel e dos moradores, respeitando as normas técnicas aplicáveis (ABNT).
- Tratar o Cliente e os moradores com respeito, educação e profissionalismo.
- Recusar-se a executar serviços que representem risco à integridade física, risco elétrico grave ou que estejam claramente fora do escopo do chamado, comunicando à Plataforma.
- Não negociar pagamento em modalidade diversa do Pix via Plataforma, sob pena de descredenciamento imediato.
- Assumir integralmente a responsabilidade civil por eventuais danos causados ao imóvel ou a terceiros em decorrência de imperícia, negligência ou imprudência na execução do serviço.
- Manter atualizado seu status de disponibilidade (online/offline) no painel da Plataforma.` },

  { section_id: 'vedacoes', title: 'Das Vedações e Condutas Proibidas', icon_key: null, body: `É expressamente proibido a qualquer usuário da Plataforma:

- Criar cadastros falsos, utilizar dados de terceiros ou fornecer informações fraudulentas.
- Burlar o sistema de geolocalização ou manipular coordenadas GPS de forma fraudulenta.
- Combinar diretamente com a outra parte (Técnico ou Cliente) pagamentos fora da Plataforma com o intuito de contornar a Taxa de Intermediação.
- Solicitar, realizar ou aceitar qualquer serviço que não esteja catalogado na Plataforma sem abertura de novo chamado formal.
- Assediar, ameaçar, discriminar ou ofender a outra parte de qualquer forma durante ou após a prestação do serviço.
- Tentar acessar, modificar ou interromper os sistemas tecnológicos da Plataforma de forma não autorizada.
- Realizar avaliações falsas, comprar avaliações ou praticar qualquer conduta que manipule o sistema de reputação da Plataforma.
- Utilizar a Plataforma para fins ilegais ou em desconformidade com a legislação brasileira vigente.

A verificação de qualquer conduta proibida ensejará o bloqueio imediato do cadastro, sem prejuízo das medidas legais cabíveis.` },

  { section_id: 'responsabilidade', title: 'Da Limitação de Responsabilidade da Plataforma', icon_key: null, body: `A Repara RV é uma **plataforma de intermediação tecnológica** e, como tal, não é parte na relação de prestação de serviços entre o Cliente e o Técnico Parceiro. A Plataforma não se responsabiliza por:

- Danos causados ao imóvel ou a bens do Cliente decorrentes de imperícia, negligência ou imprudência do Técnico Parceiro na execução do serviço.
- Qualidade técnica final do serviço executado pelo Técnico Parceiro, responsabilidade essa que é integralmente do profissional credenciado.
- Disponibilidade de Técnicos em determinados horários, bairros ou para determinados serviços, especialmente em situações de alta demanda simultânea.
- Danos ou interrupções de serviço decorrentes de força maior, falhas de infraestrutura de terceiros (Cloudflare, Supabase, operadoras de telecomunicação) ou ataques cibernéticos.
- Consequências do fornecimento de dados cadastrais incorretos ou fraudulentos pelo usuário.
- Defeito de fábrica ou mau funcionamento do aparelho/produto fornecido pelo Cliente para instalação.

A responsabilidade máxima da Plataforma, quando reconhecida, fica limitada ao valor da Taxa de Intermediação cobrada no chamado objeto da reclamação.` },

  { section_id: 'avaliacao', title: 'Da Avaliação Pós-Serviço e Sistema de Reputação', icon_key: 'Star', body: `Ao término de cada chamado concluído, tanto o Cliente quanto o Técnico Parceiro são convidados a submeter uma avaliação da experiência. As avaliações são anônimas para a outra parte e compõem o índice de reputação exibido na Plataforma.

A Plataforma **não aplica penalidades automáticas, bloqueios ou rebaixamento de reputação** por chamados recusados, expirados por timeout ou por períodos de inatividade do Técnico Parceiro, respeitando a autonomia do profissional autônomo e o modelo de trabalho independente.

Avaliações que contenham linguagem ofensiva, discriminatória ou que sejam evidentemente falsas poderão ser removidas pela equipe de moderação da Plataforma, mediante análise caso a caso.` },

  { section_id: 'seguranca', title: 'Da Segurança, Verificação de Prestadores e Botão SOS', icon_key: 'Shield', body: `Todo Técnico Parceiro é submetido a verificação cadastral com conferência de titularidade da chave Pix/CPF e assinatura da Autodeclaração de Aptidão e Idoneidade. O profissional homologado recebe o selo de *"Segurança Verificada"* exibido ao Cliente durante o chamado.

Durante chamados nos status *aceito, a caminho* e *em execução*, a Plataforma exibe a ambas as partes um **Botão SOS de Emergência**. O acionamento registra as coordenadas em tempo real no sistema, notifica a equipe de suporte e oferece acesso direto à ligação para o **serviço de emergência 190 (Polícia Militar)**.

O Botão SOS cumpre o dever de vigilância e cuidado do CDC e reduz a barreira de segurança para clientes (especialmente mulheres, idosos e PCDs) e para os próprios Técnicos Parceiros.` },

  { section_id: 'lgpd', title: 'Da Privacidade, Proteção de Dados e LGPD', icon_key: null, body: `O tratamento de dados pessoais realizado pela Plataforma é regido integralmente pela **Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 — LGPD)**. As bases legais utilizadas são: execução de contrato (art. 7º, V), legítimo interesse (art. 7º, IX) e cumprimento de obrigações legais (art. 7º, II).

O endereço completo e as coordenadas geográficas exatas do Cliente são tratados como dados sensíveis de localização e **nunca são compartilhados com o Técnico antes do aceite formal do chamado**, em estrita conformidade com o princípio da minimização de dados da LGPD.

O usuário pode solicitar confirmação de tratamento, retificação ou exclusão definitiva de seus dados pelo e-mail **privacidade@repararv.com**. Mais detalhes em nossa [Política de Privacidade e Proteção de Dados](/privacidade).` },

  { section_id: 'vigencia', title: 'Da Vigência, Alterações e Rescisão', icon_key: null, body: `Estes Termos entram em vigor na data de sua publicação e permanecem válidos por prazo indeterminado. A Plataforma reserva-se o direito de alterar, atualizar ou substituir quaisquer disposições deste instrumento, comprometendo-se a notificar os usuários ativos com antecedência mínima de **7 (sete) dias** antes da entrada em vigor de alterações substanciais, por meio de notificação dentro do aplicativo ou por mensagem ao celular cadastrado.

Qualquer usuário pode solicitar o encerramento de seu cadastro a qualquer momento, sem necessidade de justificativa, por meio do canal de suporte da Plataforma. O encerramento não afeta os direitos e obrigações decorrentes de chamados já concluídos ou em andamento à época da solicitação.

A Plataforma pode suspender ou cancelar o cadastro de qualquer usuário que viole estes Termos, com notificação prévia quando possível. Em casos de condutas graves, a suspensão pode ser imediata.` },

  { section_id: 'foro', title: 'Das Disposições Finais, Lei Aplicável e Foro de Eleição', icon_key: 'Scale', body: `Estes Termos são regidos exclusivamente pelas leis da **República Federativa do Brasil**, em especial pelo **Código Civil (Lei nº 10.406/2002)**, pelo **Marco Civil da Internet (Lei nº 12.965/2014)**, pelo **Código de Defesa do Consumidor (Lei nº 8.078/1990)** no que couber às relações com Clientes finais, e pela **Lei Geral de Proteção de Dados (Lei nº 13.709/2018)**.

Para dirimir quaisquer controvérsias decorrentes deste instrumento, fica eleito o **Foro da Comarca de Rio Verde, Estado de Goiás**, com renúncia expressa de qualquer outro, por mais privilegiado que seja. Para relações de consumo com Clientes finais, prevalece o foro do domicílio do consumidor, conforme o art. 101, I do CDC.

A tolerância da Plataforma com qualquer descumprimento destes Termos não implicará novação ou renúncia de direitos, podendo sempre exercer seus direitos dentro dos prazos legais.

---

**Repara RV Tecnologia e Intermediação Ltda**
CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil
E-mail oficial: **contato@repararv.com**
DPO / Privacidade: **privacidade@repararv.com**
Versão 1.0 — Publicado em 13 de Setembro de 2026` },
];

const privacidade = [
  { section_id: 'controlador-dpo', title: 'Identificação do Controlador e do Encarregado (DPO)', icon_key: null, body: `O **Controlador de Dados** responsável pelo tratamento dos seus dados pessoais é a **Repara RV Tecnologia e Intermediação Ltda**, pessoa jurídica de direito privado, com sede na cidade de **Rio Verde, Estado de Goiás, Brasil**.

O **Encarregado de Proteção de Dados (DPO)** pode ser contatado pelo e-mail: **privacidade@repararv.com**. Todas as solicitações relacionadas a direitos dos titulares, dúvidas sobre o tratamento de dados ou reclamações devem ser encaminhadas exclusivamente a este canal.` },

  { section_id: 'dados-coletados', title: 'Dados Pessoais Coletados e Categorias', icon_key: 'Database', body: `Para a operacionalização segura e eficiente dos chamados, coletamos as seguintes categorias de dados:

**Para Clientes / Moradores:**
- Nome completo
- Número de celular com DDD (utilizado como identificador principal e para notificações WhatsApp)
- Endereço residencial completo e coordenadas geográficas (somente durante a abertura de chamado)
- Histórico de chamados e ordens de serviço na Plataforma
- Dados de aceite de termos: data, hora e versão do documento aceito

**Para Técnicos Parceiros / Prestadores:**
- Nome completo, celular com DDD e CPF ou CNPJ MEI
- Chave Pix e tipo de chave (para processamento automático de repasses)
- Autodeclaração de aptidão e idoneidade (assinada digitalmente no cadastro)
- Localização geográfica em tempo real (capturada exclusivamente enquanto o prestador está online e ativo no radar)
- Histórico de chamados, avaliações recebidas e dados de desempenho operacional
- Dados de aceite de termos: data, hora e versão do documento aceito

**Dados de Pagamento:**
- A Repara RV **não armazena dados de cartão de crédito ou débito** em seus sistemas.
- Todas as transações são processadas pelo protocolo Pix do Banco Central do Brasil, via gateway seguro (Mercado Pago / Efí Bank).
- Armazenamos apenas o ID da transação Pix e o status de pagamento para registro e auditoria dos chamados.` },

  { section_id: 'finalidade-base-legal', title: 'Finalidade e Base Legal do Tratamento de Dados', icon_key: 'Eye', body: `Seus dados são tratados nas seguintes finalidades, com as respectivas bases legais da LGPD:

- **Execução do contrato (art. 7º, V):** Conexão entre Cliente e o Técnico mais próximo disponível no radar geoespacial; processamento do pagamento via Pix; notificação sobre chegada e status do chamado; emissão de comprovante digital.
- **Legítimo interesse (art. 7º, IX):** Prevenção a fraudes; validação de identidade do Técnico via conferência de CPF e chave Pix; moderação de avaliações e condutas; melhoria contínua dos algoritmos de roteamento geoespacial.
- **Cumprimento de obrigação legal (art. 7º, II):** Manutenção de registros de transações financeiras para fins fiscais, contábeis e de conformidade regulatória.
- **Consentimento (art. 7º, I):** Envio de comunicações de marketing, ofertas e novidades do serviço (exclusivamente quando o usuário optar por receber tais comunicações).` },

  { section_id: 'localizacao', title: 'Tratamento Especial: Dados de Localização Geográfica', icon_key: 'Globe', body: `> Dados de localização são dados sensíveis e merecem proteção reforçada. Veja abaixo nossa política específica.

**Dados do Cliente (endereço e coordenadas):** O endereço completo e as coordenadas GPS exatas do Cliente são coletados exclusivamente no momento da abertura do chamado. Antes do aceite do Técnico (status *searching*), o Técnico visualiza apenas o **bairro** e a **distância aproximada**. O endereço completo é liberado ao Técnico somente após o aceite formal, e exclusivamente para o Técnico designado para aquele chamado.

**Dados do Técnico (localização em tempo real):** A localização geográfica do Técnico Parceiro é capturada e atualizada no banco de dados **somente enquanto o Técnico ativa o status "Online" no painel**. Ao acionar "Offline", a atualização de localização cessa imediatamente. Nenhum dado de localização é retido após o encerramento do status offline.` },

  { section_id: 'compartilhamento', title: 'Compartilhamento e Transferência de Dados', icon_key: null, body: `A Repara RV **não vende, não aluga e jamais comercializa dados pessoais** a terceiros, corretoras de dados, plataformas de publicidade ou anunciantes.

Os dados são compartilhados estritamente com:

- **Técnico Parceiro designado:** Nome do Cliente e endereço de execução, somente após o aceite do chamado e exclusivamente para fins de deslocamento e execução do serviço.
- **Parceiros de infraestrutura essencial:** Supabase (banco de dados e autenticação, EUA — coberto pelo Data Processing Agreement), Cloudflare (hospedagem e CDN, EUA — coberto pelo DPA) e Mercado Pago / Efí Bank (processamento de pagamentos Pix, Brasil).
- **Autoridades públicas:** Mediante requisição legal devidamente fundamentada, em conformidade com a legislação brasileira vigente.

As transferências internacionais de dados (para servidores Supabase/Cloudflare nos EUA) são realizadas com garantias adequadas de proteção, em conformidade com o art. 33 da LGPD.` },

  { section_id: 'retencao', title: 'Prazo de Retenção dos Dados', icon_key: null, body: `Os dados pessoais são retidos pelos seguintes prazos:

| Categoria de Dado | Prazo de Retenção |
| --- | --- |
| Dados de cadastro (nome, celular, CPF) | Enquanto a conta estiver ativa + 5 anos após encerramento |
| Histórico de chamados e transações | 5 anos (obrigação fiscal e legal) |
| Registros de aceite de termos (audit trail) | 5 anos |
| Localização em tempo real do Técnico | Não retida após o status offline |
| Dados de Emergência (alertas SOS) | 2 anos |` },

  { section_id: 'direitos-titular', title: 'Direitos do Titular (LGPD) — Como Exercer', icon_key: 'Fingerprint', body: `Nos termos dos artigos 17 a 22 da LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:

- **Confirmação e Acesso:** Saber se tratamos seus dados e ter acesso à cópia dos dados que possuímos sobre você.
- **Retificação:** Solicitar a correção de dados incompletos, inexatos ou desatualizados.
- **Anonimização, Bloqueio ou Eliminação:** Solicitar que dados desnecessários, excessivos ou tratados em desconformidade com a LGPD sejam anonimizados, bloqueados ou eliminados.
- **Portabilidade:** Receber seus dados em formato estruturado e interoperável, quando aplicável.
- **Revogação do Consentimento:** Retirar o consentimento para tratamentos baseados nessa base legal, a qualquer momento.
- **Oposição:** Opor-se a tratamentos realizados com base em legítimo interesse que causem dano desproporcional.
- **Exclusão Total da Conta:** Solicitar a exclusão definitiva de todos os seus dados e cadastro da Plataforma.

> Para exercer qualquer dos direitos acima, envie solicitação para **privacidade@repararv.com** com assunto "Direitos LGPD" e informações de identificação. Respondemos em até **15 dias úteis**.` },

  { section_id: 'seguranca-informacao', title: 'Segurança da Informação e Medidas Técnicas', icon_key: 'Lock', body: `A Repara RV adota um conjunto robusto de medidas técnicas e administrativas para proteger seus dados:

- **Criptografia em trânsito:** Toda comunicação entre o aplicativo/navegador e nossos servidores utiliza TLS 1.3 / HTTPS.
- **Row Level Security (RLS):** Políticas de acesso linha a linha no banco de dados PostgreSQL (Supabase), garantindo que cada usuário acesse apenas seus próprios dados.
- **Isolamento de dados sensíveis:** Endereço completo e coordenadas do Cliente não são incluídos em respostas de API direcionadas ao radar de Técnicos antes do aceite.
- **Autenticação por PIN:** Acesso ao aplicativo protegido por PIN pessoal criado pelo usuário, sem armazenamento de senhas em texto puro.
- **Infraestrutura Cloudflare:** Proteção DDoS, firewall de aplicação web (WAF) e rede global de alta disponibilidade.
- **Acesso restrito interno:** Apenas membros autorizados da equipe têm acesso a dados de produção, mediante autenticação multifator.` },

  { section_id: 'cookies', title: 'Cookies e Dados de Navegação', icon_key: null, body: `A Repara RV opera como Progressive Web App (PWA) e utiliza **cookies de sessão** estritamente necessários para manter o usuário autenticado entre as telas e funcionalidades do aplicativo. Não utilizamos cookies de rastreamento de terceiros, pixels de publicidade comportamental ou ferramentas de analytics intrusivas.

O bloqueio de cookies pode impedir o correto funcionamento do aplicativo, especialmente o mantenimento da sessão ativa.` },

  { section_id: 'atualizacao-contato', title: 'Atualização desta Política e Canal de Contato', icon_key: null, body: `Esta Política pode ser atualizada periodicamente para refletir mudanças nas nossas práticas ou na legislação aplicável. Notificaremos os usuários ativos sobre alterações substanciais com antecedência mínima de **7 (sete) dias**, por mensagem na Plataforma ou pelo celular cadastrado. A data de vigência desta versão é indicada no cabeçalho do documento.

---

**Repara RV Tecnologia e Intermediação Ltda**
CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil
DPO / Privacidade: **privacidade@repararv.com**
Atendimento geral: **contato@repararv.com**
Versão 1.0 — Publicada em 13 de Setembro de 2026` },
];

const contrato = [
  { section_id: 'partes', title: 'Identificação das Partes Contratantes', icon_key: null, body: `| | |
| --- | --- |
| **CONTRATANTE — Plataforma** | **CONTRATADO — Técnico Parceiro** |
| **Razão Social:** Repara RV Tecnologia e Intermediação Ltda | **Identificação:** Pessoa física ou jurídica (MEI) cujos dados foram fornecidos no cadastro |
| **CNAE:** 7490-1/04 | **Vínculo:** Profissional autônomo ou Microempreendedor Individual |
| **Sede:** Rio Verde, Goiás, Brasil | |
| **E-mail:** contato@repararv.com | |
| Doravante denominada *"Plataforma"* | Doravante denominado *"Técnico Parceiro"* |` },

  { section_id: 'natureza-juridica', title: 'Da Natureza Jurídica da Relação (Autonomia e Ausência de Vínculo)', icon_key: 'Scale', body: `> **CLÁUSULA ESSENCIAL:** Este instrumento é um **contrato de parceria de intermediação tecnológica**, e não um contrato de emprego, contrato de trabalho, contrato de prestação de serviços subordinada ou qualquer outra modalidade que implique vínculo empregatício. As partes declaram expressamente compreender e concordar com tal natureza.

- O Técnico Parceiro é profissional autônomo ou MEI com plena liberdade de gestão de seu tempo e agenda.
- Não há horário mínimo de disponibilidade, metas de atendimentos, punições por recusa de chamados ou qualquer forma de controle de jornada.
- A Plataforma **não aplica advertências, suspensões ou penalidades automáticas** por chamados recusados, expirados ou por períodos de inatividade.
- O Técnico Parceiro é integralmente responsável pelo recolhimento de seus próprios tributos, contribuições previdenciárias e demais obrigações fiscais decorrentes de sua atividade autônoma.
- O Técnico Parceiro possui liberdade para utilizar outras plataformas, aplicativos ou meios de captação de clientes simultaneamente.` },

  { section_id: 'objeto-radar', title: 'Do Objeto: Acesso ao Radar e Recebimento de Chamados', icon_key: 'Wrench', body: `A Plataforma concede ao Técnico Parceiro acesso ao sistema geoespacial de roteamento de chamados técnicos (Radar Repara RV), por meio do qual o profissional receberá notificações de ordens de serviço de Clientes situados em seu raio de atuação em Rio Verde (GO), podendo aceitar ou recusar cada chamado individualmente.

O Técnico Parceiro recebe chamados nas categorias técnicas de sua especialidade declarada no cadastro, conforme o catálogo de serviços vigente na Plataforma: **Elétrica Residencial, Hidráulica, Montagem e Fixação, Chaveiro Residencial** e **Instalação de Eletrodomésticos**.` },

  { section_id: 'remuneracao', title: 'Da Remuneração, Split de Pix e Taxa de Intermediação', icon_key: 'CreditCard', body: `Por cada chamado concluído e pago pelo Cliente via Pix na Plataforma, o Técnico Parceiro receberá em sua conta vinculada à chave Pix cadastrada o **valor líquido da mão de obra** (preço fixo tabelado do serviço deduzida a Taxa de Intermediação da Plataforma).

**Fórmula de repasse:** \`Repasse ao Técnico = Preço Tabelado − Taxa de Intermediação\`
Exemplo: Serviço de R$ 80,00 → Técnico recebe R$ 68,00 (Taxa: R$ 12,00)

- O repasse é processado automaticamente via Split de Pagamento Pix no momento da confirmação do pagamento pelo Cliente.
- **Não há cobrança antecipada**, mensalidade, taxa de adesão ou taxa de renovação de cadastro para o Técnico Parceiro.
- A Taxa de Intermediação incide **exclusivamente sobre chamados efetivamente concluídos e pagos**.
- O Técnico Parceiro declara ciência de que a Taxa de Intermediação pode variar entre chamados conforme o catálogo vigente, variando entre R$ 12,00 e R$ 25,00 por chamado.
- O Técnico Parceiro é responsável por declarar os rendimentos recebidos via Pix perante a Receita Federal e demais órgãos tributários competentes.` },

  { section_id: 'prazo-repasse', title: 'Do Prazo de Repasse e da Segurança Financeira', icon_key: 'Clock', body: `O repasse do valor líquido ao Técnico Parceiro ocorrerá em até **48 (quarenta e oito) horas** após a confirmação do pagamento pelo Cliente e a conclusão formal do chamado sem ressalvas ou contestações abertas.

Em casos de disputa, contestação de qualidade ou acionamento de garantia pelo Cliente dentro do prazo de 7 dias, o repasse poderá ser suspenso temporariamente até a resolução da ocorrência pela equipe de mediação da Plataforma. O Técnico Parceiro será comunicado imediatamente e terá prazo de **5 (cinco) dias úteis** para apresentar sua versão dos fatos e documentação de suporte.` },

  { section_id: 'obrigacoes-tecnico', title: 'Das Obrigações do Técnico Parceiro', icon_key: null, body: `- Manter dados cadastrais (nome, CPF/CNPJ, celular, chave Pix) sempre atualizados na Plataforma, sob pena de não receber repasses.
- Possuir e portar ferramental técnico adequado e em boas condições para a execução dos serviços do catálogo em que está credenciado.
- Comparecer ao endereço do Cliente dentro do prazo estimado após o aceite do chamado; em caso de impossibilidade, cancelar com justificativa dentro da Plataforma antes de atingir o endereço.
- Executar os serviços com qualidade técnica compatível com as normas ABNT aplicáveis e zelar pela segurança do imóvel e dos moradores.
- Não negociar pagamento em espécie, transferência direta ou qualquer outra modalidade fora do sistema Pix da Plataforma.
- Não captar o Cliente para atendimentos futuros fora da Plataforma durante o período de atividade como Técnico Parceiro credenciado.
- Assumir integralmente a responsabilidade civil por danos causados ao imóvel ou a terceiros decorrentes de imperícia, negligência ou imprudência na execução.
- Manter sigilo sobre dados pessoais dos Clientes (endereço, telefone), utilizando-os exclusivamente para a execução do chamado em curso.` },

  { section_id: 'autocertificacao', title: 'Da Autocertificação de Aptidão e Idoneidade', icon_key: 'Shield', body: `No ato do cadastro, o Técnico Parceiro assina digitalmente a seguinte declaração, que integra este contrato:

> "Declaro, sob as penas da lei, ser profissional autônomo tecnicamente capacitado para a execução dos serviços técnicos residenciais disponíveis no catálogo da Plataforma Repara RV para os quais me credencio; assumir integralmente a responsabilidade civil pelos serviços por mim executados; estar ciente de que a Repara RV atua exclusivamente como intermediadora tecnológica, sem qualquer vínculo empregatício, de subordinação ou solidariedade trabalhista de qualquer natureza; e que todas as informações cadastrais por mim fornecidas são verdadeiras, sob pena de cancelamento imediato do credenciamento e responsabilização por eventuais danos causados à Plataforma, Clientes ou terceiros."

Esta autocertificação substitui, para fins de ingresso ágil na Plataforma, a exigência prévia de envio de comprovante de residência, sem prejuízo do direito da Plataforma de solicitar tal documento em caso de incidente ou reclamação fundamentada.` },

  { section_id: 'descredenciamento', title: 'Do Descredenciamento e Encerramento da Parceria', icon_key: null, body: `O descredenciamento do Técnico Parceiro pode ocorrer:

- **A pedido do Técnico:** A qualquer momento, sem necessidade de justificativa, mediante solicitação formal pelo canal de suporte.
- **Pela Plataforma — com aviso prévio de 7 dias:** Por encerramento de operações na área de cobertura, descontinuação de categorias de serviço ou mudanças contratuais não aceitas pelo Técnico.
- **Pela Plataforma — imediato, sem aviso prévio:** Violação grave das obrigações previstas neste contrato ou nos Termos de Uso (fraude, condutas ilegais, pagamentos fora da Plataforma, danos graves a Clientes, fornecimento de dados falsos na Autocertificação).

O descredenciamento não afeta o direito ao recebimento de valores já devidos por chamados concluídos antes da data do encerramento, salvo em casos de descredenciamento por fraude comprovada.` },

  { section_id: 'vigencia-foro', title: 'Vigência, Lei Aplicável e Foro', icon_key: null, body: `Este contrato entra em vigor na data do aceite eletrônico pelo Técnico Parceiro no ato do cadastro e tem prazo indeterminado, podendo ser encerrado conforme previsto na cláusula anterior.

É regido pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias decorrentes desta relação contratual, fica eleito o **Foro da Comarca de Rio Verde, Estado de Goiás**, com renúncia expressa a qualquer outro foro, por mais privilegiado que seja.

---

**Repara RV Tecnologia e Intermediação Ltda**
CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil
E-mail: **contato@repararv.com**
Versão 1.0 — 13 de Setembro de 2026` },
];

async function seedDocument(slug, clauses) {
  console.log(`\n📄 ${slug}: ${clauses.length} cláusulas`);
  for (let i = 0; i < clauses.length; i++) {
    const c = clauses[i];
    const { error } = await admin.from('legal_clauses').upsert(
      {
        document_slug: slug,
        order_index: i,
        section_id: c.section_id,
        title: c.title,
        icon_key: c.icon_key,
        body_markdown: c.body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'document_slug,section_id' }
    );
    if (error) {
      console.error(`   ❌ ${c.section_id}: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`   ✅ ${i + 1}. ${c.section_id} — ${c.title}`);
    }
  }
}

await seedDocument('termos', termos);
await seedDocument('privacidade', privacidade);
await seedDocument('contrato', contrato);

console.log('\n✅ Seed concluído.');
