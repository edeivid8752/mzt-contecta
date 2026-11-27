# MZT Conecta — v2.4

**[mztconecta.com](https://mztconecta.com)** · Porque lo que pasa en Mazatlán nos une.

## Historial de actualizaciones

### v2.4 — Estabilidad de mapas y experiencia comunitaria

**Mapas**
- Motor raster común para mapa principal, ampliado, selector y publicaciones: marcadores anclados a coordenadas con tamaño estable, incluyendo infraestructura.
- Gestión de instancias visibles y recuperación de teselas en blanco sin recargar el muro; control de reintento y conservación de la vista.
- Ubicación exacta opcional en noticias editoriales.
- Ampliación de la columna del mapa, tendencias y actividad sin modificar la cuadrícula de publicaciones.

**Moderación y comunidad**
- Eliminación editorial de publicaciones y comentarios desde denuncias, con confirmación.
- Explicación obligatoria para nuevas denuncias de motivo «Otro».
- Enlaces HTTP/HTTPS opcionales en publicaciones sociales y avisos ciudadanos.
- Botón explícito «Publicar reporte» en móviles y fechas separadas de creación y última respuesta en el foro.

La verificación diferida del correo queda pendiente de integración y validación; se conserva la protección de autenticación existente.

### v2.3 — Participación y seguimiento ciudadano

**Reportes y comunidad**
- Seguimiento editorial de reportes ciudadanos y de infraestructura, historial de estados, antigüedad y tiempo hasta su resolución.
- Confirmaciones ciudadanas únicas por cuenta para reportes sin resolver.
- Sugerencias de reportes similares por texto, categoría y proximidad cuando se indique una ubicación.
- Ubicación del dispositivo únicamente bajo autorización; selección manual y publicaciones sin coordenadas.
- Alertas por colonias de interés mediante el centro de notificaciones.

**Participación de visitantes**
- Publicaciones sociales y reportes con etiqueta «Publicación de un visitante», mediante sesión anónima sin perfil público.
- Revisión editorial obligatoria y límites de envío; fotografías opcionales.
- Protección Cloudflare Turnstile para el registro, inicio de sesión, recuperación de contraseña y creación de sesiones de visitantes; validación del token en Supabase Auth.
- Para habilitar el envío de visitantes, desplegar el cliente con Turnstile y verificarlo antes de habilitar CAPTCHA y Anonymous Sign-Ins en Supabase. La clave secreta se configura exclusivamente en Supabase.

### v2.2.2 — Conservación de formularios y sesión

**Estabilidad y experiencia de usuario**
- Conservación de los datos de formularios comerciales al cambiar de pestaña y regresar.
- Revalidación de la sesión sin reconstruir la vista cuando la identidad y el rol permanecen iguales.
- Conservación de los campos, archivos seleccionados y controles abiertos durante las actualizaciones de segundo plano.
- Guardado y recuperación de borradores comerciales en la pestaña, incluso después de una recarga, con conservación de imágenes y eliminación tras el envío.

### v2.2.1 — Corrección de los paneles comerciales

**Publicidad y negocios**
- Corrección de la visualización de Mi negocio y Administración de publicidad.
- Separación de los paneles de gestión y los espacios publicitarios del muro.
- Mejora de los estados de carga, acceso y recuperación ante errores de conexión.

### v2.2 — Publicidad y comercio local

**Publicidad y negocios**
- Registro y revisión de establecimientos desde cuentas de la comunidad.
- Panel Mi negocio para administrar información comercial y solicitar campañas.
- Publicidad lateral y publicaciones patrocinadas con fondo amarillo sutil.
- Administración de campañas, aprobación, pausa, programación, renovación y vencimiento automático.
- Enlaces a sitios web, redes sociales y ubicaciones de establecimientos.
- Estadísticas de visualizaciones y clics de cuentas registradas.
- Permisos comerciales privados de Administrador y Propietario, independientes de la moderación editorial.

**Interfaz móvil**
- Mapa, Tendencias y Actividad del día integrados al desplazamiento natural del muro.
- Botón flotante para regresar al mapa mediante desplazamiento suave.
- Adaptación de espacios publicitarios y formularios comerciales a pantallas pequeñas.

### v2.1 — Navegación, fluidez y privacidad

**Navegación**
- Direcciones independientes para las secciones del muro, foro, conversaciones, publicaciones, perfiles y demás apartados.
- Enlaces compartidos permanentes y compatibilidad con las direcciones anteriores.
- Navegación mediante el historial del navegador y acceso directo al contenido.

**Acceso**
- Entrada directa al muro con sesión activa o como visitante.
- Rutas independientes para iniciar sesión, registrarse y recuperar contraseña.

**Mapa interactivo**
- Transición animada entre el mapa principal y el minimapa.

**Privacidad**
- Identificación de autores mediante nombre visible y nombre de usuario, sin mostrar sus roles.

### v2.0 — Expansión de la plataforma

**Navegación e interfaz**
- Nueva barra superior con Muro, Foro y ¿Quiénes somos?
- Selectores personalizados en formularios y filtros, con navegación por teclado.
- Ajustes de distribución, espaciado y adaptación a pantallas pequeñas.

**Muro, mapa y publicaciones**
- Tres secciones: Social, Noticias e Infraestructura, con categorías y filtros temáticos independientes.
- Mapa principal que se reduce y permanece visible al recorrer el muro, con opción de ampliar o recuperar el mapa grande.
- Marcadores diferenciados por tipo y categoría; al pulsarlos, se desplaza el muro a la publicación correspondiente.
- Tendencias independientes por sección, con publicaciones aprobadas de los últimos siete días.
- Mapa alternativo para dispositivos sin WebGL.
- Publicaciones sociales con fecha de evento opcional.

**Foro**
- Conversaciones organizadas por categorías, con orden por popularidad o fecha.
- Respuestas y votos positivos o negativos.
- Vinculación opcional de conversaciones con publicaciones del mapa.

**Perfiles y comunidad**
- Listas de seguidores y seguidos desde los perfiles, con acceso a las personas y acciones de seguimiento.

**Información y actualidad**
- Barra Al día con titulares rotativos, próximos eventos y clima de Mazatlán.
- Apartado ¿Quiénes somos? y espacio de colaboraciones, accesible desde el inicio de sesión.

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

- Aplicar únicamente las migraciones pendientes, en orden: `supabase/upgrade_v12.sql`, `supabase/upgrade_v13.sql`, `supabase/upgrade_v131.sql`, `supabase/upgrade_v20.sql`, `supabase/upgrade_v21.sql`, `supabase/upgrade_v22.sql`, `supabase/upgrade_v23.sql`, `supabase/upgrade_v24.sql`. No ejecutar scripts antiguos de instalación sobre producción.
- La actualización v1.3.1 utiliza los metadatos de registro solo para el nombre visible y el identificador, nunca para asignar roles.
- El índice único de perfiles evita duplicados incluso con registros simultáneos. La consulta de disponibilidad devuelve únicamente un booleano.
- GitHub Actions verifica JavaScript y las migraciones de PostgreSQL en una base aislada.
- Render conserva la configuración existente, incluyendo manifest y service worker. No publicar claves privadas.

- Render: configurar una regla Rewrite de `/*` a `/index.html` para servir las rutas directas; los archivos estáticos existentes conservan sus rutas. Mantener el despliegue manual.

Los accesos comerciales se administran en `mzt_ad_staff`; la asignación inicial de Propietario debe realizarse desde Supabase a la cuenta autorizada. El propietario puede conceder y retirar administración comercial desde la plataforma. Las campañas se muestran únicamente cuando el establecimiento y la campaña están aprobados y dentro de su vigencia.
