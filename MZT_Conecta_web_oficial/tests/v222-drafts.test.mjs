import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCommerceDrafts} from '../src/commerce-drafts-v222.js';
const stored=new Map();
const storage={get length(){return stored.size},key:i=>[...stored.keys()][i],getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
const jpeg='data:image/jpeg;base64,YWJj';
const makeForm=(kind='business',id='',business='')=>{
 const initial=kind==='business'?{name:'',description:'',address:'',website:'',facebook:'',instagram:'',map_url:'',logo:''}:{title:'',body:'',target_url:'',placement:'both',starts_on:'2026-11-27',ends_on:'2026-11-27',picture:''};
 const controls=Object.fromEntries(Object.entries(initial).map(([k,v])=>[k,{value:v}]));
 const notes=new Map(['[data-draft-note]','[data-draft-photo]','[data-draft-clear]','[data-draft-remove-photo]'].map(k=>[k,{textContent:'',hidden:true}]));
 const details={open:false};
 return {dataset:{form:kind,id,business},elements:{namedItem:n=>controls[n]},querySelector:n=>notes.get(n),closest:()=>details,controls,details,reset(){for(const [k,v] of Object.entries(initial))controls[k].value=v}};
};
const create=()=>createCommerceDrafts({storage,compress:async()=>jpeg});
let draft=create();
const original=makeForm();original.controls.name.value='El Atlántico';original.controls.description.value='Mariscos frescos';original.controls.facebook.value='https://facebook.com/';draft.capture('account-a',original);
await draft.captureImage('account-a',original,{name:'logo.png'});
assert.equal(stored.size,1);
// Se reemplaza por completo el DOM y se recrea el módulo, como en una recarga.
draft=create();const replaced=makeForm();assert(draft.restore('account-a',replaced));assert.equal(replaced.controls.name.value,'El Atlántico');assert.equal(replaced.controls.description.value,'Mariscos frescos');assert.equal(replaced.controls.facebook.value,'https://facebook.com/');assert.equal(await draft.imageData('account-a',replaced,null),jpeg);
assert.match(replaced.querySelector('[data-draft-photo]').textContent,/logo.png/);
assert(!draft.restore('account-b',makeForm()));
assert(!draft.restore('account-a',makeForm('business','existing-business')));
replaced.controls.name.value='';draft.capture('account-a',replaced);
const blank=makeForm();assert(draft.restore('account-a',blank));assert.equal(blank.controls.name.value,'');
const campaign=makeForm('campaign','','business-a');campaign.controls.title.value='Promoción';campaign.controls.placement.value='feed';campaign.controls.ends_on.value='2026-12-01';draft.capture('account-a',campaign);
assert(!draft.restore('account-a',makeForm('campaign','','business-b')));
const rebuilt=makeForm('campaign','','business-a');assert(draft.restore('account-a',rebuilt));assert(rebuilt.details.open);assert.equal(rebuilt.controls.placement.value,'feed');assert.equal(rebuilt.controls.ends_on.value,'2026-12-01');
draft.removeImage('account-a',blank);assert.equal(await draft.imageData('account-a',blank,null),null);
draft.clear('account-a',rebuilt);assert(!create().restore('account-a',makeForm('campaign','','business-a')));
draft.discard('account-a',blank);assert(!create().restore('account-a',makeForm()));
// Una compresión que termina después de descartar no debe resucitar el borrador.
let finish;const race=createCommerceDrafts({storage,compress:()=>new Promise(r=>{finish=r})});
const form=makeForm();const uploading=race.captureImage('account-a',form,{name:'foto.jpg'});await Promise.resolve();race.discard('account-a',form);finish(jpeg);await uploading;assert(!create().restore('account-a',makeForm()));
draft.capture('account-a',original);draft.capture('account-b',original);draft.clearUser('account-a');assert(!create().restore('account-a',makeForm()));assert(create().restore('account-b',makeForm()));
const unavailable=createCommerceDrafts({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},compress:async()=>jpeg});unavailable.capture('account-a',original);assert(unavailable.restore('account-a',makeForm()));
const source=readFileSync(new URL('../src/commerce-v222.js',import.meta.url),'utf8');assert(source.includes("panel.addEventListener('input'"));assert(source.includes('restoreDrafts(uid)'));assert(source.includes('drafts.clear(uid,form)'));assert(source.includes('drafts.imageData(uid,form'));
console.log('Pruebas de recuperación de borradores tras reconstrucción y recarga correctas');
