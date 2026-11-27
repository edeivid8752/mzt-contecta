import {CATEGORY_OPTIONS, PLACES, TYPE_INFO, dateISO, offsetDate, WALL_TOPICS, matchesWallTopic} from './data.js?v=2.4.2';
import {initMap, setMapItems, focusMapItem, resizeMap, setRegionData, setSelectedRegion, refreshEmbeddedMaps, destroyEmbeddedMaps, createLocationPreview, destroyLocationPreview, createPickerMap, destroyPickerMap, resetMainMap} from './map.js?v=2.4.4-r1';
import {loadBundledRegions,setRegions,regionNames,pointInRegion,matchingRegion} from './regions.js';
import {THEMES, themeSelection, activePalette, applyTheme, choosePreset, chooseCustom, restoreDefault} from './theme.js';
import {initializeAuth, refreshIdentity, createAccount, loginAccount, logoutAccount, requestPasswordReset, changePassword, requestEmailVerification} from './auth.js';
import {loadLocalProfile, normalizeUsername, validUsername} from './profile.js';
import {editImage,closeCrop} from './crop.js';
import {authorIdFor,personFor,syncPerson,followersOf,followingOf,isFollowing,commentsFor,countComments,localPersonIds,setSocialSnapshot,clearSocialSnapshot,voteCountFor} from './social.js';
import {SUPABASE_URL} from './supabase-config.js';
import {loadNotificationsV13,socialAction,loadCommunity,createPost,editEditorialNews,updateProfileServer,createCommentServer,deleteCommentServer,followServer,voteServer,moderatePostServer,resolvePostServer,uploadDataImage,removeImageServer} from './remote.js?v=2.4.1';

import {selectTrends, avatarInitial} from './community-v12.js';
import {parseRoute, postPath, profilePath, sections, viewPaths, authPaths} from './router-v21.js?v=2.4.4';
import {createAds} from './commerce-v222.js?rev=2';
import {keepCurrentViewOnIdentity} from './session-view-v222.js';
import {submitVisitorPost,reportSnapshot,zones,zoneSet,reportAction,trackedType,similarReports,reportProgress,labels as reportLabels} from './community-v23.js';
let reportRecords={},zoneAlerts=[],zoneReady=false;
import {installColorPicker,selectFollowing} from './community-v13.js';
import {createForum} from './forum-v20.js?v=2.4.5-r2';
import {installSelects,refreshSelects} from './selectors-v20.js';
import {setupDaily,mazatlanDay} from './daily-bar.js?v=2.4.1';
import {officialToday,newApprovedIds,installPhotoViewer} from './experience-v243.js?v=2.4.3';
import {combinedTopics,pruneTopics,matchesSelection,sectionOf,wallPath,installMobileMenu} from './experience-v244.js?v=2.4.4';
let feedMode='explorar',guestMode=false,replyId=null,socialState={saved:[],notifications:[],flags:[],commentVotes:[]};
let routeReady=false,routeLock=false,pendingRoute=null,sessionChecked=false,returnAfterLogin=null;
const recoveryAtBoot=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery'||new URLSearchParams(location.search).get('type')==='recovery';let recoveryCompleted=false;

const $ = sel => document.querySelector(sel);
let items = []; // Solo publicaciones de Supabase
let communityReady=false;
let communityError='';
let loadingCommunity=false;
let newPostItems=[],checkingNewPosts=false,activeMapTransition=null;
const mobileViewport=matchMedia('(max-width:820px)');
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
let advanced = {period:'all',from:'',to:'',region:'all',sort:'newest',located:false};
let geoRegionsAvailable=false;
let mapIsExpanded=false;
let mapExpandFocus=null;
let selectedId = null;
let search = '';
let wallSection='news',activeSections=new Set(['news']),topics=new Set(),connectionsId=null,connectionsMode='followers';
let forum=null,updateDaily=null,dockQueued=false,ads=null;
let chosenCoordinates = PLACES[0].coordinates.slice();
let customMapPoint = false;
let pickerReturnFocus = null;
let pickerCoords = null;
let toastTimer = null;
applyTheme();
let helpfulVotes = new Set();
async function refreshCommunity({quiet=false}={}){
 if(loadingCommunity)return;
 loadingCommunity=true;
 const requestedUserId=currentPersonId(),requestedGuest=guestMode;
 try{
  const snapshot=await loadCommunity(guestMode);
  const records=await reportSnapshot(snapshot.items.filter(trackedType).map(p=>p.id)).catch(()=>({}));
  const alertZones=requestedUserId?await zones().catch(()=>null):[];
  if(currentPersonId()!==requestedUserId||guestMode!==requestedGuest)return;
  setSocialSnapshot(snapshot);socialState=snapshot;reportRecords=records;zoneAlerts=alertZones||[];zoneReady=alertZones!==null;
  $('#notification-count').textContent=snapshot.notifications.filter(n=>!n.read_at).length||'';
  items=snapshot.items;newPostItems=[];
  const me=snapshot.people.find(p=>p.id===currentPersonId());
  if(me){localProfile={username:me.username,bio:me.bio||'',avatar:me.avatar||null,cover:me.cover||null};
   currentIdentity.profile={...currentIdentity.profile,display_name:me.name};}
  helpfulVotes=new Set(snapshot.votes.filter(v=>v.userId===currentPersonId()).map(v=>v.postId));
  communityReady=true;communityError='';
  if(pendingRoute){const r=pendingRoute;pendingRoute=null;resolveRouteContent(r);if(r.view==='publicacion'){const target=items.find(p=>p.id===r.id);if(target)writeRoute(postPath(target),true);}}
  rememberCurrentPerson();
  $('#sidebar-avatar').innerHTML=localProfile.avatar?`<img src="${esc(localProfile.avatar)}" alt="">`:'◎';
  render();return true;
 }catch(error){if(currentPersonId()!==requestedUserId||guestMode!==requestedGuest)return;communityReady=false;communityError=error.message||'No fue posible cargar la comunidad.';
  if(!quiet)showToast('No se cargaron los datos. Revisa la migración v1.3 y la conexión a Supabase.');
  render();
 }finally{loadingCommunity=false;if((currentPersonId()!==requestedUserId||guestMode!==requestedGuest)&&(currentPersonId()||guestMode))void refreshCommunity({quiet:true});}
}
async function requireCommunity(){
 if(!communityReady)throw Error('La comunidad no está conectada. Verifica la migración v1.3 y vuelve a entrar.');
}
async function voteOn(item){
 if(!currentPersonId())return notSignedIn();
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
  return item.type==='social'&&item.eventDay?item.eventDay===day:item.day===day;
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
function updateComposerAvatar(){
  const el=$('#composer-avatar');
  const name=currentIdentity?.profile?.display_name||'Visitante';
  const url=imageURL(localProfile.avatar);
  el.innerHTML=url?`<img src="${esc(url)}" alt="">`:esc(avatarInitial(name));
}
function postAuthorByline(item){
  if(item.visitorPost)return 'Publicación de un visitante';
  const own=ownPost(item);
  const username=own?localProfile.username:personFor(authorIdFor(item))?.username;
  return username?'@'+username:'';
}
function currentPersonId(){return currentIdentity?.user?.id||'';}
function currentPerson(){return personFor(currentPersonId())||{id:currentPersonId(),name:currentIdentity?.profile?.display_name||'Mi perfil',username:localProfile.username,bio:localProfile.bio,avatar:localProfile.avatar,cover:localProfile.cover};}
function rememberCurrentPerson(){if(currentIdentity?.user?.id)syncPerson(currentIdentity.user.id,currentIdentity.profile?.display_name||'Mi perfil',localProfile);}
function openProfile(id){
 if(!currentPersonId()){const p=personFor(id);if(p){returnAfterLogin=profilePath(p);return showAuth('login');}return notSignedIn();}
  closeExpandedMap();
  if(!id||!personFor(id))return showToast('No encontramos ese perfil en la comunidad.');
  profileReturnView=['explorar','moderacion','personas','mi-cuenta','publicacion','connections','foro'].includes(view)?view:'explorar';
  pendingRoute=null;profileId=id;profileTab='publicaciones';view='mi-cuenta';render();scrollTopPage();
}
function openPost(item){
  closeExpandedMap();
  if(!item)return;
  if(view!=='publicacion')postReturnView=view;
  replyId=null;
  pendingRoute=null;selectedId=item.id;view='publicacion';render();scrollTopPage();
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
function publishedForDay(){return items.filter(i=>isLiveOn(i,dateISO()));}
function dateMatches(item){
  const today=dateISO();
  if(item.day>today)return false;
  if(advanced.period==='today')return item.day===today;
  if(advanced.period==='week')return item.day>=offsetDate(today,-6);
  if(advanced.period==='month')return item.day>=offsetDate(today,-29);
  if(advanced.period==='custom')return (!advanced.from||item.day>=advanced.from)&&(!advanced.to||item.day<=advanced.to);
  return true;
}
function regionMatches(item){
  if(advanced.region==='all')return true;
  // Primero respetamos polígonos validados; si todavía no existe el polígono, usamos
  // solamente la zona indicada explícitamente por el autor (sin inferir cercanía).
  if(item.coordinates&&matchingRegion(advanced.region).length)
    return pointInRegion(item.coordinates,advanced.region);
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  return normalize(item.location)===normalize(advanced.region);
}
function visibleForDay(sourceItems=items){
  const q=search.toLocaleLowerCase('es').trim();
  const source=feedMode==='siguiendo'&&currentPersonId()?selectFollowing(sourceItems,[...new Set(sourceItems.map(authorIdFor))].filter(id=>isFollowing(currentPersonId(),id)),authorIdFor):sourceItems;
  const list=source.filter(i=>i.review==='approved'&&matchesSelection(i,activeSections,topics)&&dateMatches(i)&&regionMatches(i)
    &&(!advanced.located||Boolean(i.coordinates)))
    .filter(i=>!q||[i.title,i.description,i.category,i.location].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));
  return list.sort((a,b)=>{
    if(advanced.sort==='votes')return voteCount(b)-voteCount(a) || String(b.createdAt).localeCompare(String(a.createdAt));
    const order=String(b.createdAt||b.day+'T'+b.clock).localeCompare(String(a.createdAt||a.day+'T'+a.clock));
    return advanced.sort==='oldest'?-order:order;
  });
}
function regionOptions(){
  const seen=new Map();
  for(const name of [...regionNames(),...PLACES.map(p=>p.name),...items.filter(i=>i.coordinates&&i.location!=='Punto seleccionado en el mapa').map(i=>i.location)]){
    const normalized=String(name||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
    if(normalized&&normalized!=='toda la ciudad'&&!seen.has(normalized))seen.set(normalized,name);
  }
  return [...seen.values()].sort((a,b)=>a.localeCompare(b,'es'));
}
function syncAdvancedForm(){
  const field=$('#filter-region');
  const options=regionOptions();
  if(advanced.region!=='all'&&!options.includes(advanced.region))options.push(advanced.region);
  field.innerHTML='<option value="all">Todas las zonas</option>'+options.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  $('#filter-period').value=advanced.period;
  $('#filter-date-from').value=advanced.from;
  $('#filter-date-to').value=advanced.to;
  $('#filter-region').value=advanced.region;
  $('#filter-sort').value=advanced.sort;
  $('#filter-located').checked=advanced.located;
  $('#filter-custom-dates').hidden=advanced.period!=='custom';
  $('#region-source-hint').textContent=geoRegionsAvailable
    ? 'Contornos cargados: las publicaciones con coordenadas se asignan por límites geográficos.'
    : 'Sin polígonos cargados: se filtra únicamente por la ubicación escrita o seleccionada en la publicación.';
  const count=Number(advanced.period!=='all')+Number(advanced.region!=='all')+Number(advanced.sort!=='newest')+Number(advanced.located);
  $('#filter-active-count').textContent=String(count);
  $('#filter-active-count').hidden=count===0;
  setSelectedRegion(advanced.region==='all'?null:advanced.region);
}
function resetAllFilters(){
  topics.clear();selectedId=null;advanced={period:'all',from:'',to:'',region:'all',sort:'newest',located:false};
  search='';$('#search-input').value='';syncAdvancedForm();render();
}
function toggleFilters(open){
  $('#advanced-filters-panel').hidden=!open;
  $('#advanced-filters-toggle').setAttribute('aria-expanded',String(open));
  if(open){syncAdvancedForm();$('#filter-period').focus({preventScroll:true});}
}
function scheduleMapCards(){requestAnimationFrame(()=>refreshEmbeddedMaps());}
function embeddedMap(item){
  if(!Array.isArray(item.coordinates)||item.coordinates.length!==2||!item.coordinates.every(Number.isFinite))return '';
  const [lon,lat]=item.coordinates;
  return `<div class="embedded-map-shell" aria-label="Mapa de esta publicación"><div class="post-embedded-map" data-coords="${lon},${lat}" data-type="${esc(item.type)}" data-category="${esc(item.category)}" data-title="${esc(item.title)}" data-resolved="${!!item.resolvedAt}" role="region" aria-label="Ubicación de ${esc(item.title)}; un solo marcador"></div></div>`;
}
function openExpandedMap(){
  if(mapIsExpanded||view!=='explorar')return;
  mapIsExpanded=true;mapExpandFocus=document.activeElement;
  $('#expanded-map-overlay').hidden=false;$('#mobile-map-return').hidden=true;
  $('#expanded-map-host').appendChild($('#map'));
  $('#expanded-map-count').textContent=`${visibleForDay().filter(i=>i.coordinates).length} publicaciones con ubicación según los filtros activos`;
  $('#expanded-map-close').focus({preventScroll:true});
  requestAnimationFrame(resizeMap);
}
function closeExpandedMap(){
  if(!mapIsExpanded)return;
  mapIsExpanded=false;
  $('#map-panel').prepend($('#map'));
  $('#expanded-map-overlay').hidden=true;scheduleDock();
  requestAnimationFrame(resizeMap);
  if(mapExpandFocus?.isConnected)mapExpandFocus.focus({preventScroll:true});
}
function goHome(){
  closeExpandedMap();toggleFilters(false);wallSection='news';activeSections=new Set(['news']);topics=pruneTopics(topics,activeSections);feedMode='explorar';writeRoute('/');
  setView('explorar');
  $('.main-area').scrollTo({top:0,behavior:'smooth'});
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(resizeMap);
}
function updateStats(){
  const pub=publishedForDay();
  $('#count-social').textContent=pub.filter(i=>i.type==='social').length;
  $('#count-news').textContent=pub.filter(i=>i.type==='news').length;
  $('#count-citizen').textContent=pub.filter(i=>i.type==='citizen').length;
  $('#count-infrastructure').textContent=pub.filter(i=>i.type==='infrastructure').length;
  const waiting=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review)).length;
  $('#mod-count').hidden = !['lector','editor'].includes(role)||waiting===0;
  $('#mod-count').textContent=waiting;
}
function voteCount(item) {
  return voteCountFor(item.id);
}
function renderTrends(){
  // Ventana móvil de 168 horas desde la creación, independiente de los filtros del muro.
  const candidates=selectTrends(visibleForDay(),voteCount);
  $('#trends-list').innerHTML=candidates.length ? candidates.map((item,index)=>`
    <button type="button" class="trend-item" data-trend-open="${esc(item.id)}" aria-label="Abrir publicación: ${esc(item.title)}">
      <span class="trend-rank">${index+1}</span>
      <span class="trend-copy"><strong>${esc(short(item.title,68))}</strong><small>${esc(typeLabel(item))}</small></span>
      <span class="trend-votes" aria-label="${voteCount(item)} votos"><span aria-hidden="true">▲</span>${voteCount(item)}</span>
    </button>`).join('') : '<p class="trends-empty">Todavía no hay publicaciones aprobadas de los últimos 7 días.</p>';
}
function emailVerificationMarkup(){
  const verified=currentIdentity?.emailVerified;
  if(verified===true)return '<strong>Correo electrónico verificado</strong><p>La dirección de correo de tu cuenta está confirmada.</p>';
  if(verified===false)return '<strong>Correo electrónico pendiente de verificar</strong><p>Puedes usar tu cuenta y verificar el correo cuando quieras. Abre el enlace recibido en tu correo para confirmar que te pertenece.</p><button type="button" class="profile-public-link" data-action="verify-email">Verificar correo electrónico</button>';
  return '<strong>Estado del correo no disponible</strong><p>Intenta comprobarlo nuevamente.</p><button type="button" class="profile-public-link" data-action="refresh-email-verification">Comprobar estado</button>';
}
function syncEmailVerification(){
  const el=$('#v24-email-verification');if(el)el.innerHTML=emailVerificationMarkup();
}
function renderAccount() {
  const picked = themeSelection();
  const colors = activePalette();
  const name = currentIdentity?.profile?.display_name || 'Mi perfil';
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
      <input type="hidden" name="${id}" value="${colors[id]}"><button type="button" class="hsv-swatch" data-hsv-pick="${id}" style="background-color:${colors[id]}" aria-label="Elegir color: ${label}"></button>
      <span class="color-hex" data-hex-for="${id}">${colors[id].toUpperCase()}</span>
    </label>`).join('');
  $('#account-panel').innerHTML = `
    <div class="account-heading"><span class="account-eyebrow">A TU MANERA</span><h1>Configuración <em>y apariencia.</em></h1>
      <p>Edita tus datos, ajusta tus fotografías y elige los colores de MZT Conecta.</p></div>
    <div class="account-grid">
      <section class="account-card profile-card" aria-labelledby="profile-heading">
        <div class="account-card-heading"><span class="account-card-icon">◎</span><div><small>PERFIL</small><h2 id="profile-heading">Tus datos</h2></div></div>
        <div class="profile-person"><span data-avatar-preview>${avatarMarkup(name)}</span><div><strong>${esc(name)}</strong><small>@${esc(localProfile.username)}</small><small>${esc(currentIdentity?.user?.email || '')}</small></div></div>
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
        <div id="v24-email-verification" class="v24-email-verification" aria-live="polite">${emailVerificationMarkup()}</div>
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
  const posts=items.filter(i=>authorIdFor(i)===id && (i.review==='approved'||id===currentPersonId()||role==='editor'||role==='lector')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const filtered=profileTab==='reportes'?posts.filter(i=>i.type!=='news'):posts;
  const followAction=own?'<button type="button" class="social-button" data-action="edit-settings">Editar perfil</button>':
    `<button type="button" class="social-button" data-action="follow" data-profile-id="${esc(id)}" >${isFollowing(currentPersonId(),id)?'Siguiendo ✓':'Seguir'}</button>`;
  $('#profile-page').innerHTML=`
    <div class="social-back-row"><button type="button" class="back-link" data-action="back-profile">‹ Volver</button><span>PERFIL DE LA COMUNIDAD</span></div>
    <div class="social-profile-card">
      <div class="social-cover" ${imageURL(person.cover)?`style="background-image:url('${esc(imageURL(person.cover))}')"`:''}><span>MAZATLÁN · SINALOA</span></div>
      <div class="social-profile-body"><div class="social-profile-top">${personAvatar(person,'social-big-avatar')}<div class="social-profile-actions">${followAction}</div></div>
        <h1>${esc(person.name)}</h1><p class="social-handle">@${esc(person.username)}</p>
        <p class="social-bio">${esc(person.bio||'Todavía no hay una biografía.')}</p>
        <div class="social-stats"><span><strong>${posts.length}</strong> publicaciones</span><button type="button" data-connections="followers"><strong>${followersOf(id)}</strong> seguidores</button><button type="button" data-connections="following"><strong>${followingOf(id)}</strong> seguidos</button></div>
      </div>
    </div>
    <div class="profile-feed-heading"><div><span>ACTIVIDAD DEL PERFIL</span><h2>Publicaciones</h2></div><div class="profile-feed-tabs"><button type="button" data-profile-tab="publicaciones" class="${profileTab==='publicaciones'?'active':''}">Todas</button><button type="button" data-profile-tab="reportes" class="${profileTab==='reportes'?'active':''}">Reportes</button></div></div>
    <div class="profile-post-list">${filtered.length?filtered.map(card).join(''):'<p class="social-empty">Este perfil todavía no tiene publicaciones en esta sección.</p>'}</div>
    <p class="social-disclaimer">Los perfiles y las publicaciones aprobadas se comparten entre usuarios registrados.</p>`;
}
function renderPeoplePage(){
  const ids=[currentPersonId(),...localPersonIds().filter(id=>id!==currentPersonId())].filter(Boolean);
  $('#people-page').innerHTML=`<div class="social-section-head"><span>LA COMUNIDAD</span><h1>Explora perfiles <em>de Mazatlán.</em></h1><p>Descubre las cuentas registradas y participa en tu comunidad.</p></div>
    <div class="people-grid">${ids.map(id=>{const person=personFor(id);if(!person)return '';return `<button type="button" class="person-tile" data-profile-id="${esc(id)}">${personAvatar(person)}<span><strong>${esc(person.name)}</strong><small>@${esc(person.username)}</small></span></button>`;}).join('')}</div>
    <p class="social-disclaimer">Perfiles de usuarios registrados en MZT Conecta.</p>`;
}
function reportAuthor(item,person,compact=false){
 if(item.visitorPost)return '<span class="v23-visitor">'+personAvatar({name:'Visitante'},compact?'post-avatar':'person-avatar')+'<span><strong>Visitante</strong><small>Publicación de un visitante</small></span></span>';
 return '<button type="button" class="person-inline" data-profile-id="'+esc(person.id)+'">'+personAvatar(person,compact?'post-avatar':'person-avatar')+'<span class="post-author-block"><strong>'+esc(person.name)+'</strong><small>'+esc(postAuthorByline(item))+'</small></span></button>';
}
function progressMarkup(item,compact=false){
 if(!trackedType(item))return '';
 const r=reportProgress(item,reportRecords[item.id]);
 const duration=r.days===null?'':(r.state==='resolved'?'Resuelto en ':'Tiempo abierto: ')+(r.days===0?'menos de un día':r.days+' '+(r.days===1?'día':'días'));
 const count=r.confirmations===null?'Confirmaciones no disponibles':r.confirmations+' '+(r.confirmations===1?'confirmación':'confirmaciones');
 const active=item.review==='approved'&&!item.resolvedAt;
 const controls=active?(currentPersonId()?'<button type="button" class="v13-panel-button" data-v23="confirm" data-v23-id="'+esc(item.id)+'" '+(r.confirmed?'disabled':'')+'>'+(r.confirmed?'Ya confirmaste':'Confirmar que persiste')+'</button>':'<button type="button" class="v13-panel-button" data-v13="login">Inicia sesión para confirmar</button>')+(role==='editor'? (r.state!=='tracking'?'<button type="button" class="v13-panel-button" data-v23="track" data-v23-id="'+esc(item.id)+'">Iniciar seguimiento</button>':'')+'<button type="button" class="v13-panel-button" data-v23="resolve" data-v23-id="'+esc(item.id)+'">Marcar como resuelto</button>':''):'';
 const history=r.events.map(e=>'<li>'+esc(reportLabels[e.state])+' <span class="v23-history-date">'+esc(e.legacy?String(e.at).slice(0,10):new Date(e.at).toLocaleString('es-MX'))+'</span></li>').join('');
 return '<section class="v23-progress'+(compact?' compact':'')+'" aria-label="Seguimiento del reporte"><strong class="v23-state">'+esc(reportLabels[r.state]||statusLabel(item))+'</strong>'+(duration?'<span>'+esc(duration)+'</span>':'')+'<span>'+esc(count)+'</span>'+(!compact?'<h3>Historial de seguimiento</h3><ol>'+history+'</ol><div class="v13-actions">'+controls+'</div><small>Las confirmaciones son aportaciones comunitarias; no acreditan una intervención oficial.</small>':'')+'</section>';
}
function renderPostPage(){
  const item=items.find(i=>i.id===selectedId);
  if(!item){$('#post-page').innerHTML='<p role="status">'+(communityReady?'Publicación no disponible.':'Cargando publicación…')+'</p><button class="back-link" data-action="back-post" type="button">‹ Volver al muro</button>';return;}
  const person=personFor(authorIdFor(item))||{id:authorIdFor(item),name:item.sourceName||'Comunidad de Mazatlán',username:'comunidad_mzt'};
  const ownAuthor=authorIdFor(item)===currentPersonId();
  const rows=commentsFor(item.id);
  const moderation=role==='editor'&&['pending','reviewed'].includes(item.review)
    ?`<div class="post-moderation"><strong>Moderación editorial</strong><button type="button" data-review="${esc(item.id)}" data-decision="approved">Aprobar</button><button type="button" data-review="${esc(item.id)}" data-decision="rejected">Rechazar</button>${item.review==='pending'?`<button type="button" data-review="${esc(item.id)}" data-decision="reviewed">Marcar revisado</button>`:''}</div>`
    :role==='lector'&&item.review==='pending'?`<div class="post-moderation"><strong>Revisión de solo lectura: no puedes cambiar estados.</strong></div>`
    :role==='editor'&&item.type==='infrastructure'&&item.review==='approved'&&!item.resolvedAt?`<div class="post-moderation"><strong>Seguimiento</strong><button type="button" data-resolve="${esc(item.id)}">Marcar como atendido</button></div>`:'';
  $('#post-page').innerHTML=`<div class="social-back-row"><button class="back-link" type="button" data-action="back-post">‹ Volver a las publicaciones</button><span>PUBLICACIÓN</span></div>
    <article class="social-post-detail">
      <div class="post-detail-author">${reportAuthor(item,person)}<span class="post-detail-time">${esc(item.day)} · ${esc(item.clock)}</span></div>
      <div class="post-detail-content"><span class="type-tag ${esc(item.type)}">${esc(typeLabel(item))}</span>${item.category?`<span class="post-topic">${esc(item.category)}</span>`:''}
        <h1>${esc(item.title)}</h1>${eventDateMarkup(item)}${item.description?`<p class="post-detail-description">${esc(item.description)}</p>`:''}
        ${imageURL(item.image)?`<img class="post-detail-image" src="${esc(imageURL(item.image))}" alt="Imagen de la publicación">`:''}
        ${embeddedMap(item)}
        ${isSafeURL(item.sourceUrl||item.externalUrl)?`<p><a href="${esc(isSafeURL(item.sourceUrl||item.externalUrl))}" target="_blank" rel="noopener noreferrer">${item.sourceUrl?'Consultar fuente original':'Abrir enlace externo'}</a></p>`:''}
        ${item.review!=='approved'?`<p class="social-local-note">${esc(statusLabel(item))}</p>`:''}
      </div>
      <div class="post-detail-actions"><button type="button" data-action="helpful" class="${helpfulVotes.has(item.id)?'voted':''}" aria-pressed="${helpfulVotes.has(item.id)}">▲ ${voteCount(item)} · Me sirve</button><span>▤ ${rows.length} comentarios</span>${ownAuthor?'<span>Tu publicación</span>':''}</div>
      ${moderation}
      ${progressMarkup(item)}
      ${v13PostActions(item)}
      <section class="post-comments" aria-labelledby="comments-heading"><div class="comment-heading"><h2 id="comments-heading">Comentarios</h2><span>${rows.length}</span></div>
        ${guestMode?'<p class="social-local-note"><button class="v13-panel-button" type="button" data-v13="login">Inicia sesión para comentar</button></p>':item.review!=='approved'?'<p class="social-local-note">Podrás comentar cuando un editor apruebe la publicación.</p>':'<form id="comment-form"><label for="comment-body" class="sr-only">Escribe un comentario</label><textarea id="comment-body" required minlength="1" maxlength="500" rows="3" placeholder="Escribe un comentario respetuoso…"></textarea><div><small>Máximo 500 caracteres · Comentario público</small><button type="submit" class="social-button">Comentar</button></div></form>'}
        <div class="comment-list">${rows.length?rows.map(c=>{const author=personFor(c.authorId)||{id:c.authorId,name:'Usuario',username:'ciudadano'};return `<article class="comment-item"><button type="button" class="person-inline" data-profile-id="${esc(author.id)}">${personAvatar(author)}<span><strong>${esc(author.name)}</strong><small>@${esc(author.username)} · ${esc(new Date(c.createdAt).toLocaleString('es-MX'))}</small></span></button><p>${v13MentionMarkup(c.text)}</p>${v13CommentActions(c,rows)}${(c.authorId===currentPersonId()||role==='editor')?`<button class="delete-comment" type="button" data-delete-comment="${esc(c.id)}">Eliminar comentario</button>`:''}</article>`;}).join(''):'<p class="social-empty">Todavía no hay comentarios. Puedes escribir el primero.</p>'}</div>
      </section>
    </article><p class="social-disclaimer">Los comentarios y votos se comparten entre usuarios registrados.</p>`;
}
function card(item){
  const typeClass=esc(item.type);
  const isOwn=ownPost(item);
  const author=item.owner==='remote' ? (isOwn ? (currentIdentity?.profile?.display_name || 'Tú') : (personFor(item.ownerUserId)?.name||'Persona de la comunidad')) : item.type==='news' ? (item.sourceName||'MZT Noticias') : 'Comunidad de Mazatlán';
  const voted=helpfulVotes.has(item.id);
  const image=imageURL(item.image)?`<img class="post-image" src="${esc(imageURL(item.image))}" alt="Imagen del reporte ciudadano" loading="lazy">`:'';
  const socialAuthor=personFor(authorIdFor(item))||{id:authorIdFor(item),name:author,username:'comunidad_mzt'};
  return `<article class="event-card ${selectedId===item.id?'selected':''}${view==='explorar'&&officialToday(item,mazatlanDay())?' v243-official-today':''}" data-post-id="${esc(item.id)}">
    <div class="post-byline">${reportAuthor(item,{...socialAuthor,name:isOwn?author:socialAuthor.name},true)}<span class="post-age">${esc(item.clock||'')}</span></div>
    <a class="post-open" href="${esc(postPath(item))}" data-open="${esc(item.id)}" aria-label="Ver publicación: ${esc(item.title)}">
      <div class="post-tags"><span class="type-tag ${typeClass}${item.resolvedAt?' resolved':''}"><span class="type-symbol symbol-${typeClass}"></span>${esc(typeLabel(item))}</span>${item.category?`<span class="post-topic">${esc(item.category)}</span>`:''}</div>
      <h3>${esc(item.title)}</h3>
      ${eventDateMarkup(item)}
      ${item.description?`<p class="post-excerpt">${esc(item.description)}</p>`:''}
      ${image}
      ${view==='mi-cuenta'&&isOwn?`<div class="pending-tag">${esc(statusLabel(item))}${item.rejectionReason?` · ${esc(short(item.rejectionReason,70))}`:''}</div>`:''}
    </a>
    ${embeddedMap(item)}
    ${progressMarkup(item,true)}
    <div class="post-actions">
      <button type="button" class="post-action ${voted?'voted':''}" data-action="helpful" data-id="${esc(item.id)}" aria-pressed="${String(voted)}"><span aria-hidden="true">▲</span> ${voteCount(item)} · ${voted?'Marcado útil':'Me sirve'}</button>
      <button type="button" class="post-action" data-open="${esc(item.id)}"><span aria-hidden="true">▤</span> Ver detalles</button>
      <button type="button" class="post-action" data-open="${esc(item.id)}">▤ ${countComments(item.id)} comentarios</button>
    </div>
    ${v13PostActions(item)}
  </article>`;
}
function empty(title,desc,buttonText='',action=''){
  return `<div class="empty-state"><span class="empty-icon">⌖</span><strong>${esc(title)}</strong><p>${esc(desc)}</p>${buttonText?`<button type="button" data-action="${esc(action)}">${esc(buttonText)}</button>`:''}</div>`;
}
function canOpenView(next){
  return (next==='tendencias'&&mobileViewport.matches)||['explorar','publicacion','foro','about','advertise'].includes(next) || (['mi-cuenta','configuracion','personas','guardados','notificaciones','connections','business','ad-admin'].includes(next) && role!=='visitante') || (next==='moderacion' && ['lector','editor'].includes(role)) || (next==='denuncias'&&role==='editor');
}
function updateNavigation(){
  document.querySelectorAll('.side-link[data-view]').forEach(button=>{
    const visible=canOpenView(button.dataset.view)&&(button.dataset.view!=='ad-admin'||!!ads?.isStaff());
    button.hidden=!visible;
    button.setAttribute('aria-hidden',String(!visible));
    if(!visible) button.classList.remove('active');
  });
  const waiting=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review)).length;
  $('#mod-count').hidden=!['lector','editor'].includes(role)||waiting===0;
}
function setView(next){
  if(next!=='explorar')closeExpandedMap();
  if(next==='foro'&&!routeLock){forum?.route({topic:'all',thread:null});writeRoute('/foro');}
  if(!canOpenView(next)) {if(!currentPersonId())return notSignedIn();showToast('Tu cuenta no tiene permiso para entrar a este apartado.');return;}
  if(!routeLock)pendingRoute=null;
  view=next; selectedId=null;
  if(next==='mi-cuenta')profileId=currentPersonId();
  document.querySelectorAll('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  if(['mi-cuenta','configuracion','personas','publicacion','guardados','notificaciones','denuncias','foro','about','connections','business','ad-admin','advertise','tendencias'].includes(next)) { render(); if(['guardados','notificaciones','denuncias'].includes(next))void refreshCommunity({quiet:true}); return; }
  const headings={explorar:['PUBLICACIONES DE LA COMUNIDAD','El muro de Mazatlán'], moderacion:role==='lector'?['PANEL DE REVISIÓN','Reportes por revisar']:['PANEL EDITORIAL','Revisión pendiente']};
  $('.mini-eyebrow').textContent=headings[next][0];
  $('#feed-title').textContent=headings[next][1];
  const hideFilters=next!=='explorar';
  $('#advanced-filters-toggle').hidden=hideFilters;
  if(hideFilters)toggleFilters(false);
  $('.filter-heading').hidden=hideFilters;
  $('#filter-row').hidden=hideFilters;
  $('.search-wrap').hidden=hideFilters;
  $('.compose-strip').hidden=next==='moderacion';
  render();if(next==='explorar')ensureMap();
}
function render() {
  updateComposerAvatar();
  if(!canOpenView(view)) view='explorar';
  arrangeMobileTrends();paintNewPosts();
  syncRoute();
  updateNavigation();
  document.querySelectorAll('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const alternate=['mi-cuenta','configuracion','personas','publicacion','guardados','notificaciones','denuncias','foro','about','connections','business','ad-admin','advertise','tendencias'].includes(view);
  $('#v13-panel').hidden=!['guardados','notificaciones','denuncias'].includes(view);
  const commercial=['business','ad-admin','advertise'].includes(view);$('#commerce-panel').hidden=!commercial;if(view!=='explorar')$('#mobile-map-return').hidden=true;if(!commercial)ads?.leave();
  $('#sign-out span:last-child').textContent=guestMode?'Iniciar sesión':'Cerrar sesión';
  $('.page-heading').hidden = alternate;
  if(view!=='explorar'){undockMap();clearMobileDock();}
  $('#map-panel').hidden = view!=='explorar';$('#map-home').hidden=view!=='explorar';
  $('#daily-bar').hidden=view!=='explorar';$('#wall-companion').hidden=view!=='explorar';$('.social-layout').classList.toggle('moderation-only',view==='moderacion');
  $('#forum-panel').hidden=view!=='foro';$('#about-panel').hidden=view!=='about';$('#connections-panel').hidden=view!=='connections';
  document.querySelectorAll('.v20-tabs [data-top-view]').forEach(b=>{if(b.dataset.topView===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#topic-filters').hidden=view!=='explorar';$('.compose-strip').hidden=view!=='explorar';
  updateDaily?.(items,mazatlanDay());
  $('.social-layout').hidden = alternate;
  $('#account-panel').hidden = view!=='configuracion';
  $('#profile-page').hidden=view!=='mi-cuenta';
  $('#post-page').hidden=view!=='publicacion';
  $('#people-page').hidden=view!=='personas';
  if(commercial){
    const panel=$('#commerce-panel');panel.hidden=false;
    if(!ads){panel.textContent='No se pudo abrir el panel comercial. Actualiza la página.';return;}
    void ads.show(view).catch(error=>{if(['business','ad-admin','advertise'].includes(view))panel.textContent=error?.message||'No se pudo abrir el panel comercial.';});return;
  }
  if(view==='tendencias'){updateStats();renderTrends();return;}
  if(view==='foro'){forum?.show();return;}
  if(view==='about'){renderAbout();return;}
  if(view==='connections'){if(pendingRoute?.username){$('#connections-panel').innerHTML='<p role="status">Cargando perfil…</p>';return;}renderConnections();return;}
  if(['guardados','notificaciones','denuncias'].includes(view)){renderV13Panel();return;}
  if(view==='configuracion'){renderAccount();return;}
  if(view==='mi-cuenta'){if(pendingRoute?.username){$('#profile-page').innerHTML='<p role="status">Cargando perfil…</p>';return;}if(profileId==='missing'){$('#profile-page').innerHTML='<p>Perfil no disponible.</p>';return;}renderProfilePage();scheduleMapCards();return;}
  if(view==='personas'){renderPeoplePage();return;}
  if(view==='publicacion'){renderPostPage();scheduleMapCards();return;}
  $('#feed-mode-tabs').hidden=view!=='explorar'||role==='visitante';
  $('#feed-mode-tabs').querySelectorAll('[data-feed-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.feedMode===feedMode)));
  updateStats();
  renderTrends();renderTopics();
  syncAdvancedForm();
  $('#result-count').textContent='0';
  let list=[];
  if(view==='explorar'){
    list=visibleForDay();
    $('#result-count').textContent=list.length;
    const located=list.filter(i=>i.coordinates);$('#expanded-map-count').textContent=located.length+' publicaciones con ubicación según los filtros activos';
    $('#feed-content').innerHTML=list.length?list.map(card).join('')
      :!activeSections.size?empty('Selecciona una o más secciones','Elige Social, Noticias o Infraestructura para explorar publicaciones.'):empty('Aún no hay publicaciones','Cuando la comunidad comparta sus primeros reportes, aparecerán aquí. Si utilizas filtros, prueba a limpiarlos.','Limpiar filtros','reset-filters');
    if(!communityReady)$('#feed-content').insertAdjacentHTML('afterbegin',`<div class="community-notice" role="status"><strong>${communityError?'Conexión pendiente':'Conectando con la comunidad…'}</strong><p>${esc(communityError||'Cargando publicaciones de la comunidad.')}</p><button type="button" data-action="retry-community">Reintentar conexión</button></div>`);
    ads?.wall();
    setMapItems(located,selectedId);
    scheduleMapCards();
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
    if(role==='editor') $('#feed-content').insertAdjacentHTML('afterbegin',editorialNewsPanel());
    setMapItems([],null);
  }
  document.querySelectorAll('#filter-row .filter-chip').forEach(btn=>{
    const on=activeSections.has(btn.dataset.filter);
    btn.classList.toggle('is-on',on);btn.setAttribute('aria-pressed',String(on));
  });
  refreshSelects();scheduleDock();
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
  $('#location-disclaimer').textContent='Ubicación aportada por el usuario. No significa que esté verificada oficialmente.';
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
function notSignedIn(){returnAfterLogin=location.pathname+location.search;showAuth('login');}
function openReportForm(){
  chosenCoordinates=null;
  customMapPoint=false;
  const initialType=wallSection==='news'?'citizen':wallSection;
  const categories=CATEGORY_OPTIONS[initialType].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  openDrawer(drawerHead('COMPARTE CON TU CIUDAD','Crear reporte ciudadano','El reporte quedará pendiente de revisión editorial.')+
    `<div class="drawer-body"><p class="form-note">Tu reporte será visible públicamente después de la aprobación de un Editor. Evita compartir datos sensibles o acusaciones sin verificar.</p>
      <form id="report-form">${role==='visitante'?'<p class="form-note">Se enviará como Publicación de un visitante. Se usará una sesión anónima de este navegador; máximo tres reportes cada 24 horas y revisión obligatoria.</p>':''}
        <div class="drawer-field"><label for="report-type">Tipo de reporte</label><select id="report-type" required><option value="social" ${initialType==='social'?'selected':''}>Social</option><option value="citizen" ${initialType==='citizen'?'selected':''}>Noticias · Aviso ciudadano</option><option value="infrastructure" ${initialType==='infrastructure'?'selected':''}>Infraestructura</option></select></div>
        <div class="drawer-field"><label for="report-category">Categoría</label><select id="report-category" required>${categories}</select></div>
        <div class="drawer-field"><label for="report-title">Título *</label><input id="report-title" maxlength="100" minlength="3" required placeholder="Ej. Corte de energía eléctrica"></div>
        <div class="drawer-field"><label for="report-description">Descripción (opcional)</label><textarea id="report-description" maxlength="800" placeholder="Si lo deseas, agrega un poco más de contexto…"></textarea></div>
        <div class="drawer-field" id="report-link-field" ${initialType==='infrastructure'?'hidden':''}><label for="report-link">Enlace externo (opcional)</label><input id="report-link" type="url" maxlength="2048" placeholder="https://..." ${initialType==='infrastructure'?'disabled':''}><small>Agrega una fuente, evento o sitio web relacionado.</small></div>
        <div class="drawer-field"><label for="report-place">Ubicación aproximada (opcional)</label><div class="location-choice"><select id="report-place"><option value="none" selected>Sin ubicación</option>${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select><button id="choose-map-point" class="soft-btn" type="button">⌖ Mapa</button></div><small id="coordinates-hint" class="picked-coords">Puedes elegir una zona o marcarla directamente en el mapa.</small><div class="v23-location-help"><button type="button" class="soft-btn" id="use-device-location">Usar mi ubicación actual</button><small>Solo con tu permiso; el GPS es opcional. La ubicación elegida se hará pública.</small></div></div>
        <div class="drawer-field"><label for="report-zone">Colonia (opcional)</label><input id="report-zone" maxlength="100" list="v23-places" placeholder="Nombre de la colonia"><datalist id="v23-places">${PLACES.map(p=>'<option value="'+esc(p.name)+'"></option>').join('')}</datalist><small>Permite recibir alertas sobre esta zona sin compartir coordenadas.</small></div>
        <div class="drawer-field" id="event-field" ${initialType==='social'?'':'hidden'}><label for="report-event">Fecha del evento (opcional)</label><input id="report-event" type="date" min="${dateISO()}"></div><div class="drawer-field"><label for="report-photo">Fotografía (opcional)</label><input id="report-photo" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG o WebP, máximo 4 MB. La imagen se publicará tras la aprobación del reporte.</small></div>
        <div class="drawer-field"><label class="policy-check"><input type="checkbox" required><span>Confirmo que la publicación no contiene datos personales sensibles, acusaciones ni información delictiva sin verificar.</span></label></div>
        <button type="submit" class="submit-btn">Enviar reporte para revisión</button>
      </form></div>`,'center');
}
function editorialNewsPanel(){
 const today=mazatlanDay(),news=items.filter(i=>i.type==='news'&&i.review==='approved').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 return '<div class="editor-tools"><button type="button" class="soft-btn" data-action="add-news">＋ Agregar noticia con fuente</button></div><section class="v241-news-panel"><h3>Noticias editoriales · Al día</h3><p>Cada noticia conserva su vigencia; al vencer permanece en el muro.</p>'+ (news.map(i=>{const until=i.dailyUntil||i.dailyDay,active=i.dailyDay<=today&&until>=today;return '<div class="v241-news-row"><div><strong>'+esc(i.title)+'</strong><small>'+ (active?'En Al día':'Fuera de Al día')+' · Hasta '+esc(until)+'</small></div><div class="v13-actions"><button type="button" class="v13-panel-button" data-action="edit-news" data-id="'+esc(i.id)+'">Editar</button>'+v13Button('moderate-delete-post',i.id,'Eliminar')+'</div></div>';}).join('')||'<p>Todavía no hay noticias editoriales.</p>')+'</section>';
}
function openNewsForm(item=null){
  if(role!=='editor'){showToast('Solo una cuenta con rol Editor puede añadir noticias.');return;}
  chosenCoordinates=item?.coordinates?.slice()||null;customMapPoint=!!chosenCoordinates;
  openDrawer(drawerHead('PANEL EDITORIAL',item?'Editar noticia':'Agregar noticia','Las noticias deben tener una fuente y enlace verificables.')+
    `<div class="drawer-body"><form id="news-form" data-news-id="${esc(item?.id||'')}">
      <div class="drawer-field"><label for="news-category">Categoría</label><select id="news-category">${[...new Set([...WALL_TOPICS.news,...(item?.category?[item.category]:[])])].map(v=>`<option value="${esc(v)}" ${item?.category===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="drawer-field"><label for="news-title">Título</label><input id="news-title" required minlength="8" maxlength="110" value="${esc(item?.title||'')}"></div>
      <div class="drawer-field"><label for="news-desc">Resumen</label><textarea id="news-desc" required minlength="15" maxlength="800">${esc(item?.description||'')}</textarea></div>
      <div class="drawer-field"><label for="news-source">Nombre del medio o fuente</label><input id="news-source" required maxlength="100" placeholder="Nombre del medio local" value="${esc(item?.sourceName||'')}"></div>
      <div class="drawer-field"><label for="news-link">Enlace de la fuente</label><input id="news-link" type="url" required maxlength="2048" placeholder="https://..." value="${esc(item?.sourceUrl||'')}"></div>
      <div class="drawer-field"><label for="news-place">Ubicación en el mapa</label><div class="location-choice"><select id="news-place"><option value="none">Toda la ciudad / sin lugar fijo</option>${item?.coordinates?`<option value="map-selected" selected>${esc(item.location||'Punto marcado en el mapa')}</option>`:''}${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select><button id="choose-map-point" type="button" class="soft-btn">⌖ Mapa</button></div><small id="coordinates-hint" class="picked-coords">Elige una zona o marca un punto exacto en el mapa.</small></div>
      <div class="drawer-field"><label for="news-until">Mostrar en Al día hasta (inclusive)</label><input id="news-until" type="date" required value="${esc(item?.dailyUntil||item?.dailyDay||mazatlanDay())}" min="${esc(item?.dailyDay||mazatlanDay())}"><small>Al vencer, la noticia sigue disponible en el muro.</small></div>
      <p class="form-note">Verifica la fuente antes de compartirla. Las demás noticias no se reemplazan.</p>
      <button class="submit-btn" type="submit" value="save">${item?'Guardar cambios':'Guardar noticia'}</button>
      ${item?'':'<button class="soft-btn v241-add-another" type="submit" value="another">Guardar y agregar otra noticia</button>'}
    </form></div>`,'center');
}
function isSafeURL(str){
  try {const url=new URL(str);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname?url.href:null;}catch{return null;}
}
function detail(item){
  const type=typeLabel(item);
  const isOwner=item.owner==='local' && item.ownerUserId===currentIdentity?.user?.id;
  const sourceLink=isSafeURL(item.sourceUrl||item.externalUrl);
  const caption='Reporte ciudadano compartido a través de Supabase.';
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
    ${sourceLink?`<p><a href="${esc(sourceLink)}" target="_blank" rel="noopener noreferrer">${item.sourceUrl?'Consultar fuente original':'Abrir enlace externo'} ↗</a></p>`:''}
    ${item.rejectionReason?`<p class="form-note">Motivo del rechazo: ${esc(item.rejectionReason)}</p>`:''}
    <div class="detail-note">${esc(caption)}</div>
    ${item.coordinates?`<div class="action-row"><button class="soft-btn" type="button" data-focus="${esc(item.id)}">⌖ Ver ubicación en el mapa</button></div>`:''}
    ${(editorActions||editorialAction||readerAction)?`<div class="action-row">${editorActions}${editorialAction}${readerAction}</div>`:''}
    
  </div>`);
}
async function review(id,decision){
 const i=items.find(e=>e.id===id);if(!i||!['pending','reviewed'].includes(i.review))return;
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
 event.preventDefault();
 const form=event.target,submit=form.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
 const visitor=role==='visitante',uid=currentPersonId();let uploaded=null,committed=false;
 try{
  await requireCommunity();
  const type=$('#report-type').value,category=$('#report-category').value;
  if(!['citizen','infrastructure','social'].includes(type)||!CATEGORY_OPTIONS[type].includes(category))throw Error('Categoría inválida.');
  const title=$('#report-title').value.trim();if(title.length<3||title.length>110)throw Error('El título debe tener de 3 a 110 caracteres.');
  const description=$('#report-description').value.trim(),coordinates=chosenCoordinates?.slice()||null,alert_zone=$('#report-zone').value.trim()||null;
  const suggestions=similarReports(items,{type,category,title,description,coordinates});
  if(suggestions.length&&!confirm('Encontramos reportes similares:\n'+suggestions.map(x=>'• '+x.post.title+(Number.isFinite(x.distance)&&x.distance<=300?' (ubicación cercana)':'')).join('\n')+'\n\n¿Quieres enviar tu reporte de todos modos?'))return;
  const rawLink=type==='infrastructure'?'':$('#report-link').value.trim();
   const external_url=rawLink?isSafeURL(rawLink):null;
   if(rawLink&&(!external_url||external_url.length>2048))throw Error('Introduce un enlace HTTP o HTTPS válido.');
   const input={type,category,title,description,alert_zone,external_url,
   location:coordinates?($('#report-place').selectedOptions[0]?.textContent||'Ubicación aproximada'):(alert_zone||'Toda la ciudad'),
   longitude:coordinates?.[0]??null,latitude:coordinates?.[1]??null,event_day:type==='social'?($('#report-event').value||null):null,review:'pending'};
  const file=$('#report-photo').files[0],photo=file?await compressedPhoto(file):null;
  if(visitor!== (role==='visitante')||uid!==currentPersonId())throw Error('La sesión cambió. Vuelve a intentar.');
  if(visitor)await submitVisitorPost(input,photo);
  else{if(photo)uploaded=await uploadDataImage(uid,photo);if(uid!==currentPersonId())throw Error('La sesión cambió.');await createPost({...input,user_id:uid,photo_url:uploaded});}
  committed=true;
  closeDrawer();await refreshCommunity();setView(visitor?'explorar':'mi-cuenta');showToast('Reporte enviado a revisión. Solo será público cuando un Editor lo apruebe.');
 }catch(error){if(uploaded&&!committed)try{await removeImageServer(uploaded);}catch{}showToast(error.message||'No se pudo enviar el reporte.');}
 finally{if(submit.isConnected)submit.disabled=false;}
}
async function handleNewsSubmit(event){
 event.preventDefault();if(role!=='editor')return;
 const form=event.target,buttons=[...form.querySelectorAll('button[type=submit]')],another=event.submitter?.value==='another',id=form.dataset.newsId,uid=currentPersonId();
 if(buttons.some(b=>b.disabled))return;buttons.forEach(b=>b.disabled=true);
 try{
  await requireCommunity();const source_url=isSafeURL($('#news-link').value);
  if(!source_url||source_url.length>2048)throw Error('Introduce un enlace de fuente válido.');
  const placeValue=$('#news-place').value,loc=placeValue==='map-selected'&&chosenCoordinates?{name:$('#news-place').selectedOptions[0]?.textContent||'Punto marcado en el mapa',coordinates:chosenCoordinates}:placeValue==='none'?null:PLACES[Number(placeValue)];
  const title=$('#news-title').value.trim(),description=$('#news-desc').value.trim(),source_name=$('#news-source').value.trim(),daily_until=$('#news-until').value;
  if(title.length<8||description.length<15||!source_name||!daily_until)throw Error('Completa todos los datos de la noticia.');
  const input={title,description,category:$('#news-category').value,location:loc?.name||'Toda la ciudad',longitude:loc?.coordinates?.[0]??null,latitude:loc?.coordinates?.[1]??null,source_name,source_url,daily_until};
  if(uid!==currentPersonId()||role!=='editor')throw Error('La sesión cambió.');
  if(id)await editEditorialNews(id,input);else await createPost({...input,user_id:uid,type:'news',review:'approved'});
  if(uid!==currentPersonId())return;
  if(form.isConnected&&$('#drawer').classList.contains('open')){if(another&&!id)openNewsForm();else closeDrawer();}
  await refreshCommunity();showToast(id?'Noticia actualizada.':another?'Noticia publicada. Puedes agregar otra.':'Noticia publicada en la comunidad.');
 }catch(error){showToast(error.message||'No fue posible publicar la noticia.');}
 finally{buttons.forEach(b=>{if(b.isConnected)b.disabled=false;});}
}
async function handleRejectSubmit(event){
 event.preventDefault();if(role!=='editor')return;
 const form=event.target,id=form.dataset.itemId,reason=form.querySelector('#reject-reason').value.trim();
 if(!id||!items.some(item=>item.id===id&&['pending','reviewed'].includes(item.review)))return showToast('Selecciona nuevamente la publicación que deseas rechazar.');
 if(reason.length<8||reason.length>300)return showToast('Explica el motivo del rechazo (8 a 300 caracteres).');
 const submit=form.querySelector('[type=submit]');
 if(submit.disabled)return;
 submit.disabled=true;
 try{await requireCommunity();await moderatePostServer(id,'rejected',reason);closeDrawer();await refreshCommunity();showToast('Reporte rechazado.');}
 catch(error){showToast(error.message||'No se pudo rechazar el reporte.');}
 finally{if(submit.isConnected)submit.disabled=false;}
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
  if(!$('#report-form')&&!$('#news-form')) return;
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
function useDeviceLocation(){
 const form=$('#report-form');if(!form||!navigator.geolocation)return showToast('La ubicación del dispositivo no está disponible. Puedes continuar sin ella.');
 if(!confirm('¿Quieres solicitar tu ubicación actual? Si la conservas, será pública al aprobarse el reporte.'))return;
 const button=$('#use-device-location');button.disabled=true;
 navigator.geolocation.getCurrentPosition(pos=>{
  if(!form.isConnected)return;
  chosenCoordinates=[Number(pos.coords.longitude.toFixed(4)),Number(pos.coords.latitude.toFixed(4))];customMapPoint=true;
  const choice=$('#report-place');let option=choice.querySelector('option[value="gps-selected"]');
  if(!option){option=new Option('Ubicación del dispositivo (aproximada)','gps-selected');choice.add(option);}
  choice.value='gps-selected';choice.dispatchEvent(new Event('change',{bubbles:true}));
  $('#coordinates-hint').textContent='Ubicación seleccionada: '+chosenCoordinates[1]+', '+chosenCoordinates[0]+'. Puedes quitarla seleccionando Sin ubicación.';
  button.disabled=false;
 },()=>{if(form.isConnected){button.disabled=false;showToast('No se obtuvo tu ubicación. Puedes continuar sin GPS.');}},{enableHighAccuracy:false,timeout:10000,maximumAge:0});
}
function confirmPicker(){
  if(!pickerCoords || $('#picker-confirm').disabled) return;
  chosenCoordinates=pickerCoords.slice();
  customMapPoint=true;
  const choice=$('#report-place')||$('#news-place');
  if(choice){
    let option=choice.querySelector('option[value="map-selected"]');
    if(!option){option=new Option('Punto marcado en el mapa','map-selected');choice.add(option);}
    choice.value='map-selected';
  }
  const hint=$('#coordinates-hint');
  if(hint)hint.textContent=`Ubicación elegida en mapa: ${chosenCoordinates[1].toFixed(5)}, ${chosenCoordinates[0].toFixed(5)}.`;
  closePicker();
  showToast('Ubicación guardada. Puedes continuar sin salir del formulario.');
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
      if(kind==='avatar'){$('#sidebar-avatar').textContent='◎';updateComposerAvatar();}
      renderAccount();await removeImageServer(old).catch(()=>{});showToast('Imagen retirada de tu perfil público.');
    }catch(error){showToast(error.message||'No se pudo retirar la imagen.');}})();return;
  }
  const verifyEmail=e.target.closest('[data-action="verify-email"]');
  if(verifyEmail){
    verifyEmail.disabled=true;
    const uid=currentPersonId();
    void requestEmailVerification().then(async already=>{
      if(uid!==currentPersonId())return;
      if(already){await refreshIdentity();showToast('Tu correo ya está verificado.');}
      else showToast('Enviamos un enlace de verificación. Revisa tu bandeja de entrada y correo no deseado.');
    }).catch(error=>showToast(error?.message||'No se pudo enviar el enlace. Inténtalo más tarde.')).finally(()=>{if(verifyEmail.isConnected)verifyEmail.disabled=false;});
    return;
  }
  if(e.target.closest('[data-action="refresh-email-verification"]')){void refreshIdentity();return;}
  if (e.target.closest('[data-action="account-reset"]')) {
    if (!currentIdentity?.user?.email) return;
    void requestPasswordReset(currentIdentity.user.email)
      .then(() => showToast('Revisa tu correo para cambiar la contraseña.'))
      .catch(error => showToast(error?.message||'No se pudo enviar el enlace. Revisa la configuración del correo en Supabase.'));
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
    if(kind==='avatar'){$('#sidebar-avatar').innerHTML=`<img src="${esc(url)}" alt="">`;updateComposerAvatar();}
    renderAccount();await removeImageServer(old).catch(()=>{});
    showToast('Fotografía guardada en tu perfil público con el encuadre elegido.');
   }catch(error){showToast(error.message||'No se pudo guardar la imagen en Supabase.');}
  });
 }catch(error){showToast(error.message||'No se pudo editar la imagen.');}finally{input.value='';}
});
installColorPicker($('#account-panel'));
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
      updateComposerAvatar();renderAccount();showToast('Perfil actualizado en Supabase para toda la comunidad.');
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
  if(guestMode)return notSignedIn();
  const button=$('#sign-out'),signedOutId=currentPersonId();button.disabled=true;
  try {await logoutAccount();ads?.clearDrafts(signedOutId);returnAfterLogin=null;writeRoute('/',true);onIdentityChange({status:'signed_out'});}
  catch {showToast('No se pudo cerrar sesión. Intenta de nuevo.');}
  finally {button.disabled=false;}
});
$('#brand-home').addEventListener('click',goHome);
$('#expand-main-map').addEventListener('click',openExpandedMap);
$('#expanded-map-close').addEventListener('click',closeExpandedMap);
$('#expanded-map-back').addEventListener('click',closeExpandedMap);
$('#expanded-map-overlay').addEventListener('click',e=>{if(e.target.id==='expanded-map-overlay')closeExpandedMap();});
$('#advanced-filters-toggle').addEventListener('click',()=>toggleFilters($('#advanced-filters-panel').hidden));
$('#advanced-filters-close').addEventListener('click',()=>toggleFilters(false));
$('#filter-period').addEventListener('change',e=>{$('#filter-custom-dates').hidden=e.target.value!=='custom';});
$('#filter-clear').addEventListener('click',()=>{resetAllFilters();toggleFilters(false);});
$('#advanced-filters-panel').addEventListener('submit',e=>{
  e.preventDefault();
  const period=$('#filter-period').value,from=$('#filter-date-from').value,to=$('#filter-date-to').value;
  if(period==='custom'&&from&&to&&from>to)return showToast('La fecha inicial no puede ser posterior a la final.');
  advanced={period,from,to,region:$('#filter-region').value,sort:$('#filter-sort').value,located:$('#filter-located').checked};
  toggleFilters(false);render();
});
document.querySelector('#region-geojson-import')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{if(file.size>10_000_000)throw Error('El GeoJSON supera los 10 MB. Exporta solo las colonias de Mazatlán.');
    const count=setRegions(JSON.parse(await file.text()));
    if(!count)throw Error('No hay polígonos válidos con nombre en este archivo.');
    geoRegionsAvailable=true;setRegionData();syncAdvancedForm();render();
    showToast(`${count} contornos cargados para esta sesión. No se modificó Supabase.`);
  }catch(error){showToast(error.message||'No se pudo importar el archivo GeoJSON.');}
  e.target.value='';
});
$('#side-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
$('#composer-report').addEventListener('click',openReportForm);
$('#composer-create').addEventListener('click',openReportForm);
$('#map-retry-init').addEventListener('click',()=>{ensureMap();});
window.addEventListener('online',()=>{if(view==='explorar'&&!mapStarted)ensureMap();});
$('#refresh-now').addEventListener('click',()=>{void refreshCommunity();});
$('#feed-mode-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-feed-mode]');if(!b||!currentPersonId())return;feedMode=b.dataset.feedMode;render();});
$('#trends-list').addEventListener('click',e=>{
  const b=e.target.closest('[data-trend-open]');if(!b)return;
  const item=items.find(i=>i.id===b.dataset.trendOpen);
  if(item)jumpToWall(item);
});
$('#people-page').addEventListener('click',e=>{const p=e.target.closest('[data-profile-id]');if(p)openProfile(p.dataset.profileId);});
$('#profile-page').addEventListener('click',e=>{
 const c=e.target.closest('[data-connections]');if(c){connectionsId=profileId||currentPersonId();connectionsMode=c.dataset.connections;setView('connections');scrollTopPage();return;}
 const p=e.target.closest('[data-profile-id]');if(p&&p.dataset.profileId!==profileId){openProfile(p.dataset.profileId);return;}
 const open=e.target.closest('[data-open]');if(open){openPost(items.find(i=>i.id===open.dataset.open));return;}
 const tab=e.target.closest('[data-profile-tab]');if(tab){profileTab=tab.dataset.profileTab;renderProfilePage();return;}
 const action=e.target.closest('[data-action]');if(!action)return;
 if(action.dataset.action==='edit-settings')return setView('configuracion');
 if(action.dataset.action==='back-profile'){if(history.state?.fromApp)return history.back();return setView(profileReturnView==='mi-cuenta'||profileReturnView==='publicacion'?'explorar':profileReturnView);}
 if(action.dataset.action==='follow'){
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
 if(action.dataset.action==='back-post'){if(history.state?.fromApp)return history.back();return setView(postReturnView==='publicacion'?'explorar':postReturnView);}
 if(action.dataset.action==='locate'){const item=items.find(i=>i.id===selectedId);if(item)openLocationModal(item);return;}
 if(action.dataset.action==='helpful'){const item=items.find(i=>i.id===selectedId);if(item)void voteOn(item);}
});
$('#post-page').addEventListener('submit',e=>{
 if(e.target.id!=='comment-form')return;e.preventDefault();
 const body=$('#comment-body').value.trim(),post=items.find(i=>i.id===selectedId);
 if(!post)return showToast('No encontramos esta publicación.');
 const button=e.target.querySelector('button[type=submit]');button.disabled=true;
 void(async()=>{try{await requireCommunity();if(body.length<1||body.length>500)throw Error('El comentario debe tener entre 1 y 500 caracteres.');
   if(!currentPersonId())return notSignedIn();await createCommentServer(post.id,currentPersonId(),body,replyId);replyId=null;await refreshCommunity({quiet:true});showToast('Comentario publicado.');}
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
$('#filter-row').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;const section=b.dataset.filter;if(!Object.hasOwn(WALL_TOPICS,section))return;if(activeSections.has(section))activeSections.delete(section);else activeSections.add(section);wallSection=activeSections.has(section)?section:([...activeSections].at(-1)||'news');topics=pruneTopics(topics,activeSections);selectedId=null;render();});
$('#search-input').addEventListener('input',e=>{search=e.target.value;selectedId=null;render();});
$('#drawer-backdrop').addEventListener('click',closeDrawer);
$('#feed-content').addEventListener('click',e=>{
  const person=e.target.closest('[data-profile-id]');if(person){openProfile(person.dataset.profileId);return;}
  const open=e.target.closest('[data-open]');
  if(open){const item=items.find(i=>i.id===open.dataset.open);if(item)openPost(item);return;}
  const action=e.target.closest('[data-action]');if(action){
    if(action.dataset.action==='reset-filters')resetAllFilters();
    if(action.dataset.action==='create-report')openReportForm();
    if(action.dataset.action==='add-news'&&role==='editor')openNewsForm();
    if(action.dataset.action==='edit-news'&&role==='editor'){const item=items.find(i=>i.id===action.dataset.id&&i.type==='news');if(item)openNewsForm(item);}
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
  if(e.target.closest('#use-device-location')){useDeviceLocation();return;}
  const resolveBtn=e.target.closest('[data-resolve]');if(resolveBtn){resolveReport(resolveBtn.dataset.resolve);return;}
  const reviewBtn=e.target.closest('[data-review]');if(reviewBtn){review(reviewBtn.dataset.review,reviewBtn.dataset.decision);return;}
  const focusBtn=e.target.closest('[data-focus]');if(focusBtn){const i=items.find(x=>x.id===focusBtn.dataset.focus);if(i)openLocationModal(i);return;}
});
$('#drawer').addEventListener('change',e=>{
  if(e.target.id==='report-type'){
    const type=e.target.value;$('#event-field').hidden=type!=='social';if(type!=='social')$('#report-event').value='';
    const allowLink=type==='social'||type==='citizen';$('#report-link-field').hidden=!allowLink;$('#report-link').disabled=!allowLink;if(!allowLink)$('#report-link').value='';
    $('#report-category').innerHTML=CATEGORY_OPTIONS[type].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  if(['report-place','news-place'].includes(e.target.id)){
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
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(mapIsExpanded){closeExpandedMap();return;}if(!$('#advanced-filters-panel').hidden){toggleFilters(false);return;}if(!$('#crop-overlay').hidden){closeCrop();return;}if(!$('#public-profile-overlay').hidden){closePublicProfile();return;}if(!$('#picker-overlay').hidden){closePicker();return;}if(!$('#location-overlay').hidden){closeLocationModal();return;}closeDrawer();}});

function setAuthView(next) {
  if(!['login','register','forgot','recover'].includes(next)) return;
  authView=next;
  $('#v13-access').hidden=!['login','register'].includes(next);
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
  initMap({onRegionSelect(name){
    advanced.region=name;toggleFilters(false);render();
    showToast(`Mostrando publicaciones de ${name}.`);
  },onSelect(id){
    const item=items.find(i=>i.id===id);if(!item)return;
    jumpToWall(item);
  },onFail(){ mapStarted=false;$('#map-fallback').hidden=false; }})
    .then(ok=>{if(ok){$('#map-fallback').hidden=true;setMapItems(view==='explorar'?visibleForDay().filter(i=>i.coordinates):[],selectedId);setTimeout(resizeMap,400);}});
}
function onIdentityChange(state){
 if(state.status==='loading')return;
 const old=currentPersonId(),wasChecked=sessionChecked,previousRole=role;sessionChecked=true;routeReady=true;
 $('#boot-status').hidden=true;
 const r=parseRoute(location.pathname,location.search);
 if(state.status==='signed_in'){
   guestMode=false;currentIdentity=state;role=state.role;void ads?.sync();
   if(old!==state.user.id||!wasChecked){forum?.reset();localProfile=loadLocalProfile(state.user.id);clearSocialSnapshot();communityReady=false;communityError='';items=[];newPostItems=[];rememberCurrentPerson();}
   $('#auth-configuration').hidden=true;
   if(!recoveryCompleted&&(state.recovery||recoveryAtBoot)){showAuth('recover',true);return;}
   if(r.auth==='recover'&&!recoveryCompleted){showAuth('recover',true);return;}
   // Revalidar la misma sesión no equivale a navegar: conservar formularios y modales abiertos.
   if(keepCurrentViewOnIdentity({wasChecked,oldId:old,newId:state.user.id,previousRole,newRole:state.role,authRoute:r.auth,recovery:state.recovery,authHidden:$('#auth-gate').hidden,shellHidden:$('.app-shell').hidden})){
     updateNavigation();updateComposerAvatar();syncEmailVerification();if(!communityReady)void refreshCommunity({quiet:true});return;
   }
   if(r.auth){const target=returnAfterLogin||'/';returnAfterLogin=null;writeRoute(target,true);}
   applyLocation();
   if(old!==state.user.id||!wasChecked||!communityReady)void refreshCommunity();
   return;
 }
 if(wasChecked&&!old&&guestMode&&state.status==='signed_out'){if(r.auth)showAuth(r.auth,true);else if(!$('#auth-gate').hidden)applyLocation();return;}
 forum?.reset();reportRecords={};zoneAlerts=[];zoneReady=false;currentIdentity=null;role='visitante';guestMode=true;feedMode='explorar';void ads?.sync();
 socialState={saved:[],notifications:[],flags:[],commentVotes:[]};clearSocialSnapshot();items=[];newPostItems=[];communityReady=false;communityError='';localProfile={username:'',bio:'',avatar:null,cover:null};
 closePublicProfile();closeDrawer();closePicker();closeLocationModal();closeExpandedMap();destroyEmbeddedMaps();
 applyLocation();$('#auth-configuration').hidden=state.status!=='unconfigured';
 if(state.status==='error'&&!$('#auth-gate').hidden)setAuthFeedback(state.message||'No fue posible verificar la sesión.',true);
 if($('#auth-gate').hidden)void refreshCommunity();
}
function enterVisitor(next='explorar'){returnAfterLogin=null;writeRoute(next==='about'?'/nosotros':'/');applyLocation();if(!communityReady)void refreshCommunity();}
$('#guest-enter').addEventListener('click',()=>enterVisitor());
$('#auth-about').addEventListener('click',()=>enterVisitor('about'));

document.querySelectorAll('[data-auth-view]').forEach(button => button.addEventListener('click',()=>showAuth(button.dataset.authView)));
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
        const result=await createAccount(email,password,data.get('display_name'),data.get('username'));
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
        recoveryCompleted=true;
        form.reset();
        writeRoute('/',true);
        await refreshIdentity();
        showToast('Contraseña actualizada.');
      }
    } catch(error) {
      setAuthFeedback(error?.message || 'No fue posible completar la operación. Inténtalo de nuevo.',true);
    } finally {button.disabled=false;}
  });
}
void loadBundledRegions().then(count=>{geoRegionsAvailable=count>0;setRegionData();if(currentIdentity)render();});
installV20();
ads=createAds({user:currentPersonId,view:()=>view,nav:updateNavigation,toast:showToast,compress:compressedPhoto,login:notSignedIn,navigate:next=>{if(next==='business'&&!currentPersonId()){returnAfterLogin='/mi-negocio';return showAuth('login');}setView(next);scrollTopPage();}});
installMobileMap();
installMobileMenu({sidebar:$('#sidebar'),nav:$('#side-nav'),toggle:$('#v244-menu-toggle'),signOut:$('#sign-out'),mobile:mobileViewport});
installPhotoViewer($('#v243-photo'),mobileViewport);
installNewPostNotice();
installRouter();
void initializeAuth(onIdentityChange);

function v13Button(kind,id,label){return '<button type="button" class="v13-panel-button" data-v13="'+esc(kind)+'" data-v13-id="'+esc(id||'')+'">'+esc(label)+'</button>';}
function v13PostActions(item){return '<div class="v13-actions">'+(item.review==='approved'?v13Button('share',item.id,'Compartir')+v13Button('save',item.id,socialState.saved.includes(item.id)?'Quitar de guardados':'Guardar')+v13Button('flag-post',item.id,'Denunciar'):'')+(ownPost(item)?(item.type!=='news'?v13Button('edit-post',item.id,'Editar'):'')+v13Button('delete-post',item.id,'Eliminar'):'')+(role==='editor'&&!ownPost(item)?v13Button('moderate-delete-post',item.id,'Eliminar publicación'):'')+'</div>';}
function v13CommentActions(c,rows){const parent=rows.find(r=>r.id===c.parentId),votes=socialState.commentVotes.filter(v=>v.comment_id===c.id);return (parent?'<small class="comment-reply-note">En respuesta a @'+esc(personFor(parent.authorId)?.username||'usuario')+'</small>':'')+(c.editedAt?'<small> · Editado</small>':'')+'<div class="v13-actions">'+v13Button('reply',c.id,'Responder')+v13Button('vote-comment',c.id,guestMode?'Votar':'▲ '+votes.length)+v13Button('flag-comment',c.id,'Denunciar')+(c.authorId===currentPersonId()?v13Button('edit-comment',c.id,'Editar'):'')+'</div>';}
const notificationText={zone_alert:'Nueva publicación en una colonia de interés',approved:'Tu publicación fue aprobada',rejected:'Tu publicación fue rechazada',follow:'Tienes un nuevo seguidor',comment:'Comentaron tu publicación',reply:'Respondieron a tu comentario',mention:'Te mencionaron en un comentario'};
function renderV13Panel(){const p=$('#v13-panel');let body='';
 if(view==='guardados'){body='<h2>Publicaciones guardadas</h2>'+items.filter(i=>socialState.saved.includes(i.id)&&i.review==='approved').map(i=>'<div class="v13-panel-row">'+esc(i.title)+' '+v13Button('open',i.id,'Ver publicación')+v13Button('save',i.id,'Quitar')+'</div>').join('');}
 if(view==='notificaciones'){body='<h2>Notificaciones</h2><section class="v23-zones"><h3>Alertas por colonia</h3><p>Recibe avisos dentro de MZT Conecta cuando se aprueben publicaciones que indiquen una de tus colonias. No se usa GPS.</p>'+(zoneReady?'<button type="button" class="v13-panel-button" data-v23="zone-add">Agregar colonia</button><ul>'+zoneAlerts.map(z=>'<li>'+esc(z)+' <button type="button" class="v13-panel-button" data-v23="zone-remove" data-v23-id="'+esc(z)+'">Desactivar</button></li>').join('')+'</ul>':'<p>No se pudieron cargar las preferencias.</p>')+'</section>'+socialState.notifications.map(n=>'<div class="v13-panel-row"><strong>'+esc(notificationText[n.kind]||n.kind)+'</strong><p>'+esc(new Date(n.created_at).toLocaleString('es-MX'))+'</p>'+(!n.read_at?v13Button('read',n.id,'Marcar leída'):'Leída')+(n.post_id?v13Button('open',n.post_id,'Ver publicación'):'')+'</div>').join('');}
 if(view==='denuncias'){body='<h2>Denuncias de la comunidad</h2>'+socialState.flags.filter(f=>f.status==='pending').map(f=>'<div class="v13-panel-row"><strong>'+esc(f.reason)+'</strong>'+(f.reason_detail?'<p class="v24-flag-reason">'+esc(f.reason_detail)+'</p>':'')+'<p>'+esc(f.post_id?'Publicación':'Comentario')+' · '+esc(f.post_id||f.comment_id)+'</p>'+v13Button('open',f.post_id||items.find(i=>commentsFor(i.id).some(c=>c.id===f.comment_id))?.id,'Ver contenido')+v13Button('review-flag',f.id,'Marcar revisada')+(role==='editor'?v13Button(f.post_id?'moderate-delete-post':'moderate-delete-comment',f.post_id||f.comment_id,'Eliminar contenido'):'')+'</div>').join('');}
 p.innerHTML=body||'<p>Sin resultados.</p>';
}
function promptV13(title,fields){return new Promise(resolve=>{const d=document.createElement('dialog');d.className='v13-dialog';d.innerHTML='<form method="dialog"><h2>'+esc(title)+'</h2>'+fields.map(f=>'<label>'+esc(f.label)+(f.options?'<select name="'+esc(f.name)+'">'+f.options.map(o=>'<option>'+esc(o)+'</option>').join('')+'</select>':f.multiline?'<textarea name="'+esc(f.name)+'" maxlength="'+f.max+'" '+(f.required?'required':'')+'>'+esc(f.value||'')+'</textarea>':'<input name="'+esc(f.name)+'" value="'+esc(f.value||'')+'" maxlength="'+f.max+'" '+(f.required?'required':'')+'>')+'</label>').join('')+'<div class="v13-actions"><button type="submit" value="cancel" formnovalidate>Cancelar</button><button type="submit" value="ok">Confirmar</button></div></form>';document.body.append(d);d.addEventListener('close',()=>{const data=d.returnValue==='ok'?Object.fromEntries(new FormData(d.querySelector('form'))):null;d.remove();resolve(data);},{once:true});d.showModal();});}
function promptFlag(){return new Promise(resolve=>{const d=document.createElement('dialog');d.className='v13-dialog';d.innerHTML='<form method="dialog"><h2>Denunciar contenido</h2><label>Motivo<select name="reason">'+['spam','informacion falsa','acoso','inapropiado','otro'].map(o=>'<option>'+esc(o)+'</option>').join('')+'</select></label><label class="v24-flag-detail" hidden>Describe el motivo<textarea name="reason_detail" maxlength="500" rows="4" placeholder="Explica la razón de tu denuncia..."></textarea></label><div class="v13-actions"><button type="submit" value="cancel" formnovalidate>Cancelar</button><button type="submit" value="ok">Confirmar</button></div></form>';document.body.append(d);const sel=d.querySelector('select'),field=d.querySelector('textarea'),label=field.parentElement;const sync=()=>{label.hidden=sel.value!=='otro';field.required=!label.hidden;field.disabled=label.hidden;if(label.hidden)field.value='';field.setCustomValidity('');};sel.addEventListener('change',sync);field.addEventListener('input',()=>field.setCustomValidity(''));d.querySelector('form').addEventListener('submit',e=>{if(e.submitter?.value==='ok'&&sel.value==='otro'&&!field.value.trim()){e.preventDefault();field.setCustomValidity('Escribe la razón de tu denuncia.');field.reportValidity();}});d.addEventListener('close',()=>{const f=d.returnValue==='ok'?Object.fromEntries(new FormData(d.querySelector('form'))):null;d.remove();resolve(f);},{once:true});sync();d.showModal();});}
async function shareV13(id){const item=items.find(p=>p.id===id);if(!item||item.review!=='approved')return;const url=new URL(postPath(item),location.origin);const d=document.createElement('dialog');d.className='v13-dialog';d.innerHTML='<form method="dialog"><h2>Compartir publicación</h2><input readonly value="'+esc(url.href)+'"><div class="v13-actions"><button type="button" data-copy>Copiar enlace</button><a target="_blank" rel="noopener noreferrer" href="https://wa.me/?text='+encodeURIComponent(url.href)+'">WhatsApp</a><a target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url.href)+'">Facebook</a></div><button>Cerrar</button></form>';document.body.append(d);d.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);showToast('Enlace copiado.');}catch{d.querySelector('input').select();}};d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-v13]');if(!b)return;const kind=b.dataset.v13,id=b.dataset.v13Id;
 if(kind==='share')return shareV13(id);
 if(kind==='open'){const item=items.find(i=>i.id===id);return item?openPost(item):showToast('Contenido no disponible.');}
 if(!currentPersonId()||kind==='login')return notSignedIn();
 if(kind==='reply'){replyId=id;const c=commentsFor(selectedId).find(c=>c.id===id),a=personFor(c?.authorId);const input=$('#comment-body');if(input){input.value='@'+(a?.username||'usuario')+' '+input.value;input.focus();}return;}
 b.disabled=true;try{let extra;
 if(kind==='save')extra=socialState.saved.includes(id);
 if(kind==='vote-comment')extra=socialState.commentVotes.some(v=>v.comment_id===id&&v.user_id===currentPersonId());
 if(kind.startsWith('flag-')){const f=await promptFlag();if(!f)return;extra={reason:f.reason,reason_detail:f.reason==='otro'?f.reason_detail.trim():null};}
 if(kind==='edit-post'){const p=items.find(i=>i.id===id);if(!p)return;const f=await promptV13('Editar y enviar a revisión',[{name:'title',label:'Título',value:p.title,max:110,required:true},{name:'description',label:'Descripción',value:p.description,max:800,multiline:true}]);if(!f)return;extra={title:f.title.trim(),description:f.description.trim()};if(extra.title===p.title&&extra.description===p.description)return;if(extra.title.length<3)throw Error('Título demasiado corto.');}
 if(kind==='edit-comment'){const c=commentsFor(selectedId).find(c=>c.id===id);if(!c)return;const f=await promptV13('Editar comentario',[{name:'body',label:'Comentario',value:c.text,max:500,multiline:true,required:true}]);if(!f)return;extra=f.body.trim();if(!extra)throw Error('Comentario vacío.');}
 if(kind.startsWith('moderate-delete-')&&role!=='editor')throw Error('Solo los editores pueden eliminar contenido de otros usuarios.');
 if(['delete-post','moderate-delete-post','moderate-delete-comment'].includes(kind)&&!confirm(kind==='moderate-delete-comment'?'¿Eliminar permanentemente este comentario?':'¿Eliminar permanentemente esta publicación y sus interacciones asociadas?'))return;
 await socialAction(kind,id,currentPersonId(),extra);if(kind==='delete-post'||(kind==='moderate-delete-post'&&view==='publicacion'))setView('explorar');await refreshCommunity({quiet:true});showToast('Cambios guardados.');
 }catch(error){showToast(error.message||'No se pudo completar la acción.');}finally{if(b.isConnected)b.disabled=false;}
});

document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-v23]');if(!b)return;
 if(!currentPersonId())return notSignedIn();
 const action=b.dataset.v23,id=b.dataset.v23Id,user=currentPersonId();b.disabled=true;
 try{
  if(action==='zone-add'){const data=await promptV13('Agregar colonia de interés',[{name:'zone',label:'Nombre de la colonia',max:100,required:true}]);if(!data)return;if(user!==currentPersonId())return;await zoneSet(data.zone,true);zoneAlerts=await zones();zoneReady=true;if(view==='notificaciones')renderV13Panel();}
  else if(action==='zone-remove'){await zoneSet(id,false);zoneAlerts=await zones();zoneReady=true;if(view==='notificaciones')renderV13Panel();}
  else if(action==='resolve'){await resolveReport(id);return;}
  else{await reportAction(action,id);await refreshCommunity({quiet:true});}
  showToast('Cambios guardados.');
 }catch(error){showToast(error.message||'No se pudo completar la operación.');}finally{if(b.isConnected)b.disabled=false;}
});
function v13MentionMarkup(value){return String(value||'').split(/(@[a-zA-Z0-9_.]{1,30})/g).map(part=>{if(!part.startsWith('@'))return esc(part);const id=localPersonIds().find(i=>personFor(i)?.username?.toLowerCase()===part.slice(1).toLowerCase());return id?'<button type="button" class="v13-mention" data-profile-id="'+esc(id)+'">'+esc(part)+'</button>':esc(part);}).join('');}
if('serviceWorker' in navigator&&window.isSecureContext)window.addEventListener('load',()=>{navigator.serviceWorker.register('/service-worker.js').catch(()=>{});});

let fetchingNotifications=false;
async function refreshNotificationsV13(){
 const user=currentPersonId();if(!user||fetchingNotifications||document.hidden)return;
 fetchingNotifications=true;try{const rows=await loadNotificationsV13();if(currentPersonId()!==user)return;socialState.notifications=rows;$('#notification-count').textContent=rows.filter(n=>!n.read_at).length||'';if(view==='notificaciones')renderV13Panel();}catch{}finally{fetchingNotifications=false;}
}
setInterval(()=>{void refreshNotificationsV13();},30000);
document.addEventListener('visibilitychange',()=>{void refreshNotificationsV13();});

function sectionFor(item){return sectionOf(item);}
function eventDateMarkup(item){return item.eventDay?'<p class="event-date">Fecha del evento: '+esc(dateLabel(item.eventDay))+'</p>':'';}
function renderTopics(){
 const group=$('#topic-filters'),selected=topics;group.innerHTML=(activeSections.size?['Todos',...combinedTopics(activeSections)]:[]).map(t=>{const on=t==='Todos'?!selected.size:selected.has(t);return '<button type="button" class="filter-chip '+(on?'is-on':'')+'" data-topic="'+esc(t)+'" aria-pressed="'+on+'">'+esc(t)+'</button>';}).join('');
}
function scrollTopPage(){const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';$('.main-area').scrollTo({top:0,behavior});window.scrollTo({top:0,behavior});}
function jumpToWall(item){
 if(!item||item.review!=='approved')return showToast('Publicación no disponible.');
 closeExpandedMap();wallSection=sectionFor(item);activeSections.add(wallSection);if(!visibleForDay().some(p=>p.id===item.id)){feedMode='explorar';topics.clear();advanced={period:'all',from:'',to:'',region:'all',sort:'newest',located:false};search='';$('#search-input').value='';}setView('explorar');selectedId=item.id;render();
 if(item.coordinates)focusMapItem(item);
 requestAnimationFrame(()=>{const card=[...document.querySelectorAll('#feed-content [data-post-id]')].find(n=>n.dataset.postId===item.id);if(card)card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});else openPost(item);scheduleDock();});
}
function undockMap(){const home=$('#map-home'),panel=$('#map-panel');if(panel.parentNode!==home){animateMapMove(()=>{home.append(panel);home.style.minHeight='';$('#wall-companion').classList.remove('is-docked');$('#restore-map').hidden=true;},view==='explorar'&&!matchMedia('(max-width:820px)').matches);}}
function scheduleDock(){if(dockQueued)return;dockQueued=true;requestAnimationFrame(()=>{dockQueued=false;const mobile=matchMedia('(max-width:820px)').matches;if(mobile){if($('#map-panel').parentNode!==$('#map-home'))undockMap();updateMobileMapButton();return;}clearMobileDock();$('#mobile-map-return').hidden=true;if(view!=='explorar'||mapIsExpanded||$('#map-panel').hidden)return;const home=$('#map-home'),panel=$('#map-panel'),header=$('.v20-top');const dock=home.getBoundingClientRect().bottom<header.getBoundingClientRect().bottom+90;if(dock&&panel.parentNode===home){animateMapMove(()=>{home.style.minHeight=home.getBoundingClientRect().height+'px';$('#map-dock').append(panel);$('#wall-companion').classList.add('is-docked');$('#restore-map').hidden=false;},true);}else if(!dock)undockMap();});}
function renderAbout(){
 $('#about-panel').innerHTML='<article class="about-card"><div class="about-hero"><img src="./assets/isotipo.png" alt="MZT Conecta"><div><p>MAZATLÁN · SINALOA</p><h1>¿Quiénes somos?</h1><p>Una comunidad conectada con su ciudad.</p></div></div><div class="about-copy"><h2>MZT Conecta</h2><p>Somos un proyecto comunitario que busca acercar a las personas de Mazatlán a lo que sucede en su ciudad. Reunimos noticias, actividades, reportes de infraestructura y conversaciones en un solo lugar.</p><h2>Colaboraciones</h2><p>Queremos sumar esfuerzos con la comunidad, negocios locales y organizaciones para dar a conocer iniciativas y actividades que beneficien a Mazatlán.</p><p><a href="/publicidad" class="soft-btn" data-about-ads>Conocer espacios publicitarios</a></p><button class="compose-button" type="button" data-about-home>Volver al muro</button></div></article>';
}
function renderConnections(){
 const person=personFor(connectionsId);if(!person){$('#connections-panel').innerHTML='<p>No encontramos este perfil.</p><button data-connections-back type="button">Volver</button>';return;}
 const all=socialState.follows||[],ids=[...new Set(all.filter(f=>connectionsMode==='followers'?f.to===connectionsId:f.from===connectionsId).map(f=>connectionsMode==='followers'?f.from:f.to))];
 const row=id=>{const p=personFor(id);if(!p)return '';const own=id===currentPersonId(),follow=isFollowing(currentPersonId(),id);return '<div class="connection-row"><button class="person-inline" data-connection-profile="'+esc(id)+'" type="button">'+personAvatar(p)+'<span><strong>'+esc(p.name)+'</strong><small>@'+esc(p.username)+'</small></span></button>'+(own?'':'<button class="social-button" data-connection-follow="'+esc(id)+'" type="button">'+(follow?'Siguiendo ✓':'Seguir')+'</button>')+'</div>';};
 $('#connections-panel').innerHTML='<div class="social-back-row"><button class="back-link" data-connections-back type="button">‹ Volver al perfil</button></div><div class="v20-heading"><div><p class="eyebrow">COMUNIDAD</p><h1>'+esc(person.name)+'</h1><p>@'+esc(person.username)+'</p></div></div><div class="connection-tabs"><button type="button" class="filter-chip '+(connectionsMode==='followers'?'is-on':'')+'" data-connections-mode="followers">Seguidores · '+followersOf(connectionsId)+'</button><button type="button" class="filter-chip '+(connectionsMode==='following'?'is-on':'')+'" data-connections-mode="following">Seguidos · '+followingOf(connectionsId)+'</button></div><div class="connection-list">'+(ids.map(row).join('')||'<p class="social-empty">Todavía no hay personas en esta lista.</p>')+'</div>';
}
function installV20(){
 forum=createForum($('#forum-panel'),{user:currentPersonId,role:()=>role,posts:()=>items,openPost:id=>{const p=items.find(i=>i.id===id);if(p)jumpToWall(p);else showToast('Publicación no disponible. Actualiza el muro.');},login:notSignedIn,toast:showToast,navigate:path=>writeRoute(path)});
 updateDaily=setupDaily($('#daily-bar'),jumpToWall);updateDaily([],mazatlanDay());
 installSelects();
 $('.v20-top').addEventListener('click',e=>{const b=e.target.closest('[data-top-view]');if(!b)return;if(b.dataset.topView==='explorar'){if(view==='explorar')return goHome();setView('explorar');scrollTopPage();return;}setView(b.dataset.topView);scrollTopPage();});
 $('#about-panel').addEventListener('click',e=>{if(e.target.closest('[data-about-ads]')&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();setView('advertise');scrollTopPage();return;}if(e.target.closest('[data-about-home]')){setView('explorar');scrollTopPage();}});
 $('#topic-filters').addEventListener('click',e=>{const b=e.target.closest('[data-topic]');if(!b)return;const set=topics,t=b.dataset.topic;if(t!=='Todos'&&!combinedTopics(activeSections).includes(t))return;if(t==='Todos')set.clear();else if(set.has(t))set.delete(t);else set.add(t);selectedId=null;render();});
 $('#restore-map').addEventListener('click',()=>scrollTopPage());
 $('#toggle-wall-panels').addEventListener('click',e=>{const b=e.currentTarget;const opened=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!opened));$('#wall-panels').classList.toggle('collapsed',opened);});
 $('.main-area').addEventListener('scroll',scheduleDock,{passive:true});window.addEventListener('scroll',scheduleDock,{passive:true});window.addEventListener('resize',scheduleDock);
 $('#connections-panel').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-connections-back')){profileId=connectionsId||currentPersonId();profileTab='publicaciones';view='mi-cuenta';render();scrollTopPage();return;}if(b.dataset.connectionsMode){connectionsMode=b.dataset.connectionsMode;syncRoute();renderConnections();return;}if(b.dataset.connectionProfile){openProfile(b.dataset.connectionProfile);return;}const id=b.dataset.connectionFollow;if(!id||!currentPersonId()||id===currentPersonId())return;b.disabled=true;try{await requireCommunity();await followServer(currentPersonId(),id,isFollowing(currentPersonId(),id));await refreshCommunity({quiet:true});}catch(error){showToast(error.message||'No se pudo actualizar el seguimiento.');}finally{if(b.isConnected)b.disabled=false;}});
}

/* v2.1: navegación por historial y transiciones sin recrear el mapa. */
function animateMapMove(move,animated){
 const panel=$('#map-panel'),rail=$('#wall-companion');
 const from=panel.getBoundingClientRect();activeMapTransition?.cancel();activeMapTransition=null;
 move();resizeMap();const to=panel.getBoundingClientRect();
 if(!animated||matchMedia('(prefers-reduced-motion: reduce)').matches||!panel.animate||!from.width||!to.width||!from.height||!to.height){rail.classList.remove('map-animating');requestAnimationFrame(resizeMap);return;}
 rail.classList.add('map-animating');
 const animation=panel.animate([{transformOrigin:'top left',transform:'translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+(from.width/to.width)+','+(from.height/to.height)+')'},{transformOrigin:'top left',transform:'none'}],{duration:340,easing:'cubic-bezier(.22,.72,.25,1)'});
 activeMapTransition=animation;const finish=()=>{if(activeMapTransition===animation){activeMapTransition=null;rail.classList.remove('map-animating');resizeMap();}};
 animation.onfinish=finish;animation.oncancel=finish;
}

function writeRoute(path,replace=false){
 if(routeLock||!routeReady||location.pathname+location.search===path)return;
 if(!replace)history.replaceState({...history.state,scroll:window.scrollY,filters:{advanced:{...advanced},search,topics:[...topics]}},'',location.href);
 history[replace?'replaceState':'pushState'](replace?{...history.state}:{fromApp:true},'',path);
}
function pathForCurrent(){
 if(view==='publicacion'){const p=items.find(i=>i.id===selectedId);return p?postPath(p):null;}
 if(view==='foro')return parseRoute(location.pathname).view==='foro'?location.pathname:'/foro';
 if(view==='explorar')return wallPath(activeSections,feedMode,location.pathname);
 if(view==='mi-cuenta'){const p=personFor(profileId);return profileId&&profileId!==currentPersonId()?(p?profilePath(p):null):'/cuenta';}
 if(view==='connections'){const p=personFor(connectionsId);return p?profilePath(p,connectionsMode):null;}
 return viewPaths[view]||'/';
}
function syncRoute(){if(routeLock||pendingRoute||!routeReady||!$('#auth-gate').hidden)return;const path=pathForCurrent();if(path)writeRoute(path);}
function showAuth(kind,replace=false){
 pendingRoute=null;closeExpandedMap();$('#mobile-map-return').hidden=true;$('#boot-status').hidden=true;$('.app-shell').hidden=true;$('#auth-gate').hidden=false;
 setAuthView(kind);writeRoute(authPaths[kind]||authPaths.login,replace);
}
function resolveRouteContent(r){
 if(r.view==='publicacion'){selectedId=r.id;view='publicacion';return;}
 if(r.username){
  const id=localPersonIds().find(id=>personFor(id)?.username?.toLowerCase()===r.username);
  if(r.view==='connections'){connectionsId=id||null;connectionsMode=r.mode;}
  else{profileId=id||'missing';profileTab='publicaciones';}
 }
}
function applyLocation(){
 if(!sessionChecked)return;
 const r=parseRoute(location.pathname,location.search);
 if(r.auth){showAuth(r.auth,true);return;}
 if(r.view==='tendencias'&&!mobileViewport.matches){writeRoute('/',true);return applyLocation();}
 if(!canOpenView(r.view)){if(!currentPersonId()){returnAfterLogin=location.pathname+location.search;showAuth('login',true);return;}showToast('No tienes permiso para abrir este apartado.');writeRoute('/',true);return applyLocation();}
 $('#auth-gate').hidden=true;$('.app-shell').hidden=false;$('#boot-status').hidden=true;
 routeLock=true;pendingRoute=null;
 try{
  if(r.view==='explorar'){activeSections=new Set(r.activeSections||[r.section]);wallSection=[...activeSections].at(-1)||'news';topics=pruneTopics(topics,activeSections);feedMode=r.mode==='siguiendo'&&currentPersonId()?'siguiendo':'explorar';}
  if(r.view==='foro')forum?.route(r);
  if(r.view==='publicacion'||r.username){
   if(r.view==='publicacion'){selectedId=r.id;view='publicacion';}
   else{view=r.view;profileId=null;}
   pendingRoute=r;
   if(communityReady&&(r.view==='publicacion'?items.some(i=>i.id===r.id):localPersonIds().some(id=>personFor(id)?.username?.toLowerCase()===r.username))){pendingRoute=null;resolveRouteContent(r);}
   render();
  }else setView(r.view);
 }finally{routeLock=false;}
 if(r.invalid){writeRoute('/',true);showToast('La dirección no existe. Mostrando el muro.');}
 if(r.view==='explorar')ensureMap();
 if(pendingRoute||!communityReady)void refreshCommunity();
}
function installRouter(){
 history.scrollRestoration='manual';
 window.addEventListener('popstate',()=>{const f=history.state?.filters;if(f){advanced={...f.advanced};search=f.search||'';$('#search-input').value=search;topics=new Set(Array.isArray(f.topics)?f.topics:Object.values(f.topics||{}).flat());}applyLocation();const y=history.state?.scroll||0;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));});
 // Los botones de navegación existentes conservan su comportamiento; clic modificado abre otra pestaña.
 document.addEventListener('click',e=>{
  const el=e.target.closest('[data-open],[data-profile-id],[data-view],[data-top-view]');
  if(!el||el.dataset.action==='follow'||e.button!==0)return;
  if(el.matches('a[href]')){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey){e.stopPropagation();return;}e.preventDefault();return;}
  if(!(e.ctrlKey||e.metaKey||e.shiftKey))return;
  let path=null;
  if(el.dataset.open){const p=items.find(i=>i.id===el.dataset.open);if(p)path=postPath(p);}
  else if(el.dataset.profileId){const p=personFor(el.dataset.profileId);if(p)path=profilePath(p);}
  else {const v=el.dataset.view||el.dataset.topView;path=v==='explorar'?'/':v==='foro'?'/foro':viewPaths[v];}
  if(path){e.preventDefault();e.stopImmediatePropagation();window.open(path,'_blank','noopener');}
 },true);
}

function clearMobileDock(){
 const home=$('#map-home'),panel=$('#map-panel');
 home.classList.remove('mobile-docked');panel.classList.remove('is-mobile-docked');
 $('#mobile-map-return').hidden=true;
}
function updateMobileMapButton(){
 const button=$('#mobile-map-return'),home=$('#map-home');
 button.hidden=!matchMedia('(max-width:820px)').matches||view!=='explorar'||!$('#auth-gate').hidden||home.hidden||mapIsExpanded||home.getBoundingClientRect().bottom>$('.v20-top').getBoundingClientRect().bottom+6;
}
function installMobileMap(){
 $('#mobile-map-return').addEventListener('click',()=>{
   if(view!=='explorar')return;
   const map=$('#map-home'),header=$('.v20-top').getBoundingClientRect().bottom;
   const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
   window.scrollTo({top:Math.max(0,window.scrollY+map.getBoundingClientRect().top-header-12),behavior});
 });
 mobileViewport.addEventListener('change',()=>{if(!mobileViewport.matches&&view==='tendencias')goHome();else render();scheduleDock();});
 for(const id of ['center-main-map','center-expanded-map'])$('#'+id).addEventListener('click',resetMainMap);
  window.visualViewport?.addEventListener('resize',scheduleDock);
  window.visualViewport?.addEventListener('scroll',scheduleDock);
}

function arrangeMobileTrends(){
 const panel=$('#mobile-trends-panel'),rail=$('#wall-panels'),trends=$('.trends-card'),stats=$('#stats-strip'),ad=$('#ad-sidebar');
 if(mobileViewport.matches){
  if(trends.parentNode!==panel)panel.append(trends,stats);
  $('.trends-intro').textContent='Las publicaciones más votadas de las secciones y filtros seleccionados durante los últimos 7 días.';
 }else{
  if(trends.parentNode!==rail){rail.insertBefore(trends,ad);rail.insertBefore(stats,ad.nextSibling);}
  $('.trends-intro').textContent='Las publicaciones más votadas de las secciones y filtros seleccionados durante los últimos 7 días.';
 }
 panel.hidden=view!=='tendencias'||!mobileViewport.matches;
}
function pendingVisiblePosts(){
 const known=new Set(items.filter(p=>p.review==='approved').map(p=>p.id));
 return visibleForDay(newPostItems).filter(p=>!known.has(p.id));
}
function paintNewPosts(){
 const button=$('#v243-new-posts'),count=communityReady&&view==='explorar'&&$('#auth-gate').hidden?pendingVisiblePosts().length:0;
 button.hidden=!count;button.textContent=count?'↑ '+count+(count===1?' publicación nueva':' publicaciones nuevas'):'';
}
async function checkNewPosts(){
 if(checkingNewPosts||loadingCommunity||!communityReady||document.hidden||view!=='explorar'||!$('#auth-gate').hidden)return;
 const id=currentPersonId(),guest=guestMode;checkingNewPosts=true;
 try{
  const snapshot=await loadCommunity(guest);
  if(id!==currentPersonId()||guest!==guestMode||!communityReady||loadingCommunity)return;
  const fresh=new Set(newApprovedIds(items,snapshot.items));
  newPostItems=snapshot.items.filter(p=>fresh.has(p.id));paintNewPosts();
 }catch{}finally{checkingNewPosts=false;}
}
function installNewPostNotice(){
 $('#v243-new-posts').addEventListener('click',async()=>{
  const b=$('#v243-new-posts'),first=pendingVisiblePosts()[0];if(!first||b.disabled)return;
  b.disabled=true;try{if(await refreshCommunity({quiet:true})){const post=items.find(p=>p.id===first.id);if(post&&view==='explorar'){selectedId=post.id;render();requestAnimationFrame(()=>[...document.querySelectorAll('#feed-content [data-post-id]')].find(n=>n.dataset.postId===post.id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));}}}finally{b.disabled=false;paintNewPosts();}
 });
 setInterval(()=>{void checkNewPosts();const day=mazatlanDay();for(const card of document.querySelectorAll('#feed-content .event-card[data-post-id]')){const p=items.find(i=>i.id===card.dataset.postId);card.classList.toggle('v243-official-today',officialToday(p,day));}},45000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkNewPosts();});
}
