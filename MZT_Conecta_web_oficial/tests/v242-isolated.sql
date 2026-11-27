\set ON_ERROR_STOP on
RESET ROLE;
\ir ../supabase/upgrade_v242.sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
INSERT INTO public.mzt_forum_threads(user_id,title,body,category) VALUES(auth.uid(),'Conversación de prueba Otros','Contenido de prueba','Otros');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_forum_snapshot(p_category=>'Otros')->'threads') t WHERE t->>'category'='Otros') THEN RAISE EXCEPTION 'No aparece Otros en el foro'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
SELECT 'Pruebas SQL v2.4.2 correctas';
