import {getAuthClient} from './auth.js';
import {threadPath,slug} from './router-v21.js';
const categories=['Infraestructura','Qué hacer','Ideas para Mazatlán','Playas','Comunidad','Movilidad','Otros'];
const forumCategoryTone=category=>['infra','activity','ideas','beach','community','mobility','other'][categories.indexOf(category)]||'other';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(){const c=await getAuthClient();if(!c)throw Error('No fue posible conectar con el foro.');return c;}
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
export function createForum(root,ctx){
 let topic='all',sort='popular',thread=null,snapshot={threads:[],replies:[]},request=0,busy=false,identity='';
 let deleteDialog=null;
 const canDelete=()=>!!ctx.user()&&ctx.role?.()==='editor';
 const who=t=>esc(t.display_name)+' · @'+esc(t.username);
 const when=t=>t.created_at?esc(new Date(t.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short',timeZone:'America/Mazatlan'})):'Sin fecha';
 function row(t){return '<article class="forum-card"><div class="forum-votes"><button type="button" data-vote="1" data-thread="'+esc(t.id)+'" aria-label="Voto positivo" aria-pressed="'+(t.my_vote===1)+'">▲</button><strong>'+t.score+'</strong><button type="button" data-vote="-1" data-thread="'+esc(t.id)+'" aria-label="Voto negativo" aria-pressed="'+(t.my_vote===-1)+'">▼</button></div><div><small class="v242-forum-meta"><span class="post-topic v242-forum-tag tone-'+forumCategoryTone(t.category)+'">'+esc(t.category)+'</span> · '+who(t)+'</small><a class="forum-title" href="'+esc(threadPath(t))+'" data-thread-open="'+esc(t.id)+'">'+esc(t.title)+'</a><p>'+esc(t.body)+'</p><small>'+'Creado: '+when(t)+'</small><small class="v24-forum-date">'+Number(t.reply_count)+' respuestas'+(t.last_reply_at?' · Última respuesta: '+when({created_at:t.last_reply_at}):'')+'</small>'+'<button type="button" class="forum-link" data-share-thread="'+esc(t.id)+'">Compartir conversación</button>'+(canDelete()?'<button type="button" class="forum-link v245-forum-delete" data-delete-thread="'+esc(t.id)+'">Eliminar publicación</button>':'')+(t.post_id?'<button type="button" class="forum-link" data-forum-post="'+esc(t.post_id)+'">Ver publicación vinculada en el mapa</button>':'')+'</div></article>';}
 function paint(){
  const t=snapshot.threads.find(t=>t.id===thread),u=ctx.user();
  root.innerHTML='<div class="v20-heading"><div><p class="eyebrow">CONVERSACIONES DE LA COMUNIDAD</p><h1>Foro</h1><p>Pregunta, comparte ideas y conversa sobre Mazatlán.</p></div>'+(u&&!thread?'<button type="button" data-forum-new class="compose-button">Nueva conversación</button>':'')+'</div>';
  if(thread){
   root.insertAdjacentHTML('beforeend','<button class="back-link" data-forum-back type="button">‹ Volver al foro</button>'+(t?row(t)+'<section class="forum-card forum-replies"><h2>Respuestas</h2>'+ (snapshot.replies.map(r=>'<div class="forum-reply"><small>'+who(r)+' · '+when(r)+'</small><p>'+esc(r.body)+'</p></div>').join('')||'<p>Aún no hay respuestas.</p>')+(u?'<form id="forum-reply-form"><label>Tu respuesta<textarea name="body" required maxlength="1000" rows="3"></textarea></label><button class="compose-button" type="submit">Responder</button></form>':'<p>Inicia sesión para responder o votar.</p>')+'</section>':'<p>Conversación no disponible.</p>'));
  }else root.insertAdjacentHTML('beforeend','<div class="forum-tools"><div class="filter-row">'+['all',...categories].map(c=>'<button type="button" class="filter-chip '+(topic===c?'is-on':'')+'" data-forum-topic="'+esc(c)+'">'+(c==='all'?'Todo el foro':esc(c))+'</button>').join('')+'</div><label>Ordenar <select id="forum-sort"><option value="popular" '+(sort==='popular'?'selected':'')+'>Popularidad</option><option value="recent" '+(sort==='recent'?'selected':'')+'>Más recientes</option></select></label></div>'+(snapshot.threads.map(row).join('')||'<p class="social-empty">No hay conversaciones en esta categoría.</p>'));
 }
 async function refresh(){
  const uid=ctx.user()||'';
  if(uid!==identity){identity=uid;snapshot={threads:[],replies:[]};}
  const seq=++request;
  root.setAttribute('aria-busy','true');
  try{
   const c=await api(),data=ok(await c.rpc('mzt_forum_snapshot',{p_thread:thread,p_category:topic==='all'?null:topic,p_sort:sort}));
   if(seq!==request||uid!==(ctx.user()||'')||root.hidden)return;
   snapshot=data;paint();
  }catch(e){if(seq===request&&!root.hidden){root.innerHTML='<p role="alert">No fue posible cargar el foro.</p><button type="button" data-forum-retry class="soft-btn">Reintentar</button>';ctx.toast(e.message);}}
  finally{if(seq===request)root.removeAttribute('aria-busy');}
 }
 function show(){if(!root.innerHTML)root.innerHTML='<p role="status">Cargando conversaciones…</p>';void refresh();}
 async function write(action){if(busy)return;const uid=ctx.user();if(!uid)return ctx.login();busy=true;try{const c=await api();if(ctx.user()!==uid)throw Error('Tu sesión cambió. Vuelve a intentarlo.');await action(c,uid);await refresh();}catch(e){ctx.toast(e.message||'No se pudo completar la acción.');}finally{busy=false;}}
 function confirmDelete(t){
  if(!canDelete()||busy||deleteDialog?.open)return;
  const uid=ctx.user(),d=document.createElement('dialog');deleteDialog=d;d.className='v13-dialog v245-forum-confirm';d.setAttribute('aria-labelledby','v245-delete-title');
  d.innerHTML='<form><h2 id="v245-delete-title">¿Eliminar esta conversación?</h2><p class="v245-delete-name">'+esc(t.title)+'</p><p>Se eliminarán también sus respuestas y votos. La publicación vinculada al muro, si existe, no se eliminará. Esta acción no se puede deshacer.</p><div class="v13-actions"><button type="button" data-cancel autofocus>Cancelar</button><button type="submit" class="v245-delete-confirm">Eliminar</button></div><p role="alert" data-delete-error hidden></p></form>';
  document.body.append(d);
  const cancel=d.querySelector('[data-cancel]'),submit=d.querySelector('[type=submit]'),error=d.querySelector('[data-delete-error]');
  cancel.onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  d.addEventListener('close',()=>{if(deleteDialog===d)deleteDialog=null;d.remove();},{once:true});
  d.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   if(!canDelete()||ctx.user()!==uid){d.close();return ctx.toast('Tu sesión o permisos cambiaron.');}
   busy=true;cancel.disabled=submit.disabled=true;error.hidden=true;
   try{
    const c=await api();if(!canDelete()||ctx.user()!==uid)throw Error('Tu sesión o permisos cambiaron.');
    const rows=ok(await c.from('mzt_forum_threads').delete().eq('id',t.id).select('id'));
    if(!rows?.some(r=>r.id===t.id))throw Error('No se pudo eliminar la conversación. Comprueba tus permisos o actualiza el foro.');
    if(ctx.user()!==uid)return;
    if(d.open)d.close();
    if(thread===t.id){thread=null;ctx.navigate(topic==='all'?'/foro':'/foro/'+slug(topic));}
    snapshot.threads=snapshot.threads.filter(r=>r.id!==t.id);
    snapshot.replies=snapshot.replies.filter(r=>r.thread_id!==t.id);
    if(!root.hidden){paint();await refresh();}
    ctx.toast('Conversación eliminada.');
   }catch(e){if(d.open){error.textContent=e.message||'No se pudo eliminar la conversación.';error.hidden=false;}else if(ctx.user()===uid)ctx.toast(e.message);}
   finally{busy=false;cancel.disabled=submit.disabled=false;}
  };
  d.showModal();cancel.focus();
 }
 function newThread(){
  if(!ctx.user())return ctx.login();
  const d=document.createElement('dialog');d.className='v13-dialog';
  d.innerHTML='<form><h2>Nueva conversación</h2><label>Título<input name="title" required minlength="3" maxlength="110"></label><label>Categoría<select name="category">'+categories.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></label><label>Contenido<textarea name="body" required maxlength="2000" rows="5"></textarea></label><label>Publicación del mapa (opcional)<select name="post"><option value="">Sin vínculo</option>'+ctx.posts().filter(p=>p.review==='approved'&&p.coordinates).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+'</option>').join('')+'</select></label><div class="v13-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Publicar conversación</button></div></form>';
  document.body.append(d);d.querySelector('[data-cancel]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove(),{once:true});d.querySelector('form').onsubmit=e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target),title=String(f.get('title')).trim(),body=String(f.get('body')).trim();if(title.length<3||!body)return ctx.toast('Completa los campos.');const b=e.target.querySelector('[type=submit]');b.disabled=true;void write(async(c,u)=>{try{const row=ok(await c.from('mzt_forum_threads').insert({user_id:u,title,body,category:f.get('category'),post_id:f.get('post')||null}).select('id').single());thread=row.id;ctx.navigate(threadPath({id:row.id,title}));d.close();}finally{if(b.isConnected)b.disabled=false;}});};d.showModal();
 }
 root.addEventListener('click',e=>{const b=e.target.closest('button,a[data-thread-open]');if(!b)return;if(b.matches('a')&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey))return;if(b.matches('a'))e.preventDefault();
  if(b.hasAttribute('data-forum-retry'))return show();
  if(b.dataset.deleteThread){const t=snapshot.threads.find(t=>t.id===b.dataset.deleteThread);if(t&&canDelete())confirmDelete(t);return;}
  if(b.dataset.shareThread){const t=snapshot.threads.find(t=>t.id===b.dataset.shareThread);if(t){const url=new URL(threadPath(t),location.origin).href;if(navigator.clipboard)navigator.clipboard.writeText(url).then(()=>ctx.toast('Enlace copiado.'),()=>window.prompt('Compartir conversación',url));else window.prompt('Compartir conversación',url);}return;}
  if(b.hasAttribute('data-forum-back')){thread=null;ctx.navigate(topic==='all'?'/foro':'/foro/'+slug(topic));return show();}
  if(b.dataset.threadOpen){thread=b.dataset.threadOpen;const t=snapshot.threads.find(t=>t.id===thread);if(t)ctx.navigate(threadPath(t));return show();}
  if(b.dataset.forumTopic){topic=b.dataset.forumTopic;thread=null;ctx.navigate(topic==='all'?'/foro':'/foro/'+slug(topic));return show();}
  if(b.dataset.forumPost)return ctx.openPost(b.dataset.forumPost);
  if(b.hasAttribute('data-forum-new'))return newThread();
  if(b.dataset.vote){const t=snapshot.threads.find(t=>t.id===b.dataset.thread),value=Number(b.dataset.vote);if(!t)return;void write(async(c,u)=>{let q;if(t.my_vote===value)q=c.from('mzt_forum_votes').delete().eq('thread_id',t.id).eq('user_id',u);else if(t.my_vote)q=c.from('mzt_forum_votes').update({value}).eq('thread_id',t.id).eq('user_id',u);else q=c.from('mzt_forum_votes').insert({thread_id:t.id,user_id:u,value});ok(await q);});}
 });
 root.addEventListener('change',e=>{if(e.target.id==='forum-sort'){sort=e.target.value;show();}});
 root.addEventListener('submit',e=>{if(e.target.id!=='forum-reply-form')return;e.preventDefault();const body=String(new FormData(e.target).get('body')).trim(),id=thread;if(!body)return ctx.toast('Escribe una respuesta.');void write(async(c,u)=>{ok(await c.from('mzt_forum_replies').insert({thread_id:id,user_id:u,body}));});});
 return {show,route(r){topic=r.topic||'all';thread=r.thread||null;},reset(){if(deleteDialog?.open)deleteDialog.close();request++;identity='';thread=null;snapshot={threads:[],replies:[]};root.replaceChildren();}};
}
