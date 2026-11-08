'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path');
const {MockHost}=require('./mockhost');
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('real PowerShell relay: register, all contexts, press/release, rewrite, no data and lifecycle', {timeout:30000},async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-host-'));const file=path.join(dir,'StreonorDock.lua'),cfg=path.join(dir,'config.json');
 const fixture=await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8');await fs.writeFile(file,fixture);
 const icon=Buffer.alloc(400*1024,65);Buffer.from([137,80,78,71,13,10,26,10]).copy(icon);await fs.writeFile(path.join(dir,'136096.png'),icon);await fs.writeFile(path.join(dir,'134829.png'),icon);
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,iconDir:dir,consumableItemIds:[118]}));
 const host=new MockHost(),port=await host.listen();const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','TESTUUID','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let diagnostics='',stderr='';child.stdout.on('data',d=>diagnostics+=d);child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin'&&m.uuid==='TESTUUID');
 for(let i=1;i<=15;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.key${i}`,context:`K${i}`,payload:{}},i===1);
 for(let i=1;i<=3;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.readout${i}`,context:`R${i}`,payload:{}});
 host.send({event:'willAppear',action:'io.github.dinonuggolus.streonordock.status',context:'S',payload:{}});
 for(const c of [...Array.from({length:15},(_,i)=>`K${i+1}`),'R1','R2','R3','S']){const m=await host.wait(m=>m.event==='setImage'&&m.context===c);a.equal(m.payload.target,0);a.match(decodeURIComponent(m.payload.image),/<svg/);}
 await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes('Minor Healing Potion'));
 const key=event=>host.send({event,action:'io.github.dinonuggolus.streonordock.key2',context:'K2',payload:{}});key('keyDown');key('keyDown');key('keyUp');
 for(let i=0;i<100&&!diagnostics.includes('"down":false');i++)await sleep(30);const chords=diagnostics.split(/\r?\n/).filter(x=>x.includes('"bridge":"chord"')).map(JSON.parse);a.equal(chords.length,2,diagnostics+stderr);a.equal(chords[0].slot,2);
 await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes('>~3</text>'));
 await host.wait(m=>m.event==='setImage'&&m.context==='R1'&&decodeURIComponent(m.payload.image).includes('>~3</text>'));
 await host.wait(m=>m.event==='setImage'&&m.context==='S'&&decodeURIComponent(m.payload.image).includes('counts est since snapshot'));
 // Holding another slot makes slot 2 an overlap refusal: no second decrement.
 host.send({event:'keyDown',context:'K1',payload:{}});key('keyDown');key('keyDown');
 await host.wait(m=>m.event==='showAlert'&&m.context==='K2');
 host.send({event:'keyUp',context:'K1',payload:{}});key('keyUp');
 a.equal((diagnostics.match(/"bridge":"accepted"/g)||[]).length,2,diagnostics);
 a.ok(!host.messages.some(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes('>~2</text>')));
 await fs.writeFile(file,fixture.replace('Moonfire','Changed Spell'));
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('Changed Spell'));
 await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes('>4</text>'));
 await fs.writeFile(file,'broken fixture');await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('NO DATA'));
 key('keyDown');key('keyUp');for(let i=0;i<100&&(diagnostics.match(/"bridge":"chord"/g)||[]).length<6;i++)await sleep(30);a.equal((diagnostics.match(/"bridge":"chord"/g)||[]).length,6);
 host.send({event:'didReceiveSettings',context:'K1',payload:{settings:{slot:99}}});
 for(const c of [...Array.from({length:15},(_,i)=>`K${i+1}`),'R1','R2','R3','S'])host.send({event:'willDisappear',context:c,payload:{}});
 await sleep(300);const count=host.messages.length;await sleep(1100);a.equal(host.messages.length,count);a.equal(stderr,'');
});

test('ledger exceptions never block chords or snapshot fallback', {timeout:20000},async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-ledger-fault-'));
 const file=path.join(dir,'snapshot.lua'),cfg=path.join(dir,'config.json'),preload=path.join(dir,'fault.cjs');
 await fs.copyFile(path.join(__dirname,'fixtures/StreonorDock.lua'),file);
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,consumableItemIds:[118]}));
 const ledger=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/countLedger.js');
 await fs.writeFile(preload,`const {CountLedger}=require(${JSON.stringify(ledger)});for(const m of ['load','capture','accept','view'])CountLedger.prototype[m]=()=>{throw Error('injected ledger failure')};`);
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,['--require',preload,plugin,'-port',String(port),'-pluginUUID','FAULT','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let diagnostics='',stderr='';child.stdout.on('data',d=>diagnostics+=d);child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin');
 host.send({event:'willAppear',action:'io.github.dinonuggolus.streonordock.key2',context:'K2',payload:{}});
 await host.wait(m=>m.event==='setImage'&&decodeURIComponent(m.payload.image).includes('Minor Healing Potion'));
 host.send({event:'keyDown',context:'K2',payload:{}});host.send({event:'keyUp',context:'K2',payload:{}});
 for(let i=0;i<100&&!diagnostics.includes('"down":false');i++)await sleep(30);
 a.equal((diagnostics.match(/"bridge":"chord"/g)||[]).length,2,diagnostics+stderr);a.match(diagnostics,/"bridge":"accepted"/);a.equal(stderr,'');
});
