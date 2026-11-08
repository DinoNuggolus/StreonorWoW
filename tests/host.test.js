'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path');
const {MockHost}=require('./mockhost');
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('real PowerShell relay: register, all contexts, press/release, rewrite, no data and lifecycle', {timeout:30000},async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-host-'));const file=path.join(dir,'StreonorDock.lua'),cfg=path.join(dir,'config.json');
 const fixture=await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8');await fs.writeFile(file,fixture);
 const icon=Buffer.alloc(400*1024,65);Buffer.from([137,80,78,71,13,10,26,10]).copy(icon);await fs.writeFile(path.join(dir,'136096.png'),icon);await fs.writeFile(path.join(dir,'134829.png'),icon);
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,iconDir:dir}));
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
 // Holding another slot makes slot 2 an overlap refusal: no second decrement.
 host.send({event:'keyDown',context:'K1',payload:{}});key('keyDown');key('keyDown');
 await host.wait(m=>m.event==='showAlert'&&m.context==='K2');
 host.send({event:'keyUp',context:'K1',payload:{}});key('keyUp');
 a.equal((diagnostics.match(/"bridge":"accepted"/g)||[]).length,2,diagnostics);
 await fs.writeFile(file,fixture.replace('Moonfire','Changed Spell'));
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('Changed Spell'));
 await fs.writeFile(file,'broken fixture');await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('#2b3844'));
 key('keyDown');key('keyUp');for(let i=0;i<100&&(diagnostics.match(/"bridge":"chord"/g)||[]).length<6;i++)await sleep(30);a.equal((diagnostics.match(/"bridge":"chord"/g)||[]).length,6);
 host.send({event:'didReceiveSettings',context:'K1',payload:{settings:{slot:99}}});
 for(const c of [...Array.from({length:15},(_,i)=>`K${i+1}`),'R1','R2','R3','S'])host.send({event:'willDisappear',context:c,payload:{}});
 await sleep(300);const count=host.messages.length;await sleep(1100);a.equal(host.messages.length,count);a.equal(stderr,'');
});

test('startup: no file yet -> keys fill when it appears; heartbeat re-sends dropped images; abrupt host drop is a clean disconnect', {timeout:40000},async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-startup-'));const file=path.join(dir,'StreonorDock.lua'),cfg=path.join(dir,'config.json'),logs=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/logs/streonordock.jsonl');
 const fixture=await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8');
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file}));
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','START','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1',STREONORDOCK_REDRAW_MS:'300'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let diagnostics='',stderr='';child.stdout.on('data',d=>diagnostics+=d);child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin');
 host.send({event:'willAppear',action:'io.github.dinonuggolus.streonordock.key1',context:'K1',payload:{}});
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('#2b3844'));
 await fs.writeFile(file,fixture);   // WoW writes the file later (first /reload)
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('Moonfire'));
 // Heartbeat: identical image is re-sent even though nothing changed.
 const before=host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length;
 for(let i=0;i<100&&host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length<=before;i++)await sleep(50);
 a.ok(host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length>before,'heartbeat redraw');
 // Host vanishes without a close handshake: relay reports disconnected, not fatal, and the plugin exits.
 const exited=new Promise(r=>child.once('exit',r));
 for(const s of host.sockets)s.destroy();
 await Promise.race([exited,sleep(8000)]);
 a.match(diagnostics,/"bridge":"disconnected"/,diagnostics);a.ok(!diagnostics.includes('"bridge":"fatal"'),diagnostics);a.equal(child.exitCode,0);
});
