-- Solo base desechable, después de v20-isolated.sql.
\set ON_ERROR_STOP on
\ir ../supabase/upgrade_v21.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.app_roles)<>1 OR EXISTS(SELECT 1 FROM public.app_roles WHERE user_id<>auth.uid()) THEN RAISE EXCEPTION 'Roles ajenos visibles'; END IF;
 IF NOT public.mzt_has_role('ciudadano') OR public.mzt_has_role('editor') THEN RAISE EXCEPTION 'Permiso propio alterado'; END IF;
 IF jsonb_array_length(public.mzt_public_feed()->'roles')<>0 THEN RAISE EXCEPTION 'Roles filtrados por RPC'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
DO $$ BEGIN
 IF NOT public.mzt_has_role('editor') OR (SELECT count(*) FROM public.app_roles)<>1 THEN RAISE EXCEPTION 'Permisos de editor alterados'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
DO $$ BEGIN
 IF jsonb_array_length(public.mzt_public_feed()->'roles')<>0 OR NOT (public.mzt_public_feed() ? 'posts') THEN RAISE EXCEPTION 'Feed público inválido'; END IF;
END $$;
RESET ROLE;
SELECT 'Pruebas SQL v2.1 correctas' AS result;
