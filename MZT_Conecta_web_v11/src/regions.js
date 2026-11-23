// Cartografía geográfica verificable: los polígonos deben provenir de una fuente comprobable.
// Las coordenadas son WGS84 / GeoJSON [longitud, latitud]. Sin aproximación por cercanía.
let regions={type:'FeatureCollection',features:[]};
const cleanName=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
const isPoint=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=-180&&p[0]<=180&&p[1]>=-90&&p[1]<=90;
function geometryValid(g){
 if(!g||!['Polygon','MultiPolygon'].includes(g.type))return false;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return Array.isArray(polygons)&&polygons.length>0&&polygons.every(rings=>Array.isArray(rings)&&rings.length&&rings.every(r=>Array.isArray(r)&&r.length>=4&&r.length<30000&&r.every(isPoint)));
}
export function normalizeRegions(data){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('El archivo debe contener una colección GeoJSON de polígonos.');
 if(data.features.length>3000)throw Error('El archivo tiene demasiados elementos. Exporta solo las colonias de Mazatlán.');
 const features=data.features.map((f,i)=>{
   const p=f?.properties||{};
   const name=String(p.name||p.NOM_ASEN||p.nom_asen||'').trim();
   const scope=String(p.scope||p.nivel||'colonia').toLowerCase();
   if(!name||name.length>90||!geometryValid(f.geometry))return null;
   return {type:'Feature',id:String(p.id||p.CVEGEO||f.id||i),properties:{name,scope:scope==='zona'?'zona':'colonia'},geometry:f.geometry};
 }).filter(Boolean);
 return {type:'FeatureCollection',features};
}
export function setRegions(data){ regions=normalizeRegions(data); return regions.features.length; }
export function getRegions(){return regions;}
export function regionNames(){return [...new Set(regions.features.map(f=>f.properties.name))].sort((a,b)=>a.localeCompare(b,'es'));}
export function matchingRegion(name){const q=cleanName(name);return regions.features.filter(f=>cleanName(f.properties.name)===q);}
function inRing(point,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if(((yi>point[1])!==(yj>point[1]))&&(point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi))inside=!inside;
 }return inside;
}
export function pointInGeometry(point,g){
 if(!isPoint(point)||!geometryValid(g))return false;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r)));
}
export function pointInRegion(point,name){return matchingRegion(name).some(f=>pointInGeometry(point,f.geometry));}
export function regionForPoint(point){return regions.features.find(f=>pointInGeometry(point,f.geometry))?.properties.name||null;}
export async function loadBundledRegions(){
 try{const response=await fetch('./data/mazatlan_colonias.geojson',{cache:'no-store'});if(response.ok)setRegions(await response.json());}
 catch(error){console.warn('No hay cartografía de colonias cargada:',error);}
 return regions.features.length;
}
