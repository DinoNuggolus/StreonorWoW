'use strict';
// Key tiles: exactly one 144x144 image per key, edge to edge. No text, count, timer, status, border,
// inset or overlay of any kind. Empty / disabled / unreadable export = fully black tile.
// An icon id whose file cannot be resolved = a plain question-mark glyph (drawn from paths, not text).
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`;
const BLANK=svg('<rect width="144" height="144" fill="#000"/>');
const QUESTION=svg('<rect width="144" height="144" fill="#1c2430"/><path d="M50 52C50 34 62 26 74 26C90 26 100 37 100 50C100 63 90 67 82 73C75 78 72 82 72 92" fill="none" stroke="#c8d2de" stroke-width="13" stroke-linecap="round"/><circle cx="72" cy="117" r="9" fill="#c8d2de"/>');
const bleed=uri=>svg(`<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="${uri}"/>`);
// s = ExportReader view (or null). resolver.uri({iconFileID}) -> data URI or null.
function slot(s,i,resolver){
 if(!s||s.enabled!==true)return BLANK;
 const id=s.icons?.[i];
 if(id==='unresolved')return QUESTION;   // assigned slot whose icon is not known yet
 if(!(Number.isInteger(id)&&id>0))return BLANK;
 const uri=resolver&&typeof resolver.uri==='function'?resolver.uri({iconFileID:id}):null;
 return uri?bleed(uri):QUESTION;
}
module.exports={slot,BLANK,QUESTION};
