'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {parse,MAX_BYTES}=require('./luatable');
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const UNRESOLVED='unresolved';
const iconId=v=>Number.isInteger(v)&&v>0&&v<=2147483647?v:undefined;
// Only icon ids are ever extracted. Everything else in an entry (names, ids, counts, times) is ignored.
function iconsFrom(table,pick){const icons={};for(let i=1;i<=15;i++)icons[i]=pick(record(table)[i]);return icons;}
// Schema 2: {schemaVersion=2, enabled=bool, profileId=string, page=1..10, icons[1..15]={iconFileID=positiveInteger?}}.
// Transitional schema 1 ({schema=1, slots[i].iconFileID}) yields icons only. Anything else throws (caller blanks the keys).
function normalize(raw,mtimeMs){
 const x=record(raw);
 if(x.schemaVersion===2){
  if(typeof x.enabled!=='boolean'||typeof x.profileId!=='string'||x.profileId.length>200||!Number.isInteger(x.page)||x.page<1||x.page>10||!x.icons||typeof x.icons!=='object'||Array.isArray(x.icons))throw Error('Invalid export envelope');
  return {schema:2,enabled:x.enabled,profileId:x.profileId,page:x.page,icons:iconsFrom(x.icons,e=>{const r=record(e);return iconId(r.iconFileID)||(r.unresolved===true?UNRESOLVED:undefined);}),mtimeMs};
 }
 if(x.schema===1){
  if(!x.slots||typeof x.slots!=='object')throw Error('Invalid export envelope');
  return {schema:1,enabled:true,icons:iconsFrom(x.slots,e=>iconId(record(e).iconFileID)),mtimeMs};
 }
 throw Error('Unsupported export schema (expected 2, or transitional 1)');
}
const {detectGamePath}=require('./gamePath');
class ExportReader {
 constructor(config={},deps={}){this.config=config;this.now=deps.now||Date.now;this.sleep=deps.sleep||(ms=>new Promise(r=>setTimeout(r,ms)));this.io=deps.fs||fs;this.snapshot=null;this.error=null;this.signature=null;this.file=null;}
 async locate(){
  if(this.config.savedVariablesPath)return this.config.savedVariablesPath;
  const base=path.join(this.config.gamePath||detectGamePath(),'WTF','Account');
  const accounts=await this.io.readdir(base,{withFileTypes:true});if(accounts.length>4096)throw Error('Account limit');
  const files=[];for(const entry of accounts){if(!entry.isDirectory())continue;const file=path.join(base,entry.name,'SavedVariables','StreonorDock.lua');try{const st=await this.io.stat(file);if(st.isFile())files.push({file,time:st.mtimeMs});}catch{}}
  files.sort((a,b)=>b.time-a.time);if(!files.length)throw Error('No saved export');return files[0].file;
 }
 async poll(){
  const previous=this.snapshot;try{
   const file=await this.locate();const first=await this.io.stat(file);const sig=`${file}:${first.mtimeMs}:${first.size}`;
   if(sig===this.signature&&this.snapshot)return false;
   for(let attempt=0;attempt<3;attempt++){
    try{
     const before=await this.io.stat(file);if(!before.isFile()||before.size>MAX_BYTES)throw Error('SavedVariables size limit');
     // Read at most MAX_BYTES+1, even if the file grows after stat.
     const handle=await this.io.open(file,'r');let buf;try{buf=Buffer.alloc(Math.min(before.size+1,MAX_BYTES+1));const r=await handle.read(buf,0,buf.length,0);buf=buf.subarray(0,r.bytesRead);}finally{await handle.close();}
     const after=await this.io.stat(file);if(buf.length!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Snapshot rewrite in progress');
     const parsed=parse(buf.toString('utf8'));const result=normalize(record(parsed.StreonorDockDB).export,after.mtimeMs);
     this.snapshot=result;this.file=file;this.signature=`${file}:${after.mtimeMs}:${after.size}`;this.error=null;return true;
    }catch(e){if(attempt===2)throw e;await this.sleep(60);}
   }
  }catch(e){this.snapshot=null;this.signature=null;this.error=String(e.message).slice(0,200);return previous!==null;}
 }
 view(){return this.snapshot?{...this.snapshot}:null;}
}
module.exports={ExportReader,normalize,UNRESOLVED};
