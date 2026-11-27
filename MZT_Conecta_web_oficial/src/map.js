// v2.4: motor raster DOM compartido, sin contextos WebGL por publicación.
import {getRegions} from './regions.js';
import {installMarkerPreviews} from './map-hover-v242.js?v=2.4.3';
const TILES_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTER=[-106.429,23.241];
let libPromise,mainState=null,initJob=null,lastItems=[],selected=null,onItemClick,onRegionClick,highlightedRegion=null,requestedFocus=null,ready=false;
let lifecycleInstalled=false,previewState=null,pickerState=null,pickerMarker=null,previewRequest=0,pickerRequest=0;
const live=new Set(),embeddedMaps=new Map(),embeddedViews=new WeakMap();
let embeddedObserver=null,embeddedGeneration=0;
let embeddedVisible=new WeakSet();
export const validCoordinates=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85.051129;
export const toLatLng=c=>[c[1],c[0]];
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const loadLibrary=()=>libPromise||(libPromise=import('https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js').then(m=>m.default||m).catch(e=>{libPromise=null;throw e;}));
const markerFor = (item,interactive=true) => {
 const wrap=document.createElement('div');wrap.className='wall-pin-wrap';
 const el=document.createElement(interactive?'button':'span');if(interactive){el.type='button';el.dataset.previewPost=String(item.id);}
 const type=['news','citizen','social','infrastructure'].includes(item.type)?item.type:'citizen';
 el.className='wall-pin wall-pin-'+type+(item.resolvedAt?' resolved':'')+(selected===item.id?' selected':'');
 el.setAttribute('aria-label',item.title);
 const c=String(item.category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let glyph='<path d="M7 7h10v10H7z M10 10h4m-4 3h4"/>';
 if(type==='social')glyph=/comida/.test(c)?'<path d="M8 5v7m-3-7v5q3 4 6 0V5m-3 7v7M16 5v14m0-14q6 3 0 8"/>':/deporte/.test(c)?'<circle cx="12" cy="12" r="7"/><path d="m12 8 4 3-2 5h-4l-2-5z"/>':/playa/.test(c)?'<path d="M4 14q4-4 8 0t8 0M4 18q4-4 8 0t8 0"/><circle cx="14" cy="7" r="3"/>':/evento/.test(c)?'<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M8 4v6m8-6v6M5 12h14"/>':'<path d="M5 9h14l-1-4H6zM6 9v10h12V9m-9 10v-6h6v6"/>';
 else if(type==='infrastructure')glyph=/agua|drenaje|inundacion/.test(c)?'<path d="M12 4s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>':/alumbrado/.test(c)?'<path d="M9 17h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9z"/>':'<path d="M5 18 12 5l7 13zM12 10v4m0 2v.5"/>';
 else if(type==='citizen')glyph='<path d="M12 5 3 19h18zM12 10v4m0 2v.5"/>';
 el.innerHTML='<svg viewBox="0 0 36 44" width="36" height="44" aria-hidden="true"><path class="wall-pin-shape" d="M18 2C8 2 2 9 2 18c0 10 16 24 16 24s16-14 16-24C34 9 28 2 18 2Z"/><g transform="translate(6 6)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</g></svg>';
 if(interactive)el.addEventListener('click',e=>{e.stopPropagation();onItemClick?.(item.id);});wrap.append(el);return wrap;
};

function icon(L,item,interactive=true){return L.divIcon({className:'leaflet-mzt-pin',html:markerFor(item,interactive),iconSize:[36,44],iconAnchor:[18,42]});}
function viewOf(state){if(!state)return null;const p=state.instance.getCenter();return {center:[p.lng,p.lat],zoom:state.instance.getZoom()};}
function visible(el){return el.isConnected&&el.getClientRects().length>0&&el.clientWidth>0&&el.clientHeight>0&&!document.hidden;}
function visibleTile(state){
 const host=state.el.getBoundingClientRect(),layer=state.tiles.getContainer();
 return !!layer&&Array.from(layer.querySelectorAll('img.leaflet-tile-loaded')).some(img=>{
  if(!img.complete||!img.naturalWidth)return false;
  const r=img.getBoundingClientRect();return r.right>host.left&&r.left<host.right&&r.bottom>host.top&&r.top<host.bottom;
 });
}
export function recoveryDelay(retries){return Math.min(120000,15000*Math.pow(2,Math.min(retries,3)));}
function check(state,manual=false){
 if(state.closed||!visible(state.el))return;
 const now=Date.now(),w=state.el.clientWidth,h=state.el.clientHeight;
 if(w!==state.w||h!==state.h){state.w=w;state.h=h;state.instance.invalidateSize({pan:true,animate:false,debounceMoveend:true});}
 if(visibleTile(state)){state.blankSince=0;state.retries=0;state.retryButton.hidden=true;return;}
 if(!state.blankSince)state.blankSince=now;
 if(now-state.blankSince>=15000)state.retryButton.hidden=false;
 if(navigator.onLine===false)return;
 if(manual||(now-state.blankSince>=15000&&now-state.lastRetry>=recoveryDelay(state.retries))){
  state.lastRetry=now;state.retries++;state.tiles.redraw();
 }
}
function installLifecycle(){
 if(lifecycleInstalled)return;lifecycleInstalled=true;
 const wake=()=>{if(!document.hidden)for(const s of live)check(s);};
 document.addEventListener('visibilitychange',wake);
 window.addEventListener('pageshow',wake);
 window.addEventListener('online',wake);
 setInterval(wake,5000);
}
function makeMap(L,el,center,zoom,{controls=false,maxZoom=19}={}){
 const instance=L.map(el,{zoomControl:controls,attributionControl:false,minZoom:10,maxZoom,zoomSnap:.25,zoomDelta:.5,scrollWheelZoom:true,zoomAnimation:!reduced(),fadeAnimation:!reduced(),markerZoomAnimation:!reduced()}).setView(toLatLng(center),zoom);
 try{
 L.control.attribution({position:'bottomleft',prefix:false}).addTo(instance);
 const tiles=L.tileLayer(TILES_URL,{attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',maxNativeZoom:19,maxZoom,keepBuffer:2,updateWhenIdle:true,updateWhenZooming:false}).addTo(instance);
 const retryButton=document.createElement('button');retryButton.type='button';retryButton.className='v24-map-retry';retryButton.textContent='Reintentar mapa';retryButton.hidden=true;el.append(retryButton);
 const state={L,el,instance,tiles,retryButton,w:el.clientWidth,h:el.clientHeight,blankSince:Date.now(),lastRetry:Date.now(),retries:0,closed:false,observer:null,pins:new Map(),regions:null};
 L.DomEvent.disableClickPropagation(retryButton);L.DomEvent.disableScrollPropagation(retryButton);
 retryButton.addEventListener('click',()=>{state.retries=0;check(state,true);});
 const validate=()=>check(state);tiles.on('tileload tileerror',validate);instance.on('moveend zoomend',validate);
 if('ResizeObserver' in window){state.observer=new ResizeObserver(()=>{if(!state.closed)requestAnimationFrame(validate);});state.observer.observe(el);}
 live.add(state);installLifecycle();return state;
 }catch(error){instance.remove();throw error;}
}
function dispose(state){if(!state||state.closed)return;state.closed=true;live.delete(state);state.observer?.disconnect();state.hover?.dispose();state.retryButton.remove();state.instance.remove();}
function addPin(state,item,interactive=true){return state.L.marker(toLatLng(item.coordinates),{icon:icon(state.L,item,interactive),keyboard:interactive,interactive}).addTo(state.instance);}
function pinSignature(item){return JSON.stringify([item.coordinates,item.type,item.category,item.title,!!item.resolvedAt,selected===item.id]);}
export async function initMap({onSelect,onRegionSelect,onFail}){
 onItemClick=onSelect;onRegionClick=onRegionSelect;
 if(mainState){resizeMap();return true;}if(initJob)return initJob;
 initJob=(async()=>{try{const L=await loadLibrary(),el=document.getElementById('map');mainState=makeMap(L,el,DEFAULT_CENTER,12.05,{maxZoom:18});mainState.hover=installMarkerPreviews(el,mainState.instance,id=>lastItems.find(item=>String(item.id)===id));ready=true;mainState.initialView=viewOf(mainState);mainState.instance.on('moveend zoomend dragend',updateCenterControls);updateCenterControls();setRegionData();setMapItems(lastItems,selected);if(requestedFocus)focusMapItem(requestedFocus);return true;}catch(error){console.warn('Mapa:',error);dispose(mainState);mainState=null;ready=false;onFail?.();return false;}finally{initJob=null;}})();
 return initJob;
}
export function setMapItems(items,selectedId){
 lastItems=items;selected=selectedId;if(!mainState||!ready)return;
 const state=mainState,keep=new Set();
 state.hover?.refresh();
 for(const item of items){if(!validCoordinates(item.coordinates))continue;keep.add(item.id);const sig=pinSignature(item),existing=state.pins.get(item.id);
  if(existing?.sig===sig)continue;
  if(existing){existing.marker.setLatLng(toLatLng(item.coordinates));existing.marker.setIcon(icon(state.L,item));existing.sig=sig;}
  else state.pins.set(item.id,{marker:addPin(state,item),sig});
 }
 for(const [id,entry] of state.pins)if(!keep.has(id)){entry.marker.remove();state.pins.delete(id);}
}
const regionColor=()=>getComputedStyle(document.documentElement).getPropertyValue('--skin-primary').trim()||'#75458b';
const regionStyle=f=>({color:regionColor(),weight:1,fillOpacity:f.properties.name===highlightedRegion ? .24 : .07});
export function setRegionData(){
 if(!mainState||!ready)return;const s=mainState;
 s.regions?.remove();s.regions=s.L.geoJSON(getRegions(),{style:regionStyle,onEachFeature:(f,l)=>l.on('click',()=>onRegionClick?.(f.properties.name))}).addTo(s.instance);s.regions.bringToBack();
}
export function setSelectedRegion(name){highlightedRegion=name||null;mainState?.regions?.setStyle(regionStyle);}
function updateCenterControls(){
 const v=viewOf(mainState),initial=mainState?.initialView;if(!v||!initial)return;
 const centered=Math.abs(v.center[0]-initial.center[0])<.0001&&Math.abs(v.center[1]-initial.center[1])<.0001&&Math.abs(v.zoom-initial.zoom)<.001;
 for(const id of ['center-main-map','center-expanded-map']){const b=document.getElementById(id);if(b){b.hidden=centered;b.removeAttribute('aria-pressed');}}
}
export function resetMainMap(){if(mainState&&ready){requestedFocus=null;const v=mainState.initialView;mainState.instance.setView(toLatLng(v.center),v.zoom,{animate:!reduced()});updateCenterControls();}}
export function getMainMapView(){return viewOf(mainState);}
export function focusMapItem(item){if(!validCoordinates(item?.coordinates))return;requestedFocus=item;if(mainState&&ready)mainState.instance.setView(toLatLng(item.coordinates),Math.max(mainState.instance.getZoom(),14),{animate:!reduced()});}
export function resizeMap(){if(mainState){const s=mainState;s.hover?.clear();if(visible(s.el)){s.instance.invalidateSize({pan:true,animate:false,debounceMoveend:true});check(s);updateCenterControls();}}}
export function isMapReady(){return !!mainState&&ready;}
function embeddedItem(el){return {id:'embedded',coordinates:(el.dataset.coords||'').split(',').map(Number),title:el.dataset.title||'Ubicación de la publicación',type:el.dataset.type||'citizen',category:el.dataset.category||'',resolvedAt:el.dataset.resolved==='true'?true:null};}
async function activateEmbeddedMap(el,generation){
 if(embeddedMaps.has(el)||!visible(el))return;
 const item=embeddedItem(el);if(!validCoordinates(item.coordinates))return;
 try{const L=await loadLibrary();if(generation!==embeddedGeneration||embeddedMaps.has(el)||!visible(el)||(embeddedObserver&&!embeddedVisible.has(el)))return;const saved=embeddedViews.get(el);el.classList.remove('embedded-map-failed');el.replaceChildren();const s=makeMap(L,el,saved?.center||item.coordinates,saved?.zoom||15.75,{controls:true});embeddedMaps.set(el,s);addPin(s,item,false);}
 catch(error){console.warn('Mapa de publicación:',error);if(el.isConnected){el.classList.add('embedded-map-failed');el.textContent='No se pudo cargar el mapa. Vuelve a abrir la publicación.';}}
}
function removeEmbedded(el,s){if(!s)return;if(el.isConnected)embeddedViews.set(el,viewOf(s));dispose(s);embeddedMaps.delete(el);}
export function refreshEmbeddedMaps(){
 embeddedObserver?.disconnect();embeddedVisible=new WeakSet();const generation=++embeddedGeneration;
 for(const [el,s] of embeddedMaps)if(!el.isConnected||!el.clientHeight)removeEmbedded(el,s);
 const nodes=document.querySelectorAll('.post-embedded-map');
 if(!('IntersectionObserver' in window)){nodes.forEach(el=>void activateEmbeddedMap(el,generation));return;}
 embeddedObserver=new IntersectionObserver(entries=>{if(generation!==embeddedGeneration)return;for(const e of entries){if(e.isIntersecting){embeddedVisible.add(e.target);void activateEmbeddedMap(e.target,generation);}else{embeddedVisible.delete(e.target);removeEmbedded(e.target,embeddedMaps.get(e.target));}}},{rootMargin:'100px 0px 100px 0px'});
 nodes.forEach(el=>embeddedObserver.observe(el));
}
export function destroyEmbeddedMaps(){embeddedGeneration++;embeddedObserver?.disconnect();embeddedObserver=null;for(const [el,s] of embeddedMaps)removeEmbedded(el,s);}
export function destroyLocationPreview(){previewRequest++;dispose(previewState);previewState=null;}
export async function createLocationPreview(item,{onLoad,onFail}={}){
 destroyLocationPreview();const request=previewRequest;if(!validCoordinates(item?.coordinates)){onFail?.();return false;}
 try{const L=await loadLibrary();if(request!==previewRequest||document.getElementById('location-overlay').hidden)return false;
 previewState=makeMap(L,document.getElementById('location-mini-map'),item.coordinates,16.25,{controls:true});addPin(previewState,item,false);onLoad?.();return true;}
 catch(error){if(request===previewRequest){destroyLocationPreview();onFail?.();}return false;}
}
export function destroyPickerMap(){pickerRequest++;dispose(pickerState);pickerState=null;pickerMarker=null;}
export async function createPickerMap(startCoords,{onPick,onLoad,onFail}={}){
 destroyPickerMap();const request=pickerRequest;
 try{const L=await loadLibrary();if(request!==pickerRequest||document.getElementById('picker-overlay').hidden)return false;
 if(!validCoordinates(startCoords))startCoords=DEFAULT_CENTER;
 pickerState=makeMap(L,document.getElementById('picker-map'),startCoords,15,{controls:true});
 const s=pickerState,pinItem={id:'picker',type:'citizen',title:'Punto seleccionado',coordinates:startCoords};
 pickerMarker=L.marker(toLatLng(startCoords),{icon:icon(L,pinItem,false),draggable:true,keyboard:true}).addTo(s.instance);
 const pick=p=>{if(request!==pickerRequest)return;const c=[p.lng,p.lat];if(!validCoordinates(c))return;pickerMarker.setLatLng(p);onPick?.(c);};
 s.instance.on('click',e=>pick(e.latlng));pickerMarker.on('dragend',()=>pick(pickerMarker.getLatLng()));onLoad?.();return true;
 }catch(error){if(request===pickerRequest){destroyPickerMap();onFail?.();}return false;}
}
