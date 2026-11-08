'use strict';
const {fallback,esc}=require('./icons');
const bounded=(v,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(v,max)):0;
const text=(v,y,size=16,color='#fff')=>`<text x="72" y="${y}" text-anchor="middle" font-family="Arial" font-size="${size}" fill="${color}">${esc(String(v))}</text>`;
const frame=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#101820"/>${body}</svg>`;
function banner(s){return !s||s.stale?`<rect width="144" height="17" fill="#853131"/>${text(s?'OLD SNAPSHOT':'STALE',12,11)}`:'';}
function ageLabel(seconds){const n=Math.floor(bounded(seconds,86400*365));return n<60?`${n}s`:n<3600?`${Math.floor(n/60)}m`:n<86400?`${Math.floor(n/3600)}h`:`${Math.floor(n/86400)}d`;}
function remaining(item,s,now=Date.now()){
 if(item?.kind!=='item'||!['game','est'].includes(item.source)||!Number.isFinite(item.endsAt)||!s)return 0;
 // savedAt (server seconds) corresponds to file mtime (local ms). This is an
 // approximation: a delayed save or copied file moves the anchor; never hide age.
 const elapsed=Math.max(0,(now-s.mtimeMs)/1000);return bounded(item.endsAt-s.savedAt-elapsed,86400);
}
function tile(s,item,index,now,resolver){
 if(!s)return frame(text('NO DATA',76,20)+text('SAVED SNAPSHOT',124,11)+banner(s));
 item=item||{kind:'empty'};let body='';
 if(item.kind==='empty')body=text('EMPTY',74,20,'#8996a2');
 else{
  body=resolver?resolver.resolve(item):fallback(item.name);
  body+=text((typeof item.name==='string'?item.name:'Unknown').slice(0,20),124,12);
  if(item.kind==='item'&&typeof item.count==='number'&&Number.isFinite(item.count))body+=`<rect x="74" y="87" width="68" height="23" rx="5" fill="#111"/>`+`<text x="108" y="104" text-anchor="middle" font-family="Arial" font-size="15" fill="#fff">${item.countEstimated?'~':''}${Math.floor(bounded(item.count,999999))}</text>`;
  if(item.kind==='item'){
   const left=remaining(item,s,now);let label='';
   if(item.source==='used')label='USED';else if(['game','est'].includes(item.source))label=Number.isFinite(item.endsAt)?left>0?`${Math.ceil(left)}s ${item.source}`:'':`CD ? ${item.source}`;
   if(label)body+=`<rect x="3" y="43" width="138" height="32" rx="5" fill="#000" opacity=".8"/>`+text(label,66,20);
  }
 }
 body+=text(`P${Math.floor(bounded(s.page?.index,10))} · ${index}`,140,11,'#aabbcc');return frame(body+banner(s));
}
const slot=(s,i,now=Date.now(),resolver)=>tile(s,s?.slots?.[i],i,now,resolver);
const readout=(s,i,now=Date.now(),resolver)=>tile(s,s?.readouts?.[i],i,now,resolver);
function status(s){if(!s)return frame(text('NO DATA',70,22)+text('SAVED SNAPSHOT',98,12)+banner(null));return frame(text('SAVED SNAPSHOT',36,12)+text(`P${s.page.index} / ${s.page.count}`,66,24)+text(`Age ${ageLabel(s.ageSeconds)}`,96,20)+text(s.countsEstimated?'counts est since snapshot':'Reload / logout updates',123,10)+banner(s));}
module.exports={slot,readout,status,remaining,ageLabel};
