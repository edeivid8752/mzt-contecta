// Mapa real MapLibre + teselas OpenStreetMap. Requiere Internet; no hay descargas masivas.
// Para producción deberá contratarse un proveedor apropiado y configurarse la variable TILES_URL.
import {getRegions} from './regions.js';
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTER = [-106.429, 23.241];
let lib = null;
let map = null;
let markers = [];
let lastItems = [];
let onItemClick = null;
let onRegionClick = null;
let highlightedRegion = null;
let regionLabels=[];
let selected = null;
let ready = false;
let alternateMap=null,requestedFocus=null;

const markerFor = item => {
 const wrap=document.createElement('div');wrap.className='wall-pin-wrap';
 const el=document.createElement('button');el.type='button';
 const type=['news','citizen','social','infrastructure'].includes(item.type)?item.type:'citizen';
 el.className='wall-pin wall-pin-'+type+(item.resolvedAt?' resolved':'')+(selected===item.id?' selected':'');
 el.setAttribute('aria-label',item.title);
 const c=String(item.category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let glyph='<path d="M7 7h10v10H7z M10 10h4m-4 3h4"/>';
 if(type==='social')glyph=/comida/.test(c)?'<path d="M8 5v7m-3-7v5q3 4 6 0V5m-3 7v7M16 5v14m0-14q6 3 0 8"/>':/deporte/.test(c)?'<circle cx="12" cy="12" r="7"/><path d="m12 8 4 3-2 5h-4l-2-5z"/>':/playa/.test(c)?'<path d="M4 14q4-4 8 0t8 0M4 18q4-4 8 0t8 0"/><circle cx="14" cy="7" r="3"/>':/evento/.test(c)?'<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M8 4v6m8-6v6M5 12h14"/>':'<path d="M5 9h14l-1-4H6zM6 9v10h12V9m-9 10v-6h6v6"/>';
 else if(type==='infrastructure')glyph=/agua|drenaje|inundacion/.test(c)?'<path d="M12 4s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>':/alumbrado/.test(c)?'<path d="M9 17h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9z"/>':'<path d="M5 18 12 5l7 13zM12 10v4m0 2v.5"/>';
 else if(type==='citizen')glyph='<path d="M12 5 3 19h18zM12 10v4m0 2v.5"/>';
 el.innerHTML='<svg viewBox="0 0 36 44" width="36" height="44" aria-hidden="true"><path class="wall-pin-shape" d="M18 2C8 2 2 9 2 18c0 10 16 24 16 24s16-14 16-24C34 9 28 2 18 2Z"/><g transform="translate(6 6)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</g></svg>';
 el.addEventListener('click',e=>{e.stopPropagation();onItemClick?.(item.id);});wrap.append(el);return wrap;
};
export async function initMap({onSelect, onRegionSelect, onFail}) {
  onItemClick = onSelect;
  onRegionClick = onRegionSelect;
  try {
    lib = await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    map = new lib.Map({
      container:'map', center:DEFAULT_CENTER, zoom:12.05, minZoom:10, maxZoom:18,
      attributionControl:false,
      style:{
        version:8,
        sources:{osm:{type:'raster',tiles:[TILES_URL],tileSize:256,
          attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}},
        layers:[{id:'base',type:'raster',source:'osm'}]
      }
    });
    map.addControl(new lib.AttributionControl({compact:true}), 'bottom-left');
    map.on('load',()=> { ready=true; mountRegionLayers(); setMapItems(lastItems,selected);if(requestedFocus)focusMapItem(requestedFocus); });
    map.on('error',e=>{ console.warn('Mapa:',e?.error?.message||'Error de teselas'); });
    return true;
  } catch(err) {
    console.error('MapLibre no disponible:', err);
    try {map?.remove();map=null;const module=await import('https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js');const L=module.default||module;const el=document.getElementById('map');el.replaceChildren();el.classList.remove('maplibregl-map');const instance=L.map(el,{zoomControl:false,minZoom:10,maxZoom:18}).setView([...DEFAULT_CENTER].reverse(),12);L.tileLayer(TILES_URL,{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(instance);alternateMap={instance,L,pins:L.layerGroup().addTo(instance),regions:null};ready=true;setRegionData();setMapItems(lastItems,selected);if(requestedFocus)focusMapItem(requestedFocus);return true;}catch(fallbackError){console.warn('Mapa alternativo:',fallbackError);onFail?.();return false;}
  }
}

export function setMapItems(items, selectedId) {
  lastItems=items;
  selected=selectedId;
  if(alternateMap){const {L,instance,pins}=alternateMap;pins.clearLayers();for(const item of items){if(!Array.isArray(item.coordinates)||item.coordinates.length!==2)continue;const icon=L.divIcon({className:'leaflet-mzt-pin',html:markerFor(item),iconSize:[36,44],iconAnchor:[18,44]});L.marker([...item.coordinates].reverse(),{icon}).addTo(pins);}return;}
  if (!map||!lib||!ready) return;
  for(const mk of markers) mk.remove();
  markers=[];
  for (const item of items) {
    if (!Array.isArray(item.coordinates) || item.coordinates.length !== 2) continue;
    const mk = new lib.Marker({element:markerFor(item),anchor:'bottom'})
      .setLngLat(item.coordinates).addTo(map);
    markers.push(mk);
  }
}
// Contornos verificables (GeoJSON). Sin datos, no se dibujan límites aproximados.
function regionColor(){return getComputedStyle(document.documentElement).getPropertyValue('--skin-primary').trim()||'#75458b';}
function mountRegionLayers(){
  if(!map||!ready)return;
  if(!map.getSource('mzt-regions')) map.addSource('mzt-regions',{type:'geojson',data:getRegions()});
  const color=regionColor();
  if(!map.getLayer('mzt-region-fill')) map.addLayer({id:'mzt-region-fill',type:'fill',source:'mzt-regions',maxzoom:15,
    paint:{'fill-color':color,'fill-opacity':['case',['==',['get','name'],highlightedRegion||''],0.24,0.07]}});
  if(!map.getLayer('mzt-region-outline'))map.addLayer({id:'mzt-region-outline',type:'line',source:'mzt-regions',maxzoom:15,
    paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],10,1.8,14,1],
      'line-opacity':['interpolate',['linear'],['zoom'],10,0.9,14,0.3]}});
  updateRegionLabels();
  map.on('zoomend',updateRegionLabels);
  map.on('moveend',updateRegionLabels);
  map.on('click','mzt-region-fill',e=>{
    const name=e.features?.[0]?.properties?.name;
    if(name)onRegionClick?.(name);
  });
  map.on('mouseenter','mzt-region-fill',()=>{map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','mzt-region-fill',()=>{map.getCanvas().style.cursor='';});
}
export function setRegionData(){
  if(alternateMap){const a=alternateMap;if(a.regions)a.regions.remove();a.regions=a.L.geoJSON(getRegions(),{style:f=>({color:regionColor(),weight:1,fillOpacity:f.properties.name===highlightedRegion?.24:.07}),onEachFeature:(f,l)=>l.on('click',()=>onRegionClick?.(f.properties.name))}).addTo(a.instance);a.regions.bringToBack();return;}
  if(!map||!ready)return;
  const src=map.getSource('mzt-regions');
  if(src)src.setData(getRegions());else mountRegionLayers();
  updateRegionLabels();
}
export function setSelectedRegion(name){
  highlightedRegion=name||null;
  if(alternateMap){setRegionData();return;}
  if(!map||!ready)return;
  const color=regionColor();
  for(const id of ['mzt-region-fill','mzt-region-outline']){
    if(map.getLayer(id))map.setPaintProperty(id,id==='mzt-region-fill'?'fill-color':'line-color',color);
  }
  if(map.getLayer('mzt-region-fill'))map.setPaintProperty('mzt-region-fill','fill-opacity',
    ['case',['==',['get','name'],highlightedRegion||''],0.24,0.07]);
  updateRegionLabels();
}
function regionMidpoint(geometry){
  const poly=geometry?.type==='Polygon'?geometry.coordinates:geometry?.coordinates?.[0];
  const ring=poly?.[0];if(!ring?.length)return null;
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(const coord of ring){minLon=Math.min(minLon,coord[0]);maxLon=Math.max(maxLon,coord[0]);minLat=Math.min(minLat,coord[1]);maxLat=Math.max(maxLat,coord[1]);}
  return [(minLon+maxLon)/2,(minLat+maxLat)/2];
}
function updateRegionLabels(){
  for(const label of regionLabels)label.remove();regionLabels=[];
  if(!map||!ready||!lib||map.getZoom()>13.4)return;
  const features=getRegions().features;
  const zoneFeatures=features.filter(f=>f.properties.scope==='zona');
  const candidates=map.getZoom()<12 && zoneFeatures.length?zoneFeatures:features;
  const visibleBounds=map.getBounds?.();
  let shown=0;
  for(const feature of candidates){
    if(shown>=70)break;
    const coords=regionMidpoint(feature.geometry);if(!coords)continue;
    if(visibleBounds&&!visibleBounds.contains(coords))continue;
    const el=document.createElement('span');el.className='region-label';
    el.textContent=feature.properties.name;
    if(feature.properties.name===highlightedRegion)el.classList.add('selected');
    el.addEventListener('click',e=>{e.stopPropagation();onRegionClick?.(feature.properties.name);});
    regionLabels.push(new lib.Marker({element:el,anchor:'center'}).setLngLat(coords).addTo(map));
    shown++;
  }
}
export function getMainMapView(){if(alternateMap){const p=alternateMap.instance.getCenter();return {center:[p.lng,p.lat],zoom:alternateMap.instance.getZoom()};}return map?{center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom()}:null;}
// Los mapas pequeños son independientes del mapa general y tienen un único marcador.
const embeddedMaps=new Map();
let embeddedObserver=null;
const embeddedStyle=()=>({version:8,sources:{osm:{type:'raster',tiles:[TILES_URL],tileSize:256,
    attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'osm'}]});
async function activateEmbeddedMap(el){
  if(embeddedMaps.has(el)||!el.isConnected)return;
  const coords=(el.dataset.coords||'').split(',').map(Number);
  if(coords.length!==2||!coords.every(Number.isFinite))return;
  try{
    if(!lib)lib=await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    if(!el.isConnected||!el.getBoundingClientRect().height||embeddedMaps.has(el))return;
    const instance=new lib.Map({container:el,center:coords,zoom:15.8,minZoom:10,maxZoom:19,
      attributionControl:false,style:embeddedStyle()});
    embeddedMaps.set(el,instance);
    instance.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
    instance.addControl(new lib.AttributionControl({compact:true}),'bottom-left');
    const marker=document.createElement('span');marker.className='location-preview-anchor';
    marker.innerHTML='<span class="location-preview-pin"></span>';
    new lib.Marker({element:marker,anchor:'bottom'}).setLngLat(coords).addTo(instance);
    instance.on('load',()=>{if(el.isConnected)instance.resize();});
  }catch(error){console.warn('Mapa integrado:',error);el.classList.add('embedded-map-failed');el.textContent='El mapa no está disponible sin conexión a Internet.';}
}
export function refreshEmbeddedMaps(){
  if(embeddedObserver)embeddedObserver.disconnect();
  for(const [el,instance] of embeddedMaps){if(!el.isConnected || !el.getBoundingClientRect().height){instance.remove();embeddedMaps.delete(el);}}
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('.post-embedded-map').forEach(el=>void activateEmbeddedMap(el));return;
  }
  embeddedObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting)void activateEmbeddedMap(entry.target);
      else if(embeddedMaps.has(entry.target)){
        embeddedMaps.get(entry.target).remove();embeddedMaps.delete(entry.target);
      }
    }
  },{rootMargin:'100px 0px 100px 0px'});
  document.querySelectorAll('.post-embedded-map').forEach(el=>embeddedObserver.observe(el));
}
export function destroyEmbeddedMaps(){
  embeddedObserver?.disconnect(); embeddedObserver=null;
  for(const instance of embeddedMaps.values())instance.remove();embeddedMaps.clear();
}

export function focusMapItem(item) {
  if(!item?.coordinates)return;requestedFocus=item;if(alternateMap){const a=alternateMap.instance;a.setView([...item.coordinates].reverse(),Math.max(a.getZoom(),14),{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});return;}if(!map||!lib||!ready)return;
  map.easeTo({center:item.coordinates,zoom:Math.max(map.getZoom(),14),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:650});
}
export function resizeMap() { if(map) map.resize();if(alternateMap)alternateMap.instance.invalidateSize({pan:false}); }
export function isMapReady() { return !!(map||alternateMap)&&ready; }


// Mapa independiente dentro de la ventana emergente de una publicación.
// No cambia el mapa principal ni provoca desplazamiento de la página.
let previewMap = null;
let previewRequest=0;
export function destroyLocationPreview(){
  previewRequest++;
  if (previewMap) { previewMap.remove(); previewMap=null; }
}
export async function createLocationPreview(item, {onLoad, onFail}={}) {
  destroyLocationPreview();
  const request=previewRequest;
  const coordinates = item?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length!==2) { onFail?.(); return false; }
  try {
    if (!lib) lib=await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    if(request!==previewRequest || document.getElementById('location-overlay').hidden) return false;
    // El overlay ya debe estar visible antes de inicializar MapLibre.
    previewMap=new lib.Map({
      container:'location-mini-map', center:coordinates, zoom:16.3, minZoom:10, maxZoom:19,
      attributionControl:false,
      style:{version:8,
        sources:{osm:{type:'raster',tiles:[TILES_URL],tileSize:256,
          attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}},
        layers:[{id:'base',type:'raster',source:'osm'}]
      }
    });
    previewMap.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
    previewMap.addControl(new lib.AttributionControl({compact:true}),'bottom-left');
    const marker=document.createElement('div');
    marker.className='location-preview-anchor';
    marker.setAttribute('aria-label','Punto indicado en la publicación');
    const pin=document.createElement('span'); pin.className='location-preview-pin'; marker.append(pin);
    new lib.Marker({element:marker,anchor:'bottom'}).setLngLat(coordinates).addTo(previewMap);
    previewMap.on('load',()=>{if(request!==previewRequest)return;previewMap?.resize(); onLoad?.();});
    previewMap.on('error',e=>console.warn('Mapa de ubicación:',e?.error?.message||'Error de teselas'));
    return true;
  } catch(err) {
    console.warn('Vista rápida del mapa no disponible:',err);
    destroyLocationPreview(); onFail?.(); return false;
  }
}


// Mapa de selección para el formulario: completamente independiente del mapa superior.
let pickerMap=null;
let pickerMarker=null;
let pickerRequest=0;
export function destroyPickerMap(){
  pickerRequest++;
  if(pickerMap){pickerMap.remove();pickerMap=null;}
  pickerMarker=null;
}
export async function createPickerMap(startCoords,{onPick,onLoad,onFail}={}){
  destroyPickerMap();
  const request=pickerRequest;
  try{
    if(!lib) lib=await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    if(request!==pickerRequest || document.getElementById('picker-overlay').hidden)return false;
    pickerMap=new lib.Map({
      container:'picker-map',center:startCoords,zoom:15,minZoom:10,maxZoom:19,attributionControl:false,
      style:{version:8,sources:{osm:{type:'raster',tiles:[TILES_URL],tileSize:256,
        attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}},
        layers:[{id:'base',type:'raster',source:'osm'}]}
    });
    pickerMap.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
    pickerMap.addControl(new lib.AttributionControl({compact:true}),'bottom-left');
    const marker=document.createElement('div');
    marker.className='location-preview-anchor';
    marker.setAttribute('aria-label','Punto seleccionado, arrastrable');
    const pin=document.createElement('span');pin.className='location-preview-pin';marker.append(pin);
    pickerMarker=new lib.Marker({element:marker,anchor:'bottom',draggable:true}).setLngLat(startCoords).addTo(pickerMap);
    pickerMap.on('click',e=>{
      if(request!==pickerRequest)return;
      const coords=[e.lngLat.lng,e.lngLat.lat];
      pickerMarker?.setLngLat(coords);
      onPick?.(coords);
    });
    pickerMarker.on('dragend',()=>{
      if(request!==pickerRequest)return;
      const pos=pickerMarker.getLngLat();onPick?.([pos.lng,pos.lat]);
    });
    pickerMap.on('load',()=>{if(request!==pickerRequest)return;pickerMap?.resize();onLoad?.();});
    pickerMap.on('error',e=>console.warn('Mapa de selección:',e?.error?.message||'Error de teselas'));
    return true;
  }catch(err){
    console.warn('Selector de ubicación no disponible:',err);
    destroyPickerMap();onFail?.();return false;
  }
}
