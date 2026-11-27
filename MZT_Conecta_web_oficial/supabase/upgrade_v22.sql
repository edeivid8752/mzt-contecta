-- v2.2: gestión comercial independiente de los permisos editoriales.
BEGIN;
CREATE TABLE public.mzt_ad_staff(
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 access_level text NOT NULL CHECK(access_level IN ('administrator','owner'))
);
ALTER TABLE public.mzt_ad_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_ad_staff FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mzt_ad_staff TO authenticated;
CREATE POLICY v22_staff_own ON public.mzt_ad_staff FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION public.mzt_ad_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.mzt_ad_manager() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mzt_ad_manager() TO authenticated;
CREATE TABLE public.mzt_businesses(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 100),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=800),
 address text NOT NULL DEFAULT '' CHECK(char_length(address)<=240),
 logo_url text CHECK(logo_url IS NULL OR (char_length(logo_url)<=500 AND logo_url LIKE 'https://ezilysykgjpkpggdekam.supabase.co/storage/v1/object/public/mzt-media/'||owner_id::text||'/%')),
 website text CHECK(website IS NULL OR (char_length(website)<=1000 AND website ~ '^https?://[^[:space:]]+$')),
 facebook text CHECK(facebook IS NULL OR (char_length(facebook)<=1000 AND facebook ~ '^https?://[^[:space:]]+$')),
 instagram text CHECK(instagram IS NULL OR (char_length(instagram)<=1000 AND instagram ~ '^https?://[^[:space:]]+$')),
 map_url text CHECK(map_url IS NULL OR (char_length(map_url)<=1500 AND map_url ~ '^https?://[^[:space:]]+$')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v22_business_owner ON public.mzt_businesses(owner_id);
CREATE TABLE public.mzt_ad_campaigns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.mzt_businesses(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 110),
 body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 1000),
 image_url text CHECK(image_url IS NULL OR (char_length(image_url)<=500 AND image_url ~ '^https://ezilysykgjpkpggdekam[.]supabase[.]co/storage/v1/object/public/mzt-media/[0-9a-f-]+/[0-9a-f-]+[.]jpg$')),
 target_url text CHECK(target_url IS NULL OR (char_length(target_url)<=1500 AND target_url ~ '^https?://[^[:space:]]+$')),
 placement text NOT NULL CHECK(placement IN ('sidebar','feed','both')),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','paused')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_on>=starts_on AND ends_on-starts_on<=366)
);
CREATE INDEX v22_campaign_business ON public.mzt_ad_campaigns(business_id);
CREATE INDEX v22_campaign_active ON public.mzt_ad_campaigns(starts_on,ends_on) WHERE status='approved';
-- Una cuenta puede aportar como máximo una visualización y un clic por campaña al día.
CREATE TABLE public.mzt_ad_events(
 campaign_id uuid NOT NULL REFERENCES public.mzt_ad_campaigns(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 day date NOT NULL,
 kind text NOT NULL CHECK(kind IN ('view','click')),
 PRIMARY KEY(campaign_id,user_id,day,kind)
);
CREATE INDEX v22_ad_events_user ON public.mzt_ad_events(user_id);
ALTER TABLE public.mzt_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzt_ad_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzt_businesses,public.mzt_ad_campaigns,public.mzt_ad_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mzt_businesses,public.mzt_ad_campaigns TO authenticated;
GRANT INSERT(owner_id,name,description,address,logo_url,website,facebook,instagram,map_url),UPDATE(name,description,address,logo_url,website,facebook,instagram,map_url) ON public.mzt_businesses TO authenticated;
GRANT INSERT(business_id,title,body,image_url,target_url,placement,starts_on,ends_on),UPDATE(title,body,image_url,target_url,placement,starts_on,ends_on) ON public.mzt_ad_campaigns TO authenticated;
CREATE POLICY v22_business_read ON public.mzt_businesses FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()) OR (SELECT public.mzt_ad_manager()));
CREATE POLICY v22_business_create ON public.mzt_businesses FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()) AND status='pending');
CREATE POLICY v22_business_edit ON public.mzt_businesses FOR UPDATE TO authenticated USING(owner_id=(SELECT auth.uid()) AND status='pending') WITH CHECK(owner_id=(SELECT auth.uid()) AND status='pending');
CREATE POLICY v22_campaign_read ON public.mzt_ad_campaigns FOR SELECT TO authenticated USING((SELECT public.mzt_ad_manager()) OR EXISTS(SELECT 1 FROM public.mzt_businesses b WHERE b.id=business_id AND b.owner_id=(SELECT auth.uid())));
CREATE POLICY v22_campaign_create ON public.mzt_ad_campaigns FOR INSERT TO authenticated WITH CHECK(status='pending' AND EXISTS(SELECT 1 FROM public.mzt_businesses b WHERE b.id=business_id AND b.owner_id=(SELECT auth.uid()) AND b.status='approved') AND (image_url IS NULL OR image_url LIKE 'https://ezilysykgjpkpggdekam.supabase.co/storage/v1/object/public/mzt-media/'||(SELECT auth.uid())::text||'/%'));
CREATE POLICY v22_campaign_edit ON public.mzt_ad_campaigns FOR UPDATE TO authenticated USING(status='pending' AND EXISTS(SELECT 1 FROM public.mzt_businesses b WHERE b.id=business_id AND b.owner_id=(SELECT auth.uid()) AND b.status='approved')) WITH CHECK(status='pending' AND EXISTS(SELECT 1 FROM public.mzt_businesses b WHERE b.id=business_id AND b.owner_id=(SELECT auth.uid()) AND b.status='approved') AND (image_url IS NULL OR image_url LIKE 'https://ezilysykgjpkpggdekam.supabase.co/storage/v1/object/public/mzt-media/'||(SELECT auth.uid())::text||'/%'));
CREATE FUNCTION public.mzt_ad_staff_set(p_username text,p_enable boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=auth.uid() AND access_level='owner') THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT id INTO target FROM public.profiles WHERE lower(username)=lower(btrim(p_username));
 IF target IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
 IF p_enable THEN INSERT INTO public.mzt_ad_staff(user_id,access_level) VALUES(target,'administrator') ON CONFLICT(user_id) DO NOTHING;
 ELSE DELETE FROM public.mzt_ad_staff WHERE user_id=target AND access_level='administrator'; END IF;
END $$;
CREATE FUNCTION public.mzt_business_review(p_id uuid,p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('approved','rejected','suspended','pending') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
 UPDATE public.mzt_businesses SET status=p_status WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado'; END IF;
END $$;
CREATE FUNCTION public.mzt_campaign_review(p_id uuid,p_status text,p_start date DEFAULT NULL,p_end date DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN ('approved','rejected','paused','pending') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
 IF p_status='approved' AND NOT EXISTS(SELECT 1 FROM public.mzt_ad_campaigns c JOIN public.mzt_businesses b ON b.id=c.business_id WHERE c.id=p_id AND b.status='approved') THEN RAISE EXCEPTION 'Aprueba primero el negocio'; END IF;
 UPDATE public.mzt_ad_campaigns SET status=p_status,starts_on=coalesce(p_start,starts_on),ends_on=coalesce(p_end,ends_on) WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaña no encontrada'; END IF;
END $$;
-- Proyección pública de campañas autorizadas y vigentes. No incluye propietarios ni estadísticas.
CREATE FUNCTION public.mzt_public_ads() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
 SELECT c.id,c.business_id,c.title,c.body,c.image_url,c.target_url,c.placement,c.starts_on,c.ends_on,
 b.name AS business_name,b.description AS business_description,b.logo_url,b.address,b.website,b.facebook,b.instagram,b.map_url
 FROM public.mzt_ad_campaigns c JOIN public.mzt_businesses b ON b.id=c.business_id
 WHERE c.status='approved' AND b.status='approved' AND (now() AT TIME ZONE 'America/Mazatlan')::date BETWEEN c.starts_on AND c.ends_on
 ORDER BY md5(c.id::text||((now() AT TIME ZONE 'America/Mazatlan')::date)::text) LIMIT 100
 ) x;
$$;
CREATE FUNCTION public.mzt_ad_event(p_campaign uuid,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE today date:=(now() AT TIME ZONE 'America/Mazatlan')::date;
BEGIN
 IF auth.uid() IS NULL OR p_kind NOT IN ('view','click') THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.mzt_ad_campaigns c JOIN public.mzt_businesses b ON b.id=c.business_id WHERE c.id=p_campaign AND c.status='approved' AND b.status='approved' AND today BETWEEN c.starts_on AND c.ends_on) THEN
 INSERT INTO public.mzt_ad_events(campaign_id,user_id,day,kind) VALUES(p_campaign,auth.uid(),today,p_kind) ON CONFLICT DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION public.mzt_ad_stats() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
 SELECT c.id AS campaign_id,count(e.kind) FILTER(WHERE e.kind='view') AS views,count(e.kind) FILTER(WHERE e.kind='click') AS clicks
 FROM public.mzt_ad_campaigns c JOIN public.mzt_businesses b ON b.id=c.business_id LEFT JOIN public.mzt_ad_events e ON e.campaign_id=c.id
 WHERE auth.uid() IS NOT NULL AND (b.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.mzt_ad_staff WHERE user_id=auth.uid()))
 GROUP BY c.id
 ) x;
$$;
REVOKE ALL ON FUNCTION public.mzt_ad_staff_set(text,boolean),public.mzt_business_review(uuid,text),public.mzt_campaign_review(uuid,text,date,date),public.mzt_ad_event(uuid,text),public.mzt_ad_stats(),public.mzt_public_ads() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_ad_staff_set(text,boolean),public.mzt_business_review(uuid,text),public.mzt_campaign_review(uuid,text,date,date),public.mzt_ad_event(uuid,text),public.mzt_ad_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mzt_public_ads() TO anon,authenticated;
COMMIT;
