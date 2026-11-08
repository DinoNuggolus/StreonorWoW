'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const {LogCleanup,sweep,NAME}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/logCleanup');
const {MockHost}=require('./mockhost');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
async function tmp(t){const d=await fs.mkdtemp(path.join(__dirname,'tmp-logs-'));t.after(()=>fs.rm(d,{recursive:true,force:true}));return d;}
const exists=async f=>fs.stat(f).then(()=>true,()=>false);
test('name pattern is exact',()=>{
 for(const ok of ['WoWChatLog.txt','WoWCombatLog.txt','WoWChatLog-110826_2100.txt','WoWCombatLog 110826.txt'])a.ok(NAME.test(ok),ok);
 for(const bad of ['WoWChatLog.log','wowchatlog.txt','WoWChatLog.txt.bak','MyWoWChatLog.txt','WoWErrorLog.txt','Client.txt','WoWChatLog','x/WoWChatLog.txt'])a.ok(!NAME.test(bad),bad);
});
test('deletes only matching files; ignores other names and folders (incl. matching-named folder)',async t=>{
 const d=await tmp(t);
 for(const f of ['WoWChatLog.txt','WoWCombatLog-1.txt','keep.txt','WoWChatLog.log','Errors.txt'])await fs.writeFile(path.join(d,f),'x');
 await fs.mkdir(path.join(d,'sub'));await fs.writeFile(path.join(d,'sub','WoWChatLog.txt'),'x');
 await fs.mkdir(path.join(d,'WoWChatLog-dir.txt'));await fs.writeFile(path.join(d,'WoWChatLog-dir.txt','inner.txt'),'x');
 const r=await sweep(d);a.equal(r.deleted,2);a.equal(r.errors,0);
 for(const f of ['keep.txt','WoWChatLog.log','Errors.txt','sub/WoWChatLog.txt','WoWChatLog-dir.txt/inner.txt'])a.ok(await exists(path.join(d,f)),f);
 a.ok(!await exists(path.join(d,'WoWChatLog.txt')));a.ok(!await exists(path.join(d,'WoWCombatLog-1.txt')));
});
test('symlinks and links outside the directory are never followed or deleted; relative/missing dirs rejected',async t=>{
 const d=await tmp(t),outside=await tmp(t);await fs.writeFile(path.join(outside,'secret.txt'),'x');
 let linked=true;try{await fs.symlink(path.join(outside,'secret.txt'),path.join(d,'WoWChatLog.txt'),'file');}catch{linked=false;}
 const r=await sweep(d);a.ok(await exists(path.join(outside,'secret.txt')));if(linked)a.equal(r.deleted,0);
 // a fake io whose realpath escapes the directory: skipped, not deleted
 await fs.writeFile(path.join(d,'WoWCombatLog.txt'),'x');
 const escaping={...fs,realpath:async p=>p.endsWith('WoWCombatLog.txt')?path.join(outside,'WoWCombatLog.txt'):fs.realpath(p)};
 const r2=await sweep(d,escaping);a.equal(r2.deleted,0);a.ok(r2.skipped>=1);a.ok(await exists(path.join(d,'WoWCombatLog.txt')));
 a.equal((await sweep('relative/dir')).errors,1);a.equal((await sweep(path.join(d,'nope'))).missing,true);
});
test('locked file is "try later", never an error; other files still deleted',async t=>{
 const d=await tmp(t);await fs.writeFile(path.join(d,'WoWChatLog.txt'),'x');await fs.writeFile(path.join(d,'WoWCombatLog.txt'),'x');
 for(const code of ['EBUSY','EPERM','EACCES']){
  const io={...fs,unlink:async p=>{if(p.endsWith('WoWChatLog.txt')){const e=new Error('locked');e.code=code;throw e;}return fs.unlink(p);}};
  const r=await sweep(d,io);a.equal(r.busy,1);a.equal(r.errors,0);a.ok(await exists(path.join(d,'WoWChatLog.txt')));
  await fs.writeFile(path.join(d,'WoWCombatLog.txt'),'x');
 }
});
test('controller: skips while the game runs or is unknown, retries on one timer, cancels when done, off respected',async t=>{
 const d=await tmp(t);await fs.writeFile(path.join(d,'WoWChatLog.txt'),'x');const logs=[];let state=true;
 const c=new LogCleanup({dir:d,isRunning:async()=>state,log:(e,x)=>logs.push([e,x]),retryMs:40});t.after(()=>c.stop());
 await c.request('export-saved');a.ok(await exists(path.join(d,'WoWChatLog.txt')));a.equal(logs.at(-1)[1].result,'game-running');a.ok(c.timer);
 state=null;await sleep(100);a.ok(await exists(path.join(d,'WoWChatLog.txt')));a.equal(logs.at(-1)[1].result,'process-check-unavailable');
 state=false;await sleep(100);a.ok(!await exists(path.join(d,'WoWChatLog.txt')));a.equal(logs.at(-1)[1].deleted,1);a.equal(c.pending,false);a.equal(c.timer,null);
 const n=logs.length;await sleep(120);a.equal(logs.length,n,'idle: no further attempts');
 const off=new LogCleanup({dir:d,enabled:false,isRunning:async()=>false});await fs.writeFile(path.join(d,'WoWChatLog.txt'),'x');await off.request('start');a.ok(await exists(path.join(d,'WoWChatLog.txt')));
 // busy file keeps the retry timer armed, without a tight loop
 const busy=new LogCleanup({dir:d,isRunning:async()=>false,retryMs:5000,io:{...fs,unlink:async()=>{const e=new Error('b');e.code='EBUSY';throw e;}}});t.after(()=>busy.stop());
 await busy.request('start');a.equal(busy.pending,true);a.ok(busy.timer);
});
test('plugin: deletes logs at start only when the game is not running; config off respected', {timeout:30000},async t=>{
 const run=async(procs,extra)=>{
  const d=await tmp(t);await fs.writeFile(path.join(d,'WoWChatLog.txt'),'x');await fs.writeFile(path.join(d,'other.txt'),'x');
  const cfg=path.join(d,'config.json');await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:path.join(d,'none.lua'),logDir:d,...extra}));
  const host=new MockHost(),port=await host.listen();
  const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','LOGS','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1',STREONORDOCK_DRY_PROCS:String(procs)},windowsHide:true,stdio:['pipe','pipe','pipe']});
  await host.wait(m=>m.event==='registerPlugin');await sleep(1500);
  child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();
  return {logExists:await exists(path.join(d,'WoWChatLog.txt')),otherExists:await exists(path.join(d,'other.txt'))};
 };
 let r=await run(0,{});a.equal(r.logExists,false);a.equal(r.otherExists,true);
 r=await run(1,{});a.equal(r.logExists,true);
 r=await run(0,{deleteLogsOnLogout:false});a.equal(r.logExists,true);
});
