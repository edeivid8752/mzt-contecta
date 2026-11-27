// Vista previa exclusiva de los mapas grandes de escritorio.
const desktopQuery='(min-width: 821px) and (hover: hover) and (pointer: fine)';
export function previewAllowed(el,desktop){
 return !!(desktop&&el&&el.id==='map'&&(el.closest('#expanded-map-host')||(
 el.closest('#map-home')&&!el.closest('#map-dock')&&!el.closest('.is-mobile-docked'))));
}
export function relativeAge(createdAt,now=Date.now()){
 const timestamp=Date.parse(createdAt);if(!Number.isFinite(timestamp))return '';
 const seconds=Math.max(0,Math.floor((now-timestamp)/1000));
 if(seconds<60)return 'Hace un momento';
 const [value,unit]=seconds<3600?[Math.floor(seconds/60),'minuto']:seconds<86400?[Math.floor(seconds/3600),'hora']:[Math.floor(seconds/86400),'día'];
 return 'Hace '+value+' '+unit+(value===1?'':'s');
}
const types={social:'Social',news:'Noticia local',citizen:'Reporte ciudadano',infrastructure:'Infraestructura'};
export function installMarkerPreviews(el,map,getItem){
 const mq=matchMedia(desktopQuery);let timer=null,target=null,card=null;
 const allowed=()=>previewAllowed(el,mq.matches)&&el.isConnected&&el.getClientRects().length>0&&!document.hidden;
 function clear(){if(timer!==null)clearTimeout(timer);timer=null;target=null;card?.remove();card=null;}
 function add(parent,tag,cls,value){const node=document.createElement(tag);node.className=cls;node.textContent=String(value||'');parent.append(node);return node;}
 function show(){
  timer=null;if(!target?.isConnected||!allowed())return clear();
  const item=getItem(target.dataset.previewPost);if(!item)return clear();
  const type=Object.hasOwn(types,item.type)?item.type:'citizen';
  card=document.createElement('div');card.className='v242-map-preview';card.setAttribute('aria-hidden','true');
  const tags=document.createElement('div');tags.className='v242-preview-tags';card.append(tags);
  add(tags,'span','type-tag '+type,types[type]);if(item.category)add(tags,'span','post-topic',item.category);
  add(card,'strong','v242-preview-title',item.title);
  if(item.description)add(card,'p','v242-preview-excerpt',item.description);
  const metadata=[item.location,relativeAge(item.createdAt)].filter(Boolean).join(' · ');
  if(metadata)add(card,'small','v242-preview-meta',metadata);
  el.append(card);
  const host=el.getBoundingClientRect(),pin=target.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;
  if(pin.right<host.left||pin.left>host.right||pin.bottom<host.top||pin.top>host.bottom)return clear();
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,Math.max(lo,hi)));
  const above=pin.top-host.top-h-8, left=clamp(pin.left-host.left+pin.width/2-w/2,8,host.width-w-8), top=clamp(above>=8?above:pin.bottom-host.top+8,8,host.height-h-8);
  card.style.left=left+'px';card.style.top=top+'px';
  if(above>=8||pin.bottom-host.top+8+h<=host.height-8){card.classList.add(above>=8?'above':'below');card.style.setProperty('--preview-arrow',clamp(pin.left-host.left+pin.width/2-left,12,w-12)+'px');}
 }
 function over(e){
  if(e.pointerType!=='mouse')return;
  const pin=e.target.closest?.('.wall-pin[data-preview-post]');
  if(!pin||!el.contains(pin)||(e.relatedTarget instanceof Node&&pin.contains(e.relatedTarget))||pin===target)return;
  clear();if(!allowed())return;target=pin;timer=setTimeout(show,500);
 }
 function out(e){if(target&&target.contains(e.target)&&!(e.relatedTarget instanceof Node&&target.contains(e.relatedTarget)))clear();}
 function refresh(){if(target&&(!allowed()||!target.isConnected||!getItem(target.dataset.previewPost)))clear();}
 const observer=new MutationObserver(()=>{if(target&&!target.isConnected)clear();});
 observer.observe(el,{childList:true,subtree:true});
 el.addEventListener('pointerover',over);el.addEventListener('pointerout',out);el.addEventListener('pointerleave',clear);el.addEventListener('pointerdown',clear);
 map.on('movestart zoomstart',clear);mq.addEventListener('change',clear);window.addEventListener('resize',clear);document.addEventListener('visibilitychange',clear);
 return {clear,refresh,dispose(){clear();observer.disconnect();el.removeEventListener('pointerover',over);el.removeEventListener('pointerout',out);el.removeEventListener('pointerleave',clear);el.removeEventListener('pointerdown',clear);map.off('movestart zoomstart',clear);mq.removeEventListener('change',clear);window.removeEventListener('resize',clear);document.removeEventListener('visibilitychange',clear);}};
}
