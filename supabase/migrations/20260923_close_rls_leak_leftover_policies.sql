-- =============================================================================
-- Migration: 20260923_close_rls_leak_leftover_policies
-- Descrição: ACHADO CRÍTICO, ATIVO EM PRODUÇÃO — reincidência do vazamento
--            corrigido em 14/09/2026 (Camada 4, item i3 do plano de
--            validação). O conserto de 14/09 funcionou; em 22/09/2026 o
--            supabase/schema.sql foi rodado por engano em produção e recriou
--            as duas políticas abertas (ele faz DROP + CREATE delas), ao lado
--            das políticas restritas criadas em 14/09. (Correção de 23/09: a
--            primeira versão deste comentário dizia que as antigas nunca
--            tinham sido removidas — a causa real só apareceu depois.)
--
--            RLS combina políticas permissivas do mesmo comando com OR, então
--            a política antiga (`using: true`) anulava completamente a
--            proteção da política nova. Efeito real, confirmado com
--            pg_policies em produção:
--
--            - profiles: qualquer pessoa, SEM LOGIN, via a chave anon
--              pública, conseguia ler nome completo, telefone e CPF de
--              qualquer usuário real (política "Perfis visíveis para
--              leitura", using: true, coexistindo com "Perfis visíveis para
--              usuários autenticados", using: auth.uid() IS NOT NULL).
--            - service_calls: qualquer usuário AUTENTICADO (não precisa ser
--              o prestador designado) conseguia ler todo chamado com
--              status='searching', endereço completo incluso (política
--              "Prestador vê chamados 'searching' e os seus", using:
--              status='searching' OR auth.uid()=provider_id).
--
--            Causa raiz (mesma de 14/09): todo chamado 'searching' já tem
--            provider_id preenchido desde a criação — a cláusula
--            OR status='searching' nunca teve propósito legítimo. A fila de
--            espera (status='queued', sem provider_id ainda) já usa
--            app/api/calls/queue/route.ts (Service Role, campos seguros),
--            não depende de RLS direta — remover esta política não quebra a
--            fila.
--
--            Corrigido imediatamente, sem esperar confirmação, por ser
--            vazamento de dados pessoais ativo e sem exigir autenticação.
-- =============================================================================

DROP POLICY IF EXISTS "Perfis visíveis para leitura" ON profiles;
DROP POLICY IF EXISTS "Prestador vê chamados 'searching' e os seus" ON service_calls;

NOTIFY pgrst, 'reload schema';
