-- =============================================================================
-- Migration: 20260924_legal_completion_approval
-- Descrição: Textos da conferência antes do Pix (pedido do dono em
--            24/09/2026 — migration 20260924_client_approves_completion.sql):
--            - Termos, cláusula 5, passo 7: o Cliente confere e aprova o
--              serviço na Plataforma antes do pagamento; problema apontado
--              volta pro Técnico corrigir; em divergência a equipe aprova ou
--              cancela. Nada é aprovado automaticamente.
--            - Contrato, cláusula 3: o Técnico espera no local a aprovação e a
--              confirmação do pagamento antes de encerrar o atendimento.
--            Troca só as frases exatas (replace) — o resto do texto não muda.
--            Idempotente: rodar de novo não altera nada.
--            Rodar DEPOIS de o dono aprovar o texto.
-- =============================================================================

-- Termos, cláusula 5 (fluxo do chamado), passo 7
UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '7. **Pagamento:** Ao concluir o serviço, o Técnico aciona a finalização na Plataforma. O Cliente realiza o pagamento pela Plataforma, somente via Pix (QR Code dinâmico) ou cartão de crédito/débito — não aceitamos dinheiro. Após a confirmação do pagamento, a Plataforma repassa ao Técnico o valor líquido da mão de obra.',
      '7. **Conferência e Pagamento:** Ao concluir o serviço, o Técnico aciona a finalização na Plataforma e o Cliente confere o serviço no local. **O pagamento só é liberado depois que o Cliente aprova o serviço na Plataforma** — não há aprovação automática. Se o Cliente apontar um problema, o Técnico corrige e aciona a finalização de novo; havendo divergência, a equipe da Plataforma analisa o caso e pode aprovar a conclusão ou cancelar o chamado. Após a aprovação, o Cliente realiza o pagamento pela Plataforma, somente via Pix (QR Code dinâmico) ou cartão de crédito/débito — não aceitamos dinheiro. Após a confirmação do pagamento, a Plataforma repassa ao Técnico o valor líquido da mão de obra.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'contratacao';

-- Contrato, cláusula 3 (remuneração): espera no local até o pagamento
UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- **O Técnico Parceiro não pode receber pagamento em dinheiro** nem por qualquer meio fora da Plataforma: o Cliente paga somente pela Plataforma, por Pix ou cartão.',
      '- **O Técnico Parceiro não pode receber pagamento em dinheiro** nem por qualquer meio fora da Plataforma: o Cliente paga somente pela Plataforma, por Pix ou cartão.' || E'\n' ||
      '- Ao concluir o serviço, o Técnico Parceiro aciona a finalização na Plataforma e **permanece no local até o Cliente aprovar o serviço e o pagamento ser confirmado na Plataforma**. Se o Cliente apontar um problema, o Técnico Parceiro corrige e aciona a finalização de novo; havendo divergência, a equipe da Plataforma decide.'),
    updated_at = NOW()
WHERE document_slug = 'contrato' AND section_id = 'remuneracao'
  AND body_markdown NOT LIKE '%permanece no local até o Cliente aprovar%';

UPDATE legal_documents SET version = '1.2', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'termos' AND version = '1.1';
UPDATE legal_documents SET version = '1.2', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'contrato' AND version = '1.1';
