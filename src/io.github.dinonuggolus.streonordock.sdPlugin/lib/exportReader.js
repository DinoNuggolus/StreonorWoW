'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {parse,MAX_BYTES}=require('./luatable');
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const num=(v,max=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.min(v,max):undefined;
const integer=(v,max=1e12)=>Number.isInteger(v)?num(v,max):undefined;
function cleanSlot(raw,readout=false){
 const x=record(raw);if(x.kind!=='item'&&(readout||x.kind!=='spell'))return {kind:'empty'};
 const out={kind:x.kind};for(const k of [readout?'itemID':'id','iconFileID']){const v=integer(x[k],2147483647);if(v>0)out[k]=v;}
 if(typeof x.name==='string')out.name=x.name.slice(0,100).replace(/[\x00-\x1f\x7f]/g,'');
 if(x.kind==='item'){
  const count=integer(x.count,999999);if(count!==undefined)out.count=count;
  if(['game','est','used'].includes(x.source)){out.source=x.source;const end=num(x.endsAt,1e11);if(x.source!=='used'&&end!==undefined)out.endsAt=end;}
 }
 return out;
}
function normalize(raw,mtimeMs){
 const x=record(raw),page=record(x.page);
 if(x.schema!==1)throw Error('Unsupported export schema (expected 1)');
 if(!Number.isInteger(x.savedAt)||x.savedAt<=0||x.savedAt>1e11||!Number.isInteger(page.index)||!Number.isInteger(page.count)||page.index<1||page.index>page.count||page.count>10||!x.slots||!x.readouts)throw Error('Invalid export envelope');
 const slots={},readouts={};for(let i=1;i<=15;i++)slots[i]=cleanSlot(record(x.slots)[i]);for(let i=1;i<=3;i++)readouts[i]=cleanSlot(record(x.readouts)[i],true);
 return {slots,readouts,page:{index:page.index,count:page.count},savedAt:x.savedAt,mtimeMs};
}
class ExportReader {
 constructor(config={},deps={}){this.config=config;this.now=deps.now||Date.now;this.sleep=deps.sleep||(ms=>new Promise(r=>setTimeout(r,ms)));this.io=deps.fs||fs;this.snapshot=null;this.error=null;this.signature=null;this.file=null;}
 async locate(){
  if(this.config.savedVariablesPath)return this.config.savedVariablesPath;
  const base=path.join(this.config.gamePath||'G:\\World of Warcraft\\_forever_','WTF','Account');
  const accounts=await this.io.readdir(base,{withFileTypes:true});if(accounts.length>4096)throw Error('Account limit');
  const files=[];for(const entry of accounts){if(!entry.isDirectory())continue;const file=path.join(base,entry.name,'SavedVariables','StreonorDock.lua');try{const st=await this.io.stat(file);if(st.isFile())files.push({file,time:st.mtimeMs});}catch{}}
  files.sort((a,b)=>b.time-a.time);if(!files.length)throw Error('No saved snapshot');return files[0].file;
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
 view(){if(!this.snapshot)return null;const s=this.snapshot,now=this.now();const ageSeconds=Math.max(0,(now-s.mtimeMs)/1000,now/1000-s.savedAt);const limit=num(this.config.staleAfterSeconds,86400*365)??600;return {...s,ageSeconds,stale:ageSeconds>limit};}
}
module.exports={ExportReader,normalize,cleanSlot};
