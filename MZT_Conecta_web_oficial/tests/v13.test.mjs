import assert from 'node:assert/strict';
import {hsvToHex,hexToHsv,selectFollowing} from '../src/community-v13.js';
for(const hex of ['#714383','#000000','#FFFFFF','#FF0000','#00FF00','#0000FF','#12AB90']){const {h,s,v}=hexToHsv(hex);assert.equal(hsvToHex(h,s,v),hex);}
assert.equal(hexToHsv('#bad'),null);
assert.deepEqual(selectFollowing([{id:1,a:'a'},{id:2,a:'b'}],['b'],p=>p.a).map(p=>p.id),[2]);
console.log('v1.3: HSV y muro Siguiendo OK');
