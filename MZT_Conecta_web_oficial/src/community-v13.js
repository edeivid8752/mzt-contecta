// Selector HSV propio. Sin dependencias ni datos remotos.
const clamp=x=>Math.max(0,Math.min(1,x));
export function hsvToHex(h,s,v){
 h=((h%360)+360)%360;s=clamp(s);v=clamp(v);
 const f=n=>{const k=(n+h/60)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1))));};
 return '#'+[f(5),f(3),f(1)].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function hexToHsv(hex){
 if(!/^#[0-9a-f]{6}$/i.test(hex))return null;
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const v=Math.max(r,g,b),d=v-Math.min(r,g,b);
 return {h:d===0?0:60*(v===r?((g-b)/d+6)%6:v===g?(b-r)/d+2:(r-g)/d+4),s:v?d/v:0,v};
}
export function installColorPicker(panel){
 panel.addEventListener('click',e=>{
  const trigger=e.target.closest('[data-hsv-pick]');if(!trigger)return;
  const key=trigger.dataset.hsvPick,input=panel.querySelector('input[name="'+key+'"]');
  if(!input)return;
  const original=input.value;let {h,s,v}=hexToHsv(original)||{h:0,s:0,v:1};
  const dialog=document.createElement('dialog');dialog.className='hsv-dialog';
  dialog.innerHTML='<form method="dialog" class="hsv-form"><header><h2>Seleccionar color</h2><button type="submit" value="cancel" aria-label="Cerrar">×</button></header><div class="hsv-square" tabindex="0" aria-label="Saturación y brillo. Usa las flechas para ajustar."><span class="hsv-cursor"></span></div><label>Tono<input class="hsv-hue" type="range" min="0" max="359" step="1" aria-label="Tono"></label><div class="hsv-values"><span class="hsv-preview"></span><label>HEX<input class="hsv-hex" maxlength="7" spellcheck="false"></label><label>RGB<output class="hsv-rgb"></output></label></div><div class="hsv-actions"><button type="button" class="hsv-reset">Restablecer</button><button type="submit" value="apply" class="theme-apply">Elegir color</button></div></form>';
  document.body.append(dialog);
  const $=q=>dialog.querySelector(q),square=$('.hsv-square'),hex=$('.hsv-hex'),hue=$('.hsv-hue');
  function paint(){const color=hsvToHex(h,s,v);square.style.backgroundColor='hsl('+h+',100%,50%)';$('.hsv-cursor').style.left=s*100+'%';$('.hsv-cursor').style.top=(1-v)*100+'%';hue.value=Math.round(h)%360;hex.value=color;hex.setCustomValidity('');$('.hsv-preview').style.backgroundColor=color;$('.hsv-rgb').textContent=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(', ');}
  function move(e){const r=square.getBoundingClientRect();s=clamp((e.clientX-r.left)/r.width);v=1-clamp((e.clientY-r.top)/r.height);paint();}
  square.addEventListener('pointerdown',e=>{square.setPointerCapture(e.pointerId);move(e);});
  square.addEventListener('pointermove',e=>{if(square.hasPointerCapture(e.pointerId))move(e);});
  square.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();s=clamp(s+(e.key==='ArrowRight'?.02:e.key==='ArrowLeft'?-.02:0));v=clamp(v+(e.key==='ArrowUp'?.02:e.key==='ArrowDown'?-.02:0));paint();});
  hue.addEventListener('input',()=>{h=+hue.value;paint();});
  hex.addEventListener('input',()=>{const x=hexToHsv(hex.value);hex.setCustomValidity(x?'':'Introduce un color HEX de seis dígitos.');if(x){({h,s,v}=x);paint();}});
  $('.hsv-reset').addEventListener('click',()=>{({h,s,v}=hexToHsv(original));paint();});
  dialog.addEventListener('close',()=>{if(dialog.returnValue==='apply'){const c=hsvToHex(h,s,v);input.value=c;trigger.style.backgroundColor=c;panel.querySelector('[data-hex-for="'+key+'"]').textContent=c;}dialog.remove();if(trigger.isConnected)trigger.focus();},{once:true});
  dialog.querySelector('button[value="cancel"]').formNoValidate=true;
  paint();dialog.showModal();
 });
}
export function selectFollowing(posts,ids,authorFor){const authors=new Set(ids);return posts.filter(p=>authors.has(authorFor(p)));}
