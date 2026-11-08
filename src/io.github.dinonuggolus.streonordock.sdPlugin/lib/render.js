'use strict';
const {fallback,esc}=require('./icons');
const bounded=(v,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(v,max)):0;
const text=(v,y,size=16,color='#fff')=>`<text x="72" y="${y}" text-anchor="middle" font-family="Arial" font-size="${size}" fill="${color}">${esc(String(v))}</text>`;
const frame=body=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#101820"/>${body}</svg>`;
function remaining(item,s,now=Date.now()){
 if(item?.kind!=='item'||!['game','est'].includes(item.source)||!Number.isFinite(item.endsAt)||!s)return 0;
 // savedAt (server seconds) corresponds to file mtime (local ms): an approximation, so a delayed
 // save or copied file shifts the anchor. endsAt is absolute, so the countdown is correct at any age.
 const elapsed=Math.max(0,(now-s.mtimeMs)/1000);return bounded(item.endsAt-s.savedAt-elapsed,86400);
}
// Big centered countdown over the icon: seconds up to 99, m:ss above.
function clock(left){const n=Math.ceil(left);return n>99?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:String(n);}
function overlay(label){
 const size=label.length>4?38:label.length>2?46:56;
 return `<rect x="14" y="30" width="116" height="66" rx="12" fill="#000" opacity=".62"/><text x="72" y="${63+size*0.36}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${size}" fill="#ffd23f" stroke="#000" stroke-width="1.5" paint-order="stroke">${esc(label)}</text>`;
}
// Missing/corrupt data draws neutral tiles (no banner); the reason is logged by the plugin.
function tile(s,item,index,now,resolver,timers){
 if(!s)return frame(text('·',84,40,'#2b3844')+text(String(index),140,11,'#4a5a69'));
 item=item||{kind:'empty'};let body='';
 if(item.kind==='empty')body=text('EMPTY',74,20,'#8996a2');
 else{
  body=resolver?resolver.resolve(item):fallback(item.name);
  body+=text((typeof item.name==='string'?item.name:'Unknown').slice(0,20),124,12);
  if(item.kind==='item'){
   // Press-started plugin timer wins; otherwise a cooldown that was running at save time. Unknown = nothing.
   const left=Math.max(timers?timers.remaining(item):0,remaining(item,s,now));
   if(left>0)body+=overlay(clock(left));
  }
 }
 body+=text(`P${Math.floor(bounded(s.page?.index,10))} · ${index}`,140,11,'#aabbcc');return frame(body);
}
const slot=(s,i,now=Date.now(),resolver,timers)=>tile(s,s?.slots?.[i],i,now,resolver,timers);
const readout=(s,i,now=Date.now(),resolver,timers)=>tile(s,s?.readouts?.[i],i,now,resolver,timers);
function status(s){return frame(text('StreonorDock',s?60:78,s?20:22)+(s?text(`Page ${s.page.index}/${s.page.count}`,100,26):''));}
module.exports={slot,readout,status,remaining,clock};
