-- v1.3.1: conservar perfiles existentes y personalizar los nuevos registros.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_mzt_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb);
  v_name text;
  v_username text;
BEGIN
  IF NOT (meta ? 'display_name' OR meta ? 'username') THEN
    -- Compatibilidad con la versión anterior y las cuentas creadas sin estos campos.
    v_name := 'Ciudadano ' || left(replace(NEW.id::text,'-',''),8);
    v_username := 'c_' || left(replace(NEW.id::text,'-',''),12);
    LOOP
      INSERT INTO public.profiles(id,display_name,username) VALUES(NEW.id,v_name,v_username)
      ON CONFLICT (lower(username)) DO NOTHING;
      EXIT WHEN FOUND;
      v_username := 'c_' || left(replace(gen_random_uuid()::text,'-',''),18);
    END LOOP;
  ELSE
    IF jsonb_typeof(meta->'display_name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(meta->'username') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Nombre visible y nombre de usuario obligatorios' USING ERRCODE='22023';
    END IF;
    v_name := btrim(meta->>'display_name');
    v_username := lower(btrim(meta->>'username'));
    IF char_length(v_name) NOT BETWEEN 3 AND 40 OR v_username !~ '^[a-z0-9._]{3,20}$' THEN
      RAISE EXCEPTION 'Nombre visible o nombre de usuario no válido' USING ERRCODE='22023';
    END IF;
    -- El índice único existente impide duplicados incluso con solicitudes simultáneas.
    INSERT INTO public.profiles(id,display_name,username) VALUES(NEW.id,v_name,v_username);
  END IF;
  -- Nunca confiar en metadatos del usuario para asignar privilegios.
  INSERT INTO public.app_roles(user_id,role) VALUES(NEW.id,'ciudadano');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_mzt_new_user() FROM PUBLIC,anon,authenticated;

-- Consulta pública deliberadamente limitada a un booleano; no devuelve datos de perfiles.
CREATE OR REPLACE FUNCTION public.mzt_username_available(p_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_username IS NULL OR lower(btrim(p_username)) !~ '^[a-z0-9._]{3,20}$' THEN false
 ELSE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username)=lower(btrim(p_username))) END;
$$;
REVOKE ALL ON FUNCTION public.mzt_username_available(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_username_available(text) TO anon,authenticated;
COMMIT;
