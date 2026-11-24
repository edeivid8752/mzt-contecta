# MZT Conecta — versión 1.1

**Plataforma comunitaria de Mazatlán** para compartir noticias, reportes ciudadanos y avisos, con un muro social y un mapa interactivo. Esta versión preparada para el lanzamiento no incluye contenido de demostración y no modifica las tablas ni políticas existentes de Supabase.

## Novedades de la versión 1.1

1. **Mapa integrado en cada publicación con ubicación.** El mapa aparece directamente en la tarjeta del muro, la vista completa y el perfil. Solo contiene el marcador de esa publicación. Las publicaciones sin ubicación no muestran ningún aviso ni espacio reservado para el mapa.
2. **Logotipo como acceso al inicio.** Al hacer clic en el logotipo se vuelve al muro principal y a la parte superior de la página; el botón tradicional de regreso continúa disponible.
3. **Filtros avanzados combinables.** Botón «Filtros» en lugar del selector de día: fecha (hoy, siete días, treinta días o rango), colonia/zona, orden cronológico, más votos «Me sirve» y publicaciones con ubicación.
4. **Selección de colonias y zonas.** Se filtra mediante la ubicación indicada en el reporte; no se dibujan contornos ni se calculan límites aproximados de las colonias.
5. **Mapa ampliado.** El botón «Ampliar» abre una vista de casi toda la pantalla usando el mismo mapa; conserva zoom, marcadores y filtros al abrir y cerrar.
6. **Mapa principal despejado.** Se eliminó el recuadro informativo superior que ocupaba espacio.
7. **Controles de categoría unificados.** Se eliminó la leyenda duplicada del mapa; las categorías «Noticias», «Comunidad» e «Infraestructura» del muro conservan su estilo y filtran tanto la lista como los marcadores.

Las funciones existentes de cuentas, perfiles, comentarios, seguidores, votos y moderación continúan utilizando Supabase.

## Instalación en Linux

1. Descomprime la carpeta `MZT_Conecta_web_v11`.
2. **Si ya tienes la versión 1.0 funcionando**, copia *solo* `src/supabase-config.js` desde esa versión hacia `MZT_Conecta_web_v11/src/`. No compartas ese archivo si contiene datos de un proyecto privado, aunque la clave publicable esté diseñada para usarse en el navegador.
3. Abre una terminal dentro de la carpeta v1.1 y ejecuta:

   ```bash
   python3 -m http.server 5500
   ```

4. Abre `http://localhost:5500` y entra con tu cuenta habitual.

Si el puerto está ocupado, detén el servidor anterior con `Ctrl+C` o usa otro puerto. Si Firefox muestra una versión anterior, recarga con `Ctrl+Shift+R`.

**No hace falta volver a ejecutar `supabase/upgrade_v10.sql`** si ya instalaste y verificaste las tablas de la versión 1.0. La v1.1 no necesita migraciones SQL adicionales. El archivo se conserva para quien configure desde cero un proyecto compatible con la v1.0; no debe ejecutarse sin revisar su alcance y hacer respaldo.

### Acceso desde otros dispositivos en la misma red

En la computadora que actuará como servidor, dentro de la carpeta v1.1, ejecuta:

```bash
python3 -m http.server 5500 --bind 0.0.0.0
```

Obtén su IP privada en Linux con `hostname -I` o en Windows con `ipconfig`. Los demás dispositivos de la **misma red Wi-Fi o LAN** abren `http://IP_DEL_SERVIDOR:5500`, sustituyendo el texto por la IP real, por ejemplo `http://192.168.1.50:5500`. Asegúrate de que el firewall permita el puerto 5500 y que la red no aísle a sus clientes. Este servidor es solo para desarrollo y pruebas locales; no lo expongas directamente a Internet.

Para registros, confirmaciones de correo y recuperación de contraseña, las URL de redirección deben estar permitidas en la configuración de Authentication de Supabase. Cada dispositivo necesita conexión a Internet para cargar el mapa y comunicarse con Supabase.

## Zonas y ubicaciones

La aplicación mantiene los filtros por colonia o zona según la ubicación seleccionada o registrada por el autor de una publicación. Los mapas no incluyen contornos de regiones. Una publicación sin ubicación se presenta como una publicación normal y no se muestra en el mapa.

## Estructura del proyecto

- `index.html`: estructura de interfaz y filtros.
- `src/main.js`: muro, perfiles, navegación y filtros combinables.
- `src/map.js`: mapa principal, mapas individuales y ampliación.
- `src/regions.js`: soporte interno para filtros de zonas.
- `data/mazatlan_colonias.geojson`: colección geográfica vacía; no se dibujan contornos.
- `src/remote.js`: consultas y cambios de publicaciones y relaciones sociales en Supabase.
- `src/auth.js`: autenticación existente.
- `src/supabase-config.js`: URL y clave *publicable*; viene sin configurar en el paquete de distribución.
- `supabase/upgrade_v10.sql`: esquema anterior de referencia; **no es una migración nueva de la v1.1**.

## Seguridad y condiciones de uso

- Nunca incluyas claves `sb_secret_`, `service_role`, contraseñas ni respaldos personales en GitHub ni en el sitio.
- Los reportes ciudadanos requieren moderación según los permisos existentes. Una ubicación aportada por una persona no implica verificación oficial.
- Las fotografías subidas al bucket público de Supabase pueden ser accesibles mediante su URL: evita contenido sensible.
- Los perfiles y publicaciones aprobadas son visibles entre usuarios registrados, siguiendo las políticas existentes. No incluye publicaciones ni perfiles simulados en la interfaz.
- Los mapas requieren una conexión a Internet y utilizan teselas de OpenStreetMap. Antes de operar el sitio a gran escala, utiliza un proveedor de mapas apropiado y respeta las condiciones de uso.
- Esta copia no publica nada ni modifica la base de datos; antes de abrirla al público debes realizar respaldos, borrar los datos de prueba y revisar el acceso y los correos.
