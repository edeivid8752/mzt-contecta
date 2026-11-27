// Capa de datos de MZT Conecta v1.2. Solo clave publicable, nunca service_role.
import {getAuthClient} from './auth.js';
import {parseRoute} from './router-v21.js';
const BUCKET='mzt-media';
const fail=(r)=>{if(r.error)throw Error(r.error.message||'Error de Supabase');return r.data;};
async function client(){const c=await getAuthClient();if(!c)throw Error('Configura tu conexión de Supabase.');return c;}
export async function loadCommunity(visitor=false){
 const c=await client();
 if(visitor){
  const raw=fail(await c.rpc('mzt_public_feed',{p_post:sharedPostId()}));
  return {people:raw.profiles.map(p=>({id:p.id,name:p.display_name,username:p.username,avatar:p.avatar_url})),items:raw.posts.map(p=>mapV13Post(p)),comments:raw.comments.map(mapV13Comment),follows:[],votes:[],voteCounts:raw.counts,saved:[],notifications:[],flags:[],commentVotes:[]};
 }
 // Consultas limitadas: para comunidades mayores se implementará paginación.
 const [profiles,posts,comments,follows,votes,saved,notifications,flags,commentVotes]=await Promise.all([
  c.from('profiles').select('id,display_name,username,bio,avatar_url,cover_url').order('created_at',{ascending:false}).limit(500),
  c.from('mzt_posts').select('*').order('created_at',{ascending:false}).limit(500),
  c.from('mzt_comments').select('id,post_id,user_id,body,created_at,parent_id,edited_at').order('created_at',{ascending:false}).limit(1000),
  c.from('mzt_follows').select('follower_id,followed_id').limit(2000),
  c.from('mzt_votes').select('post_id,user_id').limit(2000),
  c.from('mzt_saved').select('post_id').limit(1000),
  c.from('mzt_notifications').select('id,kind,post_id,created_at,read_at').order('created_at',{ascending:false}).limit(100),
  c.from('mzt_flags').select('id,post_id,comment_id,reason,status,created_at').order('created_at',{ascending:false}).limit(200),
  c.from('mzt_comment_votes').select('comment_id,user_id').limit(2000)
 ]);
 // Se consulta la publicación enlazada aunque no esté en la primera página.
 const postRows=fail(posts);const shared=sharedPostId();if(shared&&!postRows.some(p=>p.id===shared)){const extra=fail(await c.from('mzt_posts').select('*').eq('id',shared).maybeSingle());if(extra)postRows.unshift(extra);}
 return {people:fail(profiles).map(p=>({id:p.id,name:p.display_name,username:p.username,bio:p.bio||'',avatar:p.avatar_url,cover:p.cover_url})),
  items:postRows.map(p=>mapV13Post(p)),comments:fail(comments).map(mapV13Comment),saved:fail(saved).map(p=>p.post_id),notifications:fail(notifications),flags:fail(flags),commentVotes:fail(commentVotes),
  follows:fail(follows).map(f=>({from:f.follower_id,to:f.followed_id})),votes:fail(votes).map(v=>({postId:v.post_id,userId:v.user_id}))};
}
export async function createPost(input){const c=await client();return fail(await c.from('mzt_posts').insert(input).select('id').single());}
export async function updateProfileServer(id,fields){const c=await client();return fail(await c.from('profiles').update(fields).eq('id',id).select('id,display_name,username,bio,avatar_url,cover_url').single());}
export async function createCommentServer(postId,userId,body,parentId=null){const c=await client();return fail(await c.from('mzt_comments').insert({post_id:postId,user_id:userId,body,parent_id:parentId}).select('id').single());}
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

function sharedPostId(){const r=parseRoute(location.pathname,location.search);return r.view==='publicacion'?r.id:null;}
function mapV13Post(p){
 const localDate=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 return (p=>({id:p.id,type:p.type,title:p.title,description:p.description||'',category:p.category,location:p.location||'Toda la ciudad',
  coordinates:p.longitude==null||p.latitude==null?null:[p.longitude,p.latitude],day:localDate(p.created_at),
  clock:new Date(p.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false}),
  createdAt:p.created_at,review:p.review,reviewedAt:p.reviewed_at,approvedAt:p.approved_at,resolvedAt:p.resolved_at,
  eventDay:p.event_day||null,rejectionReason:p.rejection_reason,image:p.photo_url,sourceName:p.source_name,sourceUrl:p.source_url,
  visitorPost:!!p.visitor_post,alertZone:p.alert_zone||'',owner:'remote',ownerUserId:p.user_id}))(p);
}
function mapV13Comment(c){return {id:c.id,postId:c.post_id,authorId:c.user_id,text:c.body,createdAt:c.created_at,parentId:c.parent_id||null,editedAt:c.edited_at||null};}
export async function socialAction(kind,id,user,extra){
 const c=await client();let q;
 switch(kind){
 case 'save':q=extra?c.from('mzt_saved').delete().eq('post_id',id).eq('user_id',user):c.from('mzt_saved').insert({post_id:id,user_id:user});break;
 case 'read':q=c.from('mzt_notifications').update({read_at:new Date().toISOString()}).eq('id',id);break;
 case 'flag-post':case 'flag-comment':q=c.from('mzt_flags').insert({user_id:user,[kind==='flag-post'?'post_id':'comment_id']:id,reason:extra});break;
 case 'review-flag':q=c.from('mzt_flags').update({status:'reviewed'}).eq('id',id);break;
 case 'edit-post':q=c.from('mzt_posts').update(extra).eq('id',id).eq('user_id',user).select('id').single();break;
 case 'delete-post':q=c.from('mzt_posts').delete().eq('id',id).eq('user_id',user).select('id').single();break;
 case 'edit-comment':q=c.from('mzt_comments').update({body:extra}).eq('id',id).eq('user_id',user).select('id').single();break;
 case 'vote-comment':q=extra?c.from('mzt_comment_votes').delete().eq('comment_id',id).eq('user_id',user):c.from('mzt_comment_votes').insert({comment_id:id,user_id:user});break;
 default:throw Error('Acción no válida');
 }
 return fail(await q);
}

export async function loadNotificationsV13(){const c=await client();return fail(await c.from('mzt_notifications').select('id,kind,post_id,created_at,read_at').order('created_at',{ascending:false}).limit(100));}
