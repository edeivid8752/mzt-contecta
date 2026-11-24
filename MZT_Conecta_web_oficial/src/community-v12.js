// Presentación de v1.2; no otorga permisos de autorización.
export function roleLabel(value){return value==='editor'?'Editor':value==='lector'?'Lector':value==='ciudadano'?'Ciudadano':'Rol no disponible';}

export function selectTrends(posts,votesFor,now=Date.now()){const cutoff=now-7*24*60*60*1000;return posts.filter(post=>{const created=Date.parse(post.createdAt);return post.review==='approved'&&Number.isFinite(created)&&created>cutoff&&created<=now;}).sort((a,b)=>votesFor(b)-votesFor(a)||Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,5);}

export function avatarInitial(name){return Array.from(String(name||'Usuario').trim())[0]?.toLocaleUpperCase('es-MX')||'U';}

export function authorByline(username,value){return [username?'@'+username:'',roleLabel(value)].filter(Boolean).join(' · ');}
