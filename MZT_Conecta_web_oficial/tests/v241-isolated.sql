\set ON_ERROR_STOP on
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
CREATE TEMP TABLE before_241 AS SELECT to_jsonb(p) AS row FROM public.mzt_posts p;
\ir ../supabase/upgrade_v241.sql
DO $$ BEGIN
 IF EXISTS(SELECT row FROM before_241 EXCEPT SELECT to_jsonb(p)-'daily_until' FROM public.mzt_posts p) THEN RAISE EXCEPTION 'Datos anteriores cambiaron'; END IF;
END $$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
INSERT INTO public.mzt_posts(id,user_id,type,title,description,category,source_name,source_url,review,daily_until)
VALUES('10000000-0000-4000-8000-000000000041',auth.uid(),'news','Noticia de prueba uno','Descripción de prueba','Choques','Fuente de prueba','https://example.com/1','approved',(now() AT TIME ZONE 'America/Mazatlan')::date+1),
('10000000-0000-4000-8000-000000000042',auth.uid(),'news','Noticia de prueba dos','Descripción de prueba','Choques','Fuente de prueba','https://example.com/2','approved',(now() AT TIME ZONE 'America/Mazatlan')::date+2);
SELECT public.mzt_edit_editorial_news('10000000-0000-4000-8000-000000000041','Noticia actualizada','Descripción actualizada','Choques','Fuente','https://example.com/edit','Centro',NULL,NULL,(now() AT TIME ZONE 'America/Mazatlan')::date+3);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.mzt_posts WHERE id IN ('10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000042') AND review='approved')<>2 THEN RAISE EXCEPTION 'Noticias no permanecen simultáneas'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_public_feed()->'posts') x WHERE x->>'id'='10000000-0000-4000-8000-000000000041' AND x->>'daily_until' IS NOT NULL) THEN RAISE EXCEPTION 'Vigencia no pública'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 BEGIN PERFORM public.mzt_edit_editorial_news('10000000-0000-4000-8000-000000000041','Noticia alterada','Descripción de prueba','Choques','Fuente','https://example.com','Centro',NULL,NULL,current_date+3);RAISE EXCEPTION 'Ciudadano edita noticia'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
RESET ROLE;
SELECT 'Pruebas SQL v2.4.1 correctas';
