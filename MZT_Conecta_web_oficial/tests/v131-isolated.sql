-- Ejecutar después de v13-isolated.sql en la misma base de pruebas desechable.
\set ON_ERROR_STOP on
ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TRIGGER mzt_test_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_mzt_new_user();
\ir ../supabase/upgrade_v131.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM profiles)<>3 OR (SELECT count(*) FROM app_roles)<>3 THEN RAISE EXCEPTION 'Se alteraron los perfiles existentes'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
 IF public.mzt_username_available('TESTA') OR NOT public.mzt_username_available('nuevo.usuario') OR public.mzt_username_available('a!') OR public.mzt_username_available(NULL) THEN RAISE EXCEPTION 'Disponibilidad incorrecta'; END IF;
 IF has_table_privilege('public.profiles','SELECT') THEN RAISE EXCEPTION 'Visitante con acceso a tabla de perfiles'; END IF;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000004','{"display_name":"  Nuevo Usuario  ","username":"Nuevo.Usuario","role":"editor"}');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id='00000000-0000-4000-8000-000000000004' AND display_name='Nuevo Usuario' AND username='nuevo.usuario') THEN RAISE EXCEPTION 'Identidad no guardada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app_roles WHERE user_id='00000000-0000-4000-8000-000000000004' AND role='ciudadano') THEN RAISE EXCEPTION 'Rol inseguro'; END IF;
 BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000005','{"display_name":"Duplicado","username":"NUEVO.USUARIO"}');
 RAISE EXCEPTION 'Duplicado permitido';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000006','{"display_name":"  ","username":"otro"}');
 RAISE EXCEPTION 'Nombre inválido permitido';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000007','{"username":"otro"}');
 RAISE EXCEPTION 'Metadatos incompletos permitidos';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 INSERT INTO auth.users(id,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000008','{"display_name":"Usuario","username":"bad handle"}');
 RAISE EXCEPTION 'Usuario inválido permitido';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000009');
DO $$ BEGIN
 IF (SELECT count(*) FROM profiles)<>5 OR (SELECT count(*) FROM app_roles)<>5 THEN RAISE EXCEPTION 'Registros no atómicos'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id='00000000-0000-4000-8000-000000000009' AND username LIKE 'c_%') THEN RAISE EXCEPTION 'Compatibilidad anterior rota'; END IF;
 IF public.mzt_username_available('nuevo.usuario') THEN RAISE EXCEPTION 'Nombre duplicado disponible'; END IF;
END $$;
SELECT 'Pruebas SQL v1.3.1 correctas' AS result;
