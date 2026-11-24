# MZT Conecta — v1.3.1

**[mztconecta.com](https://mztconecta.com)** · Porque lo que pasa en Mazatlán nos une.

## Historial de actualizaciones

### v1.3.1 — Se mejoró el registro de usuarios

- Se agregó la opción de elegir el nombre visible y el nombre de usuario al crear una cuenta.
- Se incorporó la validación de nombres de usuario únicos.

### v1.3 — Se agregó el usuario visitante y nuevas funciones

- Acceso de solo lectura para visitantes.
- Notificaciones, guardados, enlaces compartidos, denuncias y edición/eliminación de publicaciones propias.
- Respuestas, votos, edición y menciones en comentarios.
- Aplicación web instalable, muro Explorar/Siguiendo y selector HSV.

### v1.2 — Se corrigieron errores y agregaron funciones

- Rol real del autor y avatar de la cuenta conectada.
- Tendencias con las cinco publicaciones aprobadas más votadas de los últimos siete días.
- Actividad del día conserva su funcionamiento.

## Guía técnica de actualización

- Aplicar únicamente las migraciones pendientes, en orden: `supabase/upgrade_v12.sql`, `supabase/upgrade_v13.sql`, `supabase/upgrade_v131.sql`. No ejecutar scripts antiguos de instalación sobre producción.
- La actualización v1.3.1 utiliza los metadatos de registro solo para el nombre visible y el identificador, nunca para asignar roles.
- El índice único de perfiles evita duplicados incluso con registros simultáneos. La consulta de disponibilidad devuelve únicamente un booleano.
- GitHub Actions ejecuta las pruebas de JavaScript y PostgreSQL con datos ficticios.
- Render conserva la configuración existente, incluyendo manifest y service worker. No publicar claves privadas.
