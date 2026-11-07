'use strict';
const {test}=require('node:test'), a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {ExportReader,normalize}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
const fixture=path.join(__dirname,'fixtures','StreonorDock.lua');
test('realistic account file and per-character tables, allowlist, age',async()=>{
 const r=new ExportReader({savedVariablesPath:fixture},{now:()=>1900000000000}); await r.poll();const s=r.view();
 a.equal(s.slots[1].name,'Moonfire');a.equal(s.slots[2].source,'est');a.equal(s.readouts[1].itemID,118);a.equal(s.page.index,2);a.equal(s.stale,true);a.equal(s.slots[2].extra,undefined);
});
test('reject schema and bad envelope; sanitize individual fields',()=>{
 for(const x of [null,{}, {schema:2}, {schema:'1'}, {schema:1,savedAt:0}])a.throws(()=>normalize(x,1000));
 const s=normalize({schema:1,savedAt:100,page:{index:1,count:1},slots:{1:{kind:'spell',endsAt:999,source:'game',name:{}}},readouts:{}},100000);
 a.deepEqual(s.slots[1],{kind:'spell'});a.equal(s.slots[2].kind,'empty');
});
test('rewrite in progress retry and corrupt file fails soft then recovers',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-reader-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'StreonorDock.lua');
 const good=await fs.readFile(fixture,'utf8');await fs.writeFile(file,'StreonorDockDB={');
 let waits=0;const r=new ExportReader({savedVariablesPath:file},{sleep:async()=>{if(waits++===0)await fs.writeFile(file,good);}});await r.poll();a.ok(r.view());a.equal(waits,1);
 await fs.writeFile(file,'bad !');await r.poll();a.equal(r.view(),null);a.ok(r.error);
 await fs.writeFile(file,good);await r.poll();a.ok(r.view());
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
 let reads=0,waits=0;const io={...fs,open:async(...args)=>{const h=await fs.open(...args);return {close:()=>h.close(),read:async(...readArgs)=>{const result=await h.read(...readArgs);if(reads++===0)await fs.writeFile(file,good.replace('Moonfire','Replaced Spell'));return result;}};}};
 const r=new ExportReader({savedVariablesPath:file},{fs:io,sleep:async()=>{waits++;}});await r.poll();a.equal(waits,1);a.equal(r.view().slots[1].name,'Replaced Spell');
});
test('age uses older timestamp, configurable stale threshold and clamps future age',async()=>{
 const stat=await fs.stat(fixture);const r=new ExportReader({savedVariablesPath:fixture,staleAfterSeconds:10},{now:()=>stat.mtimeMs+11000});await r.poll();a.equal(r.view().stale,true);a.ok(r.view().ageSeconds>=11);
 const future=new ExportReader({savedVariablesPath:fixture},{now:()=>0});await future.poll();a.equal(future.view().ageSeconds,0);a.equal(future.view().stale,false);
});
