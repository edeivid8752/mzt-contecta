# MZT Conecta

**Sitio web oficial: [mztconecta.com](https://mztconecta.com)**

**Porque lo que pasa en Mazatlán nos une.**

MZT Conecta es una plataforma comunitaria creada para reunir en un mismo lugar las noticias locales, los avisos y los reportes ciudadanos de **Mazatlán, Sinaloa**. Su propósito es facilitar que las personas conozcan lo que ocurre en su ciudad, compartan información útil y participen en conversaciones sobre su comunidad.

La experiencia combina un **muro de publicaciones** con un **mapa interactivo** y un **foro comunitario**. Los contenidos son aportaciones de la comunidad y **no representan comunicados oficiales**.

## ¿Qué puedes hacer en MZT Conecta?

- **Explorar el muro ciudadano:** acceder directamente a actividades sociales, noticias, avisos y reportes de infraestructura, con o sin sesión iniciada.
- **Consultar el mapa de Mazatlán:** localizar publicaciones, ampliar el mapa y mantenerlo visible mientras recorres el muro.
- **Publicar reportes y actividades:** elegir una categoría, añadir fotografías, ubicación y, en actividades sociales, fecha de evento.
- **Filtrar publicaciones:** combinar temas, fechas, zonas, votos y presencia de ubicación.
- **Participar en el foro:** crear conversaciones, responder, votar y vincular publicaciones geolocalizadas.
- **Interactuar con otras personas:** comentar, votar «Me sirve», visitar perfiles y consultar seguidores y seguidos.
- **Personalizar tu perfil:** modificar nombre, biografía, fotografía, portada y colores de la interfaz.
- **Mantenerte informado:** consultar tendencias de cada sección, titulares, eventos y clima.
- **Guardar y compartir publicaciones:** conservar contenido de interés y compartir enlaces directos a publicaciones y conversaciones.
- **Promocionar negocios locales:** registrar establecimientos, solicitar campañas y consultar sus estadísticas.
- **Consultar publicidad local:** descubrir negocios mediante anuncios identificados y enlaces comerciales.
- **Conocer MZT Conecta:** consultar la información del proyecto y su espacio de colaboraciones.
- **Moderar la comunidad:** los reportes ciudadanos pasan por revisión antes de mostrarse en el muro general.

## Roles de la comunidad

| Rol | Participación |
| --- | --- |
| **Visitante** | Consulta el contenido público del muro y del foro. |
| **Ciudadano** | Publica reportes y participa mediante comentarios, votos y seguimiento de perfiles. |
| **Lector** | Consulta publicaciones desde la sección de revisión, sin aprobarlas ni rechazarlas. |
| **Editor** | Revisa publicaciones pendientes y puede aprobarlas, rechazarlas o resolverlas. |
| **Administrador** | Gestiona establecimientos y campañas publicitarias; puede aprobarlas, pausarlas, renovar su vigencia y consultar estadísticas comerciales. |
| **Propietario** | Cuenta con los permisos del Administrador y puede conceder o retirar accesos de administración comercial. |

Los usuarios nuevos reciben inicialmente el rol **Ciudadano**. Los permisos de moderación se controlan desde la base de datos. Los accesos comerciales de Administrador y Propietario son privados e independientes del rol comunitario.

## Historial de actualizaciones

### v2.4.4 — Exploración combinada y navegación móvil
- Menú móvil desplegable con logo, opciones según los permisos existentes y fotografía de perfil en Mi cuenta cuando esté disponible.
- Control Centrar en los mapas principales, minimapa lateral de escritorio y mapa ampliado de ambos dispositivos; se oculta al recuperar la vista original y permanece dentro de los límites del mapa.
- Botones de exploración con iconos y colores característicos también en móviles.
- Selección múltiple de Social, Noticias e Infraestructura, con categorías secundarias combinadas sin duplicados y resultados sincronizados en el muro, mapas, tendencias y contador.

### v2.4.3 — Navegación móvil y experiencia del muro
- Transición animada entre mapa principal y minimapa de escritorio, con vistas previas a 500 ms.
- Recuperación del botón flotante para regresar al mapa en móviles y traslado de Tendencias y Actividad del día a una sección independiente, con acceso directo a las publicaciones.
- Aviso discreto de nuevas publicaciones sin desplazar ni reconstruir automáticamente el muro durante la lectura.
- Visor de fotografías a pantalla completa con zoom táctil y control de centrado del mapa en móviles.
- Noticias editoriales vigentes destacadas en el muro con un fondo sutil del tema elegido, sin alterar la barra Al día ni los anuncios patrocinados.

### v2.4.2 — Exploración y categorías
- Etiquetas de categorías con colores distintivos en las conversaciones del foro.
- Encabezado del muro alineado con el mapa principal y la barra Al día, sin modificar el ancho de las publicaciones.
- Vista previa discreta de publicaciones tras mantener el cursor un segundo sobre un marcador, solo en el mapa principal y ampliado de escritorio; sin cambios en el minimapa ni en los mapas de publicaciones.
- Categoría «Otros» disponible en publicaciones sociales, reportes, noticias editoriales, foro y sus filtros.
- Botones de exploración de escritorio más grandes, con los iconos y colores característicos de Social, Noticias e Infraestructura.

### v2.4.1 — Mapa compacto y titulares
- Mapa principal y barra Al día alineados con Tendencias en escritorio, sin modificar el ancho del muro.
- Minimapa superior fijo al desplazarse en móviles, con acceso al mapa grande y ampliación.
- Noticias editoriales simultáneas con vigencia individual, gestión de edición/eliminación y guardado consecutivo; las noticias vencidas permanecen en el muro.

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

- **Verificación de correo:** estado independiente de la confirmación automática de Auth, solicitud de enlace con CAPTCHA y comprobación de una nueva sesión autenticada mediante correo. La activación del registro sin confirmación inicial requiere comprobar el envío real del enlace y cambiar manualmente la opción Confirm email en Supabase después del despliegue.

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
- Notificaciones, guardados, compartir enlaces, denuncias y edición/eliminación de publicaciones propias.
- Respuestas, votos, edición y menciones en comentarios.
- Aplicación web instalable, muro Explorar/Siguiendo y selector HSV.

### v1.2 — Se corrigieron errores y agregaron funciones

- Se muestra el rol real de los autores de las publicaciones: Editor, Lector o Ciudadano.
- El cuadro de publicación muestra el avatar de la cuenta conectada, con una inicial cuando no hay foto.
- Tendencias muestra las cinco publicaciones aprobadas más votadas de los últimos siete días (168 horas), sin eliminar publicaciones, votos o comentarios.
- Actividad del día conserva su funcionamiento anterior.

### v1.1 — Versión oficial y lanzamiento público

- **Lanzamiento en Internet:** publicación mediante Render en **[mztconecta.com](https://mztconecta.com)**, con dominio propio y conexión HTTPS.
- **Correos de autenticación:** integración de Resend con el dominio para la confirmación de cuentas y recuperación de acceso.
- **Contenido real:** la versión oficial deja de generar publicaciones, perfiles, marcadores o votos de demostración; el contenido del muro proviene de Supabase.
- **Mapas por publicación:** cada reporte con coordenadas puede mostrar un mapa interactivo con su marcador exclusivo. Los reportes sin ubicación no muestran un espacio de mapa.
- **Mapa principal ampliable:** la opción «Ampliar» permite explorar los marcadores en una vista de mayor tamaño.
- **Filtros avanzados y combinables:** búsqueda por fechas, colonias o zonas, orden cronológico, popularidad y publicaciones con ubicación.
- **Filtros sincronizados:** las categorías Noticias, Comunidad e Infraestructura se aplican tanto al muro como al mapa.
- **Navegación simplificada:** el logotipo devuelve al muro principal; se eliminaron controles e indicaciones duplicadas del mapa.
- **Mejora de autenticación:** se corrigió la comprobación de sesión para mostrar el acceso normalmente a las personas que todavía no han iniciado sesión.

### v1.0 — Cuentas reales y funciones sociales

- Registro e inicio de sesión mediante Supabase Auth.
- Publicaciones y perfiles vinculados con cuentas reales y almacenados en Supabase.
- Comentarios, votos «Me sirve» y seguimiento de perfiles.
- Fotografías mediante Supabase Storage.
- Roles **Ciudadano**, **Lector** y **Editor**, con revisión y aprobación de reportes ciudadanos.

### v0.5 — Primera base del proyecto

- Estructura inicial de la interfaz de MZT Conecta.
- Muro para noticias, avisos y reportes de Mazatlán.
- Primer mapa interactivo para visualizar la información de la ciudad.
- Organización inicial de las categorías y de la navegación.

---

*MZT Conecta es una iniciativa comunitaria. Las publicaciones son responsabilidad de sus autores y pueden requerir revisión antes de hacerse visibles para toda la comunidad.*
