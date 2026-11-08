'use strict';
// Deletes WoW's own chat/combat log files after the game is done with them (privacy: they hold other
// players' chat). Safety rules, all enforced here and tested:
//  - ONE directory, non-recursive; entries must be regular files (no symlinks/junction following) whose
//    realpath stays directly inside the realpath of that directory;
//  - names must match exactly ^WoW(Chat|Combat)Log.*\.txt$ ; nothing else is ever touched, no directories;
//  - every unlink is in try/catch; EBUSY/EPERM/EACCES = "WoW still holds it": try later, never an error;
//  - never deletes while the game process is running or when that cannot be determined (the check is a
//    process-name count done by the relay; no handle to the game is ever opened).
const fsp=require('node:fs/promises'),path=require('node:path');
const NAME=/^WoW(Chat|Combat)Log.*\.txt$/;
const BUSY=new Set(['EBUSY','EPERM','EACCES']);
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
async function sweep(dir,io=fsp){
 const out={deleted:0,busy:0,skipped:0,errors:0,missing:false};
 if(typeof dir!=='string'||!path.isAbsolute(dir)){out.errors++;return out;}
 let real;try{real=await io.realpath(dir);}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR'){out.missing=true;return out;}out.errors++;return out;}
 let entries;try{entries=await io.readdir(real,{withFileTypes:true});}catch{out.errors++;return out;}
 for(const entry of entries){
  if(!NAME.test(entry.name))continue;   // other names: not counted, never touched
  const full=path.join(real,entry.name);
  try{
   const st=await io.lstat(full);
   if(!st.isFile()||st.isSymbolicLink()){out.skipped++;continue;}
   const target=await io.realpath(full);
   if(!same(path.dirname(target),real)||!same(path.basename(target),entry.name)){out.skipped++;continue;}
  }catch{out.skipped++;continue;}
  try{await io.unlink(full);out.deleted++;}
  catch(e){if(e.code==='ENOENT')continue;if(BUSY.has(e.code))out.busy++;else out.errors++;}
 }
 return out;
}
class LogCleanup {
 // opts: {dir,enabled,isRunning:async()=>true|false|null,log,retryMs,io}
 constructor(opts={}){this.dir=opts.dir;this.enabled=opts.enabled!==false;this.isRunning=opts.isRunning||(async()=>null);this.log=opts.log||(()=>{});this.retryMs=opts.retryMs||30000;this.io=opts.io||fsp;this.pending=false;this.timer=null;this.working=false;this.stopped=false;}
 request(reason){if(!this.enabled||this.stopped)return Promise.resolve();this.pending=true;return this.attempt(reason);}
 arm(){if(this.timer||this.stopped)return;this.timer=setTimeout(()=>{this.timer=null;if(this.pending)this.attempt('retry');},this.retryMs);this.timer.unref?.();}
 disarm(){if(this.timer){clearTimeout(this.timer);this.timer=null;}}
 async attempt(reason){
  if(this.working||!this.enabled||this.stopped)return;this.working=true;
  try{
   let running=null;try{running=await this.isRunning();}catch{}
   if(running!==false){this.log('logCleanup',{reason,result:running===true?'game-running':'process-check-unavailable'});this.arm();return;}
   const r=await sweep(this.dir,this.io);
   this.log('logCleanup',{reason,deleted:r.deleted,busy:r.busy,skipped:r.skipped,errors:r.errors,missing:r.missing});
   if(r.busy>0)this.arm();else{this.pending=false;this.disarm();}
  }catch(e){this.log('logCleanupError',{reason,message:String(e.message).slice(0,200)});this.arm();}
  finally{this.working=false;}
 }
 stop(){this.stopped=true;this.disarm();}
}
module.exports={LogCleanup,sweep,NAME};
