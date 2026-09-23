-- =============================================================================
-- Migration: 20260923_provider_status_private
-- Descrição: A política "Prestadores online visíveis para clientes
--            autenticados" (supabase/schema.sql) deixava QUALQUER usuário
--            logado ler a linha inteira de todo prestador online — incluindo
--            a chave Pix (que pode ser o CPF) e a localização ao vivo
--            (current_location). Provado no staging em 23/09/2026 com um
--            cliente comum. Nenhuma tela de cliente lê provider_status (só o
--            próprio prestador, pela política "Prestador gerencia seu próprio
--            status"); o casamento com o prestador mais próximo e a fila rodam
--            no servidor com Service Role. O único outro leitor é o painel
--            admin (app/(admin)/admin/dashboard, pelo navegador), que passa a
--            ter uma política própria.
-- =============================================================================

DROP POLICY IF EXISTS "Prestadores online visíveis para clientes autenticados" ON provider_status;

DROP POLICY IF EXISTS "Admin vê status dos prestadores" ON provider_status;
CREATE POLICY "Admin vê status dos prestadores"
  ON provider_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

NOTIFY pgrst, 'reload schema';
