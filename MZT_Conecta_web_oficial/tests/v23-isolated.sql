\set ON_ERROR_STOP on
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
ALTER TABLE auth.users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
CREATE TEMP TABLE before_posts AS SELECT to_jsonb(p) AS row FROM public.mzt_posts p;
CREATE TEMP TABLE before_profiles AS SELECT to_jsonb(p) AS row FROM public.profiles p;
CREATE TEMP TABLE before_business AS SELECT to_jsonb(p) AS row FROM public.mzt_businesses p;
CREATE TEMP TABLE before_campaign AS SELECT to_jsonb(p) AS row FROM public.mzt_ad_campaigns p;
\ir ../supabase/upgrade_v23.sql
DO $$ BEGIN
 IF EXISTS(SELECT row FROM before_posts EXCEPT SELECT to_jsonb(p)-'visitor_post'-'alert_zone' FROM public.mzt_posts p) OR
 EXISTS(SELECT row FROM before_profiles EXCEPT SELECT to_jsonb(p) FROM public.profiles p) OR
 EXISTS(SELECT row FROM before_business EXCEPT SELECT to_jsonb(p) FROM public.mzt_businesses p) OR
 EXISTS(SELECT row FROM before_campaign EXCEPT SELECT to_jsonb(p) FROM public.mzt_ad_campaigns p)
 THEN RAISE EXCEPTION 'Datos anteriores alterados'; END IF;
END $$;
INSERT INTO auth.users(id,is_anonymous) VALUES('00000000-0000-4000-8000-000000000023',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM profiles WHERE id='00000000-0000-4000-8000-000000000023') OR EXISTS(SELECT 1 FROM app_roles WHERE user_id='00000000-0000-4000-8000-000000000023') THEN RAISE EXCEPTION 'Visitante tiene perfil o rol registrado'; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT public.mzt_zone_alert_set(' Centro ',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000023',false);
INSERT INTO mzt_posts(id,user_id,type,category,title,description,location,alert_zone,review) VALUES('10000000-0000-4000-8000-000000000023',auth.uid(),'infrastructure','Bache','Bache de prueba','','Centro','Centro','pending');
DO $$ BEGIN
 IF NOT (SELECT visitor_post FROM mzt_posts WHERE id='10000000-0000-4000-8000-000000000023') THEN RAISE EXCEPTION 'Visitante no identificado'; END IF;
 IF EXISTS(SELECT 1 FROM profiles) OR EXISTS(SELECT 1 FROM mzt_zone_alerts) THEN RAISE EXCEPTION 'Visitante accede a información registrada'; END IF;
 BEGIN INSERT INTO mzt_posts(user_id,type,title,review) VALUES(auth.uid(),'citizen','Otro reporte','pending'); RAISE EXCEPTION 'Límite no aplicado'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Límite no aplicado' THEN RAISE; END IF; END;
 BEGIN PERFORM public.mzt_moderate_post('10000000-0000-4000-8000-000000000023','approved',NULL); RAISE EXCEPTION 'Visitante puede aprobar'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Visitante puede aprobar' THEN RAISE; END IF; END;
 BEGIN INSERT INTO mzt_businesses(owner_id,name) VALUES(auth.uid(),'Negocio no autorizado'); RAISE EXCEPTION 'Visitante crea negocio'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.mzt_confirm_report('10000000-0000-4000-8000-000000000023'); RAISE EXCEPTION 'Visitante confirma'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_public_feed()->'posts') AS x WHERE x->>'id'='10000000-0000-4000-8000-000000000023') THEN RAISE EXCEPTION 'Reporte pendiente visible'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM mzt_posts WHERE id='10000000-0000-4000-8000-000000000023') THEN RAISE EXCEPTION 'Pendiente visible a otro usuario'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_moderate_post('10000000-0000-4000-8000-000000000023','reviewed',NULL);
SELECT public.mzt_moderate_post('10000000-0000-4000-8000-000000000023','approved',NULL);
SELECT public.mzt_report_track('10000000-0000-4000-8000-000000000023');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT public.mzt_confirm_report('10000000-0000-4000-8000-000000000023');
SELECT public.mzt_confirm_report('10000000-0000-4000-8000-000000000023');
DO $$ BEGIN
 IF (public.mzt_report_snapshot(ARRAY['10000000-0000-4000-8000-000000000023'::uuid])->'10000000-0000-4000-8000-000000000023'->>'confirmations')::int<>1 THEN RAISE EXCEPTION 'Confirmación duplicada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mzt_notifications WHERE user_id=auth.uid() AND kind='zone_alert' AND post_id='10000000-0000-4000-8000-000000000023') THEN RAISE EXCEPTION 'Sin alerta de colonia'; END IF;
 BEGIN PERFORM public.mzt_report_track('10000000-0000-4000-8000-000000000023'); RAISE EXCEPTION 'Ciudadano modifica seguimiento'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.mzt_zone_alert_set('centro',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_resolve_post('10000000-0000-4000-8000-000000000023');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_public_feed()->'posts') AS x WHERE x->>'id'='10000000-0000-4000-8000-000000000023' AND (x->>'visitor_post')::boolean) THEN RAISE EXCEPTION 'Reporte aprobado no aparece'; END IF;
 IF jsonb_array_length(public.mzt_report_snapshot(ARRAY['10000000-0000-4000-8000-000000000023'::uuid])->'10000000-0000-4000-8000-000000000023'->'history')<>5 THEN RAISE EXCEPTION 'Historial incompleto'; END IF;
END $$;
RESET ROLE;
SELECT 'Pruebas SQL v2.3 correctas' AS resultado;
