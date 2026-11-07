'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_ICON_BYTES=512*1024;
const esc=v=>(typeof v==='string'?v:'').slice(0,100).replace(/[\x00-\x1f\x7f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function fallback(name){
 name=typeof name==='string'?name.slice(0,100):'?';let h=2166136261;for(const c of name)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 const initials=name.trim().split(/\s+/).slice(0,2).map(w=>Array.from(w)[0]||'').join('').toUpperCase()||'?';
 return `<rect x="8" y="20" width="128" height="88" rx="16" fill="hsl(${h%360},45%,30%)"/><text x="72" y="78" text-anchor="middle" font-size="34" fill="white">${esc(initials)}</text>`;
}
// Local SVG uses a deliberately small inert shape subset. No scripts, CSS, entities,
// images, links, external references or foreign content (including encoded hrefs).
function safeSvg(text){
 if(!/^\s*<svg[\s>]/.test(text)||/[&]|<!|<\?|url\s*\(/i.test(text))return false;
 const tags=text.match(/<[^>]*>/g)||[];
 return tags.every(tag=>/^<\/?(?:svg|g|path|rect|circle|ellipse|line|polyline|polygon)\b/i.test(tag)&&
  !/\b(?:on\w+|href|style|src)\s*=/i.test(tag)&&
  !/(?:https?:|file:|data:)/i.test(tag.replace(/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/g,'')));
}
class IconResolver{
 constructor(config={},sources=[]){this.dir=config.iconDir||path.join(__dirname,'..','icons');this.sources=sources;}
 resolve(slot={}){
  for(const source of this.sources){try{const result=source(slot);if(typeof result==='string'&&result.length<=MAX_ICON_BYTES&&/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(result))return `<image x="8" y="20" width="128" height="88" href="${result}"/>`;}catch{}}
  const id=slot.iconFileID;if(Number.isInteger(id)&&id>0&&id<=2147483647){
   for(const ext of ['png','jpg','svg']){let fd;try{
    fd=fs.openSync(path.join(this.dir,`${id}.${ext}`),'r');const st=fs.fstatSync(fd);if(!st.isFile()||st.size>MAX_ICON_BYTES)continue;
    const buf=Buffer.alloc(st.size+1),length=fs.readSync(fd,buf,0,buf.length,0);if(length!==st.size)continue;const bytes=buf.subarray(0,length);
    if(ext==='svg'&&!safeSvg(bytes.toString('utf8')))continue;
    if(ext==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
    if(ext==='jpg'&&(bytes[0]!==255||bytes[1]!==216))continue;
    const mime=ext==='jpg'?'jpeg':ext==='svg'?'svg+xml':'png';return `<image x="8" y="20" width="128" height="88" href="data:image/${mime};base64,${bytes.toString('base64')}"/>`;
   }catch{}finally{if(fd!==undefined)fs.closeSync(fd);}}
  }
  return fallback(slot.name);
 }
}
module.exports={IconResolver,fallback,esc,MAX_ICON_BYTES};
