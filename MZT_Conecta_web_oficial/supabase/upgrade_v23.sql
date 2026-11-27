-- v2.3: migración aditiva; no modifica registros existentes.
BEGIN;
ALTER TABLE public.mzt_posts ADD COLUMN visitor_post boolean NOT NULL DEFAULT false, ADD COLUMN alert_zone text CHECK(char_length(alert_zone)<=100);
GRANT SELECT(visitor_post,alert_zone),INSERT(alert_zone) ON public.mzt_posts TO authenticated;

CREATE TABLE public.mzt_report_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 post_id uuid NOT NULL REFERENCES public.mzt_posts(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('pending','reviewed','approved','tracking','resolved','rejected')),
 happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mzt_report_history_post ON public.mzt_report_history(post_id,happened_at,id);
CREATE TABLE public.mzt_report_confirmations (
 post_id uuid NOT NULL REFERENCES public.mzt_posts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(post_id,user_id)
);
CREATE TABLE public.mzt_zone_alerts (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 zone text NOT NULL CHECK(char_length(zone) BETWEEN 2 AND 100),
 PRIMARY KEY(user_id,zone)
);
ALTER TABLE public.mzt_report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_report_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_zone_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_report_history,public.mzt_report_confirmations,public.mzt_zone_alerts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mzt_zone_alerts TO authenticated;
CREATE POLICY v23_zone_own ON public.mzt_zone_alerts FOR SELECT TO authenticated USING(user_id=auth.uid());

-- Defensa adicional: una sesión anónima no adquiere permisos por pertenecer al rol PostgreSQL authenticated.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','app_roles','mzt_comments','mzt_comment_votes','mzt_votes','mzt_follows','mzt_flags','mzt_saved','mzt_notifications','mzt_forum_threads','mzt_forum_replies','mzt_forum_votes','mzt_ad_staff','mzt_businesses','mzt_ad_campaigns','mzt_ad_events','mzt_zone_alerts'] LOOP
  EXECUTE format('CREATE POLICY v23_registered_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.mzt_has_role(''ciudadano'') OR public.mzt_has_role(''lector'') OR public.mzt_has_role(''editor'')) WITH CHECK (public.mzt_has_role(''ciudadano'') OR public.mzt_has_role(''lector'') OR public.mzt_has_role(''editor''))',t);
 END LOOP;
END $$;
CREATE POLICY v23_post_update_registered ON public.mzt_posts AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.mzt_has_role('ciudadano') OR public.mzt_has_role('lector') OR public.mzt_has_role('editor')) WITH CHECK(public.mzt_has_role('ciudadano') OR public.mzt_has_role('lector') OR public.mzt_has_role('editor'));
CREATE POLICY v23_post_delete_registered ON public.mzt_posts AS RESTRICTIVE FOR DELETE TO authenticated USING(public.mzt_has_role('ciudadano') OR public.mzt_has_role('lector') OR public.mzt_has_role('editor'));

CREATE OR REPLACE FUNCTION mzt_private.v23_guard_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE visitor boolean; known boolean;
BEGIN
 IF TG_OP='UPDATE' THEN
  NEW.visitor_post:=OLD.visitor_post; RETURN NEW;
 END IF;
 IF auth.uid() IS NULL THEN NEW.visitor_post:=false; RETURN NEW; END IF;
 SELECT coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false) INTO visitor FROM auth.users u WHERE u.id=auth.uid();
 SELECT EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=auth.uid()) INTO known;
 IF NOT coalesce(visitor,false) AND NOT known THEN RAISE EXCEPTION 'Sesión sin permisos de publicación' USING ERRCODE='42501'; END IF;
 NEW.visitor_post:=coalesce(visitor,false);
 IF NEW.alert_zone IS NOT NULL THEN NEW.alert_zone:=nullif(lower(regexp_replace(btrim(NEW.alert_zone),'\s+',' ','g')),''); END IF;
 IF NEW.visitor_post THEN
  IF NEW.user_id<>auth.uid() OR NEW.review<>'pending' OR NEW.type NOT IN ('citizen','infrastructure','social') THEN RAISE EXCEPTION 'Publicación de visitante no autorizada' USING ERRCODE='42501'; END IF;
  -- Bloqueo transaccional evita superar los límites con envíos simultáneos.
  PERFORM pg_advisory_xact_lock(230023);
  NEW.created_at:=now();
  IF (SELECT count(*) FROM public.mzt_posts WHERE visitor_post AND user_id=NEW.user_id AND created_at>now()-interval '24 hours')>=3
    OR EXISTS(SELECT 1 FROM public.mzt_posts WHERE visitor_post AND user_id=NEW.user_id AND created_at>now()-interval '60 seconds')
    OR (SELECT count(*) FROM public.mzt_posts WHERE visitor_post AND created_at>now()-interval '1 hour')>=60
  THEN RAISE EXCEPTION 'Límite de publicaciones de visitante. Intenta más tarde.'; END IF;
  IF EXISTS(SELECT 1 FROM public.mzt_posts WHERE visitor_post AND user_id=NEW.user_id AND lower(btrim(title))=lower(btrim(NEW.title)) AND type=NEW.type AND category=NEW.category AND created_at>now()-interval '24 hours') THEN RAISE EXCEPTION 'Ya enviaste un reporte similar.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzt_private.v23_guard_post() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v23_guard_post BEFORE INSERT OR UPDATE ON public.mzt_posts FOR EACH ROW EXECUTE FUNCTION mzt_private.v23_guard_post();
CREATE INDEX mzt_v23_visitor_rate ON public.mzt_posts(created_at,user_id) WHERE visitor_post;

-- Imágenes de visitantes: como máximo 3 nuevas por sesión y día; el resto conserva las reglas previas.
CREATE FUNCTION mzt_private.v23_media_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=auth.uid())
 OR (EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false))
 AND (SELECT count(*) FROM storage.objects o WHERE o.bucket_id='mzt-media' AND (storage.foldername(o.name))[1]=auth.uid()::text AND coalesce((to_jsonb(o)->>'created_at')::timestamptz,now())>now()-interval '24 hours')<3)
$$;
REVOKE ALL ON FUNCTION mzt_private.v23_media_ok() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mzt_private.v23_media_ok() TO authenticated;
CREATE POLICY v23_media_limit ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'mzt-media' OR mzt_private.v23_media_ok());

CREATE FUNCTION mzt_private.v23_history_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed boolean:=false; published boolean:=false; zone_key text;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.type IN ('citizen','infrastructure') THEN INSERT INTO public.mzt_report_history(post_id,state) VALUES(NEW.id,NEW.review); END IF;
  published:=NEW.review='approved';
 ELSE
  changed:=NEW.review IS DISTINCT FROM OLD.review;
  IF NEW.type IN ('citizen','infrastructure') THEN
   IF changed THEN INSERT INTO public.mzt_report_history(post_id,state) VALUES(NEW.id,NEW.review); END IF;
   IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN INSERT INTO public.mzt_report_history(post_id,state) VALUES(NEW.id,'resolved'); END IF;
  END IF;
  published:=changed AND NEW.review='approved';
 END IF;
 IF published THEN
  zone_key:=coalesce(nullif(NEW.alert_zone,''),lower(regexp_replace(btrim(NEW.location),'\s+',' ','g')));
  INSERT INTO public.mzt_notifications(user_id,kind,post_id)
  SELECT a.user_id,'zone_alert',NEW.id FROM public.mzt_zone_alerts a
  WHERE a.zone=zone_key AND a.user_id<>NEW.user_id AND NOT EXISTS(SELECT 1 FROM public.mzt_notifications n WHERE n.user_id=a.user_id AND n.post_id=NEW.id AND n.kind='zone_alert');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzt_private.v23_history_alert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v23_history_alert AFTER INSERT OR UPDATE OF review,resolved_at ON public.mzt_posts FOR EACH ROW EXECUTE FUNCTION mzt_private.v23_history_alert();

CREATE FUNCTION public.mzt_report_snapshot(p_ids uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(p.id,jsonb_build_object(
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('state',h.state,'at',h.happened_at) ORDER BY h.happened_at,h.id) FROM public.mzt_report_history h WHERE h.post_id=p.id),'[]'::jsonb),
 'confirmations',(SELECT count(*) FROM public.mzt_report_confirmations c WHERE c.post_id=p.id),
 'confirmed',EXISTS(SELECT 1 FROM public.mzt_report_confirmations c WHERE c.post_id=p.id AND c.user_id=auth.uid())
 )),'{}'::jsonb)
 FROM public.mzt_posts p WHERE p.id=ANY(p_ids[1:500]) AND p.type IN ('citizen','infrastructure')
 AND (p.review='approved' OR p.user_id=auth.uid() OR public.mzt_has_role('editor') OR public.mzt_has_role('lector'))
$$;
CREATE FUNCTION public.mzt_report_track(p_post uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_post public.mzt_posts%rowtype;
BEGIN
 IF NOT public.mzt_has_role('editor') THEN RAISE EXCEPTION 'Solo un Editor puede iniciar seguimiento' USING ERRCODE='42501'; END IF;
 SELECT * INTO row_post FROM public.mzt_posts WHERE id=p_post FOR UPDATE;
 IF NOT FOUND OR row_post.type NOT IN ('citizen','infrastructure') OR row_post.review<>'approved' OR row_post.resolved_at IS NOT NULL THEN RAISE EXCEPTION 'Reporte no disponible'; END IF;
 IF (SELECT state FROM public.mzt_report_history WHERE post_id=p_post ORDER BY happened_at DESC,id DESC LIMIT 1) IS DISTINCT FROM 'tracking' THEN
  INSERT INTO public.mzt_report_history(post_id,state) VALUES(p_post,'tracking');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.mzt_resolve_post(p_post uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.mzt_has_role('editor') THEN RAISE EXCEPTION 'Solo un Editor puede marcar reportes atendidos' USING ERRCODE='42501'; END IF;
 UPDATE public.mzt_posts SET resolved_at=(now() AT TIME ZONE 'America/Mazatlan')::date WHERE id=p_post AND type IN ('citizen','infrastructure') AND review='approved' AND resolved_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no disponible para marcar atendido'; END IF;
END $$;
CREATE FUNCTION public.mzt_confirm_report(p_post uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_post public.mzt_posts%rowtype;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Inicia sesión para confirmar' USING ERRCODE='42501'; END IF;
 SELECT * INTO row_post FROM public.mzt_posts WHERE id=p_post FOR UPDATE;
 IF NOT FOUND OR row_post.review<>'approved' OR row_post.type NOT IN ('citizen','infrastructure') OR row_post.resolved_at IS NOT NULL THEN RAISE EXCEPTION 'Reporte no disponible'; END IF;
 INSERT INTO public.mzt_report_confirmations(post_id,user_id) VALUES(p_post,auth.uid()) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.mzt_zone_alert_set(p_zone text,p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE z text:=lower(regexp_replace(btrim(coalesce(p_zone,'')),'\s+',' ','g'));
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Inicia sesión' USING ERRCODE='42501'; END IF;
 IF char_length(z) NOT BETWEEN 2 AND 100 OR p_enabled IS NULL THEN RAISE EXCEPTION 'Colonia no válida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,23));
 IF p_enabled THEN
  IF (SELECT count(*) FROM public.mzt_zone_alerts WHERE user_id=auth.uid())>=10 AND NOT EXISTS(SELECT 1 FROM public.mzt_zone_alerts WHERE user_id=auth.uid() AND zone=z) THEN RAISE EXCEPTION 'Máximo 10 colonias'; END IF;
  INSERT INTO public.mzt_zone_alerts(user_id,zone) VALUES(auth.uid(),z) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.mzt_zone_alerts WHERE user_id=auth.uid() AND zone=z;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.mzt_report_snapshot(uuid[]),public.mzt_report_track(uuid),public.mzt_confirm_report(uuid),public.mzt_zone_alert_set(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_report_snapshot(uuid[]) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_report_track(uuid),public.mzt_confirm_report(uuid),public.mzt_zone_alert_set(text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_mzt_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data,'{}'::jsonb);
  v_name text;
  v_username text;
BEGIN
  -- Las sesiones anónimas no crean perfiles ni roles comunitarios.
  IF coalesce((to_jsonb(NEW)->>'is_anonymous')::boolean,false) THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION public.mzt_public_feed(p_post uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH posts AS (
 SELECT p.id,p.user_id,p.type,p.category,p.title,p.description,p.location,p.longitude,p.latitude,p.photo_url,p.source_name,p.source_url,p.review,p.approved_at,p.resolved_at,p.created_at,p.event_day,p.reviewed_at,p.visitor_post,p.alert_zone
 FROM public.mzt_posts p WHERE p.review='approved'
 ORDER BY (p.id=p_post) DESC NULLS LAST,p.created_at DESC LIMIT 500
), comments AS (
 SELECT c.id,c.post_id,c.user_id,c.body,c.created_at,c.parent_id,c.edited_at FROM public.mzt_comments c JOIN posts p ON p.id=c.post_id ORDER BY c.created_at DESC LIMIT 1000
), authors AS (SELECT user_id FROM posts UNION SELECT user_id FROM comments)
SELECT jsonb_build_object(
 'posts',coalesce((select jsonb_agg(to_jsonb(p)) from posts p),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(to_jsonb(c)) from comments c),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url)) from public.profiles p join authors a on p.id=a.user_id),'[]'::jsonb),
 'roles','[]'::jsonb,
 'counts',coalesce((select jsonb_object_agg(p.id,(select count(*) from public.mzt_votes v where v.post_id=p.id)) from posts p),'{}'::jsonb)
);
$$;
REVOKE ALL ON FUNCTION public.mzt_public_feed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mzt_public_feed(uuid) TO anon, authenticated;



CREATE OR REPLACE FUNCTION public.mzt_ad_event(p_campaign uuid,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE today date:=(now() AT TIME ZONE 'America/Mazatlan')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_roles WHERE user_id=auth.uid()) OR p_kind NOT IN ('view','click') THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.mzt_ad_campaigns c JOIN public.mzt_businesses b ON b.id=c.business_id WHERE c.id=p_campaign AND c.status='approved' AND b.status='approved' AND today BETWEEN c.starts_on AND c.ends_on) THEN
 INSERT INTO public.mzt_ad_events(campaign_id,user_id,day,kind) VALUES(p_campaign,auth.uid(),today,p_kind) ON CONFLICT DO NOTHING;
 END IF;
END $$;

COMMIT;
