// Network-only: do not cache account data, tokens or authenticated API responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MZT Conecta sin conexión</title><body style="font:18px system-ui;margin:2rem"><h1>Sin conexión</h1><p>Conéctate a internet para consultar publicaciones actualizadas.</p><button onclick="location.reload()">Reintentar</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});