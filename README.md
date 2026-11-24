# MZT Conecta

**Sitio web oficial: [mztconecta.com](https://mztconecta.com)**

**Porque lo que pasa en Mazatlán nos une.**

MZT Conecta es una plataforma comunitaria creada para reunir en un mismo lugar las noticias locales, los avisos y los reportes ciudadanos de **Mazatlán, Sinaloa**. Su propósito es facilitar que las personas conozcan lo que ocurre en su ciudad, compartan información útil y participen en conversaciones sobre su comunidad.

La experiencia combina un **muro de publicaciones** con un **mapa interactivo**. Los contenidos son aportaciones de la comunidad y **no representan comunicados oficiales**.

## ¿Qué puedes hacer en MZT Conecta?

- **Explorar el muro ciudadano:** consultar noticias, avisos y reportes compartidos por la comunidad.
- **Consultar el mapa de Mazatlán:** localizar las publicaciones que incluyen ubicación y ampliar el mapa para explorarlas.
- **Publicar reportes:** elegir título y categoría, con descripción, fotografía y ubicación opcionales.
- **Filtrar publicaciones:** buscar por categoría (**Noticias, Comunidad e Infraestructura**), fecha, colonia o zona, votos y presencia de ubicación.
- **Ver mapas dentro de publicaciones:** los reportes con coordenadas muestran su propio marcador; si no tienen ubicación, no se agrega un mapa innecesario.
- **Interactuar con otras personas:** comentar, votar «Me sirve», visitar perfiles y seguir usuarios.
- **Personalizar tu perfil:** agregar nombre, biografía, fotografía de perfil y portada.
- **Crear una cuenta con correo electrónico:** el registro, el inicio de sesión y la confirmación de correo se gestionan mediante Supabase Auth.
- **Moderar la comunidad:** los reportes ciudadanos pasan por revisión antes de mostrarse en el muro general.

## Roles de la comunidad

| Rol | Participación |
| --- | --- |
| **Ciudadano** | Publica reportes y participa mediante comentarios, votos y seguimiento de perfiles. |
| **Lector** | Consulta publicaciones desde la sección de revisión, sin aprobarlas ni rechazarlas. |
| **Editor** | Revisa publicaciones pendientes y puede aprobarlas, rechazarlas o resolverlas. |

Los usuarios nuevos reciben inicialmente el rol **Ciudadano**. Los permisos de moderación se controlan desde la base de datos.

## Historial de actualizaciones

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
