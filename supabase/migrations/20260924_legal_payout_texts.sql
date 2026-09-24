-- =============================================================================
-- Migration: 20260924_legal_payout_texts
-- Descrição: Item O1 do plano de lançamento — textos aprovados pelo dono em
--            24/09/2026. Os documentos diziam "repasse automático via Split de
--            Pix", mas nenhum técnico tem conta do Mercado Pago conectada: o
--            pagamento cai na conta da plataforma e o repasse é feito por Pix,
--            no prazo da cláusula 4 do Contrato (até 48 h). Também:
--            - pagamento por Pix OU cartão (decisão do dono: manter o cartão;
--              os Termos diziam "exclusivamente via Pix");
--            - janela de aceite de 30 s (o app sempre deu 30, o texto dizia 45);
--            - taxa de R$ 10 a R$ 20 (faixa real do catálogo; dizia 12 a 25);
--            - "não aceitamos dinheiro, somente Pix e cartão" explícito (pedido
--              do dono em 24/09/2026) nos Termos e no Contrato.
--            Troca só as frases exatas (replace) — o resto do texto não muda.
--            Idempotente: rodar de novo não altera nada.
-- =============================================================================

-- Contrato, cláusula 3 (remuneração)
UPDATE legal_clauses
SET title = 'Da Remuneração, Repasse via Pix e Taxa de Intermediação',
    body_markdown = replace(replace(replace(body_markdown,
      'concluído e pago pelo Cliente via Pix na Plataforma',
      'concluído e pago pelo Cliente na Plataforma (Pix ou cartão)'),
      '- O repasse é processado automaticamente via Split de Pagamento Pix no momento da confirmação do pagamento pelo Cliente.',
      '- O repasse é feito pela Plataforma, por Pix, para a chave Pix cadastrada pelo Técnico Parceiro, no prazo da cláusula seguinte.' || E'\n' ||
      '- **O Técnico Parceiro não pode receber pagamento em dinheiro** nem por qualquer meio fora da Plataforma: o Cliente paga somente pela Plataforma, por Pix ou cartão.'),
      'variando entre R$ 12,00 e R$ 25,00 por chamado',
      'variando entre R$ 10,00 e R$ 20,00 por chamado'),
    updated_at = NOW()
WHERE document_slug = 'contrato' AND section_id = 'remuneracao';

-- Termos, cláusula 5 (fluxo do chamado)
UPDATE legal_clauses
SET body_markdown = replace(replace(body_markdown,
      'O Técnico tem até **45 segundos** para aceitar o chamado.',
      'O Técnico tem até **30 segundos** para aceitar o chamado.'),
      '7. **Pagamento via Pix:** Ao concluir o serviço, o Técnico aciona a finalização na Plataforma. O Cliente realiza o pagamento via QR Code Pix dinâmico gerado pela Plataforma. O repasse automático ao Técnico ocorre após a confirmação do pagamento.',
      '7. **Pagamento:** Ao concluir o serviço, o Técnico aciona a finalização na Plataforma. O Cliente realiza o pagamento pela Plataforma, somente via Pix (QR Code dinâmico) ou cartão de crédito/débito — não aceitamos dinheiro. Após a confirmação do pagamento, a Plataforma repassa ao Técnico o valor líquido da mão de obra.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'contratacao';

-- Termos, cláusula 6 (pagamentos)
UPDATE legal_clauses
SET title = 'Dos Pagamentos, Repasse e Taxa de Intermediação',
    body_markdown = replace(replace(replace(body_markdown,
      'O pagamento é realizado **exclusivamente via Pix**, por meio de QR Code dinâmico gerado pela Plataforma ao final do serviço.',
      'O pagamento é realizado **exclusivamente pela Plataforma**, ao final do serviço, **somente via Pix (QR Code dinâmico) ou cartão de crédito/débito** (checkout do Mercado Pago). **Não aceitamos pagamento em dinheiro.**'),
      'qualquer pagamento em dinheiro, transferência bancária direta, cartão próprio do Técnico ou qualquer outra modalidade que não seja o Pix via Plataforma.',
      'qualquer pagamento em dinheiro, transferência bancária direta, maquininha ou link de pagamento do Técnico, ou qualquer outra modalidade fora da Plataforma.'),
      'O processamento utiliza tecnologia de **Split de Pagamento**: no momento da liquidação do Pix, o valor líquido da mão de obra é repassado automaticamente à conta vinculada à chave Pix cadastrada pelo Técnico Parceiro. A **Taxa de Intermediação** (entre R$ 12,00 e R$ 25,00 por chamado, conforme catálogo) é retida pela Plataforma para custeio de infraestrutura tecnológica de nuvem, segurança de dados, suporte operacional e desenvolvimento contínuo.',
      'O pagamento é recebido pela Plataforma, que retém a **Taxa de Intermediação** (entre R$ 10,00 e R$ 20,00 por chamado, conforme catálogo), destinada ao custeio de infraestrutura tecnológica de nuvem, segurança de dados, suporte operacional e desenvolvimento contínuo, e repassa o valor líquido da mão de obra, por Pix, à chave cadastrada pelo Técnico Parceiro, no prazo previsto no Contrato do Técnico Parceiro.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'pagamentos';

-- Privacidade, cláusula 1 (dados coletados)
UPDATE legal_clauses
SET body_markdown = replace(replace(replace(body_markdown,
      '- Chave Pix e tipo de chave (para processamento automático de repasses)',
      '- Chave Pix e tipo de chave (para o repasse dos valores ao Técnico)'),
      '- Todas as transações são processadas pelo protocolo Pix do Banco Central do Brasil, via gateway seguro (Mercado Pago / Efí Bank).',
      '- Os pagamentos (Pix ou cartão) são processados pelo Mercado Pago. Os dados do cartão são digitados no ambiente do próprio Mercado Pago e não passam pelos sistemas da Repara RV.'),
      'Armazenamos apenas o ID da transação Pix e o status de pagamento',
      'Armazenamos apenas o ID da transação e o status de pagamento'),
    updated_at = NOW()
WHERE document_slug = 'privacidade' AND section_id = 'dados-coletados';

-- Versões (só sobem uma vez: a condição olha a versão anterior)
UPDATE legal_documents SET version = '1.1', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'termos' AND version = '1.0';
UPDATE legal_documents SET version = '1.1', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'contrato' AND version = '1.0';
UPDATE legal_documents SET version = '1.2', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'privacidade' AND version = '1.1';
