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
// OmniCC-style cooldown on the icon. The icon (or the text-tile fallback) is defined ONCE in <defs> and
// drawn twice with <use>: a desaturated, dimmed copy, and a full-colour copy clipped to the elapsed
// clockwise pie wedge that starts at 12 o'clock. A dim rect keeps the state obvious if a renderer
// ignores the saturate filter. The big number is bold white with a dark outline.
const CX=72,CY=64,R=80;   // covers the 128x88 icon box centred on (72,64)
const progressOf=(left,total)=>Number.isFinite(left)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(1,1-left/total)):0;
const f2=n=>Number(n.toFixed(2));
// Clip shape for the elapsed fraction p of a full turn. p<=0 -> null (nothing coloured yet).
function wedge(p){
 if(!(p>0))return null;
 if(p>=1)return `<circle cx="${CX}" cy="${CY}" r="${R}"/>`;
 const a=2*Math.PI*p,x=CX+R*Math.sin(a),y=CY-R*Math.cos(a);
 return `<path d="M${CX} ${CY}L${CX} ${CY-R}A${R} ${R} 0 ${p>0.5?1:0} 1 ${f2(x)} ${f2(y)}Z"/>`;
}
function numberText(label){
 const size=label.length>4?32:label.length>3?40:label.length>2?46:54;
 return `<text x="72" y="${f2(CY+size*0.35)}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${size}" fill="#fff" stroke="#000" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(label)}</text>`;
}
function cooling(iconBody,left,total){
 const clip=wedge(progressOf(left,total));
 return `<defs><g id="ic">${iconBody}</g><filter id="gr" x="0" y="0" width="1" height="1"><feColorMatrix type="saturate" values="0"/></filter>${clip?`<clipPath id="pie">${clip}</clipPath>`:''}</defs>`+
  `<use xlink:href="#ic" filter="url(#gr)" opacity=".6"/><rect x="8" y="20" width="128" height="88" rx="16" fill="#000" opacity=".3"/>`+
  (clip?`<use xlink:href="#ic" clip-path="url(#pie)"/>`:'')+numberText(clock(left));
}
// Missing/corrupt data draws neutral tiles (no banner); the reason is logged by the plugin.
function tile(s,item,index,now,resolver,timers){
 if(!s)return frame(text('·',84,40,'#2b3844')+text(String(index),140,11,'#4a5a69'));
 item=item||{kind:'empty'};let body='';
 if(item.kind==='empty')body=text('EMPTY',74,20,'#8996a2');
 else{
  const icon=resolver?resolver.resolve(item):fallback(item.name);
  let cd=null;
  if(item.kind==='item'){
   // Press-started plugin timer wins; otherwise a cooldown that was running at save time. Unknown = nothing.
   const t=timers?.info?timers.info(item):null,saved=remaining(item,s,now);
   if(t&&t.left>0&&t.left>=saved)cd=t;
   else if(saved>0)cd={left:saved,total:Number.isFinite(item.cooldownSeconds)&&item.cooldownSeconds>=saved?item.cooldownSeconds:saved};
  }
  body=cd?cooling(icon,cd.left,cd.total):icon;
  body+=text((typeof item.name==='string'?item.name:'Unknown').slice(0,20),124,12);
 }
 body+=text(`P${Math.floor(bounded(s.page?.index,10))} · ${index}`,140,11,'#aabbcc');return frame(body);
}
const slot=(s,i,now=Date.now(),resolver,timers)=>tile(s,s?.slots?.[i],i,now,resolver,timers);
const readout=(s,i,now=Date.now(),resolver,timers)=>tile(s,s?.readouts?.[i],i,now,resolver,timers);
function status(s){return frame(text('StreonorDock',s?60:78,s?20:22)+(s?text(`Page ${s.page.index}/${s.page.count}`,100,26):''));}
module.exports={slot,readout,status,remaining,clock,wedge,progressOf};
