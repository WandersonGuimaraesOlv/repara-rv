-- =============================================================================
-- Migration: 20260924_legal_warranty_button
-- Descrição: Termos, cláusula "Da Garantia": a garantia também é acionada pelo
--            botão "Acionar garantia" no acompanhamento do chamado
--            (app/api/calls/warranty, publicado em 24/09/2026). Aprovado pelo
--            dono em 24/09/2026. Troca só a frase exata. Idempotente.
-- =============================================================================

UPDATE legal_clauses
SET body_markdown = replace(body_markdown,
      'O acionamento da garantia deve ser feito pelo canal de suporte da Plataforma (WhatsApp ou e-mail) dentro do prazo estabelecido, com breve descrição do problema e o número do chamado original.',
      'O acionamento da garantia deve ser feito pelo botão **"Acionar garantia"** no acompanhamento do chamado, na Plataforma, ou pelo canal de suporte (WhatsApp ou e-mail), dentro do prazo estabelecido, com breve descrição do problema e o número do chamado original.'),
    updated_at = NOW()
WHERE document_slug = 'termos' AND section_id = 'garantia';

UPDATE legal_documents SET version = '1.4', effective_date = '2026-09-24', updated_at = NOW() WHERE slug = 'termos' AND version = '1.3';
