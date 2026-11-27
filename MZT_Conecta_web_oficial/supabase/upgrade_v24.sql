-- v2.4: cambios aditivos, sin borrar contenido existente.
BEGIN;
ALTER TABLE public.mzt_posts ADD COLUMN external_url text;
ALTER TABLE public.mzt_posts ADD CONSTRAINT v24_external_url CHECK (external_url IS NULL OR (type IN ('social','citizen') AND char_length(external_url) BETWEEN 9 AND 2048 AND external_url ~* '^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$'));
GRANT SELECT(external_url),INSERT(external_url) ON public.mzt_posts TO authenticated;
ALTER TABLE public.mzt_flags ADD COLUMN reason_detail text;
ALTER TABLE public.mzt_flags ADD CONSTRAINT v24_flag_detail CHECK (reason_detail IS NULL OR (reason='otro' AND char_length(btrim(reason_detail)) BETWEEN 1 AND 500));
GRANT SELECT(reason_detail),INSERT(reason_detail) ON public.mzt_flags TO authenticated;
-- No modificar ni invalidar denuncias históricas sin explicación.
CREATE POLICY v24_flag_detail_required ON public.mzt_flags AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (reason <> 'otro' OR (reason_detail IS NOT NULL AND char_length(btrim(reason_detail)) BETWEEN 1 AND 500));
CREATE POLICY v24_editor_delete_post ON public.mzt_posts FOR DELETE TO authenticated USING (public.mzt_has_role('editor'));
CREATE OR REPLACE FUNCTION public.mzt_public_feed(p_post uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH posts AS (
 SELECT p.id,p.user_id,p.type,p.category,p.title,p.description,p.location,p.longitude,p.latitude,p.photo_url,p.source_name,p.source_url,p.review,p.approved_at,p.resolved_at,p.created_at,p.event_day,p.reviewed_at,p.visitor_post,p.alert_zone,p.external_url
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
CREATE OR REPLACE FUNCTION public.mzt_forum_snapshot(p_thread uuid DEFAULT NULL,p_category text DEFAULT NULL,p_sort text DEFAULT 'popular')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH candidates AS (
 SELECT t.id,t.user_id,t.title,t.body,t.category,t.created_at,
 CASE WHEN p.review='approved' AND p.longitude IS NOT NULL AND p.latitude IS NOT NULL THEN p.id ELSE NULL END AS post_id,
 coalesce((SELECT sum(v.value) FROM public.mzt_forum_votes v WHERE v.thread_id=t.id),0) AS score,
 coalesce((SELECT v.value FROM public.mzt_forum_votes v WHERE v.thread_id=t.id AND v.user_id=auth.uid()),0) AS my_vote,
 (SELECT count(*) FROM public.mzt_forum_replies r WHERE r.thread_id=t.id) AS reply_count,
 (SELECT max(r.created_at) FROM public.mzt_forum_replies r WHERE r.thread_id=t.id) AS last_reply_at,
 a.display_name,a.username,a.avatar_url
 FROM public.mzt_forum_threads t JOIN public.profiles a ON a.id=t.user_id
 LEFT JOIN public.mzt_posts p ON p.id=t.post_id
 WHERE (p_thread IS NULL OR t.id=p_thread) AND (p_thread IS NOT NULL OR p_category IS NULL OR t.category=p_category)
 ORDER BY CASE WHEN p_sort='popular' THEN coalesce((SELECT sum(v.value) FROM public.mzt_forum_votes v WHERE v.thread_id=t.id),0) END DESC NULLS LAST,t.created_at DESC,t.id
 LIMIT 100
), replies AS (
 SELECT r.id,r.thread_id,r.user_id,r.body,r.created_at,a.display_name,a.username,a.avatar_url
 FROM public.mzt_forum_replies r JOIN candidates t ON t.id=r.thread_id JOIN public.profiles a ON a.id=r.user_id
 WHERE p_thread IS NOT NULL ORDER BY r.created_at ASC,r.id LIMIT 500
)
SELECT jsonb_build_object('threads',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY CASE WHEN p_sort='popular' THEN t.score END DESC NULLS LAST,t.created_at DESC,t.id) FROM candidates t),'[]'::jsonb),
 'replies',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at,r.id) FROM replies r),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.mzt_forum_snapshot(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_forum_snapshot(uuid,text,text) TO anon,authenticated;

COMMIT;
