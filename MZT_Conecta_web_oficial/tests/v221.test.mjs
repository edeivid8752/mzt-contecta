import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.equal((html.match(/id="commerce-panel"/g)||[]).length,1);
assert(!html.includes('id="ads-panel"'));
const source=readFileSync(new URL('../src/commerce-v222.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert(main.includes("$('#commerce-panel').hidden=!commercial"));
assert(main.includes("ads.show(view).catch"));
const elements=new Map();
function element(){return {hidden:false,innerHTML:'',querySelectorAll:()=>[],replaceChildren(){this.innerHTML='';},addEventListener(){},insertAdjacentHTML(){}};}
for(const s of ['#commerce-panel','#ad-sidebar','#feed-content','.app-shell'])elements.set(s,element());
globalThis.document={querySelector:s=>elements.get(s),addEventListener(){},querySelectorAll:()=>[],hidden:false};
globalThis.window={};
let uid='user-a',which='business',level='owner',failure=false,delay=null;
globalThis.testCommerceClient={
 from(table){return {select(){return this;},eq(){return this;},order(){return this;},maybeSingle:async()=>({data:level?{access_level:level}:null,error:null}),limit:async()=>{if(delay)await delay;return failure?{error:{message:'Conexión interrumpida'}}:{data:[],error:null};}};},
 async rpc(name){return {data:[],error:null};}
};
const code=source.replace(/^import .*$/gm,'').replace('export function createAds','function createAds').replaceAll('export function ','function ');
const build=Function('getAuthClient','uploadDataImage','removeImageServer','setInterval',code+';return createAds;');
const createAds=build(async()=>globalThis.testCommerceClient,async()=>{},async()=>{},()=>{});
const panel=elements.get('#commerce-panel');
const instance=createAds({user:()=>uid,view:()=>which,nav(){},toast(){},compress(){},login(){},navigate(){}});
await instance.show('business');
assert.equal(panel.hidden,false);
assert.match(panel.innerHTML,/Mi negocio/);
assert.match(panel.innerHTML,/Registrar establecimiento/);
assert.match(panel.innerHTML,/Enviar a revisión/);
await instance.sync();
which='ad-admin';
await instance.show(which);
assert.equal(panel.hidden,false);
assert.match(panel.innerHTML,/Administración de publicidad/);
assert.match(panel.innerHTML,/0 negocios/);
assert.match(panel.innerHTML,/No hay campañas registradas/);
assert.match(panel.innerHTML,/Accesos administrativos/);
failure=true;await instance.show(which,{force:true});
assert.match(panel.innerHTML,/Conexión interrumpida/);
assert.match(panel.innerHTML,/Reintentar/);
failure=false;level='';uid='user-b';await instance.sync();await instance.show(which);
assert.match(panel.innerHTML,/No tienes acceso/);
which='business';let release;delay=new Promise(r=>{release=r;});
const loading=instance.show(which);assert.match(panel.innerHTML,/Cargando información comercial/);
which='explorar';instance.leave();release();await loading;assert.equal(panel.hidden,true);
delay=null;which='business';await instance.show(which);assert.equal(panel.hidden,false);assert.match(panel.innerHTML,/Registrar establecimiento/);
which='advertise';await instance.show(which);assert.match(panel.innerHTML,/Espacios publicitarios/);
console.log('Pruebas de renderizado y recuperación comercial v2.2.1 correctas');
