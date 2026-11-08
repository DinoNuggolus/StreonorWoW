'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path');
const {MockHost}=require('./mockhost');
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const img=m=>decodeURIComponent(m.payload.image);
const PNG=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(200,65)]);
async function launch(t,{lua='StreonorDock.lua',cfg={},env={},icons=[136096,134829]}={}){
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-host-')),file=path.join(dir,'StreonorDock.lua'),cfgFile=path.join(dir,'config.json');
 const fixture=await fs.readFile(path.join(__dirname,'fixtures',lua),'utf8');await fs.writeFile(file,fixture);
 for(const id of icons)await fs.writeFile(path.join(dir,id+'.png'),PNG);
 await fs.writeFile(cfgFile,JSON.stringify({savedVariablesPath:file,iconDir:dir,pollIntervalMs:250,...cfg}));
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','T','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfgFile,STREONORDOCK_DRY_RUN:'1',...env},windowsHide:true,stdio:['pipe','pipe','pipe']});
 const h={dir,file,fixture,host,child,out:'',err:''};child.stdout.on('data',d=>h.out+=d);child.stderr.on('data',d=>h.err+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin'&&m.uuid==='T');
 h.chords=()=>(h.out.match(/"bridge":"chord"/g)||[]).length;h.accepted=()=>(h.out.match(/"bridge":"accepted"/g)||[]).length;
 h.key=(n,e)=>host.send({event:e,action:`io.github.dinonuggolus.streonordock.key${n}`,context:`K${n}`,payload:{}});
 return h;
}
const appear=(h,n)=>h.host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.key${n}`,context:`K${n}`,payload:{}});

test('schema 2: 15 keys render icon / question glyph / blank; obsolete actions are inert; rewrite and garbage handled',{timeout:30000},async t=>{
 const h=await launch(t),{host}=h;
 for(let i=1;i<=15;i++)appear(h,i);
 for(const old of ['readout1','readout2','readout3','status'])host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.${old}`,context:'OLD_'+old,payload:{}});
 for(let i=1;i<=15;i++){const m=await host.wait(m=>m.event==='setImage'&&m.context===`K${i}`);a.equal(m.payload.target,0);a.match(img(m),/<svg/);}
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&/<image x="0" y="0" width="144" height="144"/.test(img(m)));
 const k3=await host.wait(m=>m.event==='setImage'&&m.context==='K3');a.ok(!/<text|<image/.test(img(k3)));a.match(img(k3),/<path /);
 const k5=await host.wait(m=>m.event==='setImage'&&m.context==='K5');a.match(img(k5),/fill="#000"/);a.ok(!/<text|<image|<path/.test(img(k5)));
 for(const m of host.messages.filter(m=>m.event==='setImage'))a.ok(!/<text/.test(img(m)),'no text on any tile');
 a.ok(!host.messages.some(m=>m.event==='setImage'&&String(m.context).startsWith('OLD_')),'obsolete actions never get an image');
 for(const old of ['readout1','status']){host.send({event:'keyDown',action:`io.github.dinonuggolus.streonordock.${old}`,context:'OLD_'+old,payload:{}});host.send({event:'keyUp',context:'OLD_'+old,payload:{}});host.send({event:'willDisappear',context:'OLD_'+old,payload:{}});}
 await sleep(500);a.equal(h.chords(),0);
 await fs.writeFile(h.file,h.fixture.replace('{ ["iconFileID"] = 136096 }','{}'));   // /reload: slot 1 emptied
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&!/<image|<path/.test(img(m)));
 await fs.writeFile(h.file,'broken fixture');
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&!/<image|<path/.test(img(m)));
 await host.wait(m=>m.event==='setImage'&&m.context==='K3'&&!/<image|<path/.test(img(m)));
 host.send({event:'didReceiveSettings',context:'K1',payload:{settings:{slot:99}}});
 for(let i=1;i<=15;i++)host.send({event:'willDisappear',context:`K${i}`,payload:{}});
 await sleep(400);const count=host.messages.length;await sleep(900);a.equal(host.messages.length,count,'idle with no contexts');a.equal(h.err,'');
});

test('schema-1 file (transitional) still shows its icons',{timeout:30000},async t=>{
 const h=await launch(t,{lua:'StreonorDock.schema1.lua'});appear(h,1);appear(h,3);
 await h.host.wait(m=>m.event==='setImage'&&m.context==='K1'&&/<image /.test(img(m)));
 const k3=await h.host.wait(m=>m.event==='setImage'&&m.context==='K3');a.match(img(k3),/fill="#000"/);
});

test('enabled=false blanks keys but chords still fire',{timeout:30000},async t=>{
 const h=await launch(t),{host}=h;await fs.writeFile(h.file,h.fixture.replace('["enabled"] = true','["enabled"] = false'));
 appear(h,1);await host.wait(m=>m.event==='setImage'&&m.context==='K1');
 await sleep(800);const last=host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').pop();a.ok(!/<image|<path|<text/.test(img(last)));
 h.key(1,'keyDown');h.key(1,'keyUp');for(let i=0;i<100&&h.chords()<2;i++)await sleep(30);a.equal(h.chords(),2);a.equal(h.accepted(),1);
});

test('no export file yet: blank keys, filled once it appears; heartbeat re-sends; abrupt host drop is a clean disconnect',{timeout:40000},async t=>{
 const h=await launch(t,{env:{STREONORDOCK_REDRAW_MS:'300'}}),{host}=h;await fs.rm(h.file);
 appear(h,1);const first=await host.wait(m=>m.event==='setImage'&&m.context==='K1');a.match(img(first),/fill="#000"/);a.ok(!/<text|<path/.test(img(first)));
 await fs.writeFile(h.file,h.fixture);
 await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&/<image /.test(img(m)));
 const before=host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length;
 for(let i=0;i<100&&host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length<=before;i++)await sleep(50);
 a.ok(host.messages.filter(m=>m.event==='setImage'&&m.context==='K1').length>before,'heartbeat redraw');
 const exited=new Promise(r=>h.child.once('exit',r));for(const s of host.sockets)s.destroy();
 await Promise.race([exited,sleep(8000)]);
 a.match(h.out,/"bridge":"disconnected"/);a.ok(!h.out.includes('"bridge":"fatal"'));a.equal(h.child.exitCode,0);
});

test('a press never changes what the key shows and triggers no feedback overlay',{timeout:30000},async t=>{
 const h=await launch(t),{host}=h;appear(h,2);await host.wait(m=>m.event==='setImage'&&m.context==='K2');await sleep(500);
 const n=host.messages.filter(m=>m.context==='K2').length;
 for(let i=0;i<3;i++){h.key(2,'keyDown');h.key(2,'keyUp');await sleep(700);}
 a.equal(h.accepted(),3);a.equal(host.messages.filter(m=>m.context==='K2').length,n,'no redraw/showAlert/showOk after presses');
 a.ok(!host.messages.some(m=>['showAlert','showOk','setTitle','setState'].includes(m.event)));
});

for(const fireOn of ['press','release'])test(`fireOn=${fireOn}: one physical press = one short tap; held/repeated downs never repeat`, {timeout:30000},async t=>{
 const h=await launch(t,{cfg:{fireOn}});appear(h,4);await sleep(800);
 h.key(4,'keyDown');for(let i=0;i<5;i++)h.key(4,'keyDown');
 await sleep(900);
 if(fireOn==='press'){a.equal(h.accepted(),1);a.equal(h.chords(),2,'tap fired on press, once, already released');}else{a.equal(h.accepted(),0);a.equal(h.chords(),0,'nothing before release');}
 await sleep(500);a.equal(h.chords(),fireOn==='press'?2:0,'holding longer sends nothing more');
 h.key(4,'keyUp');await sleep(900);
 a.equal(h.accepted(),1);a.equal(h.chords(),2,'exactly one tap per physical press');
 h.key(4,'keyUp');await sleep(300);a.equal(h.chords(),2,'a stray duplicate keyUp does nothing');
 h.key(4,'keyDown');h.key(4,'keyUp');await sleep(900);a.equal(h.accepted(),2);a.equal(h.chords(),4);
 a.equal(h.out.split(/\r?\n/).filter(x=>x.includes('"bridge":"released"')&&x.includes('"tap"')).length,2,'each tap released by the sender after its short interval');
});
