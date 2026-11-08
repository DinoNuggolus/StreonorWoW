'use strict';
const {fallback,esc}=require('./icons');
const bounded=(v,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(v,max)):0;
const text=(v,y,size=16,color='#fff')=>`<text x="72" y="${y}" text-anchor="middle" font-family="Arial" font-size="${size}" fill="${color}">${esc(String(v))}</text>`;
const frame=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#101820"/>${body}</svg>`;
function remaining(item,s,now=Date.now()){
 if(item?.kind!=='item'||!['game','est'].includes(item.source)||!Number.isFinite(item.endsAt)||!s)return 0;
 // savedAt (server seconds) corresponds to file mtime (local ms): an approximation, so a delayed
 // save or copied file shifts the anchor. endsAt is absolute, so the countdown is correct at any age.
 const elapsed=Math.max(0,(now-s.mtimeMs)/1000);return bounded(item.endsAt-s.savedAt-elapsed,86400);
}
// Missing/corrupt data draws neutral tiles (no banner); the reason is logged by the plugin.
function tile(s,item,index,now,resolver){
 if(!s)return frame(text('·',84,40,'#2b3844')+text(String(index),140,11,'#4a5a69'));
 item=item||{kind:'empty'};let body='';
 if(item.kind==='empty')body=text('EMPTY',74,20,'#8996a2');
 else{
  body=resolver?resolver.resolve(item):fallback(item.name);
  body+=text((typeof item.name==='string'?item.name:'Unknown').slice(0,20),124,12);
  if(item.kind==='item'){
   const left=remaining(item,s,now);let label='';
   if(item.source==='used')label='USED';else if(['game','est'].includes(item.source))label=Number.isFinite(item.endsAt)?left>0?`${Math.ceil(left)}s ${item.source}`:'':`CD ? ${item.source}`;
   if(label)body+=`<rect x="3" y="43" width="138" height="32" rx="5" fill="#000" opacity=".8"/>`+text(label,66,20);
  }
 }
 body+=text(`P${Math.floor(bounded(s.page?.index,10))} · ${index}`,140,11,'#aabbcc');return frame(body);
}
const slot=(s,i,now=Date.now(),resolver)=>tile(s,s?.slots?.[i],i,now,resolver);
const readout=(s,i,now=Date.now(),resolver)=>tile(s,s?.readouts?.[i],i,now,resolver);
function status(s){return frame(text('StreonorDock',s?60:78,s?20:22)+(s?text(`Page ${s.page.index}/${s.page.count}`,100,26):''));}
module.exports={slot,readout,status,remaining};
