-- v2.0: categorías sociales, eventos y foro. No incluye inserciones de contenido.
BEGIN;
ALTER TABLE public.mzt_posts ADD COLUMN event_day date;
ALTER TABLE public.mzt_posts DROP CONSTRAINT mzt_posts_type_check;
ALTER TABLE public.mzt_posts ADD CONSTRAINT mzt_posts_type_check CHECK(type IN ('citizen','infrastructure','news','social'));
ALTER TABLE public.mzt_posts ADD CONSTRAINT v20_event_social CHECK(event_day IS NULL OR type='social');
DROP POLICY mzt_posts_insert ON public.mzt_posts;
CREATE POLICY mzt_posts_insert ON public.mzt_posts FOR INSERT TO authenticated WITH CHECK (
 user_id=(select auth.uid()) AND (
  (type IN ('citizen','infrastructure','social') AND review='pending' AND approved_at IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL AND resolved_at IS NULL AND source_name IS NULL AND source_url IS NULL)
  OR (type='news' AND review='approved' AND public.mzt_has_role('editor') AND source_name IS NOT NULL AND source_url IS NOT NULL)
 )
);
DROP POLICY v13_post_edit ON public.mzt_posts;
CREATE POLICY v13_post_edit ON public.mzt_posts FOR UPDATE TO authenticated
 USING(user_id=(select auth.uid()) AND type IN ('citizen','infrastructure','social'))
 WITH CHECK(user_id=(select auth.uid()) AND type IN ('citizen','infrastructure','social') AND review='pending');
GRANT SELECT(event_day),INSERT(event_day) ON public.mzt_posts TO authenticated;
CREATE INDEX v20_posts_section_date ON public.mzt_posts(type,created_at DESC) WHERE review='approved';
CREATE OR REPLACE FUNCTION public.mzt_public_feed(p_post uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH posts AS (
 SELECT p.id,p.user_id,p.type,p.category,p.title,p.description,p.location,p.longitude,p.latitude,p.photo_url,p.source_name,p.source_url,p.review,p.approved_at,p.resolved_at,p.created_at,p.event_day
 FROM public.mzt_posts p WHERE p.review='approved'
 ORDER BY (p.id=p_post) DESC NULLS LAST,p.created_at DESC LIMIT 500
), comments AS (
 SELECT c.id,c.post_id,c.user_id,c.body,c.created_at,c.parent_id,c.edited_at FROM public.mzt_comments c JOIN posts p ON p.id=c.post_id ORDER BY c.created_at DESC LIMIT 1000
), authors AS (SELECT user_id FROM posts UNION SELECT user_id FROM comments)
SELECT jsonb_build_object(
 'posts',coalesce((select jsonb_agg(to_jsonb(p)) from posts p),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(to_jsonb(c)) from comments c),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url)) from public.profiles p join authors a on p.id=a.user_id),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'role',r.role)) from public.app_roles r join authors a on r.user_id=a.user_id),'[]'::jsonb),
 'counts',coalesce((select jsonb_object_agg(p.id,(select count(*) from public.mzt_votes v where v.post_id=p.id)) from posts p),'{}'::jsonb)
);
$$;
REVOKE ALL ON FUNCTION public.mzt_public_feed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mzt_public_feed(uuid) TO anon, authenticated;


CREATE TABLE public.mzt_forum_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 110),
 body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 2000),
 category text NOT NULL CHECK(category IN ('Infraestructura','Qué hacer','Ideas para Mazatlán','Playas','Comunidad','Movilidad')),
 post_id uuid REFERENCES public.mzt_posts(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mzt_forum_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 thread_id uuid NOT NULL REFERENCES public.mzt_forum_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mzt_forum_votes (
 thread_id uuid NOT NULL REFERENCES public.mzt_forum_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 value smallint NOT NULL CHECK(value IN (-1,1)),
 PRIMARY KEY(thread_id,user_id)
);
CREATE INDEX v20_forum_threads_date ON public.mzt_forum_threads(created_at DESC);
CREATE INDEX v20_forum_threads_user ON public.mzt_forum_threads(user_id);
CREATE INDEX v20_forum_threads_post ON public.mzt_forum_threads(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX v20_forum_replies_thread ON public.mzt_forum_replies(thread_id,created_at);
CREATE INDEX v20_forum_replies_user ON public.mzt_forum_replies(user_id);
CREATE INDEX v20_forum_votes_user ON public.mzt_forum_votes(user_id);
ALTER TABLE public.mzt_forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_forum_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_forum_threads,public.mzt_forum_replies,public.mzt_forum_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mzt_forum_threads,public.mzt_forum_replies,public.mzt_forum_votes TO authenticated;
GRANT INSERT(user_id,title,body,category,post_id) ON public.mzt_forum_threads TO authenticated;
GRANT INSERT(thread_id,user_id,body) ON public.mzt_forum_replies TO authenticated;
GRANT INSERT(thread_id,user_id,value),UPDATE(value),DELETE ON public.mzt_forum_votes TO authenticated;
CREATE POLICY v20_threads_read ON public.mzt_forum_threads FOR SELECT TO authenticated USING(true);
CREATE POLICY v20_threads_create ON public.mzt_forum_threads FOR INSERT TO authenticated WITH CHECK(
 user_id=(select auth.uid()) AND (post_id IS NULL OR EXISTS(SELECT 1 FROM public.mzt_posts p WHERE p.id=post_id AND p.review='approved' AND p.longitude IS NOT NULL AND p.latitude IS NOT NULL))
);
CREATE POLICY v20_replies_read ON public.mzt_forum_replies FOR SELECT TO authenticated USING(true);
CREATE POLICY v20_replies_create ON public.mzt_forum_replies FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()));
CREATE POLICY v20_votes_read ON public.mzt_forum_votes FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY v20_votes_create ON public.mzt_forum_votes FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()));
CREATE POLICY v20_votes_update ON public.mzt_forum_votes FOR UPDATE TO authenticated USING(user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()));
CREATE POLICY v20_votes_delete ON public.mzt_forum_votes FOR DELETE TO authenticated USING(user_id=(select auth.uid()));
-- Proyección pública deliberada: autores visibles y totales, sin emails ni identidades de votantes.
CREATE FUNCTION public.mzt_forum_snapshot(p_thread uuid DEFAULT NULL,p_category text DEFAULT NULL,p_sort text DEFAULT 'popular')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH candidates AS (
 SELECT t.id,t.user_id,t.title,t.body,t.category,t.created_at,
 CASE WHEN p.review='approved' AND p.longitude IS NOT NULL AND p.latitude IS NOT NULL THEN p.id ELSE NULL END AS post_id,
 coalesce((SELECT sum(v.value) FROM public.mzt_forum_votes v WHERE v.thread_id=t.id),0) AS score,
 coalesce((SELECT v.value FROM public.mzt_forum_votes v WHERE v.thread_id=t.id AND v.user_id=auth.uid()),0) AS my_vote,
 (SELECT count(*) FROM public.mzt_forum_replies r WHERE r.thread_id=t.id) AS reply_count,
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
