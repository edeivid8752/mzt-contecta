// Prueba en un Chromium real, sin Supabase ni solicitudes a servidores de mapas.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const require=createRequire(resolve(process.env.MZT_BROWSER_DEPS,'package.json'));
const {chromium}=require('playwright-core');
const leafletJS=await readFile(require.resolve('leaflet/dist/leaflet-src.esm.js'));
const leafletCSS=await readFile(require.resolve('leaflet/dist/leaflet.css'));
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBQAAAABJRU5ErkJggg==','base64');
const fixture='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/v20.css"><link rel="stylesheet" href="/src/v22.css"><link rel="stylesheet" href="/src/v23.css"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>body{margin:0;display:block;overflow:auto}.fixture{width:90%;margin:10px auto}#main-box{width:100%;height:420px;position:relative}#map{position:absolute;inset:0}#dock-box{width:300px;height:240px;position:relative}#location-overlay,#picker-overlay{position:relative;display:block;height:250px;width:100%}#location-mini-map,#picker-map{position:absolute;inset:0}#location-overlay[hidden],#picker-overlay[hidden]{display:none!important}</style></head><body><div class="fixture main-body"><div id="main-box"><div id="map" class="map-canvas"></div></div><div id="dock-box"></div><div class="social-layout"><section class="feed-panel">Feed</section><aside id="wall-companion">Mapa y tendencias</aside></div><div id="location-overlay" hidden><div id="location-mini-map" class="location-mini-map"></div></div><div id="picker-overlay" hidden><div id="picker-map" class="picker-map"></div></div><div id="embeds"></div></div><script type="module">import * as m from "/src/map.js";window.mzt=m;window.mapReady=m.initMap({onSelect:id=>window.selectedPost=id,onRegionSelect:()=>{},onFail:()=>window.failed=true});</script></body></html>';
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('content-type','text/html');res.end(fixture);return;}
 if(!/^\/src\/[\w.-]+$/.test(path)){res.writeHead(404).end();return;}
 try{const bytes=await readFile(resolve(root,'.'+path));res.setHeader('content-type',extname(path)==='.js'?'text/javascript':'text/css');res.end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.MZT_CHROME_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let tilesFailed=false;
 await page.route('https://unpkg.com/leaflet@1.9.4/dist/**',route=>route.fulfill({status:200,contentType:route.request().url().endsWith('.css')?'text/css':'text/javascript',headers:{'access-control-allow-origin':'*'},body:route.request().url().endsWith('.css')?leafletCSS:leafletJS}));
 await page.route('https://tile.openstreetmap.org/**',route=>tilesFailed?route.abort():route.fulfill({status:200,contentType:'image/png',body:pixel}));
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 const url='http://127.0.0.1:'+server.address().port;
 const markers=[
  {id:'infra-agua',type:'infrastructure',category:'Agua',title:'Agua',coordinates:[-106.429,23.241]},
  {id:'infra-bache',type:'infrastructure',category:'Bache',title:'Bache',coordinates:[-106.4285,23.2414]},
  {id:'infra-luz',type:'infrastructure',category:'Alumbrado',title:'Luz',coordinates:[-106.4295,23.2414],resolvedAt:'2026-11-27'},
  {id:'news',type:'news',category:'Noticias',title:'Noticia',coordinates:[-106.4294,23.2406]},
  {id:'social',type:'social',category:'Comida',title:'Social',coordinates:[-106.4286,23.2406]},
  {id:'citizen',type:'citizen',category:'Seguridad',title:'Ciudadano',coordinates:[-106.429,23.2404]}
 ];
 await page.goto(url);await page.waitForFunction(()=>!!window.mapReady);assert(await page.evaluate(()=>window.mapReady));
 const before=await page.locator('.feed-panel').boundingBox();
 const railBefore=await page.locator('#wall-companion').boundingBox();
 await page.addStyleTag({url:url+'/src/v24.css'});
 const after=await page.locator('.feed-panel').boundingBox(),railAfter=await page.locator('#wall-companion').boundingBox();
 assert(Math.abs(before.x-after.x)<1&&Math.abs(before.width-after.width)<1,'La columna ampliada movió el feed');
 assert(railAfter.width>railBefore.width,'La columna del mapa no se amplió');
 await page.evaluate(markers=>window.mzt.setMapItems(markers,'infra-agua'),markers);
 await page.waitForFunction(()=>document.querySelectorAll('#map .leaflet-mzt-pin').length===6);
 // Proyección Web Mercator independiente para comprobar la punta geográfica, no solo el tamaño.
 async function anchors(){
  const measured=await page.evaluate(markers=>{
   const map=document.getElementById('map'),bounds=map.getBoundingClientRect(),view=window.mzt.getMainMapView();
   const project=([lon,lat])=>{const s=Math.sin(lat*Math.PI/180),scale=256*2**view.zoom;return [(lon+180)/360*scale,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*scale];};
   const center=project(view.center);
   return markers.map(item=>{
    const node=Array.from(map.querySelectorAll('.wall-pin')).find(x=>x.getAttribute('aria-label')===item.title);
    const rect=node.closest('.leaflet-mzt-pin').getBoundingClientRect(),p=project(item.coordinates);
    const svg=node.querySelector('svg').getBoundingClientRect();
    return {title:item.title,dx:rect.left+18-(bounds.left+bounds.width/2+p[0]-center[0]),dy:rect.top+42-(bounds.top+bounds.height/2+p[1]-center[1]),width:rect.width,height:rect.height,svgTipX:svg.left+svg.width/2-(rect.left+18),svgTipY:svg.top+svg.height*42/44-(rect.top+42)};
   });
  },markers);
  for(const m of measured){assert(Math.abs(m.dx)<3&&Math.abs(m.dy)<3,JSON.stringify(m));assert(Math.abs(m.width-36)<.1&&Math.abs(m.height-44)<.1,JSON.stringify(m));assert(Math.abs(m.svgTipX)<2&&Math.abs(m.svgTipY)<2,JSON.stringify(m));}
 }
 await anchors();
 const initial=await page.evaluate(()=>window.mzt.getMainMapView().zoom);
 const b=await page.locator('#map').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,-650);
 await page.waitForFunction(z=>window.mzt.getMainMapView().zoom>z,initial);await page.waitForTimeout(500);await anchors();
 // Mover el mapa vivo a un contenedor pequeño y luego devolverlo.
 await page.evaluate(()=>{document.querySelector('#dock-box').append(document.querySelector('#map'));window.mzt.resizeMap();});
 await page.waitForTimeout(250);await anchors();
 await page.evaluate(()=>{document.querySelector('#main-box').append(document.querySelector('#map'));window.mzt.resizeMap();});
 await page.waitForTimeout(250);await anchors();
 // Las vistas de publicaciones conservan el marcador centrado durante el zoom.
 await page.evaluate(async marker=>{document.querySelector('#location-overlay').hidden=false;window.previewReady=await window.mzt.createLocationPreview(marker,{});},markers[0]);
 assert(await page.evaluate(()=>window.previewReady));
 async function centered(selector){
  const v=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),pin=el.querySelector('.leaflet-mzt-pin').getBoundingClientRect();return {x:pin.left+18-r.left-r.width/2,y:pin.top+42-r.top-r.height/2,w:pin.width,h:pin.height};});
  assert(Math.abs(v.x)<3&&Math.abs(v.y)<3&&v.w===36&&v.h===44,JSON.stringify(v));
 }
 await centered('#location-mini-map');
 await page.locator('#location-mini-map .leaflet-control-zoom-in').click();await page.waitForTimeout(500);await centered('#location-mini-map');
 await page.evaluate(()=>{window.mzt.destroyLocationPreview();document.querySelector('#location-overlay').hidden=true;});
 await page.evaluate(async marker=>{document.querySelector('#picker-overlay').hidden=false;window.pickerReady=await window.mzt.createPickerMap(marker.coordinates,{onPick:c=>window.picked=c});},markers[0]);
 assert(await page.evaluate(()=>window.pickerReady));await centered('#picker-map');
 const pb=await page.locator('#picker-map').boundingBox();await page.mouse.click(pb.x+pb.width*.65,pb.y+pb.height*.55);assert((await page.evaluate(()=>window.picked)).length===2);
 await page.evaluate(()=>{window.mzt.destroyPickerMap();document.querySelector('#picker-overlay').hidden=true;});
 await page.evaluate(marker=>{const el=document.createElement('div');el.className='post-embedded-map';Object.assign(el.dataset,{coords:marker.coordinates.join(','),title:marker.title,type:marker.type,category:marker.category});document.querySelector('#embeds').append(el);el.scrollIntoView();window.mzt.refreshEmbeddedMaps();},markers[0]);
 await page.waitForSelector('.post-embedded-map .wall-pin-infrastructure');await centered('.post-embedded-map');
 await page.locator('.post-embedded-map .leaflet-control-zoom-in').click();await page.waitForTimeout(500);await centered('.post-embedded-map');
 // Simular teselas no disponibles y vuelta de conexión sin recargar la página.
 tilesFailed=true;await page.reload();await page.waitForFunction(()=>!!window.mapReady);assert(await page.evaluate(()=>window.mapReady));
 await page.addStyleTag({url:url+'/src/v24.css'});
 await page.evaluate(markers=>window.mzt.setMapItems(markers,null),markers);
 await page.waitForSelector('#map .leaflet-tile',{state:'attached'});
 await page.evaluate(()=>{const real=Date.now;Date.now=()=>real()+20000;});
 tilesFailed=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#map .leaflet-tile-loaded')).some(i=>i.complete&&i.naturalWidth>0));
 await anchors();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await anchors();
 // v2.4.1: usar las funciones reales de acoplamiento en un documento de prueba.
 const source=await readFile(resolve(root,'src/main.js'),'utf8');
 const dockCode=source.slice(source.indexOf('function clearMobileDock(){'),source.indexOf('function installMobileMap(){'));
 await page.evaluate(code=>{
  const fixture=document.querySelector('.fixture'),map=document.querySelector('#map');
  const header=document.createElement('header');header.className='v20-top';header.textContent='Muro | Foro';
  const shell=document.createElement('div');shell.className='app-shell';
  const area=document.createElement('main');area.className='main-area';
  const sidebar=document.createElement('aside');sidebar.className='sidebar';
  fixture.before(shell);shell.append(sidebar,area);area.append(header,fixture);
  document.body.style.height='auto';document.body.style.minHeight='100dvh';
  const gate=document.createElement('div');gate.id='auth-gate';gate.hidden=true;fixture.prepend(gate);
  const daily=document.createElement('div');daily.id='daily-bar';daily.className='daily-bar';daily.textContent='Al día';
  const home=document.createElement('div');home.id='map-home';
  const panel=document.createElement('section');panel.id='map-panel';panel.className='map-panel map-hero';
  const button=document.createElement('button');button.id='mobile-map-return';button.hidden=true;button.textContent='Mapa grande';
  panel.append(map,button);home.append(panel);const heading=document.createElement('div');heading.className='page-heading';heading.textContent='Lo que pasa en Mazatlán';fixture.prepend(daily,heading,home);
  document.querySelector('#main-box').remove();document.querySelector('#dock-box').remove();
  document.querySelector('.feed-panel').style.minHeight='1800px';
  const run=new Function(String.fromCharCode(36),'resizeMap','let view="explorar",mapIsExpanded=false;'+code+';return {update:updateMobileMapButton,clear:clearMobileDock,setView(v){view=v;updateMobileMapButton();}};');
  window.dock=run(s=>document.querySelector(s),window.mzt.resizeMap);
  window.addEventListener('scroll',()=>requestAnimationFrame(window.dock.update),{passive:true});
  window.scrollTo({top:0,behavior:'instant'});window.mzt.resizeMap();
 },dockCode);
 await page.setViewportSize({width:1720,height:1050});
 await page.waitForTimeout(350);
 const rail=await page.locator('#wall-companion').boundingBox(),hero=await page.locator('#map-panel').boundingBox(),bar=await page.locator('#daily-bar').boundingBox(),feed=await page.locator('.feed-panel').boundingBox();
 assert(Math.abs(rail.x-hero.x)<2&&Math.abs(hero.x-bar.x)<2,'Bordes izquierdos desalineados '+JSON.stringify({rail,hero,bar}));
 assert(Math.abs(hero.x+hero.width-feed.x-feed.width)<2&&Math.abs(bar.x+bar.width-feed.x-feed.width)<2,'Borde derecho desalineado');
 const heading=await page.locator('.page-heading').boundingBox();
 assert(Math.abs(heading.x-hero.x)<2,'Encabezado fuera del borde del mapa');
 async function hoverPin(enter=true){
  await page.evaluate(enter=>{const pin=document.querySelector('#map .wall-pin');pin.dispatchEvent(new PointerEvent(enter?'pointerover':'pointerout',{bubbles:true,pointerType:'mouse'}));},enter);
 }
 await hoverPin();await page.waitForTimeout(200);assert.equal(await page.locator('.v242-map-preview').count(),0);await hoverPin(false);await page.waitForTimeout(700);assert.equal(await page.locator('.v242-map-preview').count(),0);
 await hoverPin();await page.waitForSelector('.v242-map-preview',{timeout:1200});await hoverPin(false);assert.equal(await page.locator('.v242-map-preview').count(),0);
 await page.evaluate(()=>{const dock=document.createElement('div');dock.id='map-dock';document.querySelector('.fixture').append(dock);dock.append(document.querySelector('#map-panel'));window.mzt.resizeMap();});
 await hoverPin();await page.waitForTimeout(1100);assert.equal(await page.locator('.v242-map-preview').count(),0);await hoverPin(false);
 await page.evaluate(()=>{const host=document.createElement('div');host.id='expanded-map-host';host.style.cssText='position:relative;height:420px;width:100%';document.querySelector('.fixture').append(host);host.append(document.querySelector('#map'));window.mzt.resizeMap();});
 await page.waitForTimeout(300);await hoverPin();await page.waitForSelector('.v242-map-preview',{timeout:1200});await hoverPin(false);
 await page.evaluate(()=>{const panel=document.querySelector('#map-panel');panel.prepend(document.querySelector('#map'));document.querySelector('#map-home').append(panel);document.querySelector('#expanded-map-host').remove();document.querySelector('#map-dock').remove();window.mzt.resizeMap();});
 await page.setViewportSize({width:390,height:844});
 await hoverPin();await page.waitForTimeout(1100);assert.equal(await page.locator('.v242-map-preview').count(),0);await hoverPin(false);
 await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(300);
 const mobileBefore=await page.locator('.feed-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,y:r.top+window.scrollY};});
 await page.evaluate(()=>{window.scrollTo({top:800,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(350);
 assert(await page.locator('#map-panel').evaluate(el=>!el.classList.contains('is-mobile-docked')&&el.clientHeight>200),'El mapa móvil no debe quedar fijo');
 assert(!(await page.locator('#mobile-map-return').evaluate(el=>el.hidden)),'No aparece la flecha al salir del mapa');
 const mobileAfter=await page.locator('.feed-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,y:r.top+window.scrollY};});
 assert(Math.abs(mobileBefore.x-mobileAfter.x)<1&&Math.abs(mobileBefore.width-mobileAfter.width)<1&&Math.abs(mobileBefore.y-mobileAfter.y)<2,'El mapa desplazó el muro');
 await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(300);
 assert(await page.locator('#mobile-map-return').evaluate(el=>el.hidden),'Flecha visible con mapa principal');
 await page.evaluate(()=>{window.scrollTo({top:850,behavior:'instant'});window.dock.update();window.dock.setView('foro');});
 assert(await page.locator('#mobile-map-return').evaluate(el=>el.hidden),'Flecha fuera del muro');
 await page.evaluate(()=>window.mzt.resetMainMap());
 await page.waitForTimeout(500);
 const reset=await page.evaluate(()=>window.mzt.getMainMapView());
 assert(Math.abs(reset.center[0]+106.429)<.001&&Math.abs(reset.center[1]-23.241)<.001&&Math.abs(reset.zoom-12)<.26,'Centrado incorrecto '+JSON.stringify(reset));
 console.log('v2.4.3: alineación, hover, mapa móvil sin acoplar, flecha y centrado comprobados');
 // v2.4.4: comprobar selección combinada y controles reales en el mapa vivo.
 await page.addStyleTag({url:url+'/src/v244.css'});
 await page.evaluate(async markers=>{
  const {matchesSelection}=await import('/src/experience-v244.js');window.mzt.setMapItems(markers.filter(p=>matchesSelection(p,new Set(['news','infrastructure']),new Set())),null);
  const p=document.querySelector('#map-panel');const controls=document.createElement('div');controls.className='v244-map-controls';controls.innerHTML='<button id="center-main-map" class="v243-map-center" hidden>Centrar</button><button class="map-expand-button">Ampliar</button>';p.append(controls);
  document.querySelector('#center-main-map').onclick=window.mzt.resetMainMap;window.mzt.resizeMap();
 },markers);
 assert.equal(await page.locator('#map .leaflet-mzt-pin').count(),5);
 async function checkCenter(width,height){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});window.mzt.resizeMap();});
  await page.waitForTimeout(350);
  await page.evaluate(()=>window.mzt.focusMapItem({coordinates:[-106.42,23.22]}));
  await page.waitForFunction(()=>{const v=window.mzt.getMainMapView();return v.zoom>=14&&!document.querySelector('#center-main-map').hidden;},null,{timeout:5000});
  await page.locator('#center-main-map').click();
  try{await page.waitForFunction(()=>{const v=window.mzt.getMainMapView();return document.querySelector('#center-main-map').hidden&&Math.abs(v.center[0]+106.429)<.0006&&Math.abs(v.center[1]-23.241)<.0006&&Math.abs(v.zoom-12)<.01;},null,{timeout:5000});}
  catch(e){throw Error('Centrado '+width+'px: '+JSON.stringify(await page.evaluate(()=>({view:window.mzt.getMainMapView(),hidden:document.querySelector('#center-main-map').hidden})))+' '+e.message);}
 }
 await checkCenter(390,844);
 await checkCenter(1440,1000);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{
  const {installMobileMenu}=await import('/src/experience-v244.js');const side=document.querySelector('.sidebar');side.id='sidebar';
  side.innerHTML='<button id="v244-menu-toggle" aria-expanded="false">Menú</button><nav id="side-nav"><button data-view="mi-cuenta" class="side-link">Mi cuenta</button><button data-view="moderacion" class="side-link" hidden>Moderación</button></nav><button id="sign-out" class="side-link">Salir</button>';
  installMobileMenu({sidebar:side,nav:side.querySelector('nav'),toggle:side.querySelector('#v244-menu-toggle'),signOut:side.querySelector('#sign-out'),mobile:matchMedia('(max-width:820px)')});
  side.querySelector('#v244-menu-toggle').click();
 });
 assert.equal(await page.locator('#v244-menu-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('[data-view=moderacion]').isVisible(),false);
 await page.locator('[data-view=mi-cuenta]').click();assert.equal(await page.locator('#v244-menu-toggle').getAttribute('aria-expanded'),'false');
 console.log('v2.4.4: marcadores combinados, centrado en ambas pantallas y menú con permisos comprobados');
 // Foro real con API simulada: rol en servidor, confirmación, comentarios y conversaciones en ambos tamaños.
 await page.route('**/src/auth.js',route=>route.fulfill({contentType:'text/javascript',body:'export async function getAuthClient(){return window.forumMock;}'}));
 await page.addStyleTag({url:url+'/src/v245.css'});
 await page.evaluate(async()=>{
  let role='ciudadano',rows=[],replies=[];
  window.forumDeletes=[];
  window.forumMock={rpc:async(name,params)=>({data:{threads:rows.filter(r=>!params.p_thread||r.id===params.p_thread).map(r=>({...r,reply_count:replies.filter(x=>x.thread_id===r.id).length})),replies:replies.filter(r=>r.thread_id===params.p_thread)}}),from:table=>table==='app_roles'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:{role}})})})}:{delete:()=>({eq:(key,id)=>({select:async()=>{window.forumDeletes.push({table,id});if(table==='mzt_forum_threads'){rows=rows.filter(r=>r.id!==id);replies=replies.filter(r=>r.thread_id!==id);}else replies=replies.filter(r=>r.id!==id);return {data:[{id}]};}})})}};
  const root=document.createElement('section');root.id='forum245-test';document.body.append(root);
  const {createForum}=await import('/src/forum-v20.js');
  const forum=createForum(root,{user:()=> 'uid',role:()=>'ciudadano',posts:()=>[],navigate:()=>{},toast:()=>{},login:()=>{}});
  window.forumTestRole=r=>{role=r;forum.show();};
  window.forumTestReset=()=>{rows=[{id:'24500000-0000-4000-8000-000000000001',title:'Conversación de prueba',body:'Texto',category:'Comunidad',display_name:'Autor',username:'autor',score:1}];replies=[{id:'r1',thread_id:rows[0].id,body:'Respuesta uno',display_name:'Autor',username:'autor'},{id:'r2',thread_id:rows[0].id,body:'Respuesta dos',display_name:'Autor',username:'autor'}];forum.route({topic:'all'});forum.show();};
  window.forumTestReset();
 });
 const root=page.locator('#forum245-test');
 await root.locator('.forum-card').waitFor();
 assert.equal(await root.locator('[data-delete-thread]').count(),0);
 await page.evaluate(()=>window.forumTestRole('lector'));
 await page.waitForFunction(()=>!document.querySelector('#forum245-test').hasAttribute('aria-busy'));
 assert.equal(await root.locator('[data-delete-thread]').count(),0);
 await page.evaluate(()=>window.forumTestRole('editor'));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(()=>{window.forumDeletes=[];window.forumTestReset();});
  await root.locator('[data-delete-thread]').waitFor();
  await root.locator('[data-thread-open]').click();
  await root.locator('[data-delete-reply]').first().waitFor();
  assert.equal(await root.locator('[data-delete-reply]').count(),2);
  await root.locator('[data-delete-reply]').first().click();
  await page.locator('.v245-forum-confirm [data-cancel]').click();
  assert.equal(await page.evaluate(()=>window.forumDeletes.length),0);
  await root.locator('[data-delete-reply]').first().click();
  await page.locator('.v245-forum-confirm [type=submit]').click();
  await page.waitForFunction(()=>window.forumDeletes.length===1&&document.querySelectorAll('#forum245-test [data-delete-reply]').length===1&&!document.querySelector('#forum245-test').hasAttribute('aria-busy'));
  assert.equal(await root.locator('[data-delete-reply]').getAttribute('data-delete-reply'),'r2');
  assert.equal(await page.evaluate(()=>window.forumDeletes[0].table),'mzt_forum_replies');
  await root.locator('[data-delete-thread]').click();
  await page.locator('.v245-forum-confirm [type=submit]').click();
  await page.waitForFunction(()=>window.forumDeletes.length===2&&!document.querySelector('#forum245-test .forum-card'));
  assert.equal(await page.evaluate(()=>window.forumDeletes[1].table),'mzt_forum_threads');
 }
 console.log('v2.4.5: rol vigente, eliminación individual y eliminación de conversación en móvil y escritorio comprobados');
 assert.deepEqual(errors,[]);
 console.log('Chromium: anclajes de todas las categorías, traslado, mapa de publicación, selector, recuperación y ancho del feed correctos');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
