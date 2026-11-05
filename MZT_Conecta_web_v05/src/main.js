import {CATEGORY_OPTIONS, PLACES, TYPE_INFO, dateISO, offsetDate} from './data.js';
import {getItems, saveItems, getRole, saveRole, newId, resetDemo} from './storage.js';
import {initMap, setMapItems, focusMapItem, resizeMap, createLocationPreview, destroyLocationPreview, createPickerMap, destroyPickerMap} from './map.js';

const $ = sel => document.querySelector(sel);
let items = getItems();
let role = getRole();
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
// Una reacción personal por publicación, exclusivamente de demostración local.
// Recuento ilustrativo para las publicaciones ficticias. No son votos de usuarios reales.
const demoVoteCounts = Object.freeze({
  'sample-1':38, 'sample-2':25, 'sample-3':54, 'sample-4':31,
  'sample-5':19, 'sample-6':43, 'sample-7':17, 'sample-8':11,
  'sample-9':9, 'sample-10':7
});
let helpfulVotes = new Set();
try {
  const savedVotes = JSON.parse(localStorage.getItem('mzt_conecta_helpful_v02') || '[]');
  if (Array.isArray(savedVotes)) helpfulVotes = new Set(savedVotes.filter(x => typeof x === 'string'));
} catch { /* El muro funciona también si no hay almacenamiento disponible. */ }


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
  return (item.demo ? (demoVoteCounts[item.id] || 0) : 0) + Number(helpfulVotes.has(item.id));
}
function renderTrends(){
  // La tabla no usa filtros de búsqueda: son los artículos aprobados más votados.
  const candidates=items.filter(i=>i.review==='approved')
    .sort((a,b)=>voteCount(b)-voteCount(a) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
    .slice(0,5);
  $('#trends-list').innerHTML=candidates.length ? candidates.map((item,index)=>`
    <button type="button" class="trend-item" data-trend-open="${esc(item.id)}" aria-label="Abrir publicación: ${esc(item.title)}">
      <span class="trend-rank">${index+1}</span>
      <span class="trend-copy"><strong>${esc(short(item.title,68))}</strong><small>${esc(typeLabel(item))}</small></span>
      <span class="trend-votes" aria-label="${voteCount(item)} votos"><span aria-hidden="true">▲</span>${voteCount(item)}</span>
    </button>`).join('') : '<p class="trends-empty">Todavía no hay publicaciones aprobadas.</p>';
}
function typeLabel(item){return item.resolvedAt && item.type==='infrastructure' ? 'Atendido' : TYPE_INFO[item.type]?.label||'Publicación';}
function statusLabel(item){return ({pending:'Recibido · esperando revisión',reviewed:'Revisado · esperando al editor',rejected:'Rechazado',approved:item.resolvedAt?'Atendido':'Publicado'})[item.review] || 'Sin estado';}
function card(item){
  const typeClass=esc(item.type);
  const author=item.owner==='local' ? 'Tú · demo' : item.type==='news' ? (item.sourceName||'MZT Noticias') : 'Comunidad de Mazatlán';
  const authorTag=item.type==='news' ? 'Medio / fuente' : 'Reporte ciudadano · No oficial';
  const initial=item.type==='news'?'N':item.type==='infrastructure'?'I':'C';
  const voted=helpfulVotes.has(item.id);
  const image=item.image?`<img class="post-image" src="${esc(item.image)}" alt="Imagen del reporte ciudadano" loading="lazy">`:'';
  return `<article class="event-card ${selectedId===item.id?'selected':''}" data-post-id="${esc(item.id)}">
    <button type="button" class="post-open" data-open="${esc(item.id)}" aria-label="Ver publicación: ${esc(item.title)}">
      <div class="post-byline"><span class="post-avatar avatar-${typeClass}">${initial}</span><span class="post-author-block"><strong>${esc(author)}</strong><small>${esc(authorTag)}</small></span><span class="post-age">${esc(item.clock||'')}${item.demo?' · EJEMPLO':''}</span></div>
      <div class="post-tags"><span class="type-tag ${typeClass}${item.resolvedAt?' resolved':''}"><span class="type-symbol symbol-${typeClass}"></span>${esc(typeLabel(item))}</span>${item.category?`<span class="post-topic">${esc(item.category)}</span>`:''}</div>
      <h3>${esc(item.title)}</h3>
      <p class="post-excerpt">${esc(item.description)}</p>
      ${image}
      <div class="post-place">⌖ ${esc(item.coordinates?item.location:'Toda la ciudad · sin ubicación puntual')}</div>
      ${view==='mis-reportes'?`<div class="pending-tag">${esc(statusLabel(item))}${item.rejectionReason?` · ${esc(short(item.rejectionReason,70))}`:''}</div>`:''}
    </button>
    <div class="post-actions">
      <button type="button" class="post-action ${voted?'voted':''}" data-action="helpful" data-id="${esc(item.id)}" aria-pressed="${String(voted)}"><span aria-hidden="true">▲</span> ${voteCount(item)} · ${voted?'Marcado útil':'Me sirve'}</button>
      <button type="button" class="post-action" data-open="${esc(item.id)}"><span aria-hidden="true">▤</span> Ver detalles</button>
      ${item.coordinates?`<button type="button" class="post-action" data-action="locate" data-id="${esc(item.id)}"><span aria-hidden="true">⌖</span> Ver en mapa</button>`:''}
      <span class="post-future" title="Los comentarios se incorporarán en la segunda versión">Comentarios en v2</span>
    </div>
  </article>`;
}
function empty(title,desc,buttonText='',action=''){
  return `<div class="empty-state"><span class="empty-icon">⌖</span><strong>${esc(title)}</strong><p>${esc(desc)}</p>${buttonText?`<button type="button" data-action="${esc(action)}">${esc(buttonText)}</button>`:''}</div>`;
}
function canOpenView(next){
  return next==='explorar' || (next==='mis-reportes' && role!=='visitante') || (next==='moderacion' && ['lector','editor'].includes(role));
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
  if(!canOpenView(next)) {showToast('Este apartado no está disponible para el rol seleccionado.');return;}
  view=next; selectedId=null;
  document.querySelectorAll('.side-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  const headings={explorar:['PUBLICACIONES DE LA COMUNIDAD','El muro de Mazatlán'], 'mis-reportes':['TU PARTICIPACIÓN','Mis reportes'], moderacion:role==='lector'?['PANEL DE REVISIÓN','Reportes por revisar']:['PANEL EDITORIAL','Revisión pendiente']};
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
  updateStats();
  renderTrends();
  $('#role-select').value=role;
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
    setMapItems(located,selectedId);
  }else if(view==='mis-reportes'){
    list=items.filter(i=>i.owner==='local').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('#result-count').textContent=list.length;
    $('#feed-content').innerHTML=list.length?`<div class="group-label">ENVIADOS DESDE ESTE NAVEGADOR</div>${list.map(card).join('')}`
      :empty('Todavía no has enviado reportes','Los reportes creados con esta demostración aparecerán aquí.','Crear mi primer reporte','create-report');
    setMapItems(list.filter(i=>i.coordinates),selectedId);
  }else{
    // Lector: solo la bandeja de pendientes. Editor: pendientes y previamente revisados.
    list=items.filter(i=>role==='lector'?i.review==='pending':['pending','reviewed'].includes(i.review))
      .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    $('#result-count').textContent=list.length;
    const readerNotice=role==='lector'
      ? '<div class="review-role-note"><strong>Tu función: revisar.</strong> Comprueba la foto, descripción y ubicación. Marca el reporte como revisado para enviarlo al Editor. No puedes aprobar, rechazar ni publicar.</div>'
      : '';
    if(!list.length){
      $('#feed-content').innerHTML=readerNotice+empty('Todo está al día',role==='lector'?'No hay reportes nuevos por revisar.':'No hay reportes pendientes de revisión o decisión editorial.');
    }else{
      $('#feed-content').innerHTML=readerNotice+`<div class="group-label">${role==='lector'?'POR REVISAR':'PENDIENTES'} · ${list.length}</div>`+list.map(i=>`<div class="review-card"><span class="type-tag ${esc(i.type)}">${esc(TYPE_INFO[i.type]?.label||'Reporte')}</span><h3>${esc(i.title)}</h3><p>${esc(short(i.description,110))}</p><div class="card-location">⌖ ${esc(i.location)} · ${esc(statusLabel(i))}</div><div class="review-actions"><button type="button" data-open="${esc(i.id)}">Ver detalle</button>${i.review==='pending'?`<button type="button" data-review="${esc(i.id)}" data-decision="reviewed">Marcar revisado</button>`:''}${role==='editor'?`<button type="button" data-review="${esc(i.id)}" data-decision="approved">Aprobar</button><button type="button" data-review="${esc(i.id)}" data-decision="rejected">Rechazar</button>`:''}</div></div>`).join('');
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
  setTimeout(()=>{ if(!$('#drawer').classList.contains('open')) $('#drawer-content').innerHTML=''; },280);
}
function openDrawer(markup){
  $('#drawer-content').innerHTML=markup;
  $('#drawer-backdrop').hidden=false;
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false');
}
function drawerHead(eyebrow,title,desc=''){
  return `<div class="drawer-head"><button class="drawer-close" type="button" data-action="close-drawer" aria-label="Cerrar panel">×</button><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div>`;
}
function notSignedIn(){
  openDrawer(drawerHead('PARTICIPA EN MAZATLÁN','Entra como ciudadano','Esta demostración todavía no incluye cuentas reales. Puedes probar el recorrido de reportes con un rol local.')+
    `<div class="drawer-body"><p class="form-note">Las cuentas seguras con Supabase, el registro y los permisos reales se conectarán en una fase posterior. Cambiar el rol aquí es solo una simulación.</p><button type="button" class="submit-btn" data-action="choose-citizen">Usar ciudadano de prueba</button></div>`);
}
function openReportForm(){
  if(role==='visitante') return notSignedIn();
  chosenCoordinates=PLACES[0].coordinates.slice();
  customMapPoint=false;
  const categories=CATEGORY_OPTIONS.citizen.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  openDrawer(drawerHead('COMPARTE CON TU CIUDAD','Crear reporte ciudadano','Tu reporte no aparecerá públicamente hasta que un editor lo apruebe.')+
    `<div class="drawer-body"><p class="form-note">Prototipo local: tus datos se guardan únicamente en este navegador. Usa información de prueba y evita datos personales o acusaciones.</p>
      <form id="report-form">
        <div class="drawer-field"><label for="report-type">Tipo de reporte</label><select id="report-type" required><option value="citizen">Aviso del día (temporal)</option><option value="infrastructure">Problema de infraestructura (persistente)</option></select></div>
        <div class="drawer-field"><label for="report-category">Categoría</label><select id="report-category" required>${categories}</select></div>
        <div class="drawer-field"><label for="report-title">Título</label><input id="report-title" maxlength="100" minlength="8" required placeholder="Ej. Fuga de agua junto al parque"></div>
        <div class="drawer-field"><label for="report-description">Descripción breve</label><textarea id="report-description" maxlength="800" minlength="15" required placeholder="Cuenta qué sucede, sin publicar información personal..."></textarea></div>
        <div class="drawer-field"><label for="report-place">Ubicación aproximada</label><div class="location-choice"><select id="report-place">${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select><button id="choose-map-point" class="soft-btn" type="button">⌖ Mapa</button></div><small id="coordinates-hint" class="picked-coords">Punto de ejemplo: ${chosenCoordinates[1].toFixed(4)}, ${chosenCoordinates[0].toFixed(4)}. Usa «Mapa» para abrir el selector de ubicación sin salir del formulario.</small></div>
        <div class="drawer-field"><label for="report-photo">Fotografía del reporte *</label><input id="report-photo" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPG, PNG o WebP, máximo 4 MB. La imagen se comprime localmente. No se envía a ningún servidor.</small></div>
        <div class="drawer-field"><label class="policy-check"><input type="checkbox" required> Confirmo que la descripción no contiene datos personales, acusaciones ni información delictiva sin verificar.</label></div>
        <button type="submit" class="submit-btn">Enviar para revisión</button>
      </form></div>`);
}
function openNewsForm(){
  if(role!=='editor'){showToast('Solo el editor de demostración puede añadir noticias.');return;}
  openDrawer(drawerHead('PANEL EDITORIAL','Agregar noticia','Las noticias deben tener una fuente y enlace verificables.')+
    `<div class="drawer-body"><form id="news-form">
      <div class="drawer-field"><label for="news-title">Título</label><input id="news-title" required minlength="8" maxlength="110"></div>
      <div class="drawer-field"><label for="news-desc">Resumen</label><textarea id="news-desc" required minlength="15" maxlength="800"></textarea></div>
      <div class="drawer-field"><label for="news-source">Nombre del medio o fuente</label><input id="news-source" required maxlength="100" placeholder="Nombre del medio local"></div>
      <div class="drawer-field"><label for="news-link">Enlace de la fuente</label><input id="news-link" type="url" required placeholder="https://..."></div>
      <div class="drawer-field"><label for="news-place">Ubicación en el mapa</label><select id="news-place"><option value="none">Toda la ciudad / sin lugar fijo</option>${PLACES.map((p,idx)=>`<option value="${idx}">${esc(p.name)}</option>`).join('')}</select></div>
      <p class="form-note">En esta versión de demostración la noticia se guarda localmente. No hay RSS ni verificación automática.</p>
      <button class="submit-btn" type="submit">Guardar noticia</button>
    </form></div>`);
}
function isSafeURL(str){
  try {const url=new URL(str);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
function detail(item){
  const type=typeLabel(item);
  const isOwner=item.owner==='local';
  const sourceLink=isSafeURL(item.sourceUrl);
  const caption=item.demo?'Contenido ficticio de demostración. No corresponde a un evento real.':
    'Contenido guardado localmente. La publicación pública y su verificación requieren un servidor.';
  const editorActions=(role==='editor' && item.review==='approved' && item.type==='infrastructure' && !item.resolvedAt)
    ?`<button type="button" class="soft-btn" data-resolve="${esc(item.id)}">✓ Marcar como atendido</button>`:'';
  const editorialAction=(role==='editor'&&['pending','reviewed'].includes(item.review))
    ?`<button class="soft-btn" type="button" data-review="${esc(item.id)}" data-decision="approved">Aprobar reporte</button><button type="button" class="danger-btn" data-review="${esc(item.id)}" data-decision="rejected">Rechazar</button>`:'';
  const readerAction=['lector','editor'].includes(role)&&item.review==='pending'?`<button class="soft-btn" type="button" data-review="${esc(item.id)}" data-decision="reviewed">Marcar como revisado</button>`:'';
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
    ${isOwner?'<p style="font-size:10px;color:#91a4b2;margin-top:20px">Este reporte pertenece al usuario de prueba de este navegador.</p>':''}
  </div>`);
}
function review(id,decision){
  const i=items.find(e=>e.id===id);
  if(!i||!['pending','reviewed'].includes(i.review)) return;
  if(decision==='reviewed'&&(!['lector','editor'].includes(role)||i.review!=='pending')) return;
  if(['approved','rejected'].includes(decision)&&role!=='editor') return;
  if(decision==='rejected'){
    openDrawer(drawerHead('DECISIÓN EDITORIAL','Motivo de rechazo','Explica brevemente por qué no es posible publicar este reporte.')+
      `<div class="drawer-body"><form id="reject-form" data-item-id="${esc(id)}"><div class="drawer-field"><label for="reject-reason">Motivo para el ciudadano</label><textarea id="reject-reason" required minlength="8" maxlength="300" placeholder="Ej. La imagen no permite identificar el problema."></textarea></div><button type="submit" class="danger-btn" style="width:100%">Confirmar rechazo</button></form></div>`);
    return;
  }
  i.review=decision;
  if(decision==='reviewed') i.reviewedAt=new Date().toISOString();
  if(decision==='approved') i.approvedAt=new Date().toISOString();
  if(!saveItems(items)){showToast('No se pudo guardar la decisión en este navegador.');items=getItems();return;}
  closeDrawer(); render();showToast(decision==='approved'?'Reporte aprobado para la demostración.':'Reporte marcado como revisado.');
}
function resolveReport(id){
  if(role!=='editor') return;
  const i=items.find(e=>e.id===id);
  if(!i||i.review!=='approved'||i.type!=='infrastructure'||i.resolvedAt) return;
  i.resolvedAt=dateISO();
  if(!saveItems(items)){showToast('No hay espacio para guardar los cambios.');return;}
  closeDrawer();render();showToast('Reporte atendido: seguirá visible durante tres días.');
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
  if(role==='visitante'){showToast('Elige el rol Ciudadano para probar el envío.');return;}
  const form=event.currentTarget;
  const submit=form.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Preparando reporte...';
  try{
    const file=$('#report-photo').files[0];
    const img=await compressedPhoto(file);
    const type=$('#report-type').value;
    if(!['citizen','infrastructure'].includes(type)) throw Error('Tipo de reporte no válido.');
    const category=$('#report-category').value;
    if(!CATEGORY_OPTIONS[type].includes(category)) throw Error('Selecciona una categoría válida.');
    const now=new Date();
    const item={id:newId(),type,title:$('#report-title').value.trim(),description:$('#report-description').value.trim(),
      category,location:customMapPoint?'Punto seleccionado en el mapa':($('#report-place').selectedOptions[0]?.textContent||'Punto seleccionado'),coordinates:chosenCoordinates.slice(),
      day:dateISO(),clock:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      createdAt:now.toISOString(),review:'pending',resolvedAt:null,image:img,sourceName:null,sourceUrl:null,owner:'local',demo:false};
    if(item.title.length<8||item.description.length<15)throw Error('Completa el título y la descripción.');
    const next=[item,...items];
    if(!saveItems(next))throw Error('No hay espacio disponible en el almacenamiento del navegador.');
    items=next;closeDrawer();setView('mis-reportes');showToast('Reporte recibido. Pendiente de revisión editorial (demo).');
  }catch(err){showToast(err.message||'No se pudo enviar el reporte.');}
  finally{submit.disabled=false;submit.textContent='Enviar para revisión';}
}
function handleNewsSubmit(event){
  event.preventDefault();if(role!=='editor')return;
  const sourceUrl=isSafeURL($('#news-link').value);
  if(!sourceUrl){showToast('Introduce una URL válida que comience con https:// o http://');return;}
  const placeValue=$('#news-place').value;
  const loc=placeValue==='none'?null:PLACES[Number(placeValue)];
  if(placeValue!=='none'&&!loc)return;
  const now=new Date();
  const item={id:newId(),type:'news',title:$('#news-title').value.trim(),description:$('#news-desc').value.trim(),
    category:'Noticia',location:loc?.name||'Toda la ciudad',coordinates:loc?.coordinates||null,
    day:dateISO(),clock:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    createdAt:now.toISOString(),review:'approved',resolvedAt:null,image:null,
    sourceName:$('#news-source').value.trim(),sourceUrl,owner:'editor-local',demo:false};
  const next=[item,...items];
  if(!saveItems(next)){showToast('No hay espacio para guardar la noticia.');return;}
  items=next;closeDrawer();date=dateISO();setView('explorar');showToast('Noticia guardada en la demostración.');
}
function handleRejectSubmit(event){
  event.preventDefault();if(role!=='editor')return;
  const id=event.currentTarget.dataset.itemId;
  const i=items.find(x=>x.id===id);
  if(!i||!['pending','reviewed'].includes(i.review))return;
  i.review='rejected';i.rejectionReason=$('#reject-reason').value.trim();
  if(i.rejectionReason.length<8){showToast('Explica el motivo del rechazo.');return;}
  if(!saveItems(items)){showToast('No se pudo guardar.');return;}
  closeDrawer();render();showToast('Reporte rechazado. Motivo guardado localmente.');
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
  pickerCoords=chosenCoordinates.slice();
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

$('#role-select').value=role;
$('#role-select').addEventListener('change',e=>{
  role=e.target.value;saveRole(role);
  if(!canOpenView(view))setView('explorar');else setView(view);
  showToast('Rol de demostración: '+e.target.selectedOptions[0].textContent+'. No equivale a una cuenta real.');
});
$('#side-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
$('#sidebar-report').addEventListener('click',openReportForm);
$('#composer-report').addEventListener('click',openReportForm);
$('#composer-create').addEventListener('click',openReportForm);
$('#trends-list').addEventListener('click',e=>{
  const b=e.target.closest('[data-trend-open]');if(!b)return;
  const item=items.find(i=>i.id===b.dataset.trendOpen);
  if(item){selectedId=item.id;render();detail(item);}
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
  const open=e.target.closest('[data-open]');
  if(open){selectedId=open.dataset.open;const item=items.find(i=>i.id===selectedId);if(item){render();focusMapItem(item);detail(item);}return;}
  const action=e.target.closest('[data-action]');if(action){
    if(action.dataset.action==='reset-filters'){enabled=new Set(['news','citizen','infrastructure']);search='';$('#search-input').value='';date=dateISO();render();}
    if(action.dataset.action==='create-report')openReportForm();
    if(action.dataset.action==='add-news'&&role==='editor')openNewsForm();
    if(action.dataset.action==='helpful'){
      const id=action.dataset.id;
      if(helpfulVotes.has(id))helpfulVotes.delete(id);else helpfulVotes.add(id);
      try{localStorage.setItem('mzt_conecta_helpful_v02',JSON.stringify([...helpfulVotes]));}catch{}
      render();
    }
    if(action.dataset.action==='locate'){
      const item=items.find(i=>i.id===action.dataset.id);
      if(item?.coordinates){openLocationModal(item);}
      else showToast('Esta publicación no tiene una ubicación en el mapa.');
    }
    return;
  }
  const reviewBtn=e.target.closest('[data-review]');if(reviewBtn)review(reviewBtn.dataset.review,reviewBtn.dataset.decision);
});
$('#drawer').addEventListener('click',e=>{
  const action=e.target.closest('[data-action]');
  if(action){if(action.dataset.action==='close-drawer')closeDrawer();if(action.dataset.action==='choose-citizen'){role='ciudadano';saveRole(role);render();openReportForm();}return;}
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
    const place=PLACES[Number(e.target.value)];
    if(place){chosenCoordinates=place.coordinates.slice();customMapPoint=false;$('#coordinates-hint').textContent=`Punto aproximado: ${chosenCoordinates[1].toFixed(4)}, ${chosenCoordinates[0].toFixed(4)}. Pulsa «Mapa» para precisar.`;}
  }
});
$('#drawer').addEventListener('submit',e=>{
  if(e.target.id==='report-form')handleReportSubmit(e);
  if(e.target.id==='news-form')handleNewsSubmit(e);
  if(e.target.id==='reject-form')handleRejectSubmit(e);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#picker-overlay').hidden){closePicker();return;}if(!$('#location-overlay').hidden){closeLocationModal();return;}closeDrawer();}});

// Pequeñas funciones de consola para reiniciar datos locales de ejemplo durante el desarrollo.
window.MZTConectaDemo={reset(){resetDemo();location.reload();}, getStatus(){return {items:items.length,role,day:date,view};}};
render();
initMap({onSelect(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  selectedId=id;render();
  const cardEl=Array.from(document.querySelectorAll('#feed-content [data-post-id]')).find(n=>n.dataset.postId===id);
  cardEl?.scrollIntoView({behavior:'smooth',block:'nearest'});
  detail(item);
},onFail(){ $('#map-fallback').hidden=false; }})
  .then(ok=>{if(ok){$('#map-fallback').hidden=true;setMapItems(view==='explorar'?visibleForDay().filter(i=>i.coordinates):[],selectedId);setTimeout(resizeMap,400);}});
