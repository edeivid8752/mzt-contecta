import {getAuthClient} from './auth.js';
import {getCaptchaToken} from './turnstile-v23.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
const ok=r=>{if(r.error)throw Error(r.error.message||'No fue posible completar la operación.');return r.data;};
async function api(){const c=await getAuthClient();if(!c)throw Error('No hay conexión con Supabase.');return c;}
let anonymousClient,sessionJob;
async function visitorClient(){
 if(!anonymousClient)anonymousClient=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'mzt-visitor-v23',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{anonymousClient=null;throw e;});
 return anonymousClient;
}
async function visitorSession(){
 if(sessionJob)return sessionJob;
 sessionJob=(async()=>{
  const c=await visitorClient();
  const session=ok(await c.auth.getSession()).session;
  if(session){const u=ok(await c.auth.getUser()).user;if(u?.is_anonymous===true)return {c,uid:u.id};throw Error('La sesión de visitante no es válida.');}
  const captchaToken=await getCaptchaToken();
  const r=await c.auth.signInAnonymously({options:{captchaToken}});
  if(r.error){if(r.error.code==='anonymous_provider_disabled')throw Error('Las publicaciones de visitantes todavía no están habilitadas.');throw Error(r.error.message);}
  if(!r.data.user?.is_anonymous)throw Error('No se pudo verificar la sesión de visitante.');
  return {c,uid:r.data.user.id};
 })().finally(()=>{sessionJob=null;});
 return sessionJob;
}
export async function submitVisitorPost(input,photo){
 const {c,uid}=await visitorSession();
 let path;
 try{
  let photo_url=null;
  if(photo){
   const blob=await (await fetch(photo)).blob();
   if(blob.type!=='image/jpeg'||blob.size>4*1024*1024)throw Error('Imagen no válida.');
   path=uid+'/'+crypto.randomUUID()+'.jpg';
   ok(await c.storage.from('mzt-media').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'}));
   photo_url=c.storage.from('mzt-media').getPublicUrl(path).data.publicUrl;
  }
  return ok(await c.from('mzt_posts').insert({...input,user_id:uid,photo_url,review:'pending'}).select('id').single());
 }catch(e){if(path)try{await c.storage.from('mzt-media').remove([path]);}catch{}throw e;}
}
export async function reportSnapshot(ids){if(!ids.length)return {};return ok(await (await api()).rpc('mzt_report_snapshot',{p_ids:ids.slice(0,500)}))||{};}
export async function zones(){return (ok(await (await api()).from('mzt_zone_alerts').select('zone').order('zone'))||[]).map(x=>x.zone);}
export async function zoneSet(zone,enabled){ok(await (await api()).rpc('mzt_zone_alert_set',{p_zone:zone,p_enabled:enabled}));}
export async function reportAction(action,id){const rpc={track:'mzt_report_track',confirm:'mzt_confirm_report'}[action];if(!rpc)throw Error('Acción inválida.');ok(await (await api()).rpc(rpc,{p_post:id}));}
export const trackedType=p=>['citizen','infrastructure'].includes(p.type);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>new Set(norm(s).split(' ').filter(x=>x.length>=3&&!['que','para','con','del','los','las','una','por','hay','esta','está'].includes(x)));
export function distanceMeters(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||![...a,...b].every(Number.isFinite))return Infinity;
 const r=Math.PI/180,dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r;
 const h=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function similarReports(items,input){
 const query=tokens(input.title+' '+input.description);
 return items.filter(p=>p.review==='approved'&&!p.resolvedAt&&p.type===input.type&&norm(p.category)===norm(input.category)).map(p=>{
  const candidate=tokens(p.title+' '+p.description),overlap=[...query].filter(x=>candidate.has(x)).length;
  const score=overlap/Math.max(1,Math.min(query.size,candidate.size));
  const distance=distanceMeters(input.coordinates,p.coordinates);
  return {post:p,score,distance,match:(query.size>0&&candidate.size>0&&score>=.55&&(overlap>=2||norm(p.title)===norm(input.title)))||distance<=300};
 }).filter(p=>p.match).sort((a,b)=>b.score-a.score||a.distance-b.distance).slice(0,5);
}
export const labels={pending:'Recibido · en revisión',reviewed:'Revisado',approved:'Publicado',tracking:'En seguimiento',resolved:'Resuelto',rejected:'Rechazado'};
export function reportProgress(post,record={}){
 const events=(record.history||[]).filter(e=>labels[e.state]&&Number.isFinite(Date.parse(e.at))).slice();
 const legacy=[['pending',post.createdAt],['reviewed',post.reviewedAt],['approved',post.approvedAt],['resolved',post.resolvedAt]];
 for(const [state,at] of legacy)if(at&&!events.some(e=>e.state===state))events.push({state,at,legacy:true});
 if(post.review==='approved'&&!events.some(e=>e.state==='approved'))events.push({state:'approved',at:post.createdAt,legacy:true});
 events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 let state=post.review;
 if(post.resolvedAt)state='resolved';
 else if(post.review==='approved'&&events.at(-1)?.state==='tracking')state='tracking';
 const start=Date.parse(post.createdAt),resolved=events.filter(e=>e.state==='resolved').at(-1);
 const end=resolved?Date.parse(resolved.at):Date.now();
 const days=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,Math.floor((end-start)/86400000)):null;
 return {state,events,days,confirmations:record.confirmations??null,confirmed:!!record.confirmed};
}
