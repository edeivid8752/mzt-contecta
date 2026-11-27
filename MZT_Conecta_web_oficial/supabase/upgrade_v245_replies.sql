-- v2.4.5: eliminación editorial de respuestas individuales. No borra datos existentes.
BEGIN;
GRANT DELETE ON public.mzt_forum_replies TO authenticated;
CREATE POLICY v245_replies_delete_editor ON public.mzt_forum_replies FOR DELETE TO authenticated USING ((select public.mzt_has_role('editor')));
COMMIT;
