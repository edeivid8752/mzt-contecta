-- MZT Conecta v1.2: ejecutar antes del despliegue, previa autorización.
-- Solo lectura de los roles de la comunidad autenticada.
-- No cambia usuarios, roles asignados, publicaciones ni políticas de escritura.
BEGIN;
DROP POLICY IF EXISTS "mzt_roles_read_for_labels" ON public.app_roles;
CREATE POLICY "mzt_roles_read_for_labels" ON public.app_roles
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);
REVOKE SELECT ON TABLE public.app_roles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (created_at) ON public.app_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, role) ON public.app_roles TO authenticated;
COMMIT;
