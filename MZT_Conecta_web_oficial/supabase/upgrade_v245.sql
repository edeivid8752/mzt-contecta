-- v2.4.5: eliminación editorial de conversaciones; no modifica datos existentes.
BEGIN;
GRANT DELETE ON public.mzt_forum_threads TO authenticated;
CREATE POLICY v245_threads_delete_editor ON public.mzt_forum_threads FOR DELETE TO authenticated USING ((select public.mzt_has_role('editor')));
COMMIT;
