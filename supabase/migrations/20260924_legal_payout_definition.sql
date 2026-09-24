-- =============================================================================
-- Migration: 20260924_legal_payout_definition
-- Descrição: Complemento do item O1 (20260924_legal_payout_texts.sql): a
--            cláusula 1 dos Termos ("Das Definições") ainda definia "Split de
--            Pagamento" como divisão automática que repassa instantaneamente
--            ao técnico — o repasse é feito pela Plataforma, por Pix, no prazo
--            do Contrato. Mesma troca aprovada pelo dono em 24/09/2026.
--            Idempotente. Os Termos já estão na versão 1.1 de 24/09/2026.
-- =============================================================================

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      '- **Split de Pagamento:** Tecnologia de divisão automática do pagamento Pix, via gateway parceiro (Mercado Pago / Efí Bank), que repassa instantaneamente o valor líquido da mão de obra ao Prestador e retém a Taxa de Intermediação na conta da Plataforma.',
      '- **Repasse:** Transferência, por Pix, do valor líquido da mão de obra ao Técnico Parceiro, feita pela Plataforma depois da confirmação do pagamento do Cliente (Pix ou cartão), no prazo previsto no Contrato do Técnico Parceiro. A Taxa de Intermediação fica com a Plataforma.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'definicoes';
