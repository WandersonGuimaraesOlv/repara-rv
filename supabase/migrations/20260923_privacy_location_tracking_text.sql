-- =============================================================================
-- Migration: 20260923_privacy_location_tracking_text
-- Descrição: Política de Privacidade v1.1 — texto aprovado pelo dono em
--            23/09/2026 para o mapa de acompanhamento do técnico
--            (app/api/calls/tracking, components/provider-tracking-map.tsx).
--            A v1.0 dizia que a localização do técnico só era capturada com
--            ele "Online" e não previa mostrá-la ao cliente.
--            Idempotente: rodar de novo regrava o mesmo texto.
-- =============================================================================

-- Cláusula "Tratamento Especial: Dados de Localização Geográfica": troca o
-- parágrafo do técnico (é o último da cláusula).
UPDATE legal_clauses
SET body_markdown = substring(body_markdown FROM 1 FOR position('**Dados do Técnico' IN body_markdown) - 1)
      || $txt$**Dados do Técnico (localização em tempo real):** A localização geográfica do Técnico Parceiro é capturada e atualizada no banco de dados em duas situações: **(i)** enquanto o Técnico mantém o status "Online" no painel, para o radar encontrar o técnico mais próximo; e **(ii)** durante o deslocamento até o endereço de um chamado que ele aceitou. Nesse deslocamento, a posição do Técnico é exibida em um mapa **exclusivamente ao Cliente daquele chamado**, do aceite até o início do atendimento (confirmação do PIN de chegada). Armazenamos somente a última posição informada, sem histórico de trajeto. Ao acionar "Offline", a atualização cessa e a última posição é apagada; se o Técnico já estiver offline, a posição do deslocamento é apagada no início do atendimento ou no cancelamento do chamado.$txt$,
    updated_at = NOW()
WHERE document_slug = 'privacidade'
  AND section_id = 'localizacao'
  AND position('**Dados do Técnico' IN body_markdown) > 0;

-- Cláusula "Prazo de Retenção dos Dados": linha da localização do técnico.
UPDATE legal_clauses
SET body_markdown = replace(
      body_markdown,
      '| Localização em tempo real do Técnico | Não retida após o status offline |',
      '| Localização do Técnico | Somente a última posição; apagada ao ficar offline ou, se já estiver offline, ao fim do deslocamento do chamado |'
    ),
    updated_at = NOW()
WHERE document_slug = 'privacidade'
  AND position('| Localização em tempo real do Técnico |' IN body_markdown) > 0;

UPDATE legal_documents
SET version = '1.1', effective_date = '2026-09-23', updated_at = NOW()
WHERE slug = 'privacidade';
