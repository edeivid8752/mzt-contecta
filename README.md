# MZT Conecta — v1.0

**Porque lo que pasa en Mazatlán nos une.**

MZT Conecta es una plataforma comunitaria para compartir noticias locales, avisos y reportes ciudadanos en Mazatlán, con un muro social y un mapa interactivo.

## Funciones de la versión 1.1

- **Cuentas reales:** registro e inicio de sesión con Supabase Auth; se conservan las funciones sociales de la versión 1.0.
- **Publicaciones compartidas:** los reportes se guardan en Supabase, vinculados con su autor. La descripción, la fotografía y la ubicación siguen siendo opcionales.
- **Mapas dentro de las publicaciones:** cuando un reporte incluye coordenadas, aparece un mapa interactivo con el marcador exclusivo de esa publicación; cuando no incluye ubicación, no se muestra ningún espacio ni aviso adicional.
- **Mapa principal ampliable:** un botón abre el mapa de Mazatlán en una ventana de mayor tamaño para explorar las publicaciones.
- **Filtros avanzados combinables:** búsqueda por fecha, colonia o zona registrada, orden cronológico, cantidad de votos «Me sirve» y presencia de ubicación.
- **Filtros sincronizados:** las categorías Noticias, Comunidad e Infraestructura filtran tanto el muro como los marcadores del mapa, también en la vista ampliada.
- **Navegación mejorada:** el logotipo permite volver al muro principal desde las demás secciones sin recargar la aplicación.
- **Mapa más despejado:** se retiraron los recuadros informativos y los controles de categorías duplicados que ocupaban espacio dentro del mapa.
- **Perfiles e interacción social:** perfiles públicos, seguidores, comentarios y votos compartidos mediante Supabase.
- **Moderación:** los reportes ciudadanos requieren aprobación; el **Editor** puede revisarlos, aprobarlos o rechazarlos y el **Lector** puede consultarlos sin modificarlos.
- **Imágenes y actualización:** fotografías mediante Supabase Storage y opción **Actualizar** para consultar las novedades.

> Las publicaciones marcadas como **EJEMPLO** son datos ficticios de demostración, no reportes oficiales. Las publicaciones pendientes no aparecen en el muro general hasta que las aprueba un Editor.

## Requisitos

- Una computadora con **Python 3** (Linux, macOS o Windows).
- Un navegador moderno.
- Conexión a Internet para Supabase, mapas y recursos externos.
- Un proyecto de **Supabase** configurado para esta aplicación, o una instancia autorizada por el responsable del proyecto.

No es necesario instalar Node.js ni ejecutar `npm install`: la interfaz se sirve como archivos web estáticos.

## 1. Descargar y configurar

1. En GitHub, abre **Code → Download ZIP**, descarga el repositorio y descomprímelo. También puedes clonarlo con:

   ```bash
   git clone https://github.com/edeivid8752/mzt-contecta.git
   ```

2. Entra en la carpeta **`MZT_Conecta_web_v10`**.
3. Abre `src/supabase-config.js` y completa **únicamente** los datos públicos de tu proyecto:

   ```js
   export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TU_CLAVE_PUBLICA';
   ```

   Ambos valores se obtienen desde la configuración de Supabase (Project URL y Publishable key). **Nunca pegues claves `sb_secret_`, `service_role`, contraseñas ni credenciales privadas.** El repositorio incluye este archivo como plantilla sin valores reales.

4. Si vas a conectar **un Supabase nuevo y vacío**, ejecuta una sola vez, en el **SQL Editor** de ese proyecto y en este orden:

   - `supabase/setup.sql`
   - `supabase/upgrade_v10.sql`

   Si tu proyecto ya tiene configuradas las tablas originales de cuentas y roles, **no vuelvas a ejecutar `setup.sql`**; respalda los datos y aplica únicamente `upgrade_v10.sql` si todavía no lo has hecho.

   Revisa las políticas RLS y la configuración de Auth antes de dar acceso a otras personas.

## 2. Ejecutar la web en tu computadora

Abre una terminal **dentro de `MZT_Conecta_web_v10`** (la carpeta que contiene `index.html`).

**Linux / macOS:**

```bash
python3 -m http.server 5500 --bind 0.0.0.0
```

**Windows (PowerShell):**

```powershell
py -m http.server 5500 --bind 0.0.0.0
```

En esa misma computadora, abre: **http://localhost:5500/**.

Mantén abierta la terminal mientras quieras usar el sitio. Para detener el servidor, presiona `Ctrl + C`.

## 3. Abrir MZT Conecta en otras computadoras o celulares de la misma red local

No es necesario instalar la aplicación en cada dispositivo: basta con que **una computadora anfitriona ejecute el servidor** y los demás abran su dirección IP.

1. Conecta la computadora anfitriona y los dispositivos de prueba a **la misma red Wi-Fi o LAN**.
2. En la computadora anfitriona, ejecuta el servidor con `--bind 0.0.0.0` como en el paso anterior.
3. Averigua la dirección IP privada de esa computadora:

   - **Linux Mint / Linux:** `hostname -I` (elige la IP de la red local, normalmente `192.168.x.x` o `10.x.x.x`).
   - **Windows:** `ipconfig` y busca **IPv4 Address / Dirección IPv4** del adaptador conectado.
   - **macOS:** consulta **Configuración del Sistema → Red**.

4. En el navegador de otro dispositivo, escribe:

   ```text
   http://192.168.1.50:5500/
   ```

   **`192.168.1.50` es solo un ejemplo.** Sustitúyelo por la IP real de la computadora anfitriona.

5. Inicia sesión con una cuenta autorizada o regístrate si el registro está habilitado.

**Si la página no abre:** verifica que ambos dispositivos estén en la misma red, que no exista aislamiento de clientes en el Wi-Fi, que el equipo anfitrión siga encendido y que el firewall permita conexiones locales al puerto TCP **5500**. No abras ese puerto a Internet ni configures redirección de puertos en el router para esta prueba.

**Si falla la confirmación por correo o la recuperación de contraseña:** en Supabase ve a **Authentication → URL Configuration → Redirect URLs** y añade la URL local desde la que los usuarios acceden, por ejemplo `http://192.168.1.50:5500/**`. Actualízala si cambia la IP de la computadora. La configuración de `localhost` por sí sola no cubre la dirección LAN.

> **Importante:** `localhost` funciona solo en el dispositivo que ejecuta el servidor. En otro celular o computadora utiliza la **IP de la computadora anfitriona**. El equipo anfitrión debe permanecer encendido y con el servidor ejecutándose. Es una prueba en red local, no un despliegue público.

## 4. Probar las funciones sociales

1. Registra o inicia sesión con una cuenta y configura el perfil.
2. Crea un reporte con título y categoría. Debe aparecer en tu perfil con estado **pendiente**.
3. Una cuenta con rol **Editor** revisa y aprueba el reporte desde **Moderación**.
4. Con otra cuenta registrada, actualiza la página y busca la publicación aprobada.
5. Abre la publicación, comenta, vota y entra al perfil de su autor para seguirlo.

Los cambios se almacenan en Supabase. **La v1.0 no utiliza actualizaciones instantáneas entre dispositivos:** para ver actividad de otras cuentas, utiliza **Actualizar** o recarga la página.

## 5. Estructura de archivos

```text
MZT_Conecta_web_v10/
├── index.html
├── assets/
├── src/
│   ├── main.js
│   ├── auth.js
│   ├── remote.js
│   ├── social.js
│   ├── styles.css
│   └── supabase-config.js
└── supabase/
    ├── setup.sql
    └── upgrade_v10.sql
```

## 6. Seguridad y límites de la prueba

- Las cuentas, perfiles y publicaciones reales dependen del proyecto Supabase configurado. La web no almacena contraseñas.
- Los roles se administran desde Supabase; una cuenta nueva inicia como **Ciudadano**.
- El bucket `mzt-media` es **público**: cualquier persona con la URL de una imagen almacenada allí puede verla. Evita fotografías o documentos sensibles.
- Los archivos de respaldo de usuarios, archivos `.env` con secretos y claves privadas **no deben subirse a GitHub**.
- El sistema está preparado para pruebas con una comunidad pequeña; no incluye todavía notificaciones push, búsqueda global ni sincronización en tiempo real.

---

**Versión:** 1.0 · **Proyecto:** MZT Conecta · **Ámbito:** Mazatlán, Sinaloa, México.
