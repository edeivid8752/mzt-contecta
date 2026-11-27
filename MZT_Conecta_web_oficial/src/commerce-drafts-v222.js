// Borradores privados de la pestaña. No se envían al servidor hasta confirmar el formulario.
const PREFIX='mzt:commerce-draft:';
const AGE=24*60*60*1000;
const fields={
 business:['name','description','address','website','facebook','instagram','map_url'],
 campaign:['title','body','target_url','placement','starts_on','ends_on']
};
export function createCommerceDrafts({compress,notify=()=>{},storage}={}){
 if(storage===undefined){try{storage=globalThis.sessionStorage;}catch{}}
 const memory=new Map(),pending=new Map();
 const key=(uid,form)=>uid&&fields[form?.dataset?.form]?PREFIX+encodeURIComponent(uid)+':'+JSON.stringify([form.dataset.form,form.dataset.id||'',form.dataset.business||'']):'';
 function read(k){
  if(!k)return null;
  let d=memory.get(k);
  if(!d){try{d=JSON.parse(storage?.getItem(k)||'null');}catch{}}
  if(!d)return null;
  if(!Number.isFinite(d.updated)||Date.now()-d.updated>AGE){remove(k);return null;}
  memory.set(k,d);return d;
 }
 function write(k,d){
  if(!k)return false;
  const next={...d,updated:Date.now()};memory.set(k,next);
  try{if(!storage)return false;storage.setItem(k,JSON.stringify(next));return true;}catch{return false;}
 }
 function remove(k){if(!k)return;pending.delete(k);memory.delete(k);try{storage?.removeItem(k);}catch{}}
 function control(form,name){return form.elements?.namedItem?.(name)||null;}
 function capture(uid,form){
  const k=key(uid,form);if(!k)return;
  const old=read(k)||{},values={};
  for(const name of fields[form.dataset.form]){const el=control(form,name);if(el)values[name]=String(el.value??'');}
  const persisted=write(k,{...old,values});
  showStatus(uid,form,persisted?'Borrador guardado en esta pestaña.':'Borrador conservado en memoria; el navegador no permite guardarlo localmente.');
 }
 function showStatus(uid,form,message){
  const k=key(uid,form);if(!k)return;
  const d=read(k),note=form.querySelector?.('[data-draft-note]'),photo=form.querySelector?.('[data-draft-photo]'),clear=form.querySelector?.('[data-draft-clear]'),removePhoto=form.querySelector?.('[data-draft-remove-photo]');
  if(note)note.textContent=message|| (d?'Borrador recuperado de esta pestaña.':'Los datos se conservan en esta pestaña hasta enviarlos.');
  if(photo)photo.textContent=d?.image?.name?'Imagen conservada: '+d.image.name:'';
  if(clear)clear.hidden=!d;
  if(removePhoto)removePhoto.hidden=!d?.image;
 }
 function restore(uid,form){
  const k=key(uid,form),d=read(k);if(!d)return false;
  for(const name of fields[form.dataset.form]){const el=control(form,name);if(el&&typeof d.values?.[name]==='string')el.value=d.values[name];}
  if(d.image||Object.keys(d.values||{}).length){const details=form.closest?.('details');if(details)details.open=true;}
  showStatus(uid,form);return true;
 }
 function captureImage(uid,form,selected){
  const k=key(uid,form);if(!k||!selected)return Promise.resolve(null);
  capture(uid,form);const d=read(k)||{};write(k,{...d,image:null});
  const token={};pending.set(k,token);
  token.promise=Promise.resolve().then(()=>compress(selected)).then(data=>{
   if(pending.get(k)!==token)return null;
   if(typeof data!=='string'||!data.startsWith('data:image/jpeg;base64,')||data.length>4*1024*1024)throw Error('No se pudo conservar la imagen.');
   const saved=write(k,{...read(k),image:{name:String(selected.name||'Imagen').slice(0,180),data}});
   showStatus(uid,form,saved?'Borrador e imagen guardados en esta pestaña.':'Imagen conservada en memoria; no se pudo guardar localmente.');
   return data;
  }).catch(error=>{
   if(pending.get(k)===token){showStatus(uid,form,'No se pudo guardar la imagen en el borrador. Selecciónala nuevamente si se pierde.');notify(error?.message||'No se pudo guardar la imagen.');}
   return null;
  }).finally(()=>{if(pending.get(k)===token)pending.delete(k);});
  return token.promise;
 }
 async function imageData(uid,form,selected){
  const k=key(uid,form);if(!k)return selected?compress(selected):null;
  const job=pending.get(k);if(job)await job.promise;
  const data=read(k)?.image?.data;
  if(selected)return data||compress(selected);
  return typeof data==='string'&&data.startsWith('data:image/jpeg;base64,')?data:null;
 }
 function removeImage(uid,form){
  const k=key(uid,form);if(!k)return;
  pending.delete(k);const d=read(k);if(d)write(k,{...d,image:null});
  const el=control(form,form.dataset.form==='business'?'logo':'picture');if(el)el.value='';
  showStatus(uid,form,'Imagen retirada del borrador.');
 }
 function discard(uid,form){remove(key(uid,form));form.reset?.();showStatus(uid,form,'Borrador descartado.');}
 function clear(uid,form){remove(key(uid,form));}
 function clearUser(uid){
  if(!uid)return;const p=PREFIX+encodeURIComponent(uid)+':';
  const keys=new Set([...memory.keys(),...pending.keys()]);
  try{for(let i=0;i<(storage?.length||0);i++)keys.add(storage.key(i));}catch{}
  for(const k of keys)if(k?.startsWith(p))remove(k);
 }
 return {capture,captureImage,restore,imageData,removeImage,discard,clear,clearUser,showStatus};
}
