'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {IconResolver,fallback}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/icons');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
test('fallback stable, escaped, bounded; local cache and size rejection',t=>{
 a.equal(fallback('Healing Potion'),fallback('Healing Potion'));a.notEqual(fallback('A'),fallback('B'));a.ok(!fallback('<&').includes('><&'));
 const dir=fs.mkdtempSync(path.join(__dirname,'tmp-icons-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'42.png'),Buffer.from([137,80,78,71,13,10,26,10]));const r=new IconResolver({iconDir:dir});a.match(r.resolve({iconFileID:42}),/data:image\/png;base64/);
 fs.writeFileSync(path.join(dir,'43.jpg'),Buffer.alloc(512*1024+1));a.match(r.resolve({iconFileID:43,name:'Hi'}),/rect/);
 fs.writeFileSync(path.join(dir,'44.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><script>bad</script></svg>');a.ok(!r.resolve({iconFileID:44}).includes('data:'));
 a.match(r.resolve({iconFileID:'../../secret'}),/rect/);
 fs.writeFileSync(path.join(dir,'45.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" fill="red"/></svg>');a.match(r.resolve({iconFileID:45}),/data:image\/svg\+xml;base64/);
 const custom=new IconResolver({},[()=>{throw Error('bad source');},()=> 'data:image/png;base64,AAAA']);a.match(custom.resolve({}),/data:image\/png/);
});
test('render server clock mapping, countdown expiry, source and unknown labels',()=>{
 const s={savedAt:1000,mtimeMs:2000000,ageSeconds:5,stale:false,page:{index:2,count:3},slots:{1:{kind:'item',name:'Potion',count:4,endsAt:1120,source:'est'}},readouts:{1:{kind:'item',source:'used'}}};
 a.equal(render.remaining(s.slots[1],s,2010000),110);a.equal(render.remaining(s.slots[1],s,2200000),0);
 const svg=render.slot(s,1,2010000);for(const text of ['110s','est','4','P2','Potion'])a.ok(svg.includes(text),text);
 a.match(render.readout(s,1,2010000),/USED/);s.slots[1].endsAt=undefined;a.match(render.slot(s,1,2010000),/CD \?/);
 s.slots[1]={kind:'spell',endsAt:1120,source:'est'};a.ok(!render.slot(s,1,2010000).includes('110s'));
});
test('honest missing, stale, status, empty and escape/clamp',()=>{
 a.match(render.slot(null,1),/NO DATA/);a.match(render.slot(null,1),/STALE/);
 const s={savedAt:1,mtimeMs:1000,ageSeconds:999,stale:true,page:{index:1,count:1},slots:{1:{kind:'item',name:'<&"',count:1e99}},readouts:{}};
 a.match(render.slot(s,1),/&lt;&amp;&quot;/);a.match(render.slot(s,1),/999999/);a.match(render.slot(s,2),/EMPTY/);a.match(render.slot(s,1),/OLD SNAPSHOT/);
 const status=render.status(s);for(const v of ['SAVED SNAPSHOT','P1 / 1','16m','OLD SNAPSHOT'])a.ok(status.includes(v),v);
});
