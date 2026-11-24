-- SOLO PostgreSQL 17 desechable, nunca Supabase producción.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),display_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.app_roles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL DEFAULT 'ciudadano',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edit own display name" ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY "read own role" ON public.app_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.app_roles TO authenticated;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
\ir ../supabase/upgrade_v10.sql
\ir ../supabase/upgrade_v12.sql
INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
INSERT INTO profiles(id,display_name,username) VALUES('00000000-0000-4000-8000-000000000001','Test A','testa'),('00000000-0000-4000-8000-000000000002','Test B','testb'),('00000000-0000-4000-8000-000000000003','Editor','editor');
INSERT INTO app_roles(user_id,role) VALUES('00000000-0000-4000-8000-000000000001','ciudadano'),('00000000-0000-4000-8000-000000000002','ciudadano'),('00000000-0000-4000-8000-000000000003','editor');
INSERT INTO mzt_posts(id,user_id,type,title,review) VALUES('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','citizen','Publicación aprobada','approved'),('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','citizen','Pendiente privada','pending');
INSERT INTO mzt_comments(id,post_id,user_id,body) VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Comentario previo');
INSERT INTO mzt_votes(post_id,user_id) VALUES('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
\ir ../supabase/upgrade_v13.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles)<>3 OR (SELECT count(*) FROM public.app_roles)<>3 OR (SELECT count(*) FROM public.mzt_posts)<>2 OR (SELECT count(*) FROM public.mzt_comments)<>1 OR (SELECT count(*) FROM public.mzt_votes)<>1 THEN RAISE EXCEPTION 'Migración alteró datos existentes'; END IF;
END $$;
SET ROLE anon;
DO $$ DECLARE result jsonb; BEGIN
 result:=public.mzt_public_feed('10000000-0000-4000-8000-000000000002');
 IF jsonb_array_length(result->'posts')<>1 OR result->'posts'->0->>'review'<>'approved' OR result->'counts'->>'10000000-0000-4000-8000-000000000001'<>'1' THEN RAISE EXCEPTION 'Feed público incorrecto'; END IF;
 IF has_table_privilege('public.mzt_posts','INSERT') OR has_table_privilege('public.mzt_notifications','SELECT') OR has_table_privilege('public.mzt_saved','SELECT') THEN RAISE EXCEPTION 'Visitante con acceso privado'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
INSERT INTO mzt_saved(user_id,post_id) VALUES(auth.uid(),'10000000-0000-4000-8000-000000000001');
INSERT INTO mzt_flags(user_id,post_id,reason) VALUES(auth.uid(),'10000000-0000-4000-8000-000000000001','spam');
INSERT INTO mzt_comments(post_id,user_id,body,parent_id) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),'Respuesta @testa','20000000-0000-4000-8000-000000000001');
INSERT INTO mzt_comment_votes(user_id,comment_id) VALUES(auth.uid(),'20000000-0000-4000-8000-000000000001');
DO $$ DECLARE affected int; BEGIN
 UPDATE mzt_posts SET title='No autorizado' WHERE id='10000000-0000-4000-8000-000000000001'; GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Edición ajena permitida'; END IF;
 UPDATE mzt_flags SET status='reviewed'; GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Ciudadano puede moderar denuncias'; END IF;
 IF (SELECT count(*) FROM mzt_notifications)<>0 THEN RAISE EXCEPTION 'Notificación ajena visible'; END IF;
 BEGIN INSERT INTO mzt_saved(user_id,post_id) VALUES('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'Guardado ajeno permitido'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM mzt_saved)<>0 THEN RAISE EXCEPTION 'Guardados ajenos visibles'; END IF;
 IF (SELECT count(*) FROM mzt_notifications WHERE kind='comment')<>1 THEN RAISE EXCEPTION 'Falta notificación'; END IF;
END $$;
UPDATE mzt_comments SET body='Comentario editado' WHERE id='20000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF (SELECT edited_at IS NULL FROM mzt_comments WHERE id='20000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Falta fecha edición'; END IF; END $$;
UPDATE mzt_posts SET title='Reporte corregido' WHERE id='10000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF (SELECT review FROM mzt_posts WHERE id='10000000-0000-4000-8000-000000000001')<>'pending' THEN RAISE EXCEPTION 'No regresó a moderación'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
UPDATE mzt_flags SET status='reviewed';
SELECT public.mzt_moderate_post('10000000-0000-4000-8000-000000000001','approved');
SELECT public.mzt_moderate_post('10000000-0000-4000-8000-000000000002','rejected','Motivo de prueba');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM mzt_flags WHERE status='reviewed')<>1 OR (SELECT count(*) FROM mzt_notifications WHERE kind IN ('approved','rejected'))<>2 THEN RAISE EXCEPTION 'Moderación o notificaciones incorrectas'; END IF;
END $$;
SELECT 'Pruebas SQL v1.3 correctas' AS result;
