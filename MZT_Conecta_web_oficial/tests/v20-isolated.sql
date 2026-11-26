-- Ejecutar después de v13-isolated.sql y v131-isolated.sql, solo en PostgreSQL desechable.
\set ON_ERROR_STOP on
CREATE TEMP TABLE before_v20 AS SELECT (SELECT count(*) FROM profiles) AS profiles,(SELECT count(*) FROM mzt_posts) AS posts,(SELECT count(*) FROM mzt_comments) AS comments,(SELECT count(*) FROM mzt_votes) AS votes;
\ir ../supabase/upgrade_v20.sql
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM before_v20 WHERE profiles<>(SELECT count(*) FROM public.profiles) OR posts<>(SELECT count(*) FROM public.mzt_posts) OR comments<>(SELECT count(*) FROM public.mzt_comments) OR votes<>(SELECT count(*) FROM public.mzt_votes)) THEN RAISE EXCEPTION 'Datos anteriores modificados'; END IF;
 IF EXISTS(SELECT 1 FROM public.mzt_forum_threads) THEN RAISE EXCEPTION 'Foro no vacío'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
 IF jsonb_array_length(public.mzt_forum_snapshot()->'threads')<>0 OR has_table_privilege('public.mzt_forum_threads','INSERT') OR has_table_privilege('public.mzt_forum_votes','SELECT') THEN RAISE EXCEPTION 'Acceso anónimo incorrecto'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO mzt_posts(user_id,type,category,title,event_day,longitude,latitude) VALUES(auth.uid(),'social','Eventos y música','Actividad comunitaria',current_date+1,-106.42,23.21) RETURNING id AS social_id \gset
DO $$ BEGIN
 BEGIN
  INSERT INTO mzt_posts(user_id,type,title,review) VALUES(auth.uid(),'social','Publicación inválida','approved');
  RAISE EXCEPTION 'Aprobación directa permitida';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO mzt_forum_threads(user_id,title,body,category) VALUES('00000000-0000-4000-8000-000000000002','Autor incorrecto','Texto','Comunidad');
  RAISE EXCEPTION 'Suplantación permitida';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_moderate_post(:'social_id','approved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO mzt_forum_threads(user_id,title,body,category,post_id) VALUES(auth.uid(),'Conversación','Texto','Comunidad',:'social_id') RETURNING id AS thread_id \gset
INSERT INTO mzt_forum_votes(thread_id,user_id,value) VALUES(:'thread_id',auth.uid(),1);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
INSERT INTO mzt_forum_replies(thread_id,user_id,body) VALUES(:'thread_id',auth.uid(),'Respuesta');
INSERT INTO mzt_forum_votes(thread_id,user_id,value) VALUES(:'thread_id',auth.uid(),-1);
DO $$ DECLARE n int; BEGIN
 IF (SELECT count(*) FROM mzt_forum_votes)<>1 THEN RAISE EXCEPTION 'Votos ajenos visibles'; END IF;
 UPDATE mzt_forum_votes SET value=-1 WHERE user_id='00000000-0000-4000-8000-000000000001'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Voto ajeno modificable'; END IF;
 IF (public.mzt_forum_snapshot()->'threads'->0->>'score')::int<>0 THEN RAISE EXCEPTION 'Conteo incorrecto'; END IF;
END $$;
UPDATE mzt_forum_votes SET value=1 WHERE thread_id=:'thread_id' AND user_id=auth.uid();
DELETE FROM mzt_forum_votes WHERE thread_id=:'thread_id' AND user_id=auth.uid();
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SET ROLE anon;
DO $$ DECLARE d jsonb; BEGIN
 d:=public.mzt_forum_snapshot((public.mzt_forum_snapshot()->'threads'->0->>'id')::uuid);
 IF (d->'threads'->0->>'score')::int<>1 OR (d->'threads'->0->>'my_vote')::int<>0 OR jsonb_array_length(d->'replies')<>1 THEN RAISE EXCEPTION 'Foro público incorrecto'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.mzt_public_feed()->'posts') p WHERE p->>'type'='social' AND p->>'event_day' IS NOT NULL) THEN RAISE EXCEPTION 'Evento no visible'; END IF;
END $$;
RESET ROLE;
SELECT 'Pruebas SQL v2.0 correctas' AS result;
