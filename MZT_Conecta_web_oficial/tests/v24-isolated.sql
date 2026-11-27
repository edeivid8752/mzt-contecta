\set ON_ERROR_STOP on
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
CREATE TEMP TABLE v24_before AS SELECT to_jsonb(p) AS row FROM public.mzt_posts p;
CREATE TEMP TABLE v24_flags_before AS SELECT to_jsonb(f) AS row FROM public.mzt_flags f;
\ir ../supabase/upgrade_v24.sql
DO $$ BEGIN
 IF EXISTS(SELECT row FROM v24_before EXCEPT SELECT to_jsonb(p)-'external_url' FROM public.mzt_posts p) OR EXISTS(SELECT row FROM v24_flags_before EXCEPT SELECT to_jsonb(f)-'reason_detail' FROM public.mzt_flags f) THEN RAISE EXCEPTION 'Datos anteriores alterados'; END IF;
END $$;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
INSERT INTO mzt_posts(id,user_id,type,category,title,description,location,external_url,review) VALUES('10000000-0000-4000-8000-000000000024',auth.uid(),'social','Comida','Evento de prueba','','Centro','https://example.com/evento','pending');
DO $$ BEGIN
 BEGIN INSERT INTO mzt_posts(user_id,type,category,title,description,location,external_url,review) VALUES(auth.uid(),'infrastructure','Bache','Prueba de enlace','','Centro','https://example.com','pending'); RAISE EXCEPTION 'Infraestructura acepta enlace'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO mzt_posts(user_id,type,category,title,description,location,external_url,review) VALUES(auth.uid(),'social','Comida','Prueba URL','','Centro','javascript:alert(1)','pending'); RAISE EXCEPTION 'URL inválida aceptada'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO mzt_flags(user_id,post_id,reason) VALUES(auth.uid(),'10000000-0000-4000-8000-000000000023','otro'); RAISE EXCEPTION 'Motivo vacío aceptado'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO mzt_flags(user_id,post_id,reason,reason_detail) VALUES(auth.uid(),'10000000-0000-4000-8000-000000000023','otro','Motivo de prueba');
 DELETE FROM mzt_posts WHERE id='10000000-0000-4000-8000-000000000023';
 IF FOUND THEN RAISE EXCEPTION 'Ciudadano elimina reporte ajeno'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.mzt_moderate_post('10000000-0000-4000-8000-000000000024','approved',NULL);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_public_feed()->'posts') x WHERE x->>'id'='10000000-0000-4000-8000-000000000024' AND x->>'external_url'='https://example.com/evento') THEN RAISE EXCEPTION 'Enlace público ausente'; END IF;
 DELETE FROM mzt_posts WHERE id='10000000-0000-4000-8000-000000000023';
 IF NOT FOUND THEN RAISE EXCEPTION 'Editor no puede eliminar'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
SELECT 'Pruebas v2.4 correctas' AS resultado;
