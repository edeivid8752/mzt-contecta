import assert from 'node:assert/strict';
import {dailyStories,mazatlanDay} from '../src/daily-bar.js';
const day='2026-11-27',story=(id,more={})=>({id,type:'news',review:'approved',day,dailyDay:day,createdAt:day+'T12:00:00Z',...more});
assert.equal(mazatlanDay(new Date('2026-11-28T03:00:00Z')),day);
assert.equal(dailyStories(Array.from({length:12},(_,i)=>story('n'+i)),day).length,12);
assert.deepEqual(dailyStories([story('old',{dailyDay:'2026-11-26',dailyUntil:day}),story('expired',{dailyDay:'2026-11-25'}),story('pending',{review:'pending'}),story('event',{type:'social',eventDay:'2026-11-28'}),story('infra',{type:'infrastructure'}),story('citizen',{type:'citizen'})],day).map(x=>x.id).sort(),['citizen','event','old']);
assert.equal(dailyStories([story('future',{dailyDay:'2026-11-28'})],day).length,0);
console.log('Titulares múltiples y vigencias independientes correctos');
