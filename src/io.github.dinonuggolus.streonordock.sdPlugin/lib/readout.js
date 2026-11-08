'use strict';
// Body of a money / currency readout tile: icon on top, short name, one big plain value.
// No age, snapshot or stale wording, ever. The "~" estimate marker exists only when explicitly enabled.
const {fallback,esc}=require('./icons');
const text=(v,y,size,color='#fff',weight='')=>`<text x="72" y="${y}" text-anchor="middle" font-family="Arial"${weight?` font-weight="${weight}"`:''} font-size="${size}" fill="${color}">${esc(String(v))}</text>`;
function money(copper){
 if(!Number.isFinite(copper)||copper<0)return '?';
 const n=Math.floor(copper),g=Math.floor(n/10000),s=Math.floor(n/100)%100,c=n%100,out=[];
 if(g>0)out.push(`${g.toLocaleString('en-US')}g`);if(s>0)out.push(`${s}s`);if(c>0||!out.length)out.push(`${c}c`);
 return out.join(' ');
}
const count=n=>Number.isFinite(n)&&n>=0?Math.floor(n).toLocaleString('en-US'):'?';
const sizeFor=s=>Math.max(14,Math.min(40,Math.floor(136/(s.length*0.58))));
// Gold coin drawn locally (the export carries no icon id for money).
const COIN='<circle cx="72" cy="44" r="26" fill="#c9a227" stroke="#7a5c00" stroke-width="3"/><circle cx="72" cy="44" r="17" fill="none" stroke="#f3d66b" stroke-width="3"/>';
function shortName(entry){
 if(entry.kind==='money')return 'Gold';
 return (typeof entry.name==='string'&&entry.name?entry.name:'Currency').slice(0,18);
}
// estimate: {value, estimated} from the Estimator, or null. options.marker: show "~" while estimated.
function body(entry,resolver,estimate,options={}){
 let icon;
 if(entry.kind==='money')icon=COIN;
 else{
  const raw=resolver?resolver.resolve(entry):fallback(entry.name);
  // Resolver art fills a 128x88 box at (8,20); scale it into the top half of the tile.
  icon=`<g transform="translate(36 6) scale(.5)">${raw}</g>`;
 }
 const base=entry.kind==='money'?entry.copper:entry.quantity;
 const shown=estimate&&Number.isFinite(estimate.value)?estimate.value:base;
 let label=entry.kind==='money'?money(shown):count(shown);
 if(options.marker&&estimate&&estimate.estimated)label='~'+label;
 return icon+text(shortName(entry),76,14,'#cfd8e0')+text(label,114,sizeFor(label),'#ffd23f','bold');
}
module.exports={body,money,count};
