# MZT Conecta — versión 1.2 (en desarrollo)

**[mztconecta.com](https://mztconecta.com)** · Porque lo que pasa en Mazatlán nos une.

La versión pública sigue siendo v1.1 hasta aprobar el despliegue de esta actualización.

## Novedades de la versión 1.2 (en preparación)

- Las publicaciones muestran el rol real del autor (Editor, Lector o Ciudadano).
- El cuadro de publicación muestra la foto de perfil de la cuenta conectada, o una inicial si no tiene foto.
- Tendencias conserva las cinco publicaciones aprobadas más votadas de las últimas 168 horas, sin eliminar publicaciones ni interacciones.
- Actividad del día mantiene exactamente las reglas de v1.1.

## Revisión técnica

- Antes de desplegar v1.2, revisar y aplicar `supabase/upgrade_v12.sql` para consultar los roles de los autores. No ejecutar scripts antiguos de instalación sobre producción.
- Ejecutar `node --experimental-default-type=module tests/v12.test.mjs` desde esta carpeta.
- Verificar con dos cuentas de roles diferentes, fotografía de perfil y publicaciones de distintas fechas. Mantener producción y Render intactos hasta aprobar el lanzamiento.
