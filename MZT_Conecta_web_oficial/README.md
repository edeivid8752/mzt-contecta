# MZT Conecta — candidato v1.3

**[mztconecta.com](https://mztconecta.com)** · Porque lo que pasa en Mazatlán nos une.

La versión pública sigue siendo v1.2 hasta aprobar el despliegue de esta actualización.

## Novedades de la versión 1.2 (publicada)

- Las publicaciones muestran el rol real del autor (Editor, Lector o Ciudadano).
- El cuadro de publicación muestra la foto de perfil de la cuenta conectada, o una inicial si no tiene foto.
- Tendencias conserva las cinco publicaciones aprobadas más votadas de las últimas 168 horas, sin eliminar publicaciones ni interacciones.
- Actividad del día mantiene exactamente las reglas de v1.1.

## Revisión técnica

- Antes de desplegar v1.2, revisar y aplicar `supabase/upgrade_v12.sql` para consultar los roles de los autores. No ejecutar scripts antiguos de instalación sobre producción.
- Ejecutar `node --experimental-default-type=module tests/v12.test.mjs` desde esta carpeta.
- Verificar con dos cuentas de roles diferentes, fotografía de perfil y publicaciones de distintas fechas. Mantener producción y Render intactos hasta aprobar el lanzamiento.


## v1.3 — candidato de desarrollo, NO desplegar aún

Implementaciones iniciales: modo visitante (proyección pública de solo lectura), notificaciones internas, guardados privados, enlaces compartidos, denuncias y bandeja editorial, edición y eliminación propias, comentarios con respuestas/votos/edición/menciones, PWA, muro Siguiendo y selector HSV. Mantener actividad del día y reglas de tendencias de v1.2.

### Antes de publicar
1. Probar la migración `supabase/upgrade_v13.sql` en una copia aislada de la base de datos, revisar RLS/privilegios/funciones, respaldo y comportamiento de los roles. No ejecutar en producción hasta aprobación.
2. Conservar el acceso por correo y contraseña. OAuth queda fuera de v1.3; no activar proveedores ni publicar credenciales.
3. Render: añadir `manifest.webmanifest service-worker.js` a los archivos copiados a dist por el comando de build (conservar el resto del comando y las variables existentes). Probar instalación y actualizar iconos PNG si el navegador lo requiere.
4. Ejecutar `node --experimental-default-type=module tests/v12.test.mjs` y `node --experimental-default-type=module tests/v13.test.mjs`. Probar flujos completos en navegador con dos cuentas, un editor y un visitante.
5. No desplegar hasta confirmar las pruebas. No contratar servicios adicionales.
