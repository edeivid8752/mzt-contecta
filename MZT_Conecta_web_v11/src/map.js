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

const markerFor = item => {
  const el = document.createElement('button');
  el.type='button';
  el.className = `map-point point-${item.type}${item.resolvedAt ? ' point-resolved' : ''}${selected===item.id?' selected':''}`;
  el.setAttribute('aria-label',item.title);
  el.title=item.title;
  el.innerHTML = `<span></span>`;
  el.addEventListener('click',e=>{ e.stopPropagation(); onItemClick?.(item.id); });
  return el;
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
    map.addControl(new lib.NavigationControl({showCompass:false}), 'bottom-right');
    map.addControl(new lib.AttributionControl({compact:true}), 'bottom-left');
    map.on('load',()=> { ready=true; mountRegionLayers(); setMapItems(lastItems,selected); });
    map.on('error',e=>{ console.warn('Mapa:',e?.error?.message||'Error de teselas'); });
    return true;
  } catch(err) {
    console.error('MapLibre no disponible:', err);
    onFail?.(); return false;
  }
}

export function setMapItems(items, selectedId) {
  lastItems=items;
  selected=selectedId;
  if (!map||!lib||!ready) return;
  for(const mk of markers) mk.remove();
  markers=[];
  for (const item of items) {
    if (!Array.isArray(item.coordinates) || item.coordinates.length !== 2) continue;
    const mk = new lib.Marker({element:markerFor(item),anchor:'center'})
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
  if(!map||!ready)return;
  const src=map.getSource('mzt-regions');
  if(src)src.setData(getRegions());else mountRegionLayers();
  updateRegionLabels();
}
export function setSelectedRegion(name){
  highlightedRegion=name||null;
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
export function getMainMapView(){return map?{center:[map.getCenter().lng,map.getCenter().lat],zoom:map.getZoom()}:null;}
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
  if (!map || !lib || !item?.coordinates) return;
  map.flyTo({center:item.coordinates, zoom:Math.max(map.getZoom(),14), essential:true, speed:1.1});
}
export function resizeMap() { if(map) map.resize(); }
export function isMapReady() { return !!map&&ready; }


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
