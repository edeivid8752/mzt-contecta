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
  fixture.before(header);
  const gate=document.createElement('div');gate.id='auth-gate';gate.hidden=true;fixture.prepend(gate);
  const daily=document.createElement('div');daily.id='daily-bar';daily.className='daily-bar';daily.textContent='Al día';
  const home=document.createElement('div');home.id='map-home';
  const panel=document.createElement('section');panel.id='map-panel';panel.className='map-panel map-hero';
  const button=document.createElement('button');button.id='mobile-map-return';button.hidden=true;button.textContent='Mapa grande';
  panel.append(map,button);home.append(panel);fixture.prepend(daily,home);
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
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(300);
 const mobileBefore=await page.locator('.feed-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,y:r.top+window.scrollY};});
 await page.evaluate(()=>{window.scrollTo({top:800,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(350);
 const first=await page.locator('#map-panel').boundingBox(),header=await page.locator('.v20-top').boundingBox();
 assert(first.height<=130&&first.height>=90&&Math.abs(first.y-Math.max(0,header.y+header.height))<2,'Minimapa fuera de cabecera '+JSON.stringify({first,header}));
 const mobileAfter=await page.locator('.feed-panel').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,y:r.top+window.scrollY};});
 assert(Math.abs(mobileBefore.x-mobileAfter.x)<1&&Math.abs(mobileBefore.width-mobileAfter.width)<1&&Math.abs(mobileBefore.y-mobileAfter.y)<2,'El acoplamiento desplazó el muro '+JSON.stringify({mobileBefore,mobileAfter}));
 await page.evaluate(()=>{window.scrollTo({top:1100,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(300);
 const second=await page.locator('#map-panel').boundingBox();
 assert(Math.abs(first.y-second.y)<2,'El mapa no acompaña el desplazamiento');
 await anchors();
 await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});window.dock.update();});
 await page.waitForTimeout(300);
 assert(await page.locator('#map-panel').evaluate(el=>!el.classList.contains('is-mobile-docked')&&el.clientHeight>200),'No regresó el mapa grande');
 await page.evaluate(()=>{window.scrollTo({top:850,behavior:'instant'});window.dock.update();window.dock.setView('foro');});
 assert(await page.locator('#map-panel').evaluate(el=>!el.classList.contains('is-mobile-docked')),'Mapa flotante fuera del muro');
 console.log('v2.4.1: alineación de escritorio, mapa fijo móvil, vuelta al mapa grande y posición del muro comprobados');
 assert.deepEqual(errors,[]);
 console.log('Chromium: anclajes de todas las categorías, traslado, mapa de publicación, selector, recuperación y ancho del feed correctos');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
