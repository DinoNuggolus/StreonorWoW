'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {MockHost}=require('./mockhost');
const {decode,resize,encode,shrink}=require('../scripts/png');
const {IconResolver,MAX_EMBED_BYTES}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/icons');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Generated test art only (no Blizzard files): smooth gradient or incompressible noise.
function img(size,kind,alpha=false){const data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const o=(y*size+x)*4;
 if(kind==='noise'){const r=crypto.randomBytes(3);data[o]=r[0];data[o+1]=r[1];data[o+2]=r[2];}else{data[o]=x*255/size;data[o+1]=y*255/size;data[o+2]=128;}
 data[o+3]=alpha&&x<size/2?0:255;}return {width:size,height:size,data};}

test('png: encode/decode roundtrip, box resize and size reduction',()=>{
 const src=img(256,'gradient'),big=encode(src),small=shrink(big,72);
 const d=decode(small);a.equal(d.width,72);a.equal(d.height,72);const noisy=encode(img(256,'noise'));a.ok(noisy.length>150000);a.ok(shrink(noisy,72).length<MAX_EMBED_BYTES*2);a.ok(small.length<MAX_EMBED_BYTES);
 const back=decode(big);a.deepEqual(Array.from(back.data.subarray(0,8)),Array.from(src.data.subarray(0,8)));
 const flat={width:4,height:4,data:new Uint8Array(64).fill(200)};a.deepEqual(Array.from(resize(flat,2).data.subarray(0,4)),[200,200,200,200]);
 const al=decode(encode(img(16,'gradient',true)));a.equal(al.data[3],0);a.equal(al.data[(8)*4+3],255);
 a.throws(()=>decode(Buffer.from('nope')));
});

test('resolver: oversized icon is skipped with a callback, kill switch and xlink:href markup',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-embed-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'1.png'),encode(img(72,'gradient')));await fs.writeFile(path.join(dir,'2.png'),encode(img(72,'noise')));
 a.ok((await fs.stat(path.join(dir,'2.png'))).size>MAX_EMBED_BYTES);
 const skips=[],r=new IconResolver({iconDir:dir},[],e=>skips.push(e));
 const ok=r.resolve({iconFileID:1,name:'A'});a.match(ok,/xlink:href="data:image\/png;base64,/);a.ok(ok.length<14000,'tile body small');
 a.match(r.resolve({iconFileID:2,name:'Bee'}),/<rect/);a.equal(skips.length,1);a.equal(skips[0].id,2);a.match(skips[0].reason,/too large/);
 a.match(new IconResolver({iconDir:dir,embedIcons:false}).resolve({iconFileID:1,name:'A'}),/<rect/);
 const svg=render.slot({slots:{1:{kind:'spell',name:'Moonfire',iconFileID:1}},page:{index:1,count:1}},1,0,r);
 a.match(svg,/xmlns:xlink=/);a.match(svg,/>Moonfire</);a.ok(svg.length<14000);a.ok(encodeURIComponent(svg).length<20000);
});

test('plugin vs size-limited host: every setImage stays under the limit, oversized icon falls back to text tile and is logged',{timeout:30000},async t=>{
 const logFile=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/logs/streonordock.jsonl'),logStart=await fs.stat(logFile).then(x=>x.size,()=>0);
 const LIMIT=20000,dir=await fs.mkdtemp(path.join(__dirname,'tmp-payload-'));
 const file=path.join(dir,'StreonorDock.lua'),cfg=path.join(dir,'config.json');
 await fs.writeFile(file,await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8'));
 await fs.writeFile(path.join(dir,'136096.png'),encode(img(72,'gradient')));   // Moonfire: small, embedded
 await fs.writeFile(path.join(dir,'134829.png'),encode(img(72,'noise')));      // potion: too big, text-only
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,iconDir:dir}));
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','PAY','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let diagnostics='',stderr='';child.stdout.on('data',d=>diagnostics+=d);child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin');
 for(let i=1;i<=15;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.key${i}`,context:`K${i}`,payload:{}});
 for(let i=1;i<=3;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.readout${i}`,context:`R${i}`,payload:{}});
 const k1=await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes('Moonfire'));
 const k2=await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes('Minor Healing Potion'));
 await host.wait(m=>m.event==='setImage'&&m.context==='R1'&&decodeURIComponent(m.payload.image).includes('Minor Healing'));
 const s1=decodeURIComponent(k1.payload.image),s2=decodeURIComponent(k2.payload.image);
 a.match(s1,/<image [^>]*xlink:href="data:image\/png;base64,/);a.match(s1,/>Moonfire</);   // label drawn on top of the icon
 a.ok(!s2.includes('<image'));a.match(s2,/<rect/);a.match(s2,/>Minor Healing Potion</);
 const rejected=host.messages.filter(m=>m.event==='setImage'&&m.payload.image.length>LIMIT);
 a.equal(rejected.length,0,'host would drop tiles over '+LIMIT+' chars: '+rejected.map(m=>m.context+':'+m.payload.image.length));
 a.ok(k1.payload.image.length<LIMIT);
 const logged=async()=>(await fs.readFile(logFile,'utf8').catch(()=>'')).slice(logStart);
 for(let i=0;i<60&&!(await logged()).includes('iconSkipped');i++)await sleep(50);
 a.match(await logged(),/"event":"iconSkipped".*too large/);a.equal(stderr,'');
});
