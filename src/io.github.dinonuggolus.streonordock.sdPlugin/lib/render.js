'use strict';
// Key tiles: exactly one 144x144 image per key, edge to edge. An icon tile has no text, count, timer, status,
// border, inset or overlay of any kind. Empty / disabled / unreadable export = fully black tile.
// An assigned slot whose icon file is missing (or not known yet) = a coloured tile with the spell/item/macro NAME,
// so the keys are usable before an icon library exists; with no name at all = a plain question-mark glyph.
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`;
const BLANK=svg('<rect width="144" height="144" fill="#000"/>');
const QUESTION=svg('<rect width="144" height="144" fill="#1c2430"/><path d="M50 52C50 34 62 26 74 26C90 26 100 37 100 50C100 63 90 67 82 73C75 78 72 82 72 92" fill="none" stroke="#c8d2de" stroke-width="13" stroke-linecap="round"/><circle cx="72" cy="117" r="9" fill="#c8d2de"/>');
const bleed=uri=>svg(`<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="${uri}"/>`);
const esc=t=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function hue(name){let h=2166136261;for(const ch of name){h^=ch.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h%360;}
// Greedy word wrap into at most 4 lines of at most `max` characters (long words are cut).
function wrap(name,max){
 const lines=[];let cur='';
 for(let w of name.split(' ')){
  while(w.length>max){if(cur){lines.push(cur);cur='';}lines.push(w.slice(0,max));w=w.slice(max);}
  if(!cur)cur=w;else if((cur+' '+w).length<=max)cur+=' '+w;else{lines.push(cur);cur=w;}
 }
 if(cur)lines.push(cur);
 return lines.slice(0,4);
}
function named(name){
 const h=hue(name),n=name.length,size=n<=10?24:n<=20?20:16,max=n<=10?9:n<=20?11:13;
 const lines=wrap(name,max),lh=size+5,top=72-(lines.length*lh)/2+size*0.8;
 const text=lines.map((l,i)=>`<text x="72" y="${(top+i*lh).toFixed(1)}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="${size}" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="3" paint-order="stroke">${esc(l)}</text>`).join('');
 return svg(`<rect width="144" height="144" fill="hsl(${h},48%,26%)"/><rect y="104" width="144" height="40" fill="hsl(${h},48%,18%)" opacity=".6"/>${text}`);
}
const fallback=(s,i)=>{const name=s.names&&s.names[i];return typeof name==='string'&&name?named(name):QUESTION;};
// s = ExportReader view (or null). resolver.uri({iconFileID}) -> data URI or null.
function slot(s,i,resolver){
 if(!s||s.enabled!==true)return BLANK;
 const id=s.icons?.[i];
 if(id==='unresolved')return fallback(s,i);   // assigned slot whose icon is not known yet
 if(!(Number.isInteger(id)&&id>0))return BLANK;
 const uri=resolver&&typeof resolver.uri==='function'?resolver.uri({iconFileID:id}):null;
 return uri?bleed(uri):fallback(s,i);
}
module.exports={slot,BLANK,QUESTION};
