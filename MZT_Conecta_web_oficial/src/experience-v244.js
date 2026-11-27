import {WALL_TOPICS,matchesWallTopic} from './data.js?v=2.4.2';
import {sections} from './router-v21.js?v=2.4.4';
export const sectionOf=item=>item.type==='citizen'?'news':item.type;
export function combinedTopics(active){
 const all=[...new Set(Object.keys(WALL_TOPICS).filter(s=>active.has(s)).flatMap(s=>WALL_TOPICS[s]))];
 return all.includes('Otros')?[...all.filter(t=>t!=='Otros'),'Otros']:all;
}
export function pruneTopics(topics,active){const allowed=new Set(combinedTopics(active));return new Set([...topics].filter(t=>allowed.has(t)));}
export function matchesSelection(item,active,topics){
 const section=sectionOf(item);return active.has(section)&&(!topics.size||[...topics].some(t=>WALL_TOPICS[section]?.includes(t)&&matchesWallTopic(item,t)));
}
export function wallPath(active,mode,previous='/'){
 const list=Object.keys(sections).filter(s=>active.has(s));
 if(mode==='siguiendo')return '/muro/siguiendo'+(list.length===1&&list[0]==='news'?'':'?secciones='+list.join(','));
 if(list.length===1)return list[0]==='news'&&previous==='/'?'/':'/muro/'+sections[list[0]];
 return '/?secciones='+list.join(',');
}
export function installMobileMenu({sidebar,nav,toggle,signOut,mobile}){
 const marker=document.createComment('Ubicación original de cerrar sesión');signOut.before(marker);
 function setOpen(open,focus=false){
  open=Boolean(open&&mobile.matches);
  sidebar.classList.toggle('v244-menu-open',open);toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
  nav.inert=mobile.matches&&!open;
  const path=toggle.querySelector('path');if(path)path.setAttribute('d',open?'M6 6l12 12M18 6L6 18':'M4 7h16M4 12h16M4 17h16');
  if(focus)toggle.focus({preventScroll:true});
 }
 function adapt(){if(mobile.matches){if(signOut.parentNode!==nav)nav.append(signOut);}else if(signOut.parentNode===nav)marker.after(signOut);setOpen(false);}
 toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
 sidebar.addEventListener('click',e=>{if(e.target.closest('[data-view],#sign-out,#brand-home'))setOpen(false);});
 document.addEventListener('click',e=>{if(!sidebar.contains(e.target)&&toggle.getAttribute('aria-expanded')==='true')setOpen(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){e.preventDefault();setOpen(false,true);}});
 mobile.addEventListener('change',adapt);adapt();return {close:()=>setOpen(false)};
}
