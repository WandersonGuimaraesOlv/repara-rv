-- =============================================================================
-- Migration: 20260924_spatial_ref_sys_read_only
-- Descrição: Aviso crítico do Supabase Advisors ("RLS Disabled in Public:
--            public.spatial_ref_sys"), conferido em 24/09/2026: a tabela do
--            PostGIS com os sistemas de coordenadas tinha INSERT, UPDATE,
--            DELETE e TRUNCATE liberados pra anon e authenticated — qualquer
--            visitante, sem login, podia apagar o SRID 4326 pela API e
--            derrubar toda conta de distância do app (casamento de técnico,
--            mapa, rota). Provado no staging com um DELETE que não casava
--            nenhuma linha: a API aceitou.
--
--            A tabela é do supabase_admin, que também deu as permissões: o
--            usuário do SQL Editor (postgres) não consegue revogá-las nem
--            ligar RLS nela. Mas tem TRIGGER nela — então um gatilho recusa
--            qualquer escrita feita como anon/authenticated (a API pública).
--            Leitura continua liberada; o próprio Supabase (supabase_admin)
--            continua podendo atualizar o PostGIS.
--
--            O Advisor continua acusando "RLS disabled" (ele só olha a flag de
--            RLS), mas a escrita pela API passa a ser recusada.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.block_api_writes_spatial_ref_sys()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'spatial_ref_sys é somente leitura pela API' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_block_api_writes ON public.spatial_ref_sys;
CREATE TRIGGER trg_block_api_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.spatial_ref_sys
  FOR EACH ROW EXECUTE FUNCTION public.block_api_writes_spatial_ref_sys();

DROP TRIGGER IF EXISTS trg_block_api_truncate ON public.spatial_ref_sys;
CREATE TRIGGER trg_block_api_truncate
  BEFORE TRUNCATE ON public.spatial_ref_sys
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_api_writes_spatial_ref_sys();
