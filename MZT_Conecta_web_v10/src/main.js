import {CATEGORY_OPTIONS, PLACES, TYPE_INFO, dateISO, offsetDate} from './data.js';
import {getItems, resetDemo} from './storage.js';
import {initMap, setMapItems, focusMapItem, resizeMap, createLocationPreview, destroyLocationPreview, createPickerMap, destroyPickerMap} from './map.js';
import {THEMES, themeSelection, activePalette, applyTheme, choosePreset, chooseCustom, restoreDefault} from './theme.js';
import {initializeAuth, refreshIdentity, createAccount, loginAccount, logoutAccount, requestPasswordReset, changePassword} from './auth.js';
import {loadLocalProfile, normalizeUsername, validUsername} from './profile.js';
import {editImage,closeCrop} from './crop.js';
import {authorIdFor,personFor,syncPerson,followersOf,followingOf,isFollowing,commentsFor,countComments,demoPersonIds,localPersonIds,setSocialSnapshot,clearSocialSnapshot,voteCountFor} from './social.js';
import {SUPABASE_URL} from './supabase-config.js';
import {loadCommunity,createPost,updateProfileServer,createCommentServer,deleteCommentServer,followServer,voteServer,moderatePostServer,resolvePostServer,uploadDataImage,removeImageServer} from './remote.js';

const $ = sel => document.querySelector(sel);
let items = getItems().filter(i=>i.demo); // Ejemplos explícitos, nunca se suben automáticamente
let communityReady=false;
let communityError='';
let loadingCommunity=false;
let role = 'visitante';
let currentIdentity = null;
let localProfile = {username:'',bio:'',avatar:null,cover:null};
let profileId=null;
let profileTab='publicaciones';
let postReturnView='explorar';
let profileReturnView='explorar';
let publicProfileReturnFocus = null;
let authView = 'login';
let mapStarted = false;
let view = 'explorar';
let date = dateISO();
let selectedId = null;
let search = '';
let enabled = new Set(['news','citizen','infrastructure']);
let chosenCoordinates = PLACES[0].coordinates.slice();
let customMapPoint = false;
let pickerReturnFocus = null;
let pickerCoords = null;
let toastTimer = null;
applyTheme();
// Recuentos ficticios solo para las tarjetas marcadas EJEMPLO.
const demoVoteCounts=Object.freeze({'sample-1':38,'sample-2':25,'sample-3':54,'sample-4':31,'sample-5':19,'sample-6':43,'sample-7':17,'sample-8':11,'sample-9':9,'sample-10':7});
// Los datos de v0.9 siguen en localStorage, pero no se importan ni se publican sin permiso.
let helpfulVotes = new Set();
async function refreshCommunity({quiet=false}={}){
 if(loadingCommunity)return;
 loadingCommunity=true;
 const requestedUserId=currentPersonId();
 try{
  const snapshot=await loadCommunity();
  if(currentPersonId()!==requestedUserId)return;
  setSocialSnapshot(snapshot);
  items=[...getItems().filter(i=>i.demo),...snapshot.items];
  const me=snapshot.people.find(p=>p.id===currentPersonId());
  if(me){localProfile={username:me.username,bio:me.bio||'',avatar:me.avatar||null,cover:me.cover||null};
   currentIdentity.profile={...currentIdentity.profile,display_name:me.name};}
  helpfulVotes=new Set(snapshot.votes.filter(v=>v.userId===currentPersonId()).map(v=>v.postId));
  communityReady=true;communityError='';
  rememberCurrentPerson();
  $('#sidebar-avatar').innerHTML=localProfile.avatar?`<img src="${esc(localProfile.avatar)}" alt="">`:'◎';
  render();
 }catch(error){communityReady=false;communityError=error.message||'No fue posible cargar la comunidad.';
  if(!quiet)showToast('No se cargaron los datos reales. Revisa la migración SQL v1.0 y tu conexión a Supabase.');
  render();
 }finally{loadingCommunity=false;}
}
async function requireCommunity(){
 if(!communityReady)throw Error('La comunidad no está conectada. Ejecuta supabase/upgrade_v10.sql en tu proyecto y vuelve a entrar.');
}
async function voteOn(item){
 if(item.demo)return showToast('Los ejemplos ficticios no admiten votos reales.');
 try{await requireCommunity();await voteServer(item.id,currentPersonId(),helpfulVotes.has(item.id));await refreshCommunity({quiet:true});}
 catch(error){showToast(error.message||'No se pudo guardar el voto.');}
}
function imageURL(value){
 if(typeof value!=='string')return null;
 if(/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(value))return value;
 try{const u=new URL(value),trusted=new URL(SUPABASE_URL);if(u.protocol==='https:'&&u.origin===trusted.origin&&u.pathname.startsWith('/storage/v1/object/public/mzt-media/')&&!/[\"'()<>]/.test(value))return u.href;}catch{}
 return null;
}
// No se usa HTML sin escapar para contenido enviado por usuarios.
function esc(input) { return String(input??'').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function short(s,max=140){ const x=String(s||''); return x.length>max?x.slice(0,max-1)+'…':x; }
function sameOrEarlier(a,b) { return a <= b; } // Fechas ISO locales en formato YYYY-MM-DD.
function isLiveOn(item, day) {
  if(item.review!=='approved') return false;
  if(item.type==='infrastructure') {
    return sameOrEarlier(item.day,day) && (!item.resolvedAt || day <= offsetDate(item.resolvedAt,3));
  }
  return item.day===day;
}
function dateLabel(d){
  if(d===dateISO()) return 'Hoy, '+new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
  if(d===offsetDate(dateISO(),-1)) return 'Ayer, '+new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long'}).format(new Date(d+'T12:00:00'));
  return new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'));
}
function showToast(message){
  const el=$('#toast'); el.textContent=message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4000);
}
function avatarMarkup(name, className='profile-avatar') {
  return localProfile.avatar
    ? `<span class="${className}"><img src="${esc(localProfile.avatar)}" alt="Fotografía de perfil"></span>`
    : `<span class="${className}">${esc(String(name||'M').charAt(0).toUpperCase())}</span>`;
}
function personAvatar(person,sizeClass='person-avatar'){
  const avatar=imageURL(person?.avatar);
  return `<span class="${sizeClass}">${avatar?`<img src="${esc(avatar)}" alt="Foto de ${esc(person.name)}">`:esc(String(person?.name||'M').charAt(0).toUpperCase())}</span>`;
}
function currentPersonId(){return currentIdentity?.user?.id||'';}
function currentPerson(){return personFor(currentPersonId())||{id:currentPersonId(),name:currentIdentity?.profile?.display_name||'Mi perfil',username:localProfile.username,bio:localProfile.bio,avatar:localProfile.avatar,cover:localProfile.cover};}
function rememberCurrentPerson(){if(currentIdentity?.user?.id)syncPerson(currentIdentity.user.id,currentIdentity.profile?.display_name||'Mi perfil',localProfile);}
function openProfile(id){
  if(!id||!personFor(id))return showToast('No encontramos ese perfil en la comunidad.');
  profileReturnView=['explorar','moderacion','personas','mi-cuenta','publicacion'].includes(view)?view:'explorar';
  profileId=id;profileTab='publicaciones';view='mi-cuenta';render();
  $('.main-area').scrollTo({top:0,behavior:'smooth'});
}
function openPost(item){
  if(!item)return;
  if(view!=='publicacion')postReturnView=view;
  selectedId=item.id;view='publicacion';render();
  $('.main-area').scrollTo({top:0,behavior:'smooth'});
}
function ownPost(item) {
  return Boolean(currentIdentity?.user?.id && item.owner==='remote' && item.ownerUserId===currentIdentity.user.id);
}
function updateAvatarPreviews() {
  const name=currentIdentity?.profile?.display_name || 'Mi perfil';
  document.querySelectorAll('[data-avatar-preview]').forEach(el=>{
    el.innerHTML=avatarMarkup(name,'profile-avatar');
  });
}
function openPublicProfile() {
  openProfile(currentPersonId());
}
function closePublicProfile() {
  $('#public-profile-overlay').hidden=true;
  publicProfileReturnFocus?.isConnected && publicProfileReturnFocus.focus();
}
function publishedForDay(){return items.filter(i=>isLiveOn(i,date));}
function visibleForDay(){
  const q=search.toLocaleLowerCase('es').trim();
  return publishedForDay().filter(i=>enabled.has(i.type)).filter(i=>!q ||
    [i.title,i.description,i.category,i.location].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)))
    .sort((a,b)=>(b.day+'T'+b.clock).localeCompare(a.day+'T'+a.clock));
}
function updateStats(){
  const pub=publishedForDay();
  $('#count-news').textContent=pub.filter(i=>i.type==='news').length;
  $('#count-citizen').textContent=pub.filter(i=>i.type==='citizen').length;
  $('#count-infrastructure').textContent=pub.filter(i=>i.type==='infrastructure').length;
  const waiting=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review)).length;
  $('#mod-count').hidden = !['lector','editor'].includes(role)||waiting===0;
  $('#mod-count').textContent=waiting;
}
function voteCount(item) {
  return item.demo ? (demoVoteCounts[item.id] || 0) : voteCountFor(item.id);
}
function renderTrends(){
  // La tabla no usa filtros de búsqueda: son los artículos aprobados más votados.
  const approved=items.filter(i=>i.review==='approved');
  const real=approved.filter(i=>!i.demo);
  const candidates=(real.length?real:approved.filter(i=>i.demo))
    .sort((a,b)=>voteCount(b)-voteCount(a) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
    .slice(0,5);
  $('#trends-list').innerHTML=candidates.length ? candidates.map((item,index)=>`
    <button type="button" class="trend-item" data-trend-open="${esc(item.id)}" aria-label="Abrir publicación: ${esc(item.title)}">
      <span class="trend-rank">${index+1}</span>
      <span class="trend-copy"><strong>${esc(short(item.title,68))}</strong><small>${esc(typeLabel(item))}${item.demo?' · EJEMPLO':''}</small></span>
      <span class="trend-votes" aria-label="${voteCount(item)} votos"><span aria-hidden="true">▲</span>${voteCount(item)}</span>
    </button>`).join('') : '<p class="trends-empty">Todavía no hay publicaciones aprobadas.</p>';
}
function renderAccount() {
  const picked = themeSelection();
  const colors = activePalette();
  const name = currentIdentity?.profile?.display_name || 'Mi perfil';
  const roleName = ({ciudadano:'Ciudadano', lector:'Lector', editor:'Editor'})[role] || 'Visitante';
  const options = Object.entries(THEMES).map(([key, theme]) => `
    <button type="button" class="theme-tile ${picked.preset === key ? 'chosen' : ''}" data-theme-preset="${key}" aria-pressed="${picked.preset === key}">
      <span class="theme-sample" style="--sample-sidebar:${theme.sidebar};--sample-primary:${theme.primary};--sample-accent:${theme.accent};--sample-bg:${theme.background}">
        <span class="sample-bar"></span><span class="sample-body"><span></span><span></span><span></span></span>
      </span>
      <span class="theme-tile-copy"><strong>${esc(theme.name)}</strong><small>${esc(theme.description)}</small></span>
      <span class="theme-select-mark">${picked.preset === key ? '✓ Elegido' : 'Elegir'}</span>
    </button>`).join('');
  const fields = [
    ['sidebar','Barra lateral','Color del menú y del encabezado de paneles'],
    ['primary','Color principal','Botones, indicadores y enlaces destacados'],
    ['accent','Color de acento','Detalles, símbolos y elementos activos'],
    ['background','Fondo','Superficie general de la aplicación']
  ].map(([id,label,hint]) => `
    <label class="color-field"><span class="color-field-text"><strong>${label}</strong><small>${hint}</small></span>
      <input type="color" name="${id}" value="${colors[id]}" aria-label="${label}">
      <span class="color-hex" data-hex-for="${id}">${colors[id].toUpperCase()}</span>
    </label>`).join('');
  $('#account-panel').innerHTML = `
    <div class="account-heading"><span class="account-eyebrow">A TU MANERA</span><h1>Configuración <em>y apariencia.</em></h1>
      <p>Edita tus datos, ajusta tus fotografías y elige los colores de MZT Conecta.</p></div>
    <div class="account-grid">
      <section class="account-card profile-card" aria-labelledby="profile-heading">
        <div class="account-card-heading"><span class="account-card-icon">◎</span><div><small>PERFIL</small><h2 id="profile-heading">Tus datos</h2></div></div>
        <div class="profile-person"><span data-avatar-preview>${avatarMarkup(name)}</span><div><strong>${esc(name)}</strong><small>@${esc(localProfile.username)} · ${roleName}</small><small>${esc(currentIdentity?.user?.email || '')}</small></div></div>
        <div class="settings-cover-preview" style="${imageURL(localProfile.cover)?`background-image:url('${esc(imageURL(localProfile.cover))}')`:''}"></div>
        <div class="profile-photo-tools"><label for="profile-photo" class="profile-photo-button">Ajustar foto de perfil</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Cambiar fotografía de perfil"><button type="button" class="profile-remove-photo" data-action="remove-avatar" ${localProfile.avatar?'':'hidden'}>Quitar foto</button></div>
        <div class="profile-photo-tools"><label for="profile-cover" class="profile-photo-button">Ajustar portada</label><input id="profile-cover" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Cambiar portada"><button type="button" class="profile-remove-photo" data-action="remove-cover" ${localProfile.cover?'':'hidden'}>Quitar portada</button></div>
        <p class="profile-photo-help">Antes de guardar podrás mover la imagen, elegir la escala y revisar el encuadre.</p>
        <form id="profile-form" class="profile-demo-form"><label for="profile-name">Nombre visible</label>
          <input id="profile-name" name="name" maxlength="40" minlength="3" required value="${esc(name)}" autocomplete="nickname">
          <label for="profile-username">Nombre de usuario</label>
          <div class="profile-handle-field"><span>@</span><input id="profile-username" name="username" maxlength="20" minlength="3" required pattern="[a-zA-Z0-9._]{3,20}" value="${esc(localProfile.username)}" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
          <small class="profile-field-help">De 3 a 20 caracteres: letras, números, punto o guion bajo.</small>
          <label for="profile-bio">Biografía</label>
          <textarea id="profile-bio" name="bio" maxlength="160" rows="3" placeholder="Cuéntale algo sobre ti a Mazatlán…">${esc(localProfile.bio)}</textarea>
          <small class="profile-field-help"><span id="profile-bio-count">${localProfile.bio.length}</span>/160 caracteres</small>
          <button class="profile-save" type="submit">Guardar cambios</button>
        </form>
        <button type="button" class="profile-public-link" data-action="show-public-profile">◎ Ver mi perfil social</button>
        <button type="button" class="account-password-link" data-action="account-reset">Enviar enlace para cambiar contraseña</button>
        <div class="account-notice"><strong>Cuenta y comunidad conectadas</strong><p>Tu cuenta, perfil, imágenes, publicaciones, seguidores y comentarios se almacenan en Supabase y pueden ser vistos por otras personas registradas. Solo los colores del tema se guardan en este navegador. Los reportes requieren aprobación editorial.</p></div>
      </section>
      <section class="account-card appearance-card" aria-labelledby="appearance-heading">
        <div class="account-card-heading"><span class="account-card-icon">✧</span><div><small>PERSONALIZACIÓN</small><h2 id="appearance-heading">Apariencia de MZT Conecta</h2></div></div>
        <p class="appearance-intro">Elige uno de nuestros diseños o crea una combinación única. El tema seleccionado se conserva al regresar a la página.</p>
        <div class="theme-section-title"><strong>Temas disponibles</strong><span>Haz clic para aplicarlos</span></div>
        <div class="theme-grid">${options}</div>
        <div class="custom-title"><div><strong>Personaliza tus colores</strong><p>Elige libremente los colores que prefieras.</p></div><span class="custom-badge">${picked.preset === 'custom' ? 'ACTIVO' : 'A TU GUSTO'}</span></div>
        <form id="custom-theme-form" class="custom-theme-form">${fields}
          <div class="theme-actions"><button class="theme-apply" type="submit">Aplicar mis colores</button><button class="theme-reset" type="button" data-action="reset-theme">Restablecer original</button></div>
        </form>
      </section>
    </div>`;
}
function typeLabel(item){return item.resolvedAt && item.type==='infrastructure' ? 'Atendido' : TYPE_INFO[item.type]?.label||'Publicación';}
function statusLabel(item){return ({pending:'Recibido · esperando revisión',reviewed:'Revisado · esperando al editor',rejected:'Rechazado',approved:item.resolvedAt?'Atendido':'Publicado'})[item.review] || 'Sin estado';}
function renderProfilePage(){
  const id=profileId||currentPersonId();
  const person=personFor(id)||currentPerson();
  const own=id===currentPersonId();
  const posts=items.filter(i=>!i.demo && authorIdFor(i)===id && (i.review==='approved'||id===currentPersonId()||role==='editor'||role==='lector')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const filtered=profileTab==='reportes'?posts.filter(i=>i.type!=='news'):posts;
  const followAction=own?'<button type="button" class="social-button" data-action="edit-settings">Editar perfil</button>':
    `<button type="button" class="social-button" data-action="follow" data-profile-id="${esc(id)}" ${person.demo?'disabled':''}>${person.demo?'Ejemplo ficticio':isFollowing(currentPersonId(),id)?'Siguiendo ✓':'Seguir'}</button>`;
  $('#profile-page').innerHTML=`
    <div class="social-back-row"><button type="button" class="back-link" data-action="back-profile">‹ Volver</button><span>PERFIL DE LA COMUNIDAD</span></div>
    <div class="social-profile-card">
      <div class="social-cover" ${imageURL(person.cover)?`style="background-image:url('${esc(imageURL(person.cover))}')"`:''}><span>MAZATLÁN · SINALOA</span></div>
      <div class="social-profile-body"><div class="social-profile-top">${personAvatar(person,'social-big-avatar')}<div class="social-profile-actions">${followAction}</div></div>
        <h1>${esc(person.name)}</h1><p class="social-handle">@${esc(person.username)}</p>
        <p class="social-bio">${esc(person.bio||'Todavía no hay una biografía.')}</p>
        <div class="social-stats"><span><strong>${posts.length}</strong> publicaciones</span><span><strong>${followersOf(id)}</strong> seguidores</span><span><strong>${followingOf(id)}</strong> seguidos</span></div>
        ${person.demo?'<div class="social-local-note">Perfil ficticio de ejemplo. No representa a una cuenta registrada.</div>':''}
      </div>
    </div>
    <div class="profile-feed-heading"><div><span>ACTIVIDAD DEL PERFIL</span><h2>Publicaciones</h2></div><div class="profile-feed-tabs"><button type="button" data-profile-tab="publicaciones" class="${profileTab==='publicaciones'?'active':''}">Todas</button><button type="button" data-profile-tab="reportes" class="${profileTab==='reportes'?'active':''}">Reportes</button></div></div>
    <div class="profile-post-list">${filtered.length?filtered.map(card).join(''):'<p class="social-empty">Este perfil todavía no tiene publicaciones en esta sección.</p>'}</div>
    <p class="social-disclaimer">Los perfiles y las publicaciones aprobadas se comparten entre usuarios registrados. Las cuentas marcadas Ejemplo son ficticias.</p>`;
}
function renderPeoplePage(){
  const ids=[currentPersonId(),...localPersonIds().filter(id=>id!==currentPersonId()),...demoPersonIds()].filter(Boolean);
  $('#people-page').innerHTML=`<div class="social-section-head"><span>LA COMUNIDAD</span><h1>Explora perfiles <em>de Mazatlán.</em></h1><p>Conoce la apariencia de los perfiles. Los que indican «Ejemplo» son ficticios.</p></div>
    <div class="people-grid">${ids.map(id=>{const person=personFor(id);if(!person)return '';return `<button type="button" class="person-tile" data-profile-id="${esc(id)}">${personAvatar(person)}<span><strong>${esc(person.name)}</strong><small>@${esc(person.username)}</small>${person.demo?'<em>EJEMPLO</em>':'<em>CUENTA REAL</em>'}</span></button>`;}).join('')}</div>
    <p class="social-disclaimer">Perfiles reales de usuarios registrados en Supabase. Las tarjetas «Ejemplo» son ficticias.</p>`;
}
function renderPostPage(){
  const item=items.find(i=>i.id===selectedId);
  if(!item){setView('explorar');return;}
  const person=personFor(authorIdFor(item))||{id:authorIdFor(item),name:item.sourceName||'Comunidad de Mazatlán',username:'comunidad_mzt'};
  const ownAuthor=authorIdFor(item)===currentPersonId();
  const rows=item.demo?[]:commentsFor(item.id);
  const moderation=role==='editor'&&['pending','reviewed'].includes(item.review)
    ?`<div class="post-moderation"><strong>Moderación editorial</strong><button type="button" data-review="${esc(item.id)}" data-decision="approved">Aprobar</button><button type="button" data-review="${esc(item.id)}" data-decision="rejected">Rechazar</button>${item.review==='pending'?`<button type="button" data-review="${esc(item.id)}" data-decision="reviewed">Marcar revisado</button>`:''}</div>`
    :role==='lector'&&item.review==='pending'?`<div class="post-moderation"><strong>Revisión de solo lectura: no puedes cambiar estados.</strong></div>`
    :role==='editor'&&item.type==='infrastructure'&&item.review==='approved'&&!item.resolvedAt?`<div class="post-moderation"><strong>Seguimiento</strong><button type="button" data-resolve="${esc(item.id)}">Marcar como atendido</button></div>`:'';
  $('#post-page').innerHTML=`<div class="social-back-row"><button class="back-link" type="button" data-action="back-post">‹ Volver a las publicaciones</button><span>PUBLICACIÓN</span></div>
    <article class="social-post-detail">
      <div class="post-detail-author"><button type="button" class="person-inline" data-profile-id="${esc(person.id)}">${personAvatar(person)}<span><strong>${esc(person.name)}</strong><small>@${esc(person.username)}${person.demo?' · Ejemplo ficticio':''}</small></span></button><span class="post-detail-time">${esc(item.day)} · ${esc(item.clock)}</span></div>
      <div class="post-detail-content"><span class="type-tag ${esc(item.type)}">${esc(typeLabel(item))}</span>${item.category?`<span class="post-topic">${esc(item.category)}</span>`:''}
        <h1>${esc(item.title)}</h1>${item.description?`<p class="post-detail-description">${esc(item.description)}</p>`:''}
        ${imageURL(item.image)?`<img class="post-detail-image" src="${esc(imageURL(item.image))}" alt="Imagen de la publicación">`:''}
        ${item.coordinates?`<button type="button" class="post-detail-location" data-action="locate">⌖ ${esc(item.location)} · Ver en mapa</button>`:''}
        ${isSafeURL(item.sourceUrl)?`<p><a href="${esc(isSafeURL(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">Consultar fuente original</a></p>`:''}
        ${item.review!=='approved'?`<p class="social-local-note">${esc(statusLabel(item))}</p>`:''}
      </div>
      <div class="post-detail-actions"><button type="button" data-action="helpful" class="${helpfulVotes.has(item.id)?'voted':''}" aria-pressed="${helpfulVotes.has(item.id)}">▲ ${voteCount(item)} · Me sirve</button><span>▤ ${rows.length} comentarios</span>${ownAuthor?'<span>Tu publicación</span>':''}</div>
      ${moderation}
      <section class="post-comments" aria-labelledby="comments-heading"><div class="comment-heading"><h2 id="comments-heading">Comentarios</h2><span>${rows.length}</span></div>
        ${item.demo?'<p class="social-local-note">Este contenido es ficticio y no admite comentarios.</p>':item.review!=='approved'?'<p class="social-local-note">Podrás comentar cuando un editor apruebe la publicación.</p>':'<form id="comment-form"><label for="comment-body" class="sr-only">Escribe un comentario</label><textarea id="comment-body" required minlength="1" maxlength="500" rows="3" placeholder="Escribe un comentario respetuoso…"></textarea><div><small>Máximo 500 caracteres · Comentario público</small><button type="submit" class="social-button">Comentar</button></div></form>'}
        <div class="comment-list">${rows.length?rows.map(c=>{const author=personFor(c.authorId)||{id:c.authorId,name:'Usuario',username:'ciudadano'};return `<article class="comment-item"><button type="button" class="person-inline" data-profile-id="${esc(author.id)}">${personAvatar(author)}<span><strong>${esc(author.name)}</strong><small>@${esc(author.username)} · ${esc(new Date(c.createdAt).toLocaleString('es-MX'))}</small></span></button><p>${esc(c.text)}</p>${(c.authorId===currentPersonId()||role==='editor')?`<button class="delete-comment" type="button" data-delete-comment="${esc(c.id)}">Eliminar comentario</button>`:''}</article>`;}).join(''):'<p class="social-empty">Todavía no hay comentarios. Puedes escribir el primero.</p>'}</div>
      </section>
    </article><p class="social-disclaimer">Los comentarios y votos en publicaciones reales son compartidos entre usuarios. Las tarjetas EJEMPLO son ficticias.</p>`;
}
function card(item){
  const typeClass=esc(item.type);
  const isOwn=ownPost(item);
  const author=item.owner==='remote' ? (isOwn ? (currentIdentity?.profile?.display_name || 'Tú') : (personFor(item.ownerUserId)?.name||'Persona de la comunidad')) : item.type==='news' ? (item.sourceName||'MZT Noticias') : 'Comunidad de Mazatlán';
  const authorTag=item.type==='news' ? 'Medio / fuente' : 'Reporte ciudadano · No oficial';
  const voted=!item.demo&&helpfulVotes.has(item.id);
  const image=imageURL(item.image)?`<img class="post-image" src="${esc(imageURL(item.image))}" alt="Imagen del reporte ciudadano" loading="lazy">`:'';
  const socialAuthor=personFor(authorIdFor(item))||{id:authorIdFor(item),name:author,username:'comunidad_mzt'};
  return `<article class="event-card ${selectedId===item.id?'selected':''}" data-post-id="${esc(item.id)}">
    <div class="post-byline"><button type="button" class="person-inline" data-profile-id="${esc(socialAuthor.id)}">${personAvatar(socialAuthor,'post-avatar')}<span class="post-author-block"><strong>${esc(isOwn?author:socialAuthor.name)}</strong><small>${esc(isOwn?'@'+localProfile.username+' · cuenta real':socialAuthor.demo?'Ejemplo ficticio':authorTag)}</small></span></button><span class="post-age">${esc(item.clock||'')}${item.demo?' · EJEMPLO':''}</span></div>
    <button type="button" class="post-open" data-open="${esc(item.id)}" aria-label="Ver publicación: ${esc(item.title)}">
      <div class="post-tags"><span class="type-tag ${typeClass}${item.resolvedAt?' resolved':''}"><span class="type-symbol symbol-${typeClass}"></span>${esc(typeLabel(item))}</span>${item.category?`<span class="post-topic">${esc(item.category)}</span>`:''}</div>
      <h3>${esc(item.title)}</h3>
      ${item.description?`<p class="post-excerpt">${esc(item.description)}</p>`:''}
      ${image}
      <div class="post-place">⌖ ${esc(item.coordinates?item.location:'Toda la ciudad · sin ubicación puntual')}</div>
      ${view==='mi-cuenta'&&isOwn?`<div class="pending-tag">${esc(statusLabel(item))}${item.rejectionReason?` · ${esc(short(item.rejectionReason,70))}`:''}</div>`:''}
    </button>
    <div class="post-actions">
      <button type="button" class="post-action ${voted?'voted':''}" data-action="helpful" data-id="${esc(item.id)}" aria-pressed="${String(voted)}"><span aria-hidden="true">▲</span> ${voteCount(item)} · ${voted?'Marcado útil':'Me sirve'}</button>
      <button type="button" class="post-action" data-open="${esc(item.id)}"><span aria-hidden="true">▤</span> Ver detalles</button>
      ${item.coordinates?`<button type="button" class="post-action" data-action="locate" data-id="${esc(item.id)}"><span aria-hidden="true">⌖</span> Ver en mapa</button>`:''}
      <button type="button" class="post-action" data-open="${esc(item.id)}">▤ ${item.demo?0:countComments(item.id)} comentarios</button>
    </div>
  </article>`;
}
function empty(title,desc,buttonText='',action=''){
  return `<div class="empty-state"><span class="empty-icon">⌖</span><strong>${esc(title)}</strong><p>${esc(desc)}</p>${buttonText?`<button type="button" data-action="${esc(action)}">${esc(buttonText)}</button>`:''}</div>`;
}
function canOpenView(next){
  return next==='explorar' || (['mi-cuenta','configuracion','personas','publicacion'].includes(next) && role!=='visitante') || (next==='moderacion' && ['lector','editor'].includes(role));
}
function updateNavigation(){
  document.querySelectorAll('.side-link[data-view]').forEach(button=>{
    const visible=canOpenView(button.dataset.view);
    button.hidden=!visible;
    button.setAttribute('aria-hidden',String(!visible));
    if(!visible) button.classList.remove('active');
  });
  const waiting=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review)).length;
  $('#mod-count').hidden=!['lector','editor'].includes(role)||waiting===0;
}
function setView(next){
  if(!canOpenView(next)) {showToast('Tu cuenta no tiene permiso para entrar a este apartado.');return;}
  view=next; selectedId=null;
  if(next==='mi-cuenta')profileId=currentPersonId();
  document.querySelectorAll('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  if(['mi-cuenta','configuracion','personas','publicacion'].includes(next)) { render(); return; }
  const headings={explorar:['PUBLICACIONES DE LA COMUNIDAD','El muro de Mazatlán'], moderacion:role==='lector'?['PANEL DE REVISIÓN','Reportes por revisar']:['PANEL EDITORIAL','Revisión pendiente']};
  $('.mini-eyebrow').textContent=headings[next][0];
  $('#feed-title').textContent=headings[next][1];
  const hideFilters=next!=='explorar';
  $('.date-switcher').hidden=hideFilters;
  $('.filter-heading').hidden=hideFilters;
  $('#filter-row').hidden=hideFilters;
  $('.search-wrap').hidden=hideFilters;
  $('.compose-strip').hidden=next==='moderacion';
  render();
}
function render() {
  if(!canOpenView(view)) view='explorar';
  updateNavigation();
  document.querySelectorAll('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const alternate=['mi-cuenta','configuracion','personas','publicacion'].includes(view);
  $('.page-heading').hidden = alternate;
  $('#map-panel').hidden = alternate;
  $('.social-layout').hidden = alternate;
  $('#account-panel').hidden = view!=='configuracion';
  $('#profile-page').hidden=view!=='mi-cuenta';
  $('#post-page').hidden=view!=='publicacion';
  $('#people-page').hidden=view!=='personas';
  if(view==='configuracion'){renderAccount();return;}
  if(view==='mi-cuenta'){renderProfilePage();return;}
  if(view==='personas'){renderPeoplePage();return;}
  if(view==='publicacion'){renderPostPage();return;}
  updateStats();
  renderTrends();
  $('#selected-date').value=date;
  $('#selected-date').max=dateISO();
  $('#date-caption').textContent=dateLabel(date);
  $('#next-day').disabled=date===dateISO();
  $('#result-count').textContent='0';
  let list=[];
  if(view==='explorar'){
    list=visibleForDay();
    $('#result-count').textContent=list.length;
    const located=list.filter(i=>i.coordinates);
    const noLocation=list.filter(i=>!i.coordinates);
    $('#feed-content').innerHTML=list.length?`${located.length?`<div class="group-label">PUBLICACIONES CON UBICACIÓN · ${located.length}</div>${located.map(card).join('')}`:''}
    ${noLocation.length?`<div class="group-label">TODA LA CIUDAD · SIN LUGAR FIJO · ${noLocation.length}</div>${noLocation.map(card).join('')}`:''}`
      :empty('No encontramos resultados','Prueba con otra búsqueda, fecha o filtro.','Limpiar filtros','reset-filters');
    if(!communityReady)$('#feed-content').insertAdjacentHTML('afterbegin',`<div class="community-notice" role="status"><strong>${communityError?'Conexión pendiente':'Conectando con la comunidad…'}</strong><p>${esc(communityError||'Cargando publicaciones reales de Supabase.')}</p><button type="button" data-action="retry-community">Reintentar conexión</button></div>`);
    setMapItems(located,selectedId);
  }else{
    // Lector: solo la bandeja de pendientes. Editor: pendientes y previamente revisados.
    list=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review))
      .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    $('#result-count').textContent=list.length;
    const readerNotice=role==='lector'
      ? '<div class="review-role-note"><strong>Tu función: observar.</strong> Puedes leer las publicaciones pendientes, pero solo el Editor puede cambiar su estado.</div>'
      : '';
    if(!list.length){
      $('#feed-content').innerHTML=readerNotice+empty('Todo está al día',role==='lector'?'No hay reportes nuevos por revisar.':'No hay reportes pendientes de revisión o decisión editorial.');
    }else{
      $('#feed-content').innerHTML=readerNotice+`<div class="group-label">${role==='lector'?'POR REVISAR':'PENDIENTES'} · ${list.length}</div>`+list.map(i=>`<div class="review-card"><span class="type-tag ${esc(i.type)}">${esc(TYPE_INFO[i.type]?.label||'Reporte')}</span><h3>${esc(i.title)}</h3><p>${esc(short(i.description,110))}</p><div class="card-location">⌖ ${esc(i.location)} · ${esc(statusLabel(i))}</div><div class="review-actions"><button type="button" data-open="${esc(i.id)}">Ver detalle</button>${role==='editor'&&i.review==='pending'?`<button type="button" data-review="${esc(i.id)}" data-decision="reviewed">Marcar revisado</button>`:''}${role==='editor'?`<button type="button" data-review="${esc(i.id)}" data-decision="approved">Aprobar</button><button type="button" data-review="${esc(i.id)}" data-decision="rejected">Rechazar</button>`:''}</div></div>`).join('');
    }
    if(role==='editor') $('#feed-content').insertAdjacentHTML('afterbegin','<div class="editor-tools"><button type="button" class="soft-btn" data-action="add-news">＋ Agregar noticia con fuente</button></div>');
    setMapItems([],null);
  }
  document.querySelectorAll('#filter-row .filter-chip').forEach(btn=>{
    const on=enabled.has(btn.dataset.filter);
    btn.classList.toggle('is-on',on);btn.setAttribute('aria-pressed',String(on));
  });
}
let locationReturnFocus=null;
function closeLocationModal(){
  if ($('#location-overlay').hidden) return;
  destroyLocationPreview();
  $('#location-overlay').hidden=true;
  $('#location-loading').hidden=false;
  const lastFocus=locationReturnFocus;
  locationReturnFocus=null;
  if(lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
}
function openLocationModal(item){
  if(!item?.coordinates || !Array.isArray(item.coordinates)){
    showToast('Esta publicación no tiene una ubicación puntual.'); return;
  }
  const lon=Number(item.coordinates[0]),lat=Number(item.coordinates[1]);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90||Math.abs(lon)>180){
    showToast('No se ha registrado una ubicación válida.'); return;
  }
  locationReturnFocus=document.activeElement;
  $('#location-modal-title').textContent=item.title;
  $('#location-modal-place').textContent=item.location||'Punto seleccionado por el autor';
  $('#location-coordinates').textContent=`${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const osm=new URL('https://www.openstreetmap.org/');
  osm.searchParams.set('mlat',lat.toFixed(5));osm.searchParams.set('mlon',lon.toFixed(5));
  osm.hash=`map=17/${lat.toFixed(5)}/${lon.toFixed(5)}`;
  $('#location-external').href=osm.href;
  $('#location-disclaimer').textContent=item.demo
    ? 'Punto de demostración: la publicación no representa un incidente real.'
    : 'Ubicación aportada por el usuario. No significa que esté verificada oficialmente.';
  $('#location-overlay').hidden=false;
  $('#location-loading').hidden=false;
  $('#location-loading').textContent='Cargando mapa de la ubicación…';
  $('#location-close').focus({preventScroll:true});
  createLocationPreview(item,{
    onLoad:()=>{$('#location-loading').hidden=true;},
    onFail:()=>{$('#location-loading').textContent='No fue posible cargar el mapa. Puedes consultar el punto en OpenStreetMap.';}
  });
}
function closeDrawer(){
  $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden','true');
  $('#drawer-backdrop').hidden=true;
  $('#drawer').classList.remove('centered-drawer');
  $('#drawer-backdrop').classList.remove('centered-backdrop');
  setTimeout(()=>{ if(!$('#drawer').classList.contains('open')) $('#drawer-content').innerHTML=''; },280);
}
function openDrawer(markup,mode='side'){
  $('#drawer-content').innerHTML=markup;
  $('#drawer').classList.toggle('centered-drawer',mode==='center');
  $('#drawer-backdrop').classList.toggle('centered-backdrop',mode==='center');
  $('#drawer-backdrop').hidden=false;
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false');
}
function drawerHead(eyebrow,title,desc=''){
  return `<div class="drawer-head"><button class="drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar panel">×</button><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div>`;
}
function notSignedIn(){
  $('#auth-gate').hidden = false;
  $('.app-shell').hidden = true;
  setAuthView('login');
}
function openReportForm(){
  if(role==='visitante') return notSignedIn();
  chosenCoordinates=null;
  customMapPoint=false;
  const categories=CATEGORY_OPTIONS.citizen.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  openDrawer(drawerHead('COMPARTE CON TU CIUDAD','Crear reporte ciudadano','El reporte quedará pendiente de revisión editorial.')+
    `<div class="drawer-body"><p class="form-note">Tu reporte se guardará en Supabase y será visible públicamente después de la aprobación de un Editor. Evita compartir datos sensibles o acusaciones sin verificar.</p>
      <form id="report-form">
        <div class="drawer-field"><label for="report-type">Tipo de reporte</label><select id="report-type" required><option value="citizen">Aviso del día (temporal)</option><option value="infrastructure">Problema de infraestructura (persistente)</option></select></div>
        <div class="drawer-field"><label for="report-category">Categoría</label><select id="report-category" required>${categories}</select></div>
        <div class="drawer-field"><label for="report-title">Título *</label><input id="report-title" maxlength="100" minlength="3" required placeholder="Ej. Corte de energía eléctrica"></div>
        <div class="drawer-field"><label for="report-description">Descripción (opcional)</label><textarea id="report-description" maxlength="800" placeholder="Si lo deseas, agrega un poco más de contexto…"></textarea></div>
        <div class="drawer-field"><label for="report-place">Ubicación aproximada (opcional)</label><div class="location-choice"><select id="report-place"><option value="none" selected>Sin ubicación</option>${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select><button id="choose-map-point" class="soft-btn" type="button">⌖ Mapa</button></div><small id="coordinates-hint" class="picked-coords">Puedes elegir una zona o marcarla directamente en el mapa.</small></div>
        <div class="drawer-field"><label for="report-photo">Fotografía (opcional)</label><input id="report-photo" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG o WebP, máximo 4 MB. La imagen se publicará tras la aprobación del reporte.</small></div>
        <div class="drawer-field"><label class="policy-check"><input type="checkbox" required><span>Confirmo que la publicación no contiene datos personales sensibles, acusaciones ni información delictiva sin verificar.</span></label></div>
        <button type="submit" class="submit-btn">Enviar reporte para revisión</button>
      </form></div>`,'center');
}
function openNewsForm(){
  if(role!=='editor'){showToast('Solo una cuenta con rol Editor puede añadir noticias.');return;}
  openDrawer(drawerHead('PANEL EDITORIAL','Agregar noticia','Las noticias deben tener una fuente y enlace verificables.')+
    `<div class="drawer-body"><form id="news-form">
      <div class="drawer-field"><label for="news-title">Título</label><input id="news-title" required minlength="8" maxlength="110"></div>
      <div class="drawer-field"><label for="news-desc">Resumen</label><textarea id="news-desc" required minlength="15" maxlength="800"></textarea></div>
      <div class="drawer-field"><label for="news-source">Nombre del medio o fuente</label><input id="news-source" required maxlength="100" placeholder="Nombre del medio local"></div>
      <div class="drawer-field"><label for="news-link">Enlace de la fuente</label><input id="news-link" type="url" required placeholder="https://..."></div>
      <div class="drawer-field"><label for="news-place">Ubicación en el mapa</label><select id="news-place"><option value="none">Toda la ciudad / sin lugar fijo</option>${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select></div>
      <p class="form-note">La noticia se publicará para las cuentas registradas. Verifica la fuente antes de compartirla.</p>
      <button class="submit-btn" type="submit">Guardar noticia</button>
    </form></div>`,'center');
}
function isSafeURL(str){
  try {const url=new URL(str);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
function detail(item){
  const type=typeLabel(item);
  const isOwner=item.owner==='local' && item.ownerUserId===currentIdentity?.user?.id;
  const sourceLink=isSafeURL(item.sourceUrl);
  const caption=item.demo?'Contenido ficticio de demostración. No corresponde a un evento real.':
    'Reporte ciudadano compartido a través de Supabase.';
  const editorActions=(role==='editor' && item.review==='approved' && item.type==='infrastructure' && !item.resolvedAt)
    ?`<button type="button" class="soft-btn" data-resolve="${esc(item.id)}">✓ Marcar como atendido</button>`:'';
  const editorialAction=(role==='editor'&&['pending','reviewed'].includes(item.review))
    ?`<button class="soft-btn" type="button" data-review="${esc(item.id)}" data-decision="approved">Aprobar reporte</button><button type="button" class="danger-btn" data-review="${esc(item.id)}" data-decision="rejected">Rechazar</button>`:'';
  const readerAction=role==='editor'&&item.review==='pending'?`<button class="soft-btn" type="button" data-review="${esc(item.id)}" data-decision="reviewed">Marcar como revisado</button>`:'';
  openDrawer(drawerHead('INFORMACIÓN DE MAZATLÁN',item.title,type)+`<div class="drawer-body">
    <span class="type-tag ${esc(item.type)}${item.resolvedAt?' resolved':''}">${esc(type)}</span>
    <div class="detail-grid"><div class="detail-cell"><small>Ubicación</small><strong>${esc(item.location||'Sin lugar fijo')}</strong></div><div class="detail-cell"><small>Fecha y hora</small><strong>${esc(dateLabel(item.day))}, ${esc(item.clock)}</strong></div><div class="detail-cell"><small>Origen</small><strong>${esc(item.type==='news'?(item.sourceName||'Sin fuente'): 'Reporte ciudadano · No oficial')}</strong></div><div class="detail-cell"><small>Estado</small><strong>${esc(statusLabel(item))}</strong></div></div>
    <p class="detail-content">${esc(item.description)}</p>
    ${item.image?`<img class="detail-photo" src="${esc(item.image)}" alt="Fotografía proporcionada con el reporte">`:''}
    ${sourceLink?`<p><a href="${esc(sourceLink)}" target="_blank" rel="noopener noreferrer">Consultar fuente original ↗</a></p>`:''}
    ${item.rejectionReason?`<p class="form-note">Motivo del rechazo: ${esc(item.rejectionReason)}</p>`:''}
    <div class="detail-note">${esc(caption)}</div>
    ${item.coordinates?`<div class="action-row"><button class="soft-btn" type="button" data-focus="${esc(item.id)}">⌖ Ver ubicación en el mapa</button></div>`:''}
    ${(editorActions||editorialAction||readerAction)?`<div class="action-row">${editorActions}${editorialAction}${readerAction}</div>`:''}
    ${isOwner?'<p style="font-size:10px;color:#91a4b2;margin-top:20px">Este reporte de prueba se creó con tu cuenta en este navegador.</p>':''}
  </div>`);
}
async function review(id,decision){
 const i=items.find(e=>e.id===id);if(!i||i.demo||!['pending','reviewed'].includes(i.review))return;
 if(decision==='rejected'){
  openDrawer(drawerHead('DECISIÓN EDITORIAL','Motivo de rechazo','Explica por qué no puede publicarse el reporte.')+
   `<div class="drawer-body"><form id="reject-form" data-item-id="${esc(id)}"><div class="drawer-field"><label for="reject-reason">Motivo para el ciudadano</label><textarea id="reject-reason" required minlength="8" maxlength="300"></textarea></div><button class="danger-btn" type="submit">Confirmar rechazo</button></form></div>`);return;
 }
 try{await requireCommunity();await moderatePostServer(id,decision);closeDrawer();await refreshCommunity();showToast(decision==='approved'?'Reporte publicado.':'Reporte marcado como revisado.');}
 catch(error){showToast(error.message||'No fue posible moderar el reporte.');}
}
async function resolveReport(id){
 try{await requireCommunity();await resolvePostServer(id);closeDrawer();await refreshCommunity();showToast('Reporte marcado como atendido.');}
 catch(error){showToast(error.message||'No se pudo actualizar el reporte.');}
}
async function compressedPhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecciona una imagen JPG, PNG o WebP.');
  if(file.size>4*1024*1024)throw Error('La fotografía debe pesar como máximo 4 MB.');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const max=900, scale=Math.min(1,max/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.72);
  }finally{URL.revokeObjectURL(url);}
}
async function handleReportSubmit(event){
 event.preventDefault();if(role==='visitante')return notSignedIn();
 const form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
 try{
  await requireCommunity();
  const type=$('#report-type').value,category=$('#report-category').value;
  if(!['citizen','infrastructure'].includes(type)||!CATEGORY_OPTIONS[type].includes(category))throw Error('Categoría inválida.');
  const title=$('#report-title').value.trim();if(title.length<3||title.length>110)throw Error('El título debe tener de 3 a 110 caracteres.');
  const file=$('#report-photo').files[0];let photo_url=null;
  if(file)photo_url=await uploadDataImage(currentPersonId(),await compressedPhoto(file));
  await createPost({user_id:currentPersonId(),type,category,title,description:$('#report-description').value.trim(),
   location:chosenCoordinates?(customMapPoint?'Punto seleccionado en el mapa':($('#report-place').selectedOptions[0]?.textContent||'Ubicación aproximada')):'Toda la ciudad',
   longitude:chosenCoordinates?.[0]??null,latitude:chosenCoordinates?.[1]??null,photo_url,review:'pending'});
  closeDrawer();await refreshCommunity();setView('mi-cuenta');showToast('Reporte enviado a revisión. Solo será público cuando un Editor lo apruebe.');
 }catch(error){showToast(error.message||'No se pudo enviar el reporte.');}
 finally{if(submit.isConnected)submit.disabled=false;}
}
async function handleNewsSubmit(event){
 event.preventDefault();if(role!=='editor')return;
 try{
  await requireCommunity();const source_url=isSafeURL($('#news-link').value);
  if(!source_url)throw Error('Introduce un enlace de fuente válido.');
  const placeValue=$('#news-place').value,loc=placeValue==='none'?null:PLACES[Number(placeValue)];
  const title=$('#news-title').value.trim(),description=$('#news-desc').value.trim(),source_name=$('#news-source').value.trim();
  if(title.length<8||description.length<15||!source_name)throw Error('Completa todos los datos de la noticia.');
  await createPost({user_id:currentPersonId(),type:'news',title,description,category:'Noticia',
   location:loc?.name||'Toda la ciudad',longitude:loc?.coordinates?.[0]??null,latitude:loc?.coordinates?.[1]??null,
   source_name,source_url,review:'approved'});
  closeDrawer();date=dateISO();await refreshCommunity();setView('explorar');showToast('Noticia publicada en la comunidad.');
 }catch(error){showToast(error.message||'No fue posible publicar la noticia.');}
}
async function handleRejectSubmit(event){
 event.preventDefault();if(role!=='editor')return;
 const id=event.currentTarget.dataset.itemId,reason=$('#reject-reason').value.trim();
 if(reason.length<8)return showToast('Explica el motivo del rechazo.');
 try{await requireCommunity();await moderatePostServer(id,'rejected',reason);closeDrawer();await refreshCommunity();showToast('Reporte rechazado.');}
 catch(error){showToast(error.message||'No se pudo rechazar el reporte.');}
}
function closePicker(){
  if($('#picker-overlay').hidden) return;
  destroyPickerMap();
  $('#picker-overlay').hidden=true;
  pickerCoords=null;
  $('#picker-confirm').disabled=true;
  const returnFocus=pickerReturnFocus;
  pickerReturnFocus=null;
  if(returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
}
function pickLocation(){
  if(!$('#report-form')) return;
  pickerReturnFocus=document.activeElement;
  pickerCoords=chosenCoordinates?.slice()||PLACES[0].coordinates.slice();
  $('#picker-coordinates').textContent=`${pickerCoords[1].toFixed(5)}, ${pickerCoords[0].toFixed(5)}`;
  $('#picker-status').textContent='Toca otra posición o arrastra el marcador para ajustar el punto.';
  $('#picker-confirm').disabled=true;
  $('#picker-loading').hidden=false;
  $('#picker-loading').textContent='Cargando mapa para seleccionar ubicación…';
  $('#picker-overlay').hidden=false;
  $('#picker-close').focus({preventScroll:true});
  createPickerMap(pickerCoords,{
    onPick:coords=>{
      pickerCoords=coords;
      $('#picker-coordinates').textContent=`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
      $('#picker-status').textContent='Punto marcado. Pulsa «Usar esta ubicación» para guardarlo.';
      $('#picker-confirm').disabled=false;
    },
    onLoad:()=>{$('#picker-loading').hidden=true;$('#picker-confirm').disabled=false;},
    onFail:()=>{$('#picker-loading').textContent='No fue posible cargar el mapa. Cierra esta ventana y elige una ubicación aproximada.';$('#picker-confirm').disabled=true;}
  });
}
function confirmPicker(){
  if(!pickerCoords || $('#picker-confirm').disabled) return;
  chosenCoordinates=pickerCoords.slice();
  customMapPoint=true;
  const choice=$('#report-place');
  if(choice){
    let option=choice.querySelector('option[value="map-selected"]');
    if(!option){option=new Option('Punto marcado en el mapa','map-selected');choice.add(option);}
    choice.value='map-selected';
  }
  const hint=$('#coordinates-hint');
  if(hint)hint.textContent=`Ubicación elegida en mapa: ${chosenCoordinates[1].toFixed(5)}, ${chosenCoordinates[0].toFixed(5)}.`;
  closePicker();
  showToast('Ubicación guardada en tu reporte. Puedes continuar sin salir del formulario.');
}

$('#account-panel').addEventListener('click', e => {
  if (e.target.closest('[data-action="show-public-profile"]')) {
    openPublicProfile();
    return;
  }
  if(e.target.closest('[data-action="remove-avatar"]') || e.target.closest('[data-action="remove-cover"]')){
    const kind=e.target.closest('[data-action="remove-avatar"]')?'avatar':'cover';
    void(async()=>{try{await requireCommunity();const old=localProfile[kind];
      await updateProfileServer(currentPersonId(),{[kind+'_url']:null});
      localProfile={...localProfile,[kind]:null};rememberCurrentPerson();
      if(kind==='avatar')$('#sidebar-avatar').textContent='◎';
      renderAccount();await removeImageServer(old).catch(()=>{});showToast('Imagen retirada de tu perfil público.');
    }catch(error){showToast(error.message||'No se pudo retirar la imagen.');}})();return;
  }
  if (e.target.closest('[data-action="account-reset"]')) {
    if (!currentIdentity?.user?.email) return;
    void requestPasswordReset(currentIdentity.user.email)
      .then(() => showToast('Revisa tu correo para cambiar la contraseña.'))
      .catch(() => showToast('No se pudo enviar el enlace. Revisa la configuración del correo en Supabase.'));
    return;
  }
  const preset = e.target.closest('[data-theme-preset]');
  if (preset && choosePreset(preset.dataset.themePreset)) {
    renderAccount();
    showToast('Tema aplicado. Tu preferencia se guardó en este navegador.');
    return;
  }
  if (e.target.closest('[data-action="reset-theme"]')) {
    restoreDefault();
    renderAccount();
    showToast('Recuperamos los colores originales de MZT Conecta.');
  }
});
$('#account-panel').addEventListener('input', e => {
  if (e.target.id==='profile-bio') {
    const counter=$('#profile-bio-count');
    if(counter)counter.textContent=e.target.value.length;
  }
  if (e.target.matches('#custom-theme-form input[type="color"]')) {
    const field = $('#account-panel').querySelector(`[data-hex-for="${e.target.name}"]`);
    if (field) field.textContent = e.target.value.toUpperCase();
  }
});
$('#account-panel').addEventListener('change', async e => {
 if(!['profile-photo','profile-cover'].includes(e.target.id)||!e.target.files?.length||!currentPersonId())return;
 const input=e.target,kind=input.id==='profile-cover'?'cover':'avatar';
 try{await requireCommunity();await editImage(input.files[0],kind,async image=>{
   try{const old=localProfile[kind];const url=await uploadDataImage(currentPersonId(),image);
    await updateProfileServer(currentPersonId(),{[kind+'_url']:url});
    localProfile={...localProfile,[kind]:url};rememberCurrentPerson();
    if(kind==='avatar')$('#sidebar-avatar').innerHTML=`<img src="${esc(url)}" alt="">`;
    renderAccount();await removeImageServer(old).catch(()=>{});
    showToast('Fotografía guardada en tu perfil público con el encuadre elegido.');
   }catch(error){showToast(error.message||'No se pudo guardar la imagen en Supabase.');}
  });
 }catch(error){showToast(error.message||'No se pudo editar la imagen.');}finally{input.value='';}
});
$('#account-panel').addEventListener('submit', async e => {
  if (e.target.id === 'custom-theme-form') {
    e.preventDefault();
    const form = new FormData(e.target);
    const palette = Object.fromEntries(['sidebar','primary','accent','background'].map(key => [key, String(form.get(key) || '')]));
    if (!chooseCustom(palette)) { showToast('Revisa los cuatro colores seleccionados.'); return; }
    renderAccount();
    showToast('Tu paleta personalizada ya está activa.');
  }
  if (e.target.id === 'profile-form') {
    e.preventDefault();
    const formData=new FormData(e.target);
    const name = String(formData.get('name') || '').trim();
    const username=normalizeUsername(formData.get('username'));
    const bio=String(formData.get('bio')||'').trim();
    if (name.length < 3 || name.length > 40 || /[<>\r\n]/.test(name)) {
      showToast('Usa un nombre de 3 a 40 caracteres, sin símbolos HTML.');
      return;
    }
    if(!validUsername(username)) {showToast('El @usuario necesita 3 a 20 letras, números, puntos o guiones bajos.');return;}
    if(bio.length>160) {showToast('La biografía no puede superar 160 caracteres.');return;}
    const button=e.target.querySelector('[type="submit"]');
    button.disabled=true;
    try {
      await requireCommunity();
      const profile=await updateProfileServer(currentPersonId(),{display_name:name,username,bio});
      currentIdentity={...currentIdentity,profile:{...currentIdentity.profile,display_name:profile.display_name}};
      localProfile={...localProfile,username:profile.username,bio:profile.bio};rememberCurrentPerson();
      renderAccount();showToast('Perfil actualizado en Supabase para toda la comunidad.');
    } catch(error) {showToast(error.message||'No se pudo guardar el perfil. Inténtalo de nuevo.');}
    finally {if(button.isConnected)button.disabled=false;}
  }
});
$('#public-profile-close').addEventListener('click',closePublicProfile);
$('#public-profile-overlay').addEventListener('click',e=>{if(e.target.id==='public-profile-overlay')closePublicProfile();});
$('#public-profile-content').addEventListener('click',e=>{
  if(e.target.id==='public-profile-edit') {closePublicProfile();setView('mi-cuenta');}
});
$('#public-profile-dialog').addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const focusables=[...$('#public-profile-dialog').querySelectorAll('button:not([disabled])')];
  const first=focusables[0],last=focusables.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
$('#sign-out').addEventListener('click', async () => {
  const button=$('#sign-out');button.disabled=true;
  try {await logoutAccount();onIdentityChange({status:'signed_out'});}
  catch {showToast('No se pudo cerrar sesión. Intenta de nuevo.');}
  finally {button.disabled=false;}
});
$('#side-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
$('#sidebar-report').addEventListener('click',openReportForm);
$('#composer-report').addEventListener('click',openReportForm);
$('#composer-create').addEventListener('click',openReportForm);
$('#refresh-now').addEventListener('click',()=>{void refreshCommunity();});
$('#trends-list').addEventListener('click',e=>{
  const b=e.target.closest('[data-trend-open]');if(!b)return;
  const item=items.find(i=>i.id===b.dataset.trendOpen);
  if(item)openPost(item);
});
$('#people-page').addEventListener('click',e=>{const p=e.target.closest('[data-profile-id]');if(p)openProfile(p.dataset.profileId);});
$('#profile-page').addEventListener('click',e=>{
 const p=e.target.closest('[data-profile-id]');if(p&&p.dataset.profileId!==profileId){openProfile(p.dataset.profileId);return;}
 const open=e.target.closest('[data-open]');if(open){openPost(items.find(i=>i.id===open.dataset.open));return;}
 const tab=e.target.closest('[data-profile-tab]');if(tab){profileTab=tab.dataset.profileTab;renderProfilePage();return;}
 const action=e.target.closest('[data-action]');if(!action)return;
 if(action.dataset.action==='edit-settings')return setView('configuracion');
 if(action.dataset.action==='back-profile')return setView(profileReturnView==='mi-cuenta'||profileReturnView==='publicacion'?'explorar':profileReturnView);
 if(action.dataset.action==='follow'){
  const p=personFor(profileId);if(p?.demo)return showToast('No puedes seguir un perfil ficticio.');
  void(async()=>{try{await requireCommunity();await followServer(currentPersonId(),profileId,isFollowing(currentPersonId(),profileId));await refreshCommunity({quiet:true});showToast('Seguimiento actualizado.');}
   catch(error){showToast(error.message||'No se pudo actualizar el seguimiento.');}})();return;
 }
 if(action.dataset.action==='locate'){const item=items.find(i=>i.id===action.dataset.id);if(item?.coordinates)openLocationModal(item);return;}
 if(action.dataset.action==='helpful'){const item=items.find(i=>i.id===action.dataset.id);if(item)void voteOn(item);}
});
$('#post-page').addEventListener('click',e=>{
 const person=e.target.closest('[data-profile-id]');if(person){openProfile(person.dataset.profileId);return;}
 const remove=e.target.closest('[data-delete-comment]');if(remove){
  void(async()=>{try{await requireCommunity();await deleteCommentServer(remove.dataset.deleteComment);await refreshCommunity({quiet:true});showToast('Comentario eliminado.');}
   catch(error){showToast(error.message||'No se pudo eliminar el comentario.');}})();return;
 }
 const resolve=e.target.closest('[data-resolve]');if(resolve){void resolveReport(resolve.dataset.resolve);return;}
 const decision=e.target.closest('[data-review]');if(decision){void review(decision.dataset.review,decision.dataset.decision);return;}
 const action=e.target.closest('[data-action]');if(!action)return;
 if(action.dataset.action==='back-post')return setView(postReturnView==='publicacion'?'explorar':postReturnView);
 if(action.dataset.action==='locate'){const item=items.find(i=>i.id===selectedId);if(item)openLocationModal(item);return;}
 if(action.dataset.action==='helpful'){const item=items.find(i=>i.id===selectedId);if(item)void voteOn(item);}
});
$('#post-page').addEventListener('submit',e=>{
 if(e.target.id!=='comment-form')return;e.preventDefault();
 const body=$('#comment-body').value.trim(),post=items.find(i=>i.id===selectedId);
 if(!post||post.demo)return showToast('Este ejemplo no admite comentarios.');
 const button=e.target.querySelector('button[type=submit]');button.disabled=true;
 void(async()=>{try{await requireCommunity();if(body.length<1||body.length>500)throw Error('El comentario debe tener entre 1 y 500 caracteres.');
   await createCommentServer(post.id,currentPersonId(),body);await refreshCommunity({quiet:true});showToast('Comentario publicado.');}
   catch(error){showToast(error.message||'No se pudo publicar el comentario.');}
   finally{if(button.isConnected)button.disabled=false;}})();
});
$('#picker-close').addEventListener('click',closePicker);
$('#picker-cancel').addEventListener('click',closePicker);
$('#picker-confirm').addEventListener('click',confirmPicker);
$('#picker-overlay').addEventListener('click',e=>{if(e.target.id==='picker-overlay')closePicker();});
$('#picker-dialog').addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    const focusables=[...$('#picker-dialog').querySelectorAll('button:not([disabled])')];
    const first=focusables[0],last=focusables.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
$('#location-close').addEventListener('click',closeLocationModal);
$('#location-overlay').addEventListener('click',e=>{
  if(e.target.id==='location-overlay')closeLocationModal();
});
$('#location-modal').addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    const focusables=[...$('#location-modal').querySelectorAll('button, a[href]')].filter(el=>!el.hidden);
    const first=focusables[0],last=focusables.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
$('#filter-row').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;enabled.has(b.dataset.filter)?enabled.delete(b.dataset.filter):enabled.add(b.dataset.filter);selectedId=null;render();});
$('#selected-date').addEventListener('change',e=>{date=e.target.value<=dateISO()?e.target.value:dateISO();selectedId=null;render();});
$('#previous-day').addEventListener('click',()=>{date=offsetDate(date,-1);selectedId=null;render();});
$('#next-day').addEventListener('click',()=>{if(date<dateISO())date=offsetDate(date,1);selectedId=null;render();});
$('#search-input').addEventListener('input',e=>{search=e.target.value;selectedId=null;render();});
$('#drawer-backdrop').addEventListener('click',closeDrawer);
$('#feed-content').addEventListener('click',e=>{
  const person=e.target.closest('[data-profile-id]');if(person){openProfile(person.dataset.profileId);return;}
  const open=e.target.closest('[data-open]');
  if(open){const item=items.find(i=>i.id===open.dataset.open);if(item)openPost(item);return;}
  const action=e.target.closest('[data-action]');if(action){
    if(action.dataset.action==='reset-filters'){enabled=new Set(['news','citizen','infrastructure']);search='';$('#search-input').value='';date=dateISO();render();}
    if(action.dataset.action==='create-report')openReportForm();
    if(action.dataset.action==='add-news'&&role==='editor')openNewsForm();
    if(action.dataset.action==='retry-community'){void refreshCommunity();return;}
    if(action.dataset.action==='helpful'){
      const item=items.find(i=>i.id===action.dataset.id);if(item)void voteOn(item);
    }
    if(action.dataset.action==='locate'){
      const item=items.find(i=>i.id===action.dataset.id);
      if(item?.coordinates){openLocationModal(item);}
      else showToast('Esta publicación no tiene una ubicación en el mapa.');
    }
    if(action.dataset.action==='profile')openPublicProfile();
    return;
  }
  const reviewBtn=e.target.closest('[data-review]');if(reviewBtn)review(reviewBtn.dataset.review,reviewBtn.dataset.decision);
});
$('#drawer').addEventListener('click',e=>{
  const action=e.target.closest('[data-action]');
  if(action){if(action.dataset.action==='close-drawer')closeDrawer();return;}
  if(e.target.closest('#choose-map-point')){pickLocation();return;}
  const resolveBtn=e.target.closest('[data-resolve]');if(resolveBtn){resolveReport(resolveBtn.dataset.resolve);return;}
  const reviewBtn=e.target.closest('[data-review]');if(reviewBtn){review(reviewBtn.dataset.review,reviewBtn.dataset.decision);return;}
  const focusBtn=e.target.closest('[data-focus]');if(focusBtn){const i=items.find(x=>x.id===focusBtn.dataset.focus);if(i)openLocationModal(i);return;}
});
$('#drawer').addEventListener('change',e=>{
  if(e.target.id==='report-type'){
    const type=e.target.value;
    $('#report-category').innerHTML=CATEGORY_OPTIONS[type].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  if(e.target.id==='report-place'){
    if(e.target.value==='none'){chosenCoordinates=null;customMapPoint=false;$('#coordinates-hint').textContent='No se mostrará ubicación en esta publicación.';return;}
    const place=PLACES[Number(e.target.value)];
    if(place){chosenCoordinates=place.coordinates.slice();customMapPoint=false;$('#coordinates-hint').textContent=`Punto aproximado: ${chosenCoordinates[1].toFixed(4)}, ${chosenCoordinates[0].toFixed(4)}. Pulsa «Mapa» para precisar.`;}
  }
});
$('#drawer').addEventListener('submit',e=>{
  if(e.target.id==='report-form')handleReportSubmit(e);
  if(e.target.id==='news-form')handleNewsSubmit(e);
  if(e.target.id==='reject-form')handleRejectSubmit(e);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#crop-overlay').hidden){closeCrop();return;}if(!$('#public-profile-overlay').hidden){closePublicProfile();return;}if(!$('#picker-overlay').hidden){closePicker();return;}if(!$('#location-overlay').hidden){closeLocationModal();return;}closeDrawer();}});

// Pequeñas funciones de consola para reiniciar datos locales de ejemplo durante el desarrollo.
window.MZTConectaDemo={reset(){resetDemo();location.reload();}, getStatus(){return {items:items.length,role,day:date,view};}};

function setAuthView(next) {
  if(!['login','register','forgot','recover'].includes(next)) return;
  authView=next;
  $('#auth-tabs').hidden=!['login','register'].includes(next);
  document.querySelectorAll('#auth-gate .auth-form').forEach(form => {form.hidden=form.id!==`${next}-form`;});
  document.querySelectorAll('[data-auth-view]').forEach(button => {
    button.classList.toggle('selected',button.dataset.authView===next);
    button.setAttribute('aria-pressed',String(button.dataset.authView===next));
  });
  $('#auth-feedback').hidden=true;
}
function setAuthFeedback(message, error=false) {
  const feedback=$('#auth-feedback');
  feedback.textContent=message;
  feedback.dataset.kind=error?'error':'success';
  feedback.hidden=false;
}
function ensureMap() {
  if(mapStarted) {resizeMap();return;}
  mapStarted=true;
  initMap({onSelect(id){
    const item=items.find(i=>i.id===id);if(!item)return;
    selectedId=id;render();
    const cardEl=Array.from(document.querySelectorAll('#feed-content [data-post-id]')).find(n=>n.dataset.postId===id);
    cardEl?.scrollIntoView({behavior:'smooth',block:'nearest'});
    openPost(item);
  },onFail(){ $('#map-fallback').hidden=false; }})
    .then(ok=>{if(ok){$('#map-fallback').hidden=true;setMapItems(view==='explorar'?visibleForDay().filter(i=>i.coordinates):[],selectedId);setTimeout(resizeMap,400);}});
}
function onIdentityChange(state) {
  if (state.status==='loading') return;
  if (state.status==='signed_in') {
    currentIdentity=state;
    role=state.role;
    localProfile=loadLocalProfile(state.user.id);
    clearSocialSnapshot();communityReady=false;communityError='';items=getItems().filter(i=>i.demo);
    rememberCurrentPerson();
    $('#sidebar-avatar').innerHTML=localProfile.avatar?`<img src="${esc(localProfile.avatar)}" alt="">`:'◎';
    $('#auth-configuration').hidden=true;
    if(state.recovery){
      $('.app-shell').hidden=true;
      $('#auth-gate').hidden=false;
      setAuthView('recover');
      return;
    }
    $('#auth-gate').hidden=true;
    $('.app-shell').hidden=false;
    if(!canOpenView(view))view='explorar';
    render();
    ensureMap();
    void refreshCommunity();
    return;
  }
  currentIdentity=null;clearSocialSnapshot();communityReady=false;communityError='';items=getItems().filter(i=>i.demo);
  role='visitante';
  localProfile={username:'',bio:'',avatar:null,cover:null};
  closePublicProfile();
  closeDrawer();
  closePicker();
  closeLocationModal();
  view='explorar';
  $('.app-shell').hidden=true;
  $('#auth-gate').hidden=false;
  setAuthView('login');
  $('#auth-configuration').hidden=state.status!=='unconfigured';
  if(state.status==='error')setAuthFeedback(state.message||'No fue posible conectarse con Supabase.',true);
}
document.querySelectorAll('[data-auth-view]').forEach(button => button.addEventListener('click',()=>setAuthView(button.dataset.authView)));
for(const form of document.querySelectorAll('#auth-gate .auth-form')) {
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;
    const data=new FormData(form);
    const email=String(data.get('email')||'').trim();
    const password=String(data.get('password')||'');
    const confirm=String(data.get('confirm')||'');
    try {
      if (authView==='login') {
        await loginAccount(email,password);
        await refreshIdentity();
      } else if(authView==='register') {
        if(password!==confirm)throw Error('Las contraseñas no coinciden.');
        const result=await createAccount(email,password);
        form.reset();
        if(result.session) {
          await refreshIdentity();
        } else {
          setAuthFeedback('Registro recibido. Revisa tu correo y confirma la cuenta antes de iniciar sesión.');
        }
      } else if(authView==='forgot') {
        await requestPasswordReset(email);
        setAuthFeedback('Si tu correo está registrado, recibirás un enlace para recuperar tu contraseña.');
      } else if(authView==='recover') {
        if(password!==confirm)throw Error('Las contraseñas no coinciden.');
        await changePassword(password);
        form.reset();
        await refreshIdentity();
        showToast('Contraseña actualizada.');
      }
    } catch(error) {
      setAuthFeedback(error?.message || 'No fue posible completar la operación. Inténtalo de nuevo.',true);
    } finally {button.disabled=false;}
  });
}
void initializeAuth(onIdentityChange);
