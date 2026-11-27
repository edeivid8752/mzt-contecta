// Rutas sin dependencias. El UUID es estable incluso si se edita el título.
export const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70).replace(/-$/,'');
const idFrom=s=>{const id=String(s||'').slice(-36);return uuid.test(id)?id.toLowerCase():null;};
export const sections={social:'social',news:'noticias',infrastructure:'infraestructura'};
export const authPaths={login:'/iniciar-sesion',register:'/registro',forgot:'/recuperar-contrasena',recover:'/restablecer-contrasena'};
export const viewPaths={'mi-cuenta':'/cuenta',configuracion:'/configuracion',personas:'/personas',guardados:'/guardados',notificaciones:'/notificaciones',moderacion:'/moderacion',denuncias:'/denuncias',about:'/nosotros',business:'/mi-negocio','ad-admin':'/administracion/publicidad',advertise:'/publicidad',tendencias:'/tendencias'};
export const forumCategories=['Infraestructura','Qué hacer','Ideas para Mazatlán','Playas','Comunidad','Movilidad','Otros'];
export function postPath(item){return '/publicacion/'+(slug(item.title)?slug(item.title)+'-':'')+item.id;}
export function threadPath(t){return '/foro/conversacion/'+(slug(t.title)?slug(t.title)+'-':'')+t.id;}
export function profilePath(p,mode){return '/perfil/'+encodeURIComponent(p.username)+(mode?'/'+(mode==='followers'?'seguidores':'seguidos'):'');}
export function parseRoute(path,search=''){
 const legacy=new URLSearchParams(search).get('post');if(path==='/'&&uuid.test(legacy||''))return {view:'publicacion',id:legacy.toLowerCase()};
 const p=path.replace(/\/+$/,'')||'/';
 const a=Object.entries(authPaths).find(([,v])=>v===p);if(a)return {auth:a[0]};
 const v=Object.entries(viewPaths).find(([,v])=>v===p);if(v)return {view:v[0]};
 if(['/negocio/registro','/mi-negocio/campanas','/mi-negocio/estadisticas'].includes(p))return {view:'business'};
 if(p==='/')return {view:'explorar',section:'news',mode:'explorar'};
 if(p==='/muro/siguiendo')return {view:'explorar',section:'news',mode:'siguiendo'};
 const w=Object.entries(sections).find(([,s])=>p==='/muro/'+s);if(w)return {view:'explorar',section:w[0],mode:'explorar'};
 let m=p.match(/^\/publicacion\/([^/]+)$/);if(m&&idFrom(m[1]))return {view:'publicacion',id:idFrom(m[1])};
 if(p==='/foro')return {view:'foro',topic:'all',thread:null};
 m=p.match(/^\/foro\/conversacion\/([^/]+)$/);if(m&&idFrom(m[1]))return {view:'foro',topic:'all',thread:idFrom(m[1])};
 const cat=forumCategories.find(c=>p==='/foro/'+slug(c));if(cat)return {view:'foro',topic:cat,thread:null};
 m=p.match(/^\/perfil\/([a-zA-Z0-9._]{3,20})(?:\/(seguidores|seguidos))?$/);if(m)return {view:m[2]?'connections':'mi-cuenta',username:m[1].toLowerCase(),mode:m[2]==='seguidores'?'followers':'following'};
 return {view:'explorar',invalid:true,section:'news',mode:'explorar'};
}
