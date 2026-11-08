'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_ICON_BYTES=512*1024;
// Embedded icons must stay small: the whole tile is one data-URI setImage message and hosts have been
// seen to blank tiles (text included) when it is large. Build scripts make 144 px palette PNGs (~11 KB,
// hard cap 20 KB) and a 72 px fallback set (< 12 KB). Over-cap files are skipped and the next dir is tried.
const MAX_EMBED_BYTES=20*1024;
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
 constructor(config={},sources=[],onSkip=()=>{}){this.dir=config.iconDir||path.join(__dirname,'..','icons');this.dirs=[this.dir,...(Array.isArray(config.iconFallbackDirs)?config.iconFallbackDirs.filter(d=>typeof d==='string'&&d):[])];this.sources=sources;this.enabled=config.embedIcons!==false;this.onSkip=onSkip;}
 skip(slot,reason,bytes){try{this.onSkip({id:slot.iconFileID,reason,bytes});}catch{}}
 // Data URI of the first usable icon: sources, then each dir in order (144 px set, 72 px set, old cache). null = none.
 uri(slot={}){
  if(!this.enabled)return null;
  for(const source of this.sources){try{const result=source(slot);if(typeof result==='string'&&result.length<=MAX_EMBED_BYTES*2&&/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(result))return result;}catch{}}
  const id=slot.iconFileID;if(Number.isInteger(id)&&id>0&&id<=2147483647){
   for(const dir of this.dirs)for(const ext of ['png','jpg','svg']){let fd;try{
    fd=fs.openSync(path.join(dir,`${id}.${ext}`),'r');const st=fs.fstatSync(fd);if(!st.isFile())continue;if(st.size>MAX_EMBED_BYTES){this.skip(slot,'icon file too large',st.size);continue;}
    const buf=Buffer.alloc(st.size+1),length=fs.readSync(fd,buf,0,buf.length,0);if(length!==st.size)continue;const bytes=buf.subarray(0,length);
    if(ext==='svg'&&!safeSvg(bytes.toString('utf8')))continue;
    if(ext==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
    if(ext==='jpg'&&(bytes[0]!==255||bytes[1]!==216))continue;
    const mime=ext==='jpg'?'jpeg':ext==='svg'?'svg+xml':'png';return `data:image/${mime};base64,${bytes.toString('base64')}`;
   }catch{}finally{if(fd!==undefined)fs.closeSync(fd);}}
  }
  return null;
 }
}
module.exports={IconResolver,MAX_ICON_BYTES,MAX_EMBED_BYTES};
