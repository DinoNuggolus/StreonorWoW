'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {CountLedger}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/countLedger');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
function snapshot(count=5,id=159,savedAt=100){return {savedAt,mtimeMs:100000,page:{index:1,count:1},ageSeconds:0,slots:{1:{kind:'item',id,count,name:'Spring Water'},2:{kind:'item',id:6948,count:1},3:{kind:'spell',id:123}},readouts:{1:{kind:'item',itemID:id,count}}};}
function press(l,slot=1){const p=l.capture(slot);l.accept(p);return p;}
test('baseline, multiple accepted presses, readout and estimate badges; input stays immutable',()=>{
 const l=new CountLedger([159]),s=snapshot();l.load(s);a.equal(l.view(s).slots[1].count,5);a.equal(l.view(s).countsEstimated,false);
 for(let i=0;i<3;i++)press(l);const v=l.view(s);a.equal(v.slots[1].count,2);a.equal(v.readouts[1].count,2);a.equal(s.slots[1].count,5);
 a.match(render.slot(v,1),/>~2<\/text>/);a.match(render.readout(v,1),/>~2<\/text>/);a.match(render.status(v),/counts est since snapshot/);
});
test('floor remains estimated at zero; huge baseline clamps and missing counts stay missing',()=>{
 const l=new CountLedger([159]);l.load(snapshot(1));press(l);press(l);a.equal(l.view(snapshot(1)).slots[1].count,0);a.match(render.slot(l.view(snapshot(1)),1),/>~0<\/text>/);
 l.load(snapshot(1e99));press(l);a.equal(l.view(snapshot(1e99)).slots[1].count,999998);
 const s=snapshot();delete s.slots[1].count;l.load(s);press(l);a.equal(l.view(s).slots[1].count,undefined);
});
test('refused/unacknowledged presses and reusable items/spells never decrement; held acknowledgement once',()=>{
 const l=new CountLedger([159]);const s=snapshot();l.load(s);l.capture(1);a.equal(l.view(s).slots[1].count,5);
 press(l,2);press(l,3);a.equal(l.view(s).slots[2].count,1);a.equal(l.view(s).countsEstimated,false);
 const token=press(l);l.accept(token);a.equal(l.view(s).slots[1].count,4);
});
test('new savedAt or changed export resets; unchanged snapshot preserves; old acknowledgements discarded',()=>{
 const l=new CountLedger([159,118]);let s=snapshot();l.load(s);press(l);l.load({...s,ageSeconds:10});a.equal(l.view(s).slots[1].count,4);
 const pending=l.capture(1);s=snapshot(7,159,101);l.load(s);l.accept(pending);a.equal(l.view(s).slots[1].count,7);a.equal(l.view(s).countsEstimated,false);
 s=snapshot(3,118,101);l.load(s);press(l);a.equal(l.view(s).slots[1].count,2);a.equal(l.view(s).slots[1].id,118);
});
test('missing export, unknown IDs, invalid slots and plugin restart fail soft',()=>{
 const l=new CountLedger([159]);l.load(null);a.equal(l.view(null),null);a.doesNotThrow(()=>l.accept(l.capture(1)));
 l.load(snapshot());press(l);l.load(null);l.load(snapshot());a.equal(l.view(snapshot()).slots[1].count,5);
 a.doesNotThrow(()=>press(l,99));const fresh=new CountLedger();fresh.load(snapshot());press(fresh);a.equal(fresh.view(snapshot()).slots[1].count,5);
});
