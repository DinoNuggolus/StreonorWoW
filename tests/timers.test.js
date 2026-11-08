'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {PressTimers}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/pressTimers');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
const {normalize}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
const potion={kind:'item',id:1,name:'Potion',cooldownSeconds:120,cooldownSource:'table',poolKey:'pool:potion'};
const other={kind:'item',id:2,name:'Other',cooldownSeconds:120,cooldownSource:'table',poolKey:'pool:potion'};
const clockOf=()=>{const c={t:1000000};c.now=()=>c.t;return c;};
test('press starts a timer; repeat press neither restarts nor extends it; shared pool; clears at zero',()=>{
 const c=clockOf(),t=new PressTimers(c.now);
 a.equal(t.active(),false);a.equal(t.start(potion),true);a.equal(t.remaining(potion),120);a.equal(t.active(),true);
 c.t+=30000;a.equal(t.start(potion),false);a.equal(t.remaining(potion),90);
 a.equal(t.remaining(other),90,'same pool shares one timer');a.equal(t.start(other),false);
 c.t+=90000;a.equal(t.remaining(potion),0);a.equal(t.active(),false);
 a.equal(t.start(other),true,'a new press after expiry starts again');
});
test('unknown or invalid duration starts nothing; items without poolKey are separate',()=>{
 const t=new PressTimers(clockOf().now);
 for(const item of [{kind:'item',id:5,name:'x'},{kind:'spell',id:5,cooldownSeconds:60},{kind:'item',id:5,cooldownSeconds:1},{kind:'item',id:5,cooldownSeconds:'60'},{kind:'empty'},null])a.equal(t.start(item),false);
 a.equal(t.active(),false);
 a.equal(t.start({kind:'item',id:7,cooldownSeconds:60}),true);a.equal(t.remaining({kind:'item',id:8,cooldownSeconds:60}),0);
});
test('big countdown overlay at 119/60/59/1 seconds, none at 0, no banner text',()=>{
 const c=clockOf(),t=new PressTimers(c.now);const s={savedAt:1,mtimeMs:1,page:{index:1,count:1},slots:{1:potion},readouts:{}};
 const shown=()=>render.slot(s,1,c.t,null,t);
 a.ok(!shown().includes('font-size="56"')&&!shown().includes('fill="#ffd23f"'));
 t.start(potion);c.t+=0;a.match(shown(),/>2:00</);
 c.t=1000000+1000;a.match(shown(),/>1:59</);
 c.t=1000000+60000;a.match(shown(),/>60</);
 c.t=1000000+61000;a.match(shown(),/>59</);
 c.t=1000000+119000;a.match(shown(),/>1</);
 c.t=1000000+120000;a.ok(!shown().includes('#ffd23f'));
 for(const bad of ['SNAPSHOT','STALE','saved','USED','CD ?'])a.ok(!shown().includes(bad));
});
test('export end time (cooldown running at save time) is honored; unknown source draws nothing',()=>{
 const s=normalize({schema:1,savedAt:1000,page:{index:1,count:1},slots:{1:{kind:'item',id:9,name:'P',endsAt:1090,source:'game'},2:{kind:'item',id:10,name:'Q',source:'used'},3:{kind:'item',id:11,name:'R',source:'est'}},readouts:{}},50000);
 a.match(render.slot(s,1,50000+10000),/>80</);
 a.ok(!render.slot(s,2,60000).includes('#ffd23f'));a.ok(!render.slot(s,3,60000).includes('#ffd23f'));
});
test('reader accepts only known press-timer fields',()=>{
 const s=normalize({schema:1,savedAt:1000,page:{index:1,count:1},slots:{1:potion,2:{kind:'item',id:3,cooldownSeconds:120,cooldownSource:'bogus'},3:{kind:'item',id:4,cooldownSeconds:60,cooldownSource:'learned',poolKey:'a b<'}},readouts:{}},1);
 a.equal(s.slots[1].cooldownSeconds,120);a.equal(s.slots[1].poolKey,'pool:potion');a.equal(s.slots[2].cooldownSeconds,undefined);a.equal(s.slots[3].poolKey,undefined);a.equal(s.slots[3].cooldownSource,'learned');
});
