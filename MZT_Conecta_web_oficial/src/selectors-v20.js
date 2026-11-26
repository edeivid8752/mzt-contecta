// Conserva el select original como valor del formulario; el control visible usa teclado y ratón.
const controls=new WeakMap();
const iconPaths={social:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v2"/>',citizen:'<rect x="5" y="3" width="15" height="17" rx="2"/><path d="M8 7h9M8 11h9M8 15h6"/>',infrastructure:'<path d="M12 3 4 20h16L12 3zM8 12h8M6 16h12"/>',generic:'<path d="M5 7h14M5 12h14M5 17h14"/>',place:'<path d="M12 21s-7-6-7-12a7 7 0 1 1 14 0c0 6-7 12-7 12z"/><circle cx="12" cy="9" r="2"/>',date:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',check:'<path d="m5 12 4 4 10-10"/>'};
function icon(name){const el=document.createElement('span');el.className='mzt-select-icon icon-'+name;el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.generic)+'</svg>';return el;}
function info(select,o){if(select.id==='report-type')return {key:o.value,title:{social:'Social',citizen:'Noticias',infrastructure:'Infraestructura'}[o.value]||o.text,desc:{social:'Recomendaciones y eventos',citizen:'Noticias y avisos ciudadanos',infrastructure:'Problemas y servicios de la ciudad'}[o.value]||''};return {key:/place|region|post/.test(select.id||select.name)?'place':/period|date/.test(select.id)?'date':'generic',title:o.text,desc:''};}
let serial=0,active=null;
function decorate(s){
 if(s.multiple||s.size>1||controls.has(s))return;
 const w=document.createElement('div'),trigger=document.createElement('button'),menu=document.createElement('div');
 w.className='mzt-select';trigger.type='button';trigger.className='mzt-select-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');menu.className='mzt-select-list';menu.id='mzt-list-'+(++serial);menu.setAttribute('role','listbox');menu.hidden=true;trigger.setAttribute('aria-controls',menu.id);
 s.before(w);w.append(s,trigger,menu);s.classList.add('mzt-native-select');s.tabIndex=-1;
 let signature='',open=false;
 function refresh(){
  const next=JSON.stringify([s.selectedIndex,s.disabled,Array.from(s.options,o=>[o.value,o.text,o.disabled])]);if(next===signature)return;signature=next;
  const chosen=s.options[s.selectedIndex],meta=chosen?info(s,chosen):{title:'Seleccionar',key:'generic'};
  const name=s.labels?.[0]?.textContent?.trim()||s.getAttribute('aria-label')||'Seleccionar opción';
  trigger.setAttribute('aria-label',name.split('\n')[0]+': '+meta.title);trigger.disabled=s.disabled;
  const label=document.createElement('span');label.textContent=meta.title;label.className='mzt-select-label';
  const arrow=document.createElement('span');arrow.className='mzt-select-arrow';arrow.textContent=open?'⌃':'⌄';
  trigger.replaceChildren(icon(meta.key),label,arrow);
  menu.replaceChildren(...Array.from(s.options,(o,i)=>{const meta=info(s,o),b=document.createElement('button');b.type='button';b.className='mzt-select-option';b.disabled=o.disabled||s.disabled;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===s.selectedIndex));b.tabIndex=-1;
   const txt=document.createElement('span');txt.className='mzt-select-text';const title=document.createElement('strong');title.textContent=meta.title;txt.append(title);if(meta.desc){const desc=document.createElement('small');desc.textContent=meta.desc;txt.append(desc);}
   b.append(icon(meta.key),txt);if(i===s.selectedIndex)b.append(icon('check'));b.onclick=e=>{e.preventDefault();s.selectedIndex=i;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));close(true);refresh();};return b;}));
 }
 function close(focus=false){if(!open)return;open=false;menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(active===close)active=null;signature='';refresh();if(focus&&trigger.isConnected)trigger.focus();}
 function start(){if(s.disabled)return;active?.();open=true;active=close;menu.hidden=false;trigger.setAttribute('aria-expanded','true');signature='';refresh();const buttons=[...menu.querySelectorAll('button')];(buttons[s.selectedIndex]||buttons.find(b=>!b.disabled))?.focus({preventScroll:true});}
 trigger.onclick=e=>{e.preventDefault();open?close(true):start();};
 w.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close(true);return;}if(e.key==='Tab'){close();return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();if(!open){start();return;}const choices=[...menu.querySelectorAll('button:not(:disabled)')];if(!choices.length)return;let i=choices.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?choices.length-1:(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;choices[i].focus();});
 s.addEventListener('change',refresh);s.addEventListener('focus',()=>{if(!open)trigger.focus();});s.addEventListener('invalid',()=>trigger.focus());controls.set(s,{refresh,close,w});refresh();
}
export function refreshSelects(){document.querySelectorAll('select').forEach(s=>{decorate(s);controls.get(s)?.refresh();});}
export function installSelects(){let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refreshSelects();});};new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected']});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.mzt-select'))active?.();});document.addEventListener('reset',()=>setTimeout(refreshSelects,0));document.addEventListener('change',schedule);refreshSelects();}
