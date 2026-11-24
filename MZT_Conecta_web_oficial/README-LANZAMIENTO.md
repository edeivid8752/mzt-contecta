# MZT Conecta — Preparación de lanzamiento público

Esta es una copia local de v1.1 sin publicaciones ni perfiles simulados, destinada a pruebas antes del despliegue público.

## Cambios sobre v1.1

- No se generan reportes, marcadores, perfiles ni votos de demostración.
- El muro, el mapa, las tendencias y el resumen muestran solo datos obtenidos de Supabase.
- El estado sin publicaciones se muestra de forma neutral.
- Se mantienen cuentas, moderación, filtros, imágenes y demás funciones reales.
- La configuración de Supabase se distribuye vacía. Copia únicamente la URL y clave `sb_publishable_` autorizadas a `src/supabase-config.js` para pruebas locales.
- No se ejecutó ningún borrado de usuarios, imágenes ni información en Supabase.

**No publiques este paquete todavía:** antes hay que respaldar la base y el almacenamiento, retirar datos de prueba y verificar permisos y autenticación para usuarios nuevos.
