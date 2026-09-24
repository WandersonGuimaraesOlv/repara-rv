-- =============================================================================
-- Migration: 20260924_legal_consistency_pass
-- Descrição: Revisão de consistência pedida pelo plano de maturação (§22):
--            documentos iguais ao que o app faz em 24/09/2026.
--            - Pix OU cartão em todos os lugares (sobras da O1 que ainda
--              diziam "exclusivamente via Pix"/"sistema Pix").
--            - Sem "Split de Pix liquidado diretamente": o repasse é manual,
--              por Pix, até existir CNPJ.
--            - Pagamento só depois de o cliente aprovar o serviço.
--            - Verificação do técnico descrita como é: conferência de CPF/CNPJ
--              e chave Pix pela equipe + selfie + autodeclaração; sem consulta
--              a base oficial nem antecedentes. Selo com o nome do app.
--            - SOS vale do aceite até o pagamento confirmado.
--            - Técnico fica offline sozinho depois de 2 chamados sem resposta
--              (não é penalidade) — os textos diziam que nada era automático.
--            - Privacidade: e-mail, CPF e CEP do cliente; e-mail e selfie do
--              técnico; prazo da selfie; sem "Efí Bank" (não é usado).
--            Troca só as frases exatas (replace) — o resto do texto não muda.
--            Idempotente. Rodar DEPOIS de o dono aprovar o texto.
-- =============================================================================

-- ── Termos ───────────────────────────────────────────────────────────────────
UPDATE legal_clauses
SET body_markdown = replace(replace(replace(body_markdown,
      'Para cadastro de **Clientes**: fornecimento de nome, celular e PIN.',
      'Para cadastro de **Clientes**: fornecimento de nome, e-mail, celular, CPF, CEP e PIN.'),
      'adicionalmente, CPF ou CNPJ MEI, chave Pix para recebimentos e assinatura da Autocertificação vinculante abaixo:',
      'adicionalmente, CPF ou CNPJ MEI, chave Pix para recebimentos, selfie de verificação tirada na hora e assinatura da Autocertificação vinculante abaixo:'),
      'O Split de Pix é liquidado diretamente na conta bancária vinculada ao CPF ou CNPJ informado.',
      'O repasse do valor líquido é feito pela Plataforma, por Pix, para a chave cadastrada pelo Técnico Parceiro, vinculada ao CPF ou CNPJ informado.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'cadastro';

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- Efetuar o pagamento exclusivamente via Pix pelo QR Code gerado pela Plataforma ao final do serviço, abstendo-se de qualquer negociação de preço ou forma de pagamento diretamente com o Técnico.',
      '- Conferir o serviço ao final do atendimento e efetuar o pagamento somente pela Plataforma, por Pix ou cartão, depois de aprovar o serviço, abstendo-se de qualquer negociação de preço ou forma de pagamento diretamente com o Técnico.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'obrigacoes-cliente';

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- Não negociar pagamento em modalidade diversa do Pix via Plataforma, sob pena de descredenciamento imediato.',
      '- Não negociar pagamento fora da Plataforma nem receber em dinheiro: o Cliente paga somente pela Plataforma, por Pix ou cartão, sob pena de descredenciamento imediato.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'obrigacoes-prestador';

UPDATE legal_clauses
SET body_markdown = replace(replace(body_markdown,
      'Todo Técnico Parceiro é submetido a verificação cadastral com conferência de titularidade da chave Pix/CPF e assinatura da Autodeclaração de Aptidão e Idoneidade. O profissional homologado recebe o selo de *"Segurança Verificada"* exibido ao Cliente durante o chamado.',
      'Todo Técnico Parceiro passa por verificação cadastral feita pela equipe da Plataforma: conferência do CPF ou CNPJ e da chave Pix informados, selfie de verificação tirada na hora e assinatura da Autodeclaração de Aptidão e Idoneidade. O profissional aprovado recebe o selo de *"Cadastro Verificado"*, exibido ao Cliente durante o chamado junto com a foto do Técnico. A Plataforma não consulta bases oficiais de dados nem realiza verificação de antecedentes criminais.'),
      'Durante chamados nos status *aceito, a caminho* e *em execução*, a Plataforma exibe a ambas as partes um **Botão SOS de Emergência**.',
      'Do aceite do chamado até a confirmação do pagamento — enquanto o Técnico está a caminho ou no local —, a Plataforma exibe a ambas as partes um **Botão SOS de Emergência**.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'seguranca';

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      'respeitando a autonomia do profissional autônomo e o modelo de trabalho independente.',
      'respeitando a autonomia do profissional autônomo e o modelo de trabalho independente. Para não enviar chamados a quem não está disponível, o Técnico que deixar de responder 2 chamados seguidos fica offline automaticamente e é avisado no celular; isso não é penalidade, e ele pode voltar a ficar online a qualquer momento.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'avaliacao'
  AND body_markdown NOT LIKE '%fica offline automaticamente%';

-- ── Contrato ─────────────────────────────────────────────────────────────────
UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- Não negociar pagamento em espécie, transferência direta ou qualquer outra modalidade fora do sistema Pix da Plataforma.',
      '- Não negociar pagamento em espécie, transferência direta ou qualquer outra modalidade fora da Plataforma: o Cliente paga somente pela Plataforma, por Pix ou cartão.'),
    updated_at = NOW()
WHERE document_slug = 'contrato' AND section_id = 'obrigacoes-tecnico';

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- A Plataforma **não aplica advertências, suspensões ou penalidades automáticas** por chamados recusados, expirados ou por períodos de inatividade.',
      '- A Plataforma **não aplica advertências, suspensões ou penalidades automáticas** por chamados recusados, expirados ou por períodos de inatividade. Sem resposta a 2 chamados seguidos, o Técnico Parceiro fica offline automaticamente, sem penalidade, e pode voltar a ficar online quando quiser.'),
    updated_at = NOW()
WHERE document_slug = 'contrato' AND section_id = 'natureza-juridica'
  AND body_markdown NOT LIKE '%fica offline automaticamente%';

-- ── Privacidade ──────────────────────────────────────────────────────────────
UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      'Mercado Pago / Efí Bank (processamento de pagamentos Pix, Brasil)',
      'Mercado Pago (processamento de pagamentos por Pix e cartão, Brasil)'),
    updated_at = NOW()
WHERE document_slug = 'privacidade' AND section_id = 'compartilhamento';

UPDATE legal_clauses
SET body_markdown = replace(replace(body_markdown,
      'processamento do pagamento via Pix;',
      'processamento do pagamento por Pix ou cartão;'),
      'validação de identidade do Técnico via conferência de CPF e chave Pix;',
      'verificação cadastral do Técnico (conferência de CPF ou CNPJ, chave Pix e selfie de verificação);'),
    updated_at = NOW()
WHERE document_slug = 'privacidade' AND section_id = 'finalidade-base-legal';

UPDATE legal_clauses
SET body_markdown = replace(replace(body_markdown,
      E'**Para Clientes / Moradores:**\n- Nome completo\n',
      E'**Para Clientes / Moradores:**\n- Nome completo, e-mail, CPF e CEP\n'),
      E'- Nome completo, celular com DDD e CPF ou CNPJ MEI\n',
      E'- Nome completo, e-mail, celular com DDD e CPF ou CNPJ MEI\n- Selfie de verificação (foto do rosto tirada na hora): usada pela equipe para aprovar o cadastro e exibida ao Cliente do chamado, para ele reconhecer o Técnico que chega\n'),
    updated_at = NOW()
WHERE document_slug = 'privacidade' AND section_id = 'dados-coletados'
  AND body_markdown NOT LIKE '%Selfie de verificação%';

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      E'| Dados de cadastro (nome, celular, CPF) | Enquanto a conta estiver ativa + 5 anos após encerramento |\n',
      E'| Dados de cadastro (nome, celular, CPF) | Enquanto a conta estiver ativa + 5 anos após encerramento |\n| Selfie de verificação do Técnico | Enquanto a conta estiver ativa; apagada após o encerramento da conta |\n'),
    updated_at = NOW()
WHERE document_slug = 'privacidade' AND section_id = 'retencao'
  AND body_markdown NOT LIKE '%Selfie de verificação%';

UPDATE legal_documents SET version = '1.3', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'termos' AND version = '1.2';
UPDATE legal_documents SET version = '1.3', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'contrato' AND version = '1.2';
UPDATE legal_documents SET version = '1.3', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'privacidade' AND version = '1.2';
