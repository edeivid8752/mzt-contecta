// Capa de datos de MZT Conecta v1.0. Solo clave publicable, nunca service_role.
import {getAuthClient} from './auth.js';
const BUCKET='mzt-media';
const fail=(r)=>{if(r.error)throw Error(r.error.message||'Error de Supabase');return r.data;};
async function client(){const c=await getAuthClient();if(!c)throw Error('Configura tu conexión de Supabase.');return c;}
export async function loadCommunity(){
 const c=await client();
 // Consultas limitadas: para comunidades mayores se implementará paginación.
 const [profiles,posts,comments,follows,votes]=await Promise.all([
  c.from('profiles').select('id,display_name,username,bio,avatar_url,cover_url').order('created_at',{ascending:false}).limit(500),
  c.from('mzt_posts').select('*').order('created_at',{ascending:false}).limit(500),
  c.from('mzt_comments').select('id,post_id,user_id,body,created_at').order('created_at',{ascending:false}).limit(1000),
  c.from('mzt_follows').select('follower_id,followed_id').limit(2000),
  c.from('mzt_votes').select('post_id,user_id').limit(2000)
 ]);
 const localDate=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const mapPost=p=>({id:p.id,type:p.type,title:p.title,description:p.description||'',category:p.category,location:p.location||'Toda la ciudad',
  coordinates:p.longitude==null||p.latitude==null?null:[p.longitude,p.latitude],day:localDate(p.created_at),
  clock:new Date(p.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false}),
  createdAt:p.created_at,review:p.review,reviewedAt:p.reviewed_at,approvedAt:p.approved_at,resolvedAt:p.resolved_at,
  rejectionReason:p.rejection_reason,image:p.photo_url,sourceName:p.source_name,sourceUrl:p.source_url,
  owner:'remote',ownerUserId:p.user_id});
 return {people:fail(profiles).map(p=>({id:p.id,name:p.display_name,username:p.username,bio:p.bio||'',avatar:p.avatar_url,cover:p.cover_url})),
  items:fail(posts).map(mapPost),comments:fail(comments).map(c=>({id:c.id,postId:c.post_id,authorId:c.user_id,text:c.body,createdAt:c.created_at})),
  follows:fail(follows).map(f=>({from:f.follower_id,to:f.followed_id})),votes:fail(votes).map(v=>({postId:v.post_id,userId:v.user_id}))};
}
export async function createPost(input){const c=await client();return fail(await c.from('mzt_posts').insert(input).select('id').single());}
export async function updateProfileServer(id,fields){const c=await client();return fail(await c.from('profiles').update(fields).eq('id',id).select('id,display_name,username,bio,avatar_url,cover_url').single());}
export async function createCommentServer(postId,userId,body){const c=await client();return fail(await c.from('mzt_comments').insert({post_id:postId,user_id:userId,body}).select('id').single());}
export async function deleteCommentServer(id){const c=await client();fail(await c.from('mzt_comments').delete().eq('id',id));}
export async function followServer(from,to,following){const c=await client();if(following)fail(await c.from('mzt_follows').delete().eq('follower_id',from).eq('followed_id',to));
 else fail(await c.from('mzt_follows').insert({follower_id:from,followed_id:to}));}
export async function voteServer(postId,userId,voted){const c=await client();if(voted)fail(await c.from('mzt_votes').delete().eq('post_id',postId).eq('user_id',userId));
 else fail(await c.from('mzt_votes').insert({post_id:postId,user_id:userId}));}
export async function moderatePostServer(id,decision,reason=null){const c=await client();fail(await c.rpc('mzt_moderate_post',{p_post:id,p_decision:decision,p_reason:reason}));}
export async function resolvePostServer(id){const c=await client();fail(await c.rpc('mzt_resolve_post',{p_post:id}));}
export async function uploadImageServer(userId,blob){
 if(!userId||!blob||blob.size>4*1024*1024||blob.type!=='image/jpeg')throw Error('Imagen no válida o demasiado grande.');
 const c=await client();const path=`${userId}/${crypto.randomUUID()}.jpg`;
 fail(await c.storage.from(BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'}));
 return c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
export async function uploadDataImage(userId,dataUrl){const blob=await (await fetch(dataUrl)).blob();return uploadImageServer(userId,blob);}
export async function removeImageServer(url){
 // Limpieza solo de imágenes antiguas del mismo bucket; las políticas Storage comprueban el propietario.
 if(!url)return;
 const c=await client();const prefix=c.storage.from(BUCKET).getPublicUrl('PLACEHOLDER').data.publicUrl.replace('PLACEHOLDER','');
 if(!url.startsWith(prefix))return;
 const path=decodeURIComponent(url.slice(prefix.length));
 if(path)fail(await c.storage.from(BUCKET).remove([path]));
}
