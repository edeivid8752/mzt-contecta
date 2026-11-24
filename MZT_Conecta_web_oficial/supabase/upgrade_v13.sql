-- v1.3 draft: test in isolated Supabase before production. No destructive reset.
BEGIN;
ALTER TABLE public.mzt_comments ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.mzt_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
-- Public read projection: no emails, private reports, voter identities or follower graph.
CREATE OR REPLACE FUNCTION public.mzt_public_feed(p_post uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH posts AS (
 SELECT p.id,p.user_id,p.type,p.category,p.title,p.description,p.location,p.longitude,p.latitude,p.photo_url,p.source_name,p.source_url,p.review,p.approved_at,p.resolved_at,p.created_at
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

CREATE TABLE IF NOT EXISTS public.mzt_saved (user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,post_id uuid NOT NULL REFERENCES public.mzt_posts(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,post_id));
ALTER TABLE public.mzt_saved ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_saved FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.mzt_saved TO authenticated;
CREATE POLICY v13_saved_read ON public.mzt_saved FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY v13_saved_insert ON public.mzt_saved FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.mzt_posts p WHERE p.id=post_id AND p.review='approved'));
CREATE POLICY v13_saved_delete ON public.mzt_saved FOR DELETE TO authenticated USING(user_id=(select auth.uid()));

ALTER TABLE public.mzt_comments ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.mzt_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
-- Composite reference prevents replies to comments on other posts.
ALTER TABLE public.mzt_comments ADD CONSTRAINT v13_comment_identity UNIQUE(id,post_id);
ALTER TABLE public.mzt_comments ADD CONSTRAINT v13_comment_parent FOREIGN KEY(parent_id,post_id) REFERENCES public.mzt_comments(id,post_id) ON DELETE SET NULL (parent_id);
ALTER TABLE public.mzt_comments ADD CONSTRAINT v13_comment_not_self CHECK(parent_id IS DISTINCT FROM id);
REVOKE INSERT ON public.mzt_comments FROM authenticated;
GRANT INSERT(post_id,user_id,body,parent_id) ON public.mzt_comments TO authenticated;
GRANT UPDATE(body) ON public.mzt_comments TO authenticated;
CREATE POLICY v13_comment_edit ON public.mzt_comments FOR UPDATE TO authenticated USING(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.mzt_posts p WHERE p.id=post_id AND p.review='approved')) WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.mzt_posts p WHERE p.id=post_id AND p.review='approved'));
CREATE OR REPLACE FUNCTION public.mzt_v13_comment_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.edited_at=now(); RETURN NEW; END $$;
CREATE TRIGGER v13_comment_timestamp BEFORE UPDATE OF body ON public.mzt_comments FOR EACH ROW EXECUTE FUNCTION public.mzt_v13_comment_timestamp();
CREATE TABLE IF NOT EXISTS public.mzt_comment_votes (user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,comment_id uuid NOT NULL REFERENCES public.mzt_comments(id) ON DELETE CASCADE,PRIMARY KEY(user_id,comment_id));
ALTER TABLE public.mzt_comment_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_comment_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.mzt_comment_votes TO authenticated;
CREATE POLICY v13_cv_read ON public.mzt_comment_votes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.mzt_comments c JOIN public.mzt_posts p ON p.id=c.post_id WHERE c.id=comment_id AND p.review='approved'));
CREATE POLICY v13_cv_insert ON public.mzt_comment_votes FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.mzt_comments c JOIN public.mzt_posts p ON p.id=c.post_id WHERE c.id=comment_id AND p.review='approved'));
CREATE POLICY v13_cv_delete ON public.mzt_comment_votes FOR DELETE TO authenticated USING(user_id=(select auth.uid()));

CREATE TABLE IF NOT EXISTS public.mzt_flags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,post_id uuid REFERENCES public.mzt_posts(id) ON DELETE CASCADE,comment_id uuid REFERENCES public.mzt_comments(id) ON DELETE CASCADE,reason text NOT NULL CHECK(reason IN ('spam','informacion falsa','acoso','inapropiado','otro')),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed')),created_at timestamptz NOT NULL DEFAULT now(),CHECK(num_nonnulls(post_id,comment_id)=1));
CREATE UNIQUE INDEX v13_flag_post_once ON public.mzt_flags(user_id,post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX v13_flag_comment_once ON public.mzt_flags(user_id,comment_id) WHERE comment_id IS NOT NULL;
ALTER TABLE public.mzt_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_flags FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mzt_flags TO authenticated;
GRANT INSERT(user_id,post_id,comment_id,reason),UPDATE(status) ON public.mzt_flags TO authenticated;
CREATE POLICY v13_flags_read ON public.mzt_flags FOR SELECT TO authenticated USING(user_id=(select auth.uid()) OR public.mzt_has_role('editor'));
CREATE POLICY v13_flags_insert ON public.mzt_flags FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND status='pending' AND (EXISTS(SELECT 1 FROM public.mzt_posts p WHERE p.id=post_id AND p.review='approved') OR EXISTS(SELECT 1 FROM public.mzt_comments c JOIN public.mzt_posts p ON p.id=c.post_id WHERE c.id=comment_id AND p.review='approved')));
CREATE POLICY v13_flags_review ON public.mzt_flags FOR UPDATE TO authenticated USING(public.mzt_has_role('editor')) WITH CHECK(public.mzt_has_role('editor') AND status='reviewed');

-- Owner edits are restricted to text and always return non-news reports to review.
GRANT UPDATE(title,description),DELETE ON public.mzt_posts TO authenticated;
CREATE POLICY v13_post_edit ON public.mzt_posts FOR UPDATE TO authenticated USING(user_id=(select auth.uid()) AND type IN ('citizen','infrastructure')) WITH CHECK(user_id=(select auth.uid()) AND type IN ('citizen','infrastructure') AND review='pending');
CREATE POLICY v13_post_delete ON public.mzt_posts FOR DELETE TO authenticated USING(user_id=(select auth.uid()));
CREATE OR REPLACE FUNCTION public.mzt_v13_reset_review() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN
 NEW.review='pending'; NEW.reviewed_at=NULL; NEW.approved_at=NULL; NEW.rejection_reason=NULL; NEW.resolved_at=NULL;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER v13_post_reset_review BEFORE UPDATE OF title,description ON public.mzt_posts FOR EACH ROW EXECUTE FUNCTION public.mzt_v13_reset_review();

CREATE TABLE IF NOT EXISTS public.mzt_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,kind text NOT NULL,post_id uuid REFERENCES public.mzt_posts(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz);
ALTER TABLE public.mzt_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.mzt_notifications TO authenticated;
CREATE POLICY v13_notifications_read ON public.mzt_notifications FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY v13_notifications_seen ON public.mzt_notifications FOR UPDATE TO authenticated USING(user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()));
CREATE INDEX v13_notification_owner ON public.mzt_notifications(user_id,created_at DESC);
CREATE SCHEMA IF NOT EXISTS mzt_private;
REVOKE ALL ON SCHEMA mzt_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mzt_private.v13_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid; parent_owner uuid; mentioned_id uuid;
BEGIN
 IF TG_TABLE_NAME='mzt_posts' THEN
  IF NEW.review IS DISTINCT FROM OLD.review AND NEW.review IN ('approved','rejected') THEN
   INSERT INTO public.mzt_notifications(user_id,kind,post_id) VALUES(NEW.user_id,NEW.review,NEW.id);
  END IF;
 ELSIF TG_TABLE_NAME='mzt_follows' THEN
  INSERT INTO public.mzt_notifications(user_id,kind) VALUES(NEW.followed_id,'follow');
 ELSIF TG_TABLE_NAME='mzt_comments' THEN
  SELECT p.user_id INTO owner_id FROM public.mzt_posts p WHERE p.id=NEW.post_id;
  IF owner_id<>NEW.user_id THEN INSERT INTO public.mzt_notifications(user_id,kind,post_id) VALUES(owner_id,'comment',NEW.post_id); END IF;
  SELECT c.user_id INTO parent_owner FROM public.mzt_comments c WHERE c.id=NEW.parent_id;
  IF parent_owner<>NEW.user_id AND parent_owner IS DISTINCT FROM owner_id THEN INSERT INTO public.mzt_notifications(user_id,kind,post_id) VALUES(parent_owner,'reply',NEW.post_id); END IF;
  FOR mentioned_id IN SELECT DISTINCT p.id FROM public.profiles p JOIN regexp_matches(NEW.body,'@([a-zA-Z0-9_.]{1,30})','g') AS m ON lower(p.username)=lower(m[1]) WHERE p.id<>NEW.user_id AND p.id IS DISTINCT FROM owner_id AND p.id IS DISTINCT FROM parent_owner LOOP
   INSERT INTO public.mzt_notifications(user_id,kind,post_id) VALUES(mentioned_id,'mention',NEW.post_id);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzt_private.v13_notify() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v13_notify_post AFTER UPDATE OF review ON public.mzt_posts FOR EACH ROW EXECUTE FUNCTION mzt_private.v13_notify();
CREATE TRIGGER v13_notify_follow AFTER INSERT ON public.mzt_follows FOR EACH ROW EXECUTE FUNCTION mzt_private.v13_notify();
CREATE TRIGGER v13_notify_comment AFTER INSERT ON public.mzt_comments FOR EACH ROW EXECUTE FUNCTION mzt_private.v13_notify();
COMMIT;
