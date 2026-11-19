# MZT Conecta · Versión 0.6 · Apariencia y cuenta de demostración

**Proyecto de Cultura Emprendedora — Mazatlán, Sinaloa**  
Lema: **«Porque lo que pasa en Mazatlán nos une»**

La aplicación parte del documento del equipo «MZT Conecta: qué vamos a construir (primera versión de la web)», 4 de noviembre de 2026. Es un **prototipo funcional en el navegador**, no un portal público ni un servicio que publique avisos reales.

## Novedades de la v0.6

- El menú lateral ahora cuenta con transiciones, animación al seleccionar una sección, desplazamiento suave de iconos y efectos al pasar el cursor, inspirados en el panel de **Acceso Lince**.
- Se agregó el apartado **Mi cuenta** y su acceso rápido en la barra superior. Para verlo, selecciona **Ciudadano (demo)**, **Lector (demo)** o **Editor (demo)** en el selector «Simular rol».
- En Mi cuenta se puede cambiar el nombre visible de demostración, elegir entre **MZT Conecta**, **Guinda institucional**, **Azul medianoche**, **Ciruela imperial** y **Terracota noble**, o crear una paleta personalizada con cuatro colores.
- El tema se aplica sin recargar la página y se conserva con `localStorage` en ese mismo navegador. Se respeta la preferencia de movimiento reducido del sistema.
- **No se han implementado cuentas reales, contraseñas, correo, Supabase ni base de datos.** El selector de roles sigue siendo de prueba. Las publicaciones todavía son locales y ficticias; no usar esta versión como sitio público operativo.
- El mapa, el muro, las tendencias, las ventanas de ubicación y la revisión de reportes permanecen en esta versión.

## Cómo abrirlo en Linux Mint / Ubuntu

1. Descomprime `MZT_Conecta_web_v05.zip`.
2. Abre una terminal dentro de la carpeta `MZT_Conecta_web_v05`.
3. Ejecuta el siguiente comando dentro de la carpeta del proyecto:

   ```bash
   python3 -m http.server 5500
   ```
4. En Firefox o Chromium abre **http://localhost:5500**.

El mapa necesita conexión a Internet para cargar MapLibre y las teselas de OpenStreetMap. Si no carga, la lista de demostración sigue funcionando.

## Qué funciona ya

- Pantalla responsive con identidad de MZT Conecta y el logotipo original proporcionado por el equipo.
- Mapa interactivo de Mazatlán con marcadores **circulares** (noticias), **romboidales** (reportes ciudadanos) y **cuadrados** (infraestructura).
- Lista de resultados sincronizada con marcadores y detalles de los reportes.
- Búsqueda por texto, filtros por tipo y selección de fechas anteriores.
- Noticias y avisos temporales correspondientes a su día; infraestructura persistente hasta atención y tres días adicionales en verde.
- Sección «Sin lugar fijo» para noticias que no corresponden a un punto del mapa.
- Creación de reportes con título, descripción, categoría, ubicación y **fotografía obligatoria**.
- Elección aproximada de ubicación o elección exacta **desde una ventana emergente independiente**, sin mover el mapa principal ni cerrar el formulario.
- Bandeja «Mis reportes» y flujo de moderación: recibido → revisado → aprobado o rechazado con motivo.
- Selector de roles de prueba: **Lector** y **Editor** ven el panel de moderación, con diferentes acciones; el **Visitante** no ve «Mis reportes» ni «Moderación»; el **Ciudadano** sí ve sus reportes. El Lector puede consultar y marcar como revisados únicamente los reportes pendientes, pero no aprobar, rechazar ni publicar.
- Rol editor: revisión, aprobación, rechazo, alta manual de noticias con fuente y cierre de reportes de infraestructura.
- Guardado local en `localStorage`; botón contextual no expuesto: `MZTConectaDemo.reset()` en consola restablece los ejemplos.

## Importante: limitaciones actuales

- **Todos los eventos iniciales son ficticios** y se identifican como «Simulación». No representan noticias ni reportes reales de Mazatlán.
- El selector «Explorar como» **simula** roles; **no es registro o inicio de sesión seguro**. No usarlo en producción para autorización.
- Los reportes, las fotografías y las decisiones editoriales se almacenan **solo en el navegador local** y no se comparten con otros usuarios.
- **No hay** base de datos conectada, RSS automatizado, detección de reportes duplicados, validación real de fuentes ni notificaciones.
- Los reportes locales se pueden añadir con los roles de prueba; se excluyeron datos personales y relatos reales del demo.
- Para una versión pública habrá que incorporar Supabase Auth, PostgreSQL/PostGIS, almacenamiento de imágenes y **políticas RLS verificadas en el servidor**. No se debe permitir cambiar roles desde el cliente en producción.
- Se debe eliminar EXIF/metadatos de fotografías **en el servidor** también; la demostración genera una copia comprimida en canvas, que usualmente descarta metadatos embebidos, pero no sustituye controles del servidor.
- Confirmar los requisitos legales, términos y licencias de las fuentes de noticias. Para publicar RSS usar enlaces y resúmenes apropiados, sin copiar contenido completo sin autorización.
- Los servicios de mapas públicos de OpenStreetMap tienen límites de uso; para despliegues con tráfico significativo configurar proveedor de teselas apropiado según su licencia.
- Se añadió la categoría «Tope sin señalización» (según el documento). **No** se añadió «Tope fuera de norma» porque el propio documento indica que hay que comprobar antes la norma municipal aplicable.
- Delincuencia, acusaciones e información personal requieren reglas y moderación más estrictas antes de permitir usuarios reales.

## Archivos

```text
MZT_Conecta_web/
├── index.html                 Interfaz web
├── assets/
│   ├── logo-original.png      Logo enviado por el equipo
│   └── isotipo.png            Recorte técnico del isotipo para el encabezado
└── src/
    ├── styles.css            Estilos y diseño responsive
    ├── data.js               Categorías, ubicaciones y ejemplos ficticios
    ├── storage.js            Estado y almacenamiento local
    ├── map.js                MapLibre + OpenStreetMap
    └── main.js               Búsqueda, filtros, formularios y moderación
```

## Próximas etapas

1. Crear el proyecto Supabase y definir tablas para publicaciones, categorías, adjuntos, estados, perfiles y auditoría.
2. Aplicar autenticación real, RLS, roles firmados en servidor y almacenamiento seguro de fotografías.
3. Implementar editor de noticias con RSS, verificación de fuente y calendario de publicación.
4. Diseñar validación de cierre/reapertura de reportes y medidas contra abuso o datos personales.
5. Habilitar alojamiento y dominio; posteriormente agregar perfiles, grupos, publicaciones sociales, comentarios y app móvil (v2 según el PDF).

## Créditos técnicos

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenStreetMap](https://www.openstreetmap.org/copyright) (teselas con atribución visible)
- Logo aportado por el equipo de MZT Conecta.

## Cambios de la v0.2: diseño estilo foro / Reddit

- El **mapa ocupa la franja superior** y sigue siendo interactivo.
- El **muro de publicaciones ocupa la columna central**, con tarjetas grandes, autor o fuente, etiquetas, texto e imagen adjunta si la hay.
- La columna derecha contiene una invitación a participar, estadísticas e información sobre la verificación de publicaciones.
- Botón **Me sirve** para marcar localmente publicaciones útiles (solo en este navegador, no es un contador público real).
- Botón **Ver en mapa** que sube hasta el mapa y centra el marcador correspondiente.
- Las herramientas de fecha, búsqueda, filtros, reportes y revisión editorial de v0.1 se conservaron.
- Los comentarios, hilos, perfiles y votos reales entre usuarios continúan planificados para la segunda versión social.
- Las fotografías que se adjunten en un reporte se muestran como parte de la tarjeta cuando un editor de demostración lo aprueba.
- Se conservan los mismos datos locales de v0.1; si ya habías enviado reportes desde el mismo navegador, deberían seguir visibles.

## Cambios v0.3 (solicitados por el equipo)

- El enlace «Ver en mapa» de cada tarjeta y el botón «Ver ubicación en el mapa» del panel de detalles ahora abren **una ventana modal con un mapa MapLibre independiente**, centrado y con marcador en las coordenadas del reporte. El muro y la posición de lectura quedan intactos al abrir y cerrar.
- La ventana incluye nombre de la publicación, lugar, coordenadas, botón de cierre y enlace opcional a OpenStreetMap. Se puede cerrar pulsando `Esc` o el fondo. Si no hay Internet, muestra un aviso y mantiene el enlace externo.
- Se reemplazó la tarjeta lateral «Tu ciudad. Tu voz.» por **Tendencias**, con las cinco publicaciones aprobadas que más votos tienen, ordenadas de mayor a menor y con acceso directo a su detalle.
- El botón «Me sirve» muestra el total de votos; votarlo o retirar el voto cambia las tendencias.
- **Importante:** las cifras iniciales en tendencias son **ficticias, solo para la demostración**. Los votos de este navegador suman o restan una unidad y no se sincronizan entre usuarios. Con la futura base de datos deberán reemplazarse por votos reales, autenticados y protegidos contra duplicados.
- Las ubicaciones iniciales también son puntos de ejemplo, no incidentes verificados.

## Cambios v0.4

- Navegación visible según rol: Visitante no ve «Mis reportes» ni «Moderación»; Ciudadano no ve «Moderación»; únicamente Editor puede abrir el panel de moderación. Lector tampoco lo ve en esta versión, conforme a la decisión de dejarlo exclusivo para Editor.
- Retirado el botón naranja «Crear reporte» que duplicaba el botón «Publicar reporte» del muro. Se mantiene el acceso desde «Crear un reporte» del menú.
- El botón «Mapa» del formulario abre un **segundo mapa dentro de un diálogo**; se puede hacer clic o arrastrar el pin y confirmar la elección. No desplaza el scroll, ni usa el mapa de arriba, ni cierra el formulario. Cancelar conserva la ubicación anterior.
- Al confirmar, el desplegable indica «Punto marcado en el mapa» y se muestran las coordenadas exactas (latitud, longitud) que se guardarán en el reporte.
- Como se retiró el botón naranja, **Agregar noticia con fuente** se encuentra ahora dentro de la vista Moderación del Editor.
- Se mantiene el modo demo: esconder menús es solo una decisión visual. Para una app pública hay que implementar permisos obligatorios del servidor.

## Cambios v0.5

- Se devuelve la opción **Moderación** al rol **Lector (demo)**. El Visitante y Ciudadano siguen sin verla.
- El Lector ve únicamente los reportes **Recibidos / pendientes**, puede abrir sus detalles, examinar la fotografía, descripción y ubicación, y pulsar **Marcar revisado**. Una vez revisado, el reporte sale de su bandeja y queda esperando la decisión editorial.
- El Editor conserva el acceso a Moderación y puede revisar, aprobar y rechazar reportes, publicar noticias y cerrar incidentes de infraestructura atendidos.
- Se aplican las restricciones en las funciones de JavaScript, además de ocultar los botones: un lector no puede invocar acciones de aprobación o rechazo mediante las acciones de la interfaz.
- Estos roles son **solo de prueba** y se pueden cambiar desde el selector del navegador; en producción requieren autorización y permisos del servidor.
