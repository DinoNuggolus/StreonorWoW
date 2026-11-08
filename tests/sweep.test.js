'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
const {PressTimers}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/pressTimers');
const {cadence,nextDelay}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/cadence');
const URI='data:image/png;base64,AAAAAAAA';
const resolver={resolve:()=>`<image x="8" y="20" width="128" height="88" xlink:href="${URI}"/>`};
const mk=d=>({kind:'item',id:1,name:'Potion',cooldownSeconds:d,cooldownSource:'table',iconFileID:1});
const snap=item=>({savedAt:1,mtimeMs:1,page:{index:1,count:1},slots:{1:item},readouts:{}});
function at(duration,elapsed){const c={t:1e6},t=new PressTimers(()=>c.t),item=mk(duration);t.start(item);c.t+=elapsed*1000;return {svg:render.slot(snap(item),1,c.t,resolver,t),t,item};}
test('wedge geometry at quadrant boundaries: clockwise from 12 o\'clock, large-arc flag, full circle',()=>{
 a.equal(render.wedge(0),null);a.equal(render.wedge(-1),null);a.equal(render.wedge(NaN),null);
 const arc=p=>/A80 80 0 (\d) 1 (-?[\d.]+) (-?[\d.]+)Z/.exec(render.wedge(p)).slice(1).map(Number);
 let [l,x,y]=arc(0.25);a.deepEqual([l,x,y],[0,152,64]);
 [l,x,y]=arc(0.5);a.equal(l,0);a.equal(x,72);a.equal(y,144);
 [l,x,y]=arc(0.75);a.deepEqual([l,x,y],[1,-8,64]);
 [l,x,y]=arc(0.99);a.equal(l,1);a.ok(Math.abs(x-72)<6&&y<-10);
 a.match(render.wedge(1),/^<circle cx="72" cy="64" r="80"\/>$/);a.match(render.wedge(5),/<circle/);
 a.match(render.wedge(0.1),/^<path d="M72 64L72 -16A/);
});
test('progress 0/50/99/100%: gray base, clipped colour wedge, big number, icon embedded once',()=>{
 let {svg}=at(100,0);a.match(svg,/filter="url\(#gr\)"/);a.match(svg,/saturate/);a.ok(!svg.includes('clip-path'),'0%: nothing coloured yet');a.match(svg,/>1:40</);
 ({svg}=at(100,50));a.match(svg,/<clipPath id="pie"><path/);a.match(svg,/clip-path="url\(#pie\)"/);a.match(svg,/>50</);
 ({svg}=at(100,99));a.match(svg,/>1</);a.match(svg,/A80 80 0 1 1/);
 ({svg}=at(100,100));a.ok(!svg.includes('id="ic"')&&!svg.includes('<defs>'),'100%: timer vanishes, plain icon');a.match(svg,/xlink:href="data:image/);
 ({svg}=at(100,25));a.equal(svg.split(URI).length-1,1,'icon data URI appears exactly once');a.equal(svg.split('<use ').length-1,2);
 a.match(svg,/font-weight="bold"[^>]*fill="#fff"[^>]*stroke="#000"/);a.match(svg,/opacity="\.3"/,'dim fallback rect');
});
test('no icon: text tile gets the same big number and gray sweep',()=>{
 const c={t:1e6},t=new PressTimers(()=>c.t),item=mk(60);t.start(item);c.t+=30000;
 const svg=render.slot(snap(item),1,c.t,{resolve:i=>require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/icons').fallback(i.name)},t);
 a.match(svg,/<g id="ic"><rect[^>]*hsl/);a.match(svg,/>30</);a.match(svg,/clip-path="url\(#pie\)"/);
});
test('zero, negative, huge and invalid durations never produce NaN or a timer',()=>{
 const t=new PressTimers(()=>1e6);
 for(const d of [0,-5,1,NaN,Infinity,86401,'60',null])a.equal(t.start(mk(d)),false);
 a.equal(render.progressOf(-5,100),1);a.equal(render.progressOf(5,0),0);a.equal(render.progressOf(NaN,10),0);a.equal(render.progressOf(200,100),0);
 const {svg}=at(86400,1);a.ok(!/NaN|undefined|Infinity/.test(svg));a.match(svg,/>1439:59</);
 const neg=render.slot(snap(mk(60)),1,1e6,resolver,{info:()=>({left:-3,total:60})});a.ok(!neg.includes('<defs>'));
});
test('export end time (running at save) also gets the sweep, using cooldownSeconds as the total',()=>{
 const item={...mk(120),endsAt:1090,source:'game'},s={savedAt:1000,mtimeMs:0,page:{index:1,count:1},slots:{1:item},readouts:{}};
 const svg=render.slot(s,1,0,resolver);a.match(svg,/>90</);a.match(svg,/clip-path="url\(#pie\)"/);
});
test('redraw cadence: slow normally, fast only at <=10s left, configurable; idle = slow',()=>{
 const c=cadence({});a.deepEqual(c,{slow:1000,fast:500,within:10});
 a.equal(nextDelay(Infinity,c),1000);a.equal(nextDelay(60,c),1000);a.equal(nextDelay(10,c),500);a.equal(nextDelay(0.2,c),500);
 const custom=cadence({redrawIntervalMs:2000,fastRedrawIntervalMs:250,fastRedrawWithinSeconds:3});a.equal(nextDelay(4,custom),2000);a.equal(nextDelay(3,custom),250);
 a.deepEqual(cadence({redrawIntervalMs:5,fastRedrawIntervalMs:'x'}),c);
 const c2={t:0},t=new PressTimers(()=>c2.t);a.equal(t.minLeft(),Infinity);t.start(mk(30));c2.t+=25000;a.equal(t.minLeft(),5);c2.t+=6000;a.equal(t.minLeft(),Infinity);
});
