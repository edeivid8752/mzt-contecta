-- v2.4: verificación de propiedad del correo separada del registro.
-- Aplicar ANTES de desactivar Confirm email en Auth.
BEGIN;
CREATE SCHEMA IF NOT EXISTS mzt_private;
REVOKE ALL ON SCHEMA mzt_private FROM PUBLIC,anon,authenticated;
CREATE TABLE mzt_private.v24_email_verified(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL,
 verified_at timestamptz NOT NULL
);
CREATE TABLE mzt_private.v24_email_requests(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL,
 session_id uuid NOT NULL,
 requested_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL
);
ALTER TABLE mzt_private.v24_email_verified ENABLE ROW LEVEL SECURITY;
ALTER TABLE mzt_private.v24_email_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mzt_private.v24_email_verified,mzt_private.v24_email_requests FROM PUBLIC,anon,authenticated;
-- Conservar el estado de confirmación anterior al cambio de configuración.
INSERT INTO mzt_private.v24_email_verified(user_id,email,verified_at)
 SELECT u.id,lower(u.email),u.email_confirmed_at
 FROM auth.users u JOIN public.app_roles r ON r.user_id=u.id
 WHERE NOT coalesce(u.is_anonymous,false) AND u.email_confirmed_at IS NOT NULL AND nullif(u.email,'') IS NOT NULL;

CREATE FUNCTION mzt_private.v24_has_verified_email(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM mzt_private.v24_email_verified v JOIN auth.users u ON u.id=v.user_id WHERE v.user_id=p_user AND v.email=lower(u.email) AND NOT coalesce(u.is_anonymous,false));
$$;
REVOKE ALL ON FUNCTION mzt_private.v24_has_verified_email(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.mzt_email_verification_begin() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 uid uuid:=auth.uid(); claims jsonb:=auth.jwt();
 sid uuid:=nullif(claims->>'session_id','')::uuid;
 addr text; moment timestamptz:=clock_timestamp(); inserted uuid;
BEGIN
 SELECT lower(u.email) INTO addr FROM auth.users u JOIN public.app_roles r ON r.user_id=u.id
 WHERE u.id=uid AND NOT coalesce(u.is_anonymous,false) AND nullif(u.phone,'') IS NULL AND nullif(u.email,'') IS NOT NULL;
 IF addr IS NULL OR lower(claims->>'email') IS DISTINCT FROM addr
    OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=sid AND s.user_id=uid) THEN
   RAISE EXCEPTION 'Inicia sesión con una cuenta de correo válida para solicitar la verificación' USING ERRCODE='42501';
 END IF;
 IF mzt_private.v24_has_verified_email(uid) THEN RETURN NULL; END IF;
 INSERT INTO mzt_private.v24_email_requests AS q(user_id,email,session_id,requested_at,expires_at)
 VALUES(uid,addr,sid,moment,moment+interval '1 hour')
 ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,session_id=excluded.session_id,requested_at=excluded.requested_at,expires_at=excluded.expires_at
 WHERE q.requested_at<=moment-interval '60 seconds'
 RETURNING user_id INTO inserted;
 IF inserted IS NULL THEN RAISE EXCEPTION 'Espera un minuto antes de solicitar otro enlace'; END IF;
 RETURN addr;
END $$;

CREATE FUNCTION public.mzt_email_verification_status() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 uid uuid:=auth.uid(); claims jsonb:=auth.jwt();
 sid uuid:=nullif(claims->>'session_id','')::uuid;
 addr text; q mzt_private.v24_email_requests%ROWTYPE;
BEGIN
 SELECT lower(u.email) INTO addr FROM auth.users u JOIN public.app_roles r ON r.user_id=u.id
 WHERE u.id=uid AND NOT coalesce(u.is_anonymous,false) AND nullif(u.email,'') IS NOT NULL;
 IF addr IS NULL OR lower(claims->>'email') IS DISTINCT FROM addr
    OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=sid AND s.user_id=uid) THEN RETURN false; END IF;
 IF mzt_private.v24_has_verified_email(uid) THEN RETURN true; END IF;
 -- OTP también puede ser un método telefónico; aquí solo se admiten cuentas sin teléfono.
 IF nullif(claims->>'phone','') IS NOT NULL OR EXISTS(SELECT 1 FROM auth.users u WHERE u.id=uid AND nullif(u.phone,'') IS NOT NULL) THEN RETURN false; END IF;
 SELECT * INTO q FROM mzt_private.v24_email_requests WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR q.email IS DISTINCT FROM addr OR q.expires_at<clock_timestamp() OR q.session_id=sid THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=sid AND s.user_id=uid AND s.created_at>=q.requested_at) THEN RETURN false; END IF;
 -- Solo métodos de prueba de correo del JWT firmado, no datos editables del perfil.
 IF NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(claims->'amr')='array' THEN claims->'amr' ELSE '[]'::jsonb END) AS a
   WHERE a->>'method' IN ('otp','magiclink')
     AND CASE WHEN jsonb_typeof(a->'timestamp')='number' THEN (a->>'timestamp')::numeric>=floor(extract(epoch FROM q.requested_at)) ELSE false END
 ) THEN RETURN false; END IF;
 INSERT INTO mzt_private.v24_email_verified(user_id,email,verified_at)
 VALUES(uid,addr,clock_timestamp()) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at;
 DELETE FROM mzt_private.v24_email_requests WHERE user_id=uid;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.mzt_email_verification_begin(),public.mzt_email_verification_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_email_verification_begin(),public.mzt_email_verification_status() TO authenticated;

-- Una cuenta sin correo comprobado no puede recibir privilegios editoriales/comerciales.
CREATE FUNCTION mzt_private.v24_require_verified_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='app_roles' THEN
   IF NEW.role<>'editor' THEN RETURN NEW; END IF;
 END IF;
 IF NOT mzt_private.v24_has_verified_email(NEW.user_id) THEN
   RAISE EXCEPTION 'Verifica el correo de la cuenta antes de conceder permisos administrativos' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzt_private.v24_require_verified_grant() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v24_verify_editor_grant BEFORE INSERT OR UPDATE OF role,user_id ON public.app_roles FOR EACH ROW EXECUTE FUNCTION mzt_private.v24_require_verified_grant();
CREATE TRIGGER v24_verify_ad_grant BEFORE INSERT OR UPDATE OF access_level,user_id ON public.mzt_ad_staff FOR EACH ROW EXECUTE FUNCTION mzt_private.v24_require_verified_grant();

CREATE FUNCTION mzt_private.v24_email_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF lower(OLD.email) IS DISTINCT FROM lower(NEW.email) THEN
   -- No dejar privilegios existentes asociados a una dirección distinta sin comprobar.
   IF EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=OLD.id AND role='editor')
      OR EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=OLD.id) THEN
     RAISE EXCEPTION 'Retira los permisos administrativos antes de cambiar el correo de esta cuenta' USING ERRCODE='42501';
   END IF;
   DELETE FROM mzt_private.v24_email_requests WHERE user_id=OLD.id;
   DELETE FROM mzt_private.v24_email_verified WHERE user_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzt_private.v24_email_changed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v24_invalidate_email_verification BEFORE UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION mzt_private.v24_email_changed();
COMMIT;
