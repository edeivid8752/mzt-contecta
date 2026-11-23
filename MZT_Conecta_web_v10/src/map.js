// Mapa real MapLibre + teselas OpenStreetMap. Requiere Internet; no hay descargas masivas.
// Para producción deberá contratarse un proveedor apropiado y configurarse la variable TILES_URL.
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTER = [-106.429, 23.241];
let lib = null;
let map = null;
let markers = [];
let lastItems = [];
let onItemClick = null;
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

export async function initMap({onSelect, onFail}) {
  onItemClick = onSelect;
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
    map.on('load',()=> { ready=true; setMapItems(lastItems,selected); });
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
