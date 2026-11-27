\set ON_ERROR_STOP on
\ir ../supabase/upgrade_v22.sql
DO $$ BEGIN IF EXISTS(SELECT 1 FROM mzt_businesses) OR EXISTS(SELECT 1 FROM mzt_ad_campaigns) OR EXISTS(SELECT 1 FROM mzt_ad_staff) THEN RAISE EXCEPTION 'Tablas comerciales deben comenzar vacías'; END IF; END $$;
INSERT INTO mzt_ad_staff VALUES('00000000-0000-4000-8000-000000000003','owner');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO mzt_businesses(owner_id,name) VALUES(auth.uid(),'Comercio de prueba') RETURNING id AS biz \gset
DO $$ BEGIN
 BEGIN PERFORM public.mzt_business_review((SELECT id FROM mzt_businesses LIMIT 1),'approved'); RAISE EXCEPTION 'Autoaprobación permitida'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE mzt_businesses SET status='approved'; RAISE EXCEPTION 'Edición de estado permitida'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF jsonb_array_length(public.mzt_public_ads())<>0 THEN RAISE EXCEPTION 'Anuncios prematuros'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM mzt_businesses) OR EXISTS(SELECT 1 FROM mzt_ad_staff) THEN RAISE EXCEPTION 'Datos privados visibles'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_business_review(:'biz','approved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO mzt_ad_campaigns(business_id,title,body,placement,starts_on,ends_on) VALUES(:'biz','Promoción local','Conoce el establecimiento','both',current_date-2,current_date+30) RETURNING id AS campaign \gset
DO $$ BEGIN
 BEGIN PERFORM public.mzt_campaign_review((SELECT id FROM mzt_ad_campaigns LIMIT 1),'approved'); RAISE EXCEPTION 'Autoaprobación de anuncio'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF jsonb_array_length(public.mzt_public_ads())<>0 THEN RAISE EXCEPTION 'Campaña pendiente visible'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_campaign_review(:'campaign','approved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
SELECT public.mzt_ad_event(:'campaign','view');
SELECT public.mzt_ad_event(:'campaign','view');
SELECT public.mzt_ad_event(:'campaign','click');
DO $$ BEGIN IF jsonb_array_length(public.mzt_ad_stats())<>0 OR EXISTS(SELECT 1 FROM mzt_ad_campaigns) THEN RAISE EXCEPTION 'Estadísticas o campañas ajenas visibles'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN IF (public.mzt_ad_stats()->0->>'views')::int IS DISTINCT FROM 1 OR (public.mzt_ad_stats()->0->>'clicks')::int IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Conteo incorrecto'; END IF; END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN IF jsonb_array_length(public.mzt_public_ads())<>1 OR (public.mzt_public_ads()->0 ? 'owner_id') OR has_table_privilege('public.mzt_ad_events','SELECT') THEN RAISE EXCEPTION 'Proyección pública incorrecta'; END IF; END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.mzt_campaign_review(:'campaign','approved',current_date-10,current_date-3);
DO $$ BEGIN IF jsonb_array_length(public.mzt_public_ads())<>0 THEN RAISE EXCEPTION 'Campaña vencida visible'; END IF; END $$;
RESET ROLE;
SELECT 'Pruebas SQL v2.2 correctas' AS resultado;
