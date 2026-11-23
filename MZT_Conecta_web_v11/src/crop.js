// Ajuste de foto y portada. La pantalla principal sube la imagen recortada a Supabase.
let active=null;
const $=s=>document.querySelector(s);
const canvas=$('#crop-canvas');
const ctx=canvas.getContext('2d');
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function draw(){
  if(!active)return;
  const {img}=active,w=canvas.width,h=canvas.height;
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)*active.zoom;
  const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  active.x=clamp(active.x,-Math.max(0,(iw-w)/2),Math.max(0,(iw-w)/2));
  active.y=clamp(active.y,-Math.max(0,(ih-h)/2),Math.max(0,(ih-h)/2));
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(img,(w-iw)/2+active.x,(h-ih)/2+active.y,iw,ih);
}
function close(){
  $('#crop-overlay').hidden=true;
  if(active){URL.revokeObjectURL(active.url);active=null;}
}
export async function editImage(file,kind,onSave){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Elige una imagen JPG, PNG o WebP.');
  if(file.size>4*1024*1024)throw Error('La imagen no debe superar 4 MB.');
  close();
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    if(!img.naturalWidth||!img.naturalHeight)throw Error('No se pudo abrir la imagen.');
    const cover=kind==='cover';canvas.width=cover?600:400;canvas.height=cover?240:400;
    canvas.classList.toggle('crop-wide',cover);
    $('#crop-title').textContent=cover?'Ajustar foto de portada':'Ajustar foto de perfil';
    $('#crop-hint').textContent=cover?'Arrastra la imagen para encuadrar tu portada.':'Arrastra la fotografía para centrarla dentro del círculo.';
    $('#crop-zoom').value='1';
    active={img,url,kind,onSave,zoom:1,x:0,y:0,drag:null};
    $('#crop-message').textContent='';
    draw();$('#crop-overlay').hidden=false;$('#crop-dialog').focus();
  }catch(e){URL.revokeObjectURL(url);throw e;}
}
canvas.addEventListener('pointerdown',e=>{
  if(!active)return;
  canvas.setPointerCapture(e.pointerId);
  active.drag={px:e.clientX,py:e.clientY,x:active.x,y:active.y};
});
canvas.addEventListener('pointermove',e=>{
  if(!active?.drag)return;
  const rect=canvas.getBoundingClientRect();
  active.x=active.drag.x+(e.clientX-active.drag.px)*canvas.width/rect.width;
  active.y=active.drag.y+(e.clientY-active.drag.py)*canvas.height/rect.height;
  draw();
});
canvas.addEventListener('pointerup',()=>{if(active)active.drag=null;});
canvas.addEventListener('pointercancel',()=>{if(active)active.drag=null;});
canvas.addEventListener('wheel',e=>{
  if(!active)return;
  e.preventDefault();
  active.zoom=clamp(active.zoom+(e.deltaY<0?.12:-.12),1,3);
  $('#crop-zoom').value=String(active.zoom);draw();
},{passive:false});
$('#crop-zoom').addEventListener('input',e=>{if(active){active.zoom=Number(e.target.value);draw();}});
$('#crop-reset').addEventListener('click',()=>{if(active){active.zoom=1;active.x=0;active.y=0;$('#crop-zoom').value='1';draw();}});
$('#crop-cancel').addEventListener('click',close);
$('#crop-close').addEventListener('click',close);
$('#crop-overlay').addEventListener('click',e=>{if(e.target.id==='crop-overlay')close();});
$('#crop-save').addEventListener('click',()=>{
  if(!active)return;
  draw();
  const result=canvas.toDataURL('image/jpeg',active.kind==='cover'?.72:.77);
  try{active.onSave(result);close();}catch(e){$('#crop-message').textContent=e.message;}
});
export function closeCrop(){close();}
