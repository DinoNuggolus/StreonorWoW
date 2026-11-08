'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin');
const render=require(path.join(root,'lib/render'));
const URI='data:image/png;base64,AAAAAAAA';
const resolver={uri:i=>i.iconFileID===1?URI:null};
const snap=icons=>({schema:2,enabled:true,profileId:'p',page:1,icons:{1:undefined,2:undefined,3:undefined,...icons}});
const FORBIDDEN=/<text|<tspan|<title|<desc|<defs|<filter|<clipPath|<use|opacity|stroke-dasharray|<rect(?![^>]*width="144" height="144")/;

test('resolved icon: one 144x144 image edge to edge, nothing else',()=>{
 const svg=render.slot(snap({1:1}),1,resolver);
 a.match(svg,/width="144" height="144" viewBox="0 0 144 144"/);
 a.match(svg,/<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="data:image\/png;base64,AAAAAAAA"\/>/);
 a.equal((svg.match(/<(?!\/?svg|image)[a-z]/gi)||[]).length,0,'only svg + image elements');
 a.equal((svg.match(/<image /g)||[]).length,1);a.ok(!FORBIDDEN.test(svg));
});
test('empty / disabled / no export / out-of-range key = fully black blank',()=>{
 for(const s of [snap({}),null,{...snap({1:1}),enabled:false},{...snap({1:1}),enabled:undefined}])for(const i of [1,3,9,99])a.equal(render.slot(s,i,resolver),render.BLANK);
 a.match(render.BLANK,/<rect width="144" height="144" fill="#000"\/>/);a.ok(!/<text|<image/.test(render.BLANK));
});
test('unresolved (marker, or id with no icon file, or no resolver) = icon-only question glyph without text',()=>{
 for(const svg of [render.slot(snap({1:'unresolved'}),1,resolver),render.slot(snap({2:2}),2,resolver),render.slot(snap({1:1}),1,null)]){
  a.equal(svg,render.QUESTION);a.ok(!/<text|<image/.test(svg));a.match(svg,/<path /);}
});
test('rendered output never carries telemetry/status fields even when the reader view has them',()=>{
 const poisoned={...snap({1:1}),savedAt:1,age:99,stale:true,count:77,cooldown:30,status:'Page 2/3',name:'Moonfire',readouts:{1:{kind:'money'}},slots:{1:{name:'Moonfire',count:77,endsAt:9}}};
 const svg=render.slot(poisoned,1,resolver);a.ok(!FORBIDDEN.test(svg),svg);
 for(const bad of ['Moonfire','77','Page','STALE','NO DATA','SNAPSHOT'])a.ok(!svg.includes(bad),bad);
 a.deepEqual(Object.keys(render).sort(),['BLANK','QUESTION','slot']);   // no status/readout/legacy renderers
});
test('fifteen stable positions: a gap never compacts the rest',()=>{
 const s=snap({1:1,3:1,15:1});const out=Array.from({length:15},(_,i)=>render.slot(s,i+1,resolver));
 a.deepEqual(out.map(x=>x.includes('<image')),[true,false,true,...Array(11).fill(false),true]);
});

const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(['logs','node_modules'].includes(e.name)?[]:walk(path.join(d,e.name))):[path.join(d,e.name)]);
test('no code path reads or deletes game chat/combat logs (grep over lib/ and plugin/)',()=>{
 const files=[...walk(path.join(root,'lib')),...walk(path.join(root,'plugin'))].filter(f=>/\.(js|ps1|json)$/.test(f));a.ok(files.length>=6);
 for(const f of files){const code=fs.readFileSync(f,'utf8');
  a.doesNotMatch(code,/WoWChatLog|WoWCombatLog|chat[ _-]?log|combat[ _-]?log|chatLogPath|logDir|deleteLogs|LoggingChat|LoggingCombat|[\/]Logs\b/i,f+': game log reference');
  a.doesNotMatch(code,/\bunlink(Sync)?\b|\brmSync\b|\brmdir(Sync)?\b|fs\.rm\(|\.rm\(|Remove-Item|\bdel\b|File\]::Delete|Directory\]::Delete/,f+': deletion primitive');
  a.doesNotMatch(code,/createReadStream|fs\.watch|readdirSync\(.*Logs/,f);}
 // The only file reads are the SavedVariables export and icon files.
 const idx=fs.readFileSync(path.join(root,'plugin/index.js'),'utf8');a.doesNotMatch(idx,/readFileSync\((?!file|path)/);
});
test('removed modules and manifest actions are really gone',()=>{
 for(const f of ['cadence','chatParser','chatTail','estimator','logCleanup','pressTimers','readout'])a.ok(!fs.existsSync(path.join(root,'lib',f+'.js')),f);
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'plugin/config.json'),'utf8'));
 for(const k of ['deleteLogsOnLogout','liveEstimates','showEstimateMarker','logDir','chatLogPath'])a.ok(!(k in cfg),k);
});
