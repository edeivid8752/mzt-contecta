import assert from 'node:assert/strict';
import {combinedTopics,pruneTopics,matchesSelection,wallPath} from '../src/experience-v244.js';
import {parseRoute} from '../src/router-v21.js';
const active=new Set(['news','infrastructure']), all=combinedTopics(active);
assert(all.includes('Clima')&&all.includes('Baches')&&!all.includes('Comida'));assert.equal(all.filter(t=>t==='Otros').length,1);
const posts=[{type:'news',category:'Clima'},{type:'infrastructure',category:'Bache'},{type:'social',category:'Comida'},{type:'citizen',category:'Corte de agua'}];
assert.deepEqual(posts.filter(p=>matchesSelection(p,active,new Set())),[posts[0],posts[1],posts[3]]);
assert.deepEqual(posts.filter(p=>matchesSelection(p,active,new Set(['Clima','Baches']))),posts.slice(0,2));
assert.equal(posts.filter(p=>matchesSelection(p,new Set(),new Set())).length,0);
assert.deepEqual([...pruneTopics(new Set(['Clima','Baches','Otros']),new Set(['news']))],['Clima','Otros']);
for(const selection of [new Set(),active,new Set(['social','news','infrastructure']),new Set(['social'])]){const url=new URL(wallPath(selection,'explorar'),'https://mztconecta.com');const r=parseRoute(url.pathname,url.search);assert.deepEqual(new Set(r.activeSections||[r.section]),selection);}
console.log('v2.4.4: combinación, deselección, deduplicación, rutas y filtros secundarios correctos');
