'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
const {PressTimers}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/pressTimers');
const {cadence,nextDelay}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/cadence');
const URI='data:image/png;base64,AAAAAAAA';
const resolver={resolve:()=>`<image x="8" y="20" width="128" height="88" xlink:href="${URI}"/>`};
const mk=d=>({kind:'item',id:1,name:'Potion',cooldownSeconds:d,cooldownSource:'table',iconFileID:1});
const snap=item=>({savedAt:1,mtimeMs:1,page:{index:1,count:1},slots:{1:item},readouts:{}});
function at(duration,elapsed){const c={t:1e6},t=new PressTimers(()=>c.t),item=mk(duration);t.start(item);c.t+=elapsed*1000;return {svg:render.legacySlot(snap(item),1,c.t,resolver,t),t,item};}
const PATH=/M(-?[0-9.]+) (-?[0-9.]+)L(-?[0-9.]+) (-?[0-9.]+)A([0-9]+) ([0-9]+) 0 ([0-9]) ([0-9]) (-?[0-9.]+) (-?[0-9.]+)Z/;
const TAU=2*Math.PI,clockwise=(cx,cy,x,y)=>{const t=Math.atan2(x-cx,-(y-cy));return t<0?t+TAU:t;};
// Parses a generated clip shape and returns {fraction, contains(angleFraction)} computed from the real path data.
function analyse(shape){
 if(shape===null)return {fraction:0,contains:()=>false};
 if(/^<circle cx="72" cy="64" r="80"[/]>$/.test(shape))return {fraction:1,contains:()=>true};
 const m=PATH.exec(shape);a.ok(m,shape);const [cx,cy,x0,y0,rx,ry,large,sweepFlag,x1,y1]=m.slice(1).map(Number);
 a.equal(rx,80);a.equal(ry,80);a.equal(sweepFlag,1,'clockwise');
 const start=clockwise(cx,cy,x0,y0);let sweep=(clockwise(cx,cy,x1,y1)-start+TAU)%TAU;if(sweep<1e-6)sweep=TAU;
 a.equal(large,sweep>Math.PI+1e-9?1:0,'large-arc flag matches the actual sweep ('+shape+')');
 return {fraction:sweep/TAU,start,contains:f=>{const ang=(f*TAU-start+TAU)%TAU;return ang<sweep;}};
}
test('wedge geometry: parsed clip covers exactly the elapsed fraction (0/5/25/50/75/95/99/100%), clockwise from 12',()=>{
 for(const p of [0,0.05,0.25,0.5,0.75,0.95,0.99,1]){
  const w=analyse(render.wedge(p)),r=analyse(render.rest(p));
  a.ok(Math.abs(w.fraction-p)<0.01,'elapsed '+p+' got '+w.fraction);
  a.ok(Math.abs(r.fraction-(1-p))<0.01,'remaining '+p+' got '+r.fraction);
  // sample 720 directions: every direction belongs to exactly one of the two regions, and the colour
  // region is exactly the first p of the turn (starting at 12 o'clock, going clockwise)
  let inside=0;for(let k=0;k<720;k++){const f=(k+0.5)/720,inW=w.contains(f),inR=r.contains(f);a.equal(inW!==inR,true,'partition at '+f);if(inW)inside++;a.equal(inW,f<p||p>=1,'direction '+f+' at p='+p);}
  a.ok(Math.abs(inside/720-p)<0.01);
 }
 a.equal(render.wedge(0),null);a.equal(render.wedge(-1),null);a.equal(render.wedge(NaN),null);a.equal(render.rest(1),null);a.equal(render.rest(NaN),render.wedge(1));
 // quadrant boundaries: exact end points
 a.match(render.wedge(0.25),/A80 80 0 0 1 152 64Z/);a.match(render.wedge(0.5),/A80 80 0 0 1 72 144Z/);a.match(render.wedge(0.75),/A80 80 0 1 1 -8 64Z/);
 a.match(render.wedge(0.95),/^<path d="M72 64L72 -16A80 80 0 1 1 47.28 -12.08Z"[/]>$/);
 a.match(render.rest(0.95),/^<path d="M72 64L47.28 -12.08A80 80 0 0 1 72 -16Z"[/]>$/);
});
test('rendered tile at 95%: colour wedge covers the elapsed 95%, gray only the last 5%; icon embedded once',()=>{
 const {svg}=at(100,95);
 const pie=/<clipPath id="pie">(.*?)<[/]clipPath>/.exec(svg)[1],rest=/<clipPath id="rest">(.*?)<[/]clipPath>/.exec(svg)[1];
 a.ok(Math.abs(analyse(pie).fraction-0.95)<0.01);a.ok(Math.abs(analyse(rest).fraction-0.05)<0.01);
 a.ok(svg.includes('<use xlink:href="#ic" clip-path="url(#pie)"/>'));a.ok(svg.includes('<g clip-path="url(#rest)"><use xlink:href="#ic" filter="url(#gr)"'));
 a.equal(svg.split(URI).length-1,1);a.equal(svg.split('<use ').length-1,2);
 // the colour copy is never layered over the gray copy: each region is drawn once
 a.ok(svg.indexOf('clip-path="url(#pie)"')<svg.indexOf('clip-path="url(#rest)"'));
});
test('progress 0/50/99/100%: defs, gray base, big number, plain icon when done',()=>{
 let {svg}=at(100,0);a.ok(svg.includes('filter="url(#gr)"'));a.match(svg,/saturate/);a.ok(!svg.includes('clip-path="url(#pie)"'),'0%: nothing coloured yet');a.match(svg,/>2m</);
 ({svg}=at(100,50));a.match(svg,/<clipPath id="pie"><path/);a.match(svg,/>50</);
 ({svg}=at(100,99));a.match(svg,/>1</);a.match(svg,/A80 80 0 1 1/);
 ({svg}=at(100,100));a.ok(!svg.includes('id="ic"')&&!svg.includes('<defs>'),'100%: timer vanishes, plain icon');a.match(svg,/xlink:href="data:image/);
 ({svg}=at(100,25));a.match(svg,/font-weight="bold"[^>]*fill="#fff"[^>]*stroke="#000"/);a.ok(svg.includes('opacity=".3"'),'dim fallback rect');
});
test('OmniCC time text: seconds under 90, minutes from 90 s, hours from 90 min; never m:ss',()=>{
 const t=(l)=>render.clock(l);
 for(const [l,e] of [[0.2,'1'],[1,'1'],[1.01,'2'],[6,'6'],[59.4,'60'],[89,'89'],[89.5,'89'],[90,'2m'],[91,'2m'],[120,'2m'],[120.1,'3m'],[1800,'30m'],[5399,'90m'],[5400,'2h'],[7200,'2h'],[7201,'3h'],[86400,'24h']])a.equal(t(l),e,String(l));
 for(const l of [0,-1,NaN,Infinity])a.equal(t(l)===''||l===Infinity,true);
 const c={t:1e6},tm=new PressTimers(()=>c.t),item=mk(1800);tm.start(item);
 const svg=render.legacySlot(snap(item),1,c.t,resolver,tm);a.match(svg,/>30m</);a.match(svg,/font-size="42"/);a.ok(!/[0-9]:[0-9][0-9]/.test(svg.replace(/data:[^"]*/,'')));
});
test('no icon: text tile gets the same big number and gray sweep',()=>{
 const c={t:1e6},t=new PressTimers(()=>c.t),item=mk(60);t.start(item);c.t+=30000;
 const svg=render.legacySlot(snap(item),1,c.t,{resolve:i=>require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/icons').fallback(i.name)},t);
 a.match(svg,/<g id="ic"><rect[^>]*hsl/);a.match(svg,/>30</);a.match(svg,/clip-path="url\(#pie\)"/);
});
test('zero, negative, huge and invalid durations never produce NaN or a timer',()=>{
 const t=new PressTimers(()=>1e6);
 for(const d of [0,-5,1,NaN,Infinity,86401,'60',null])a.equal(t.start(mk(d)),false);
 a.equal(render.progressOf(-5,100),1);a.equal(render.progressOf(5,0),0);a.equal(render.progressOf(NaN,10),0);a.equal(render.progressOf(200,100),0);
 const {svg}=at(86400,1);a.ok(!/NaN|undefined|Infinity/.test(svg));a.match(svg,/>24h</);
 const neg=render.legacySlot(snap(mk(60)),1,1e6,resolver,{info:()=>({left:-3,total:60})});a.ok(!neg.includes('<defs>'));
});
test('export end time (running at save) also gets the sweep, using cooldownSeconds as the total',()=>{
 const item={...mk(120),endsAt:1090,source:'game'},s={savedAt:1000,mtimeMs:0,page:{index:1,count:1},slots:{1:item},readouts:{}};
 const svg=render.legacySlot(s,1,0,resolver);a.match(svg,/>2m</);a.match(svg,/clip-path="url\(#pie\)"/);
});
test('redraw cadence: slow normally, fast only at <=10s left, configurable; idle = slow',()=>{
 const c=cadence({});a.deepEqual(c,{slow:1000,fast:500,within:10});
 a.equal(nextDelay(Infinity,c),1000);a.equal(nextDelay(60,c),1000);a.equal(nextDelay(10,c),500);a.equal(nextDelay(0.2,c),500);
 const custom=cadence({redrawIntervalMs:2000,fastRedrawIntervalMs:250,fastRedrawWithinSeconds:3});a.equal(nextDelay(4,custom),2000);a.equal(nextDelay(3,custom),250);
 a.deepEqual(cadence({redrawIntervalMs:5,fastRedrawIntervalMs:'x'}),c);
 const c2={t:0},t=new PressTimers(()=>c2.t);a.equal(t.minLeft(),Infinity);t.start(mk(30));c2.t+=25000;a.equal(t.minLeft(),5);c2.t+=6000;a.equal(t.minLeft(),Infinity);
});
