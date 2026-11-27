-- v2.4.1: vigencia de titulares sin cambiar las publicaciones anteriores.
BEGIN;
ALTER TABLE public.mzt_posts ADD COLUMN daily_until date;
ALTER TABLE public.mzt_posts ADD CONSTRAINT v241_daily_news_only CHECK(daily_until IS NULL OR (type='news' AND isfinite(daily_until) AND daily_until >= (created_at AT TIME ZONE 'America/Mazatlan')::date));
GRANT SELECT(daily_until), INSERT(daily_until) ON public.mzt_posts TO authenticated;
-- Mantener la revisión obligatoria para ciudadanos; edición editorial únicamente por RPC.
CREATE OR REPLACE FUNCTION public.mzt_v13_reset_review() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN
  IF OLD.type='news' AND NEW.type='news' AND public.mzt_has_role('editor') THEN RETURN NEW; END IF;
  NEW.review='pending'; NEW.reviewed_at=NULL; NEW.approved_at=NULL; NEW.rejection_reason=NULL; NEW.resolved_at=NULL;
 END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.mzt_edit_editorial_news(p_id uuid,p_title text,p_description text,p_category text,p_source_name text,p_source_url text,p_location text,p_longitude double precision,p_latitude double precision,p_daily_until date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.mzt_has_role('editor') THEN RAISE EXCEPTION 'Solo editores' USING ERRCODE='42501'; END IF;
 IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 8 AND 110 OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 15 AND 800 OR p_source_name IS NULL OR char_length(btrim(p_source_name)) NOT BETWEEN 1 AND 100 OR p_source_url IS NULL OR char_length(p_source_url)>2048 OR p_source_url !~* '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$' OR p_category IS NULL OR char_length(btrim(p_category)) NOT BETWEEN 1 AND 100 OR p_daily_until IS NULL OR NOT isfinite(p_daily_until) OR ((p_longitude IS NULL) <> (p_latitude IS NULL)) OR (p_longitude IS NOT NULL AND (p_longitude NOT BETWEEN -180 AND 180 OR p_latitude NOT BETWEEN -85.051129 AND 85.051129)) THEN RAISE EXCEPTION 'Datos de noticia inválidos' USING ERRCODE='22023'; END IF;
 UPDATE public.mzt_posts SET title=btrim(p_title),description=btrim(p_description),category=btrim(p_category),source_name=btrim(p_source_name),source_url=p_source_url,location=coalesce(nullif(btrim(p_location),''),'Toda la ciudad'),longitude=p_longitude,latitude=p_latitude,daily_until=p_daily_until WHERE id=p_id AND type='news' AND review='approved';
 IF NOT FOUND THEN RAISE EXCEPTION 'Noticia no disponible'; END IF;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.mzt_edit_editorial_news(uuid,text,text,text,text,text,text,double precision,double precision,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_edit_editorial_news(uuid,text,text,text,text,text,text,double precision,double precision,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.mzt_public_feed(p_post uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH posts AS (
 SELECT p.id,p.user_id,p.type,p.category,p.title,p.description,p.location,p.longitude,p.latitude,p.photo_url,p.source_name,p.source_url,p.review,p.approved_at,p.resolved_at,p.created_at,p.event_day,p.reviewed_at,p.visitor_post,p.alert_zone,p.external_url,p.daily_until
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

COMMIT;
