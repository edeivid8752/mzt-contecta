// Lógica de novedades y visor móvil, sin nuevas dependencias ni cambios de permisos.
export function officialToday(p,today){return !!(p?.review==='approved'&&p.type==='news'&&p.dailyDay<=today&&(p.dailyUntil||p.dailyDay)>=today);}
export function newApprovedIds(before,after){const seen=new Set(before.filter(p=>p.review==='approved').map(p=>p.id));return [...new Set(after.filter(p=>p.review==='approved'&&!seen.has(p.id)).map(p=>p.id))];}
export function installPhotoViewer(dialog,mobile){
 const stage=dialog.querySelector('.v243-photo-stage'),img=stage.querySelector('img'),pointers=new Map();
 let scale=1,x=0,y=0,start=null,previousFocus=null,lastTap=0;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function paint(){const limitX=stage.clientWidth*(scale-1)/2,limitY=stage.clientHeight*(scale-1)/2;x=clamp(x,-limitX,limitX);y=clamp(y,-limitY,limitY);img.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';}
 function baseline(){const a=[...pointers.values()];start=a.length>=2?{distance:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)),scale,x,y}:a.length?{px:a[0].x,py:a[0].y,x,y,scale}:null;}
 function reset(){pointers.clear();start=null;scale=1;x=y=0;lastTap=0;paint();}
 document.addEventListener('click',e=>{
  if(!mobile.matches||e.ctrlKey||e.metaKey||e.shiftKey)return;
  const photo=e.target.closest?.('img.post-image,img.post-detail-image');if(!photo||!photo.src)return;
  e.preventDefault();e.stopImmediatePropagation();previousFocus=document.activeElement;img.src=photo.currentSrc||photo.src;img.alt=photo.alt||'Fotografía de publicación';reset();if(!dialog.open)dialog.showModal();dialog.querySelector('[data-photo-close]').focus();
 },true);
 dialog.querySelector('[data-photo-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{reset();img.removeAttribute('src');previousFocus?.focus?.({preventScroll:true});});
 mobile.addEventListener('change',()=>{if(!mobile.matches&&dialog.open)dialog.close();});
 stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.pointerType!=='mouse')return;stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});baseline();});
 stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!start)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pointers.values()];if(a.length>=2&&start.distance){scale=clamp(start.scale*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/start.distance,1,4);}else if(a.length===1&&start.px!==undefined){x=start.x+a[0].x-start.px;y=start.y+a[0].y-start.py;}paint();});
 function end(e){if(!pointers.has(e.pointerId))return;const tap=e.type==='pointerup'&&pointers.size===1&&start?.px!==undefined&&Math.hypot(e.clientX-start.px,e.clientY-start.py)<12;pointers.delete(e.pointerId);baseline();if(tap){const now=Date.now();if(now-lastTap<300){scale=scale>1?1:2;x=y=0;paint();lastTap=0;}else lastTap=now;}}
 stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
}
