'use strict';
const {fallback,fallbackTile,esc}=require('./icons');
const readoutBody=require('./readout').body;
const bounded=(v,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(v,max)):0;
const text=(v,y,size=16,color='#fff')=>`<text x="72" y="${y}" text-anchor="middle" font-family="Arial" font-size="${size}" fill="${color}">${esc(String(v))}</text>`;
const frame=body=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#101820"/>${body}</svg>`;
function remaining(item,s,now=Date.now()){
 if(item?.kind!=='item'||!['game','est'].includes(item.source)||!Number.isFinite(item.endsAt)||!s)return 0;
 // savedAt (server seconds) corresponds to file mtime (local ms): an approximation, so a delayed
 // save or copied file shifts the anchor. endsAt is absolute, so the countdown is correct at any age.
 const elapsed=Math.max(0,(now-s.mtimeMs)/1000);return bounded(item.endsAt-s.savedAt-elapsed,86400);
}
// OmniCC-style text: whole seconds (rounded up, no suffix) under 90 s; whole minutes ('2m') from 90 s;
// whole hours ('2h') from 90 minutes. Never m:ss.
function clock(left){
 if(!Number.isFinite(left)||left<=0)return '';
 if(left>=5400)return `${Math.ceil(left/3600)}h`;
 if(left>=90)return `${Math.ceil(left/60)}m`;
 return String(Math.max(1,Math.min(89,Math.ceil(left))));
}
// OmniCC-style cooldown on the icon. The icon (or the text-tile fallback) is defined ONCE in <defs> and
// drawn twice with <use>: a desaturated, dimmed copy, and a full-colour copy clipped to the elapsed
// clockwise pie wedge that starts at 12 o'clock. A dim rect keeps the state obvious if a renderer
// ignores the saturate filter. The big number is bold white with a dark outline.
const CX=72,CY=64,R=80;   // covers the 128x88 icon box centred on (72,64)
const progressOf=(left,total)=>Number.isFinite(left)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(1,1-left/total)):0;
const f2=n=>Number(n.toFixed(2));
// Each region is drawn ONCE: full colour inside the elapsed wedge, gray (+dim) inside the remaining wedge.
// (Layering colour over gray lets an icon's semi-transparent pixels blend with gray and look washed out.)
// Arc: from 12 o'clock clockwise by fraction p of a turn; large-arc flag set when the arc exceeds 180 degrees.
function sector(from,to){          // fractions of a turn clockwise from 12 o'clock, 0 <= from < to <= 1
 const a=2*Math.PI*to,x=CX+R*Math.sin(a),y=CY-R*Math.cos(a),b=2*Math.PI*from,x0=CX+R*Math.sin(b),y0=CY-R*Math.cos(b);
 return `<path d="M${CX} ${CY}L${f2(x0)} ${f2(y0)}A${R} ${R} 0 ${to-from>0.5?1:0} 1 ${f2(x)} ${f2(y)}Z"/>`;
}
const circle=`<circle cx="${CX}" cy="${CY}" r="${R}"/>`;
function wedge(p){       // elapsed part: null when nothing elapsed, a full circle when done
 if(!(p>0))return null;if(p>=1)return circle;return sector(0,p);
}
function rest(p){        // remaining part: complement of wedge(p)
 if(!(p>0))return circle;if(p>=1)return null;return sector(p,1);
}
function numberText(label){
 const size=label.length>=3?42:54;
 return `<text x="72" y="${f2(CY+size*0.35)}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${size}" fill="#fff" stroke="#000" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(label)}</text>`;
}
function cooling(iconBody,left,total){
 const p=progressOf(left,total),done=wedge(p),todo=rest(p);
 return `<defs><g id="ic">${iconBody}</g><filter id="gr" x="0" y="0" width="1" height="1"><feColorMatrix type="saturate" values="0"/></filter>`+
  (done?`<clipPath id="pie">${done}</clipPath>`:'')+(todo?`<clipPath id="rest">${todo}</clipPath>`:'')+`</defs>`+
  (done?`<use xlink:href="#ic" clip-path="url(#pie)"/>`:'')+
  (todo?`<g clip-path="url(#rest)"><use xlink:href="#ic" filter="url(#gr)" opacity=".6"/><rect x="8" y="20" width="128" height="88" rx="16" fill="#000" opacity=".3"/></g>`:'')+
  numberText(clock(left));
}
// Bare tile: no background rect, so nothing but the given body is visible.
const bare=body=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`;
const bleed=uri=>`<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="${uri}"/>`;
// Key tiles: ONLY the icon, full-bleed over the whole 144x144 canvas (no border, inset, label, caption, badge,
// cooldown or timer). Empty slot = fully black tile. Filled slot with no resolvable icon = plain coloured tile
// with initials, so a missing icon is noticed. No snapshot at all keeps the neutral placeholder.
function tile(s,item,index,now,resolver,timers){
 if(!s)return frame(text('·',84,40,'#2b3844')+text(String(index),140,11,'#4a5a69'));
 item=item||{kind:'empty'};
 if(item.kind==='empty')return bare('<rect width="144" height="144" fill="#000"/>');
 const uri=resolver&&typeof resolver.uri==='function'?resolver.uri(item):null;
 return bare(uri?bleed(uri):fallbackTile(item.name));
}
// Retired: inset icon with cooldown overlay, name and caption. Unused by tile(); kept for reference/tests.
function legacyTile(s,item,index,now,resolver,timers){
 item=item||{kind:'empty'};let body='';
 if(item.kind==='empty')body=text('EMPTY',74,20,'#8996a2');
 else{
  const icon=resolver?resolver.resolve(item):fallback(item.name);
  let cd=null;
  if(item.kind==='item'||item.kind==='spell'){
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
const legacySlot=(s,i,now=Date.now(),resolver,timers)=>s?legacyTile(s,s.slots?.[i],i,now,resolver,timers):tile(s,null,i);
// est = {estimator, marker}: money/currency readouts show the saved value plus chat-log gains since the save.
function readout(s,i,now=Date.now(),resolver,timers,est){
 const entry=s?.readouts?.[i];
 if(s&&entry&&(entry.kind==='money'||entry.kind==='currency')){
  let estimate=null;try{estimate=est?.estimator?est.estimator.value(entry,s.savedAt):null;}catch{}
  return frame(readoutBody(entry,resolver,estimate,{marker:!!est?.marker})+text(`P${Math.floor(bounded(s.page?.index,10))} · ${i}`,140,11,'#aabbcc'));
 }
 return tile(s,entry,i,now,resolver,timers);
}
function status(s){return frame(text('StreonorDock',s?60:78,s?20:22)+(s?text(`Page ${s.page.index}/${s.page.count}`,100,26):''));}
module.exports={slot,legacySlot,readout,status,remaining,clock,wedge,rest,progressOf};
