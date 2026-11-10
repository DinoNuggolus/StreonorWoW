'use strict';
const {test}=require('node:test'), a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {ExportReader,normalize}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
const fixture=path.join(__dirname,'fixtures','StreonorDock.lua'),fixture1=path.join(__dirname,'fixtures','StreonorDock.schema1.lua');
const icons=n=>{const o={};for(let i=1;i<=15;i++)o[i]=n[i]||{};return o;};
test('schema-2 fixture: icons, unresolved and empty entries',async()=>{
 const r=new ExportReader({savedVariablesPath:fixture}); await r.poll();const s=r.view();
 a.equal(s.schema,2);a.equal(s.enabled,true);a.equal(s.profileId,'opaque-fixture');a.equal(s.page,2);
 a.equal(s.icons[1],136096);a.equal(s.icons[2],134829);a.equal(s.icons[3],'unresolved');
 for(let i=4;i<=15;i++)a.equal(s.icons[i],undefined);
 a.deepEqual(Object.keys(s).sort(),['enabled','icons','mtimeMs','names','page','profileId','schema']);   // no telemetry survives
 a.equal(s.names[1],'Rejuvenation');a.equal(s.names[3],undefined);a.equal(s.names[2],undefined);a.equal(s.names[4],undefined);
});
test('schema-1 fixture (transitional): icons only, everything else ignored',async()=>{
 const r=new ExportReader({savedVariablesPath:fixture1}); await r.poll();const s=r.view();
 a.equal(s.schema,1);a.equal(s.enabled,true);a.equal(s.icons[1],136096);a.equal(s.icons[2],134829);a.equal(s.icons[3],undefined);
 a.deepEqual(Object.keys(s).sort(),['enabled','icons','mtimeMs','schema']);
});
test('schema-2 validation: envelope errors throw, entry errors blank only that key',()=>{
 const ok={schemaVersion:2,enabled:true,profileId:'p',page:1,icons:icons({1:{iconFileID:5}})};
 a.equal(normalize(ok,1).icons[1],5);
 for(const bad of [null,{},{schemaVersion:3},{...ok,enabled:'yes'},{...ok,profileId:7},{...ok,page:0},{...ok,page:11},{...ok,page:1.5},{...ok,icons:null},{...ok,icons:'x'},{schema:2},{schema:1}])a.throws(()=>normalize(bad,1),String(JSON.stringify(bad)));
 const messy=normalize({...ok,icons:{1:{iconFileID:-4},2:{iconFileID:'9'},3:{iconFileID:1.5},4:{iconFileID:99999999999},5:{unresolved:'true'},6:'junk',7:{iconFileID:7,name:'Moonfire',count:3,endsAt:9},16:{iconFileID:8}}},1);
 for(const i of [1,2,3,4,5,6])a.equal(messy.icons[i],undefined,'slot '+i);a.equal(messy.icons[7],7);a.equal(Object.keys(messy.icons).length,15);
 a.equal(normalize({...ok,enabled:false},1).enabled,false);
 a.equal(normalize({schemaVersion:2,enabled:true,profileId:'',page:10,icons:{1:{iconFileID:3,unresolved:true}}},1).icons[1],3);
});
test('rewrite in progress retry and corrupt file fails soft then recovers',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-reader-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'StreonorDock.lua');
 const good=await fs.readFile(fixture,'utf8');await fs.writeFile(file,'StreonorDockDB={');
 let waits=0;const r=new ExportReader({savedVariablesPath:file},{sleep:async()=>{if(waits++===0)await fs.writeFile(file,good);}});await r.poll();a.ok(r.view());a.equal(waits,1);
 await fs.writeFile(file,'bad !');await r.poll();a.equal(r.view(),null);a.ok(r.error);
 await fs.writeFile(file,good);await r.poll();a.ok(r.view());
 await fs.writeFile(file,good.replace('["schemaVersion"] = 2, ["enabled"]','["schemaVersion"] = 9, ["enabled"]'));await r.poll();a.equal(r.view(),null);a.match(r.error,/Unsupported/);
});
test('auto-detection newest account fixture, unchanged poll, missing and size bounds',async t=>{
 const base=await fs.mkdtemp(path.join(__dirname,'tmp-auto-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));
 for(const account of ['A','B']){const dir=path.join(base,'WTF','Account',account,'SavedVariables');await fs.mkdir(dir,{recursive:true});await fs.copyFile(fixture,path.join(dir,'StreonorDock.lua'));}
 const old=path.join(base,'WTF','Account','A','SavedVariables','StreonorDock.lua');await fs.utimes(old,1,1);
 const r=new ExportReader({gamePath:base});a.equal(await r.poll(),true);a.match(r.file,/B/);a.equal(await r.poll(),false);
 const missing=new ExportReader({savedVariablesPath:path.join(base,'missing')});await missing.poll();a.equal(missing.view(),null);
 await fs.writeFile(old,' '.repeat(5*1024*1024+1));const big=new ExportReader({savedVariablesPath:old},{sleep:async()=>{}});await big.poll();a.match(big.error,/size/i);
});
test('stat/read/stat detects an actual mid-read replacement and retries',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-race-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'snapshot.lua');const good=await fs.readFile(fixture,'utf8');await fs.writeFile(file,good);
 let reads=0,waits=0;const io={...fs,open:async(...args)=>{const h=await fs.open(...args);return {close:()=>h.close(),read:async(...readArgs)=>{const result=await h.read(...readArgs);if(reads++===0)await fs.writeFile(file,good.replace('136096','222222'));return result;}};}};
 const r=new ExportReader({savedVariablesPath:file},{fs:io,sleep:async()=>{waits++;}});await r.poll();a.equal(waits,1);a.equal(r.view().icons[1],222222);
});
