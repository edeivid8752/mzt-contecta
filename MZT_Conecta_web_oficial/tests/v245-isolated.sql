\set ON_ERROR_STOP on
RESET ROLE;
\ir ../supabase/upgrade_v245.sql
BEGIN;
-- Datos exclusivamente de prueba; rollback al final.
INSERT INTO public.mzt_forum_threads(id,user_id,title,body,category) VALUES
 ('24500000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Conversación de prueba','Texto','Comunidad'),
 ('24500000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Segunda conversación','Texto','Otros');
INSERT INTO public.mzt_forum_replies(thread_id,user_id,body) VALUES('24500000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Respuesta');
INSERT INTO public.mzt_forum_votes(thread_id,user_id,value) VALUES('24500000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1);
UPDATE public.app_roles SET role='ciudadano' WHERE user_id='00000000-0000-4000-8000-000000000001';
UPDATE public.app_roles SET role='lector' WHERE user_id='00000000-0000-4000-8000-000000000002';
UPDATE public.app_roles SET role='editor' WHERE user_id='00000000-0000-4000-8000-000000000003';
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege('public.mzt_forum_threads','DELETE') THEN RAISE EXCEPTION 'Visitante puede borrar'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE n int; BEGIN
 DELETE FROM public.mzt_forum_threads WHERE id='24500000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Ciudadano puede borrar'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n int; BEGIN
 DELETE FROM public.mzt_forum_threads WHERE id='24500000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Lector puede borrar'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE n int; BEGIN
 DELETE FROM public.mzt_forum_threads WHERE id='24500000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Editor no puede borrar'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.mzt_forum_replies WHERE thread_id='24500000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.mzt_forum_votes WHERE thread_id='24500000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Cascada incorrecta'; END IF;
END $$;
UPDATE public.app_roles SET role='editor' WHERE user_id='00000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n int; BEGIN
 DELETE FROM public.mzt_forum_threads WHERE id='24500000-0000-4000-8000-000000000002'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Segundo editor no puede borrar'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
SELECT 'v2.4.5: permisos de todos los editores y cascada correctos';
