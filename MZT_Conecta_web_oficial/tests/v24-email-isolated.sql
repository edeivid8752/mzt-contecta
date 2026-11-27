\set ON_ERROR_STOP on
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN email_confirmed_at timestamptz, ADD COLUMN phone text;
UPDATE auth.users SET email=id::text||'@example.test',email_confirmed_at=now() WHERE NOT coalesce(is_anonymous,false);
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='00000000-0000-4000-8000-000000000002';
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
\ir ../supabase/upgrade_v24_email.sql
DO $$ BEGIN
 IF NOT mzt_private.v24_has_verified_email('00000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Se perdió confirmación anterior'; END IF;
 IF mzt_private.v24_has_verified_email('00000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Cuenta no confirmada aparece verificada'; END IF;
 BEGIN UPDATE public.app_roles SET role='editor' WHERE user_id='00000000-0000-4000-8000-000000000002'; RAISE EXCEPTION 'Editor sin correo comprobado'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.mzt_ad_staff(user_id,access_level) VALUES('00000000-0000-4000-8000-000000000002','admin'); RAISE EXCEPTION 'Permiso comercial sin correo comprobado'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_table_privilege('authenticated','mzt_private.v24_email_verified','SELECT') THEN RAISE EXCEPTION 'Estado privado expuesto'; END IF;
 IF has_function_privilege('anon','public.mzt_email_verification_status()','EXECUTE') THEN RAISE EXCEPTION 'RPC accesible a visitantes'; END IF;
END $$;
-- Simular confirmación automática del proveedor: no equivale a verificación.
UPDATE auth.users SET email_confirmed_at=clock_timestamp() WHERE id='00000000-0000-4000-8000-000000000002';
INSERT INTO auth.sessions(id,user_id) VALUES('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims',jsonb_build_object('email','00000000-0000-4000-8000-000000000002@example.test','session_id','20000000-0000-4000-8000-000000000001','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',floor(extract(epoch FROM clock_timestamp())))))::text,false);
DO $$ BEGIN
 IF public.mzt_email_verification_status() THEN RAISE EXCEPTION 'Contraseña prueba propiedad del correo'; END IF;
 IF public.mzt_email_verification_begin() IS NULL THEN RAISE EXCEPTION 'No se inició solicitud'; END IF;
 IF public.mzt_email_verification_status() THEN RAISE EXCEPTION 'Solicitud sin enlace ya verificada'; END IF;
 BEGIN PERFORM public.mzt_email_verification_begin(); RAISE EXCEPTION 'Sin límite de solicitudes'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Espera un minuto antes de solicitar otro enlace' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
INSERT INTO auth.sessions(id,user_id) VALUES('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('email','00000000-0000-4000-8000-000000000002@example.test','session_id','20000000-0000-4000-8000-000000000002','amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',floor(extract(epoch FROM clock_timestamp())))))::text,false);
DO $$ BEGIN IF public.mzt_email_verification_status() THEN RAISE EXCEPTION 'Nueva sesión de contraseña verifica correo'; END IF; END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('email','otra@example.test','session_id','20000000-0000-4000-8000-000000000002','amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',floor(extract(epoch FROM clock_timestamp())))))::text,false);
DO $$ BEGIN IF public.mzt_email_verification_status() THEN RAISE EXCEPTION 'Correo ajeno verificado'; END IF; END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('email','00000000-0000-4000-8000-000000000002@example.test','session_id','20000000-0000-4000-8000-000000000002','amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',floor(extract(epoch FROM clock_timestamp())))))::text,false);
DO $$ BEGIN IF NOT public.mzt_email_verification_status() THEN RAISE EXCEPTION 'Enlace válido no verifica'; END IF; END $$;
RESET ROLE;
DO $$ BEGIN IF NOT mzt_private.v24_has_verified_email('00000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Verificación no persiste'; END IF; END $$;
UPDATE auth.users SET email='nuevo@example.test' WHERE id='00000000-0000-4000-8000-000000000002';
DO $$ BEGIN IF mzt_private.v24_has_verified_email('00000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Cambio de correo conserva verificación'; END IF; END $$;
SELECT 'Pruebas de verificación diferida de correo correctas' AS resultado;
