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
 await fs.writeFile(path.join(dir,'1.png'),encode(img(72,'gradient')));await fs.writeFile(path.join(dir,'2.png'),encode(img(96,'noise')));
 a.equal(MAX_EMBED_BYTES,20*1024);a.ok((await fs.stat(path.join(dir,'2.png'))).size>MAX_EMBED_BYTES);
 const skips=[],r=new IconResolver({iconDir:dir},[],e=>skips.push(e));
 const ok=r.uri({iconFileID:1});a.match(ok,/^data:image\/png;base64,/);a.ok(ok.length<14000,'icon body small');
 a.equal(r.uri({iconFileID:2}),null);a.equal(skips.length,1);a.equal(skips[0].id,2);a.match(skips[0].reason,/too large/);
 a.equal(new IconResolver({iconDir:dir,embedIcons:false}).uri({iconFileID:1}),null);
 const svg=render.slot({enabled:true,icons:{1:1}},1,r);
 a.match(svg,/xmlns:xlink=/);a.ok(svg.length<14000);a.ok(encodeURIComponent(svg).length<20000);
 // Full-bleed geometry: one image over the whole 144x144 canvas, slice, nothing else (no rect, text, name, caption).
 a.match(svg,/<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="data:image\/png;base64,/);
 a.equal((svg.match(/<image /g)||[]).length,1);a.ok(!/<text|<rect|Moonfire|P1|<defs/.test(svg),svg.slice(0,300));
});

test('fallback order 144 -> 72 -> old cache -> question glyph; empty slot is plain black',async t=>{
 const d144=await fs.mkdtemp(path.join(__dirname,'tmp-o144-')),d72=await fs.mkdtemp(path.join(__dirname,'tmp-o72-'));
 t.after(()=>Promise.all([fs.rm(d144,{recursive:true,force:true}),fs.rm(d72,{recursive:true,force:true})]));
 const A=encode(img(144,'gradient')),B=encode(img(72,'gradient')),big=encode(img(96,'noise'));
 await fs.writeFile(path.join(d144,'1.png'),A);await fs.writeFile(path.join(d72,'1.png'),B);   // in both: 144 wins
 await fs.writeFile(path.join(d144,'2.png'),big);await fs.writeFile(path.join(d72,'2.png'),B);  // 144 over the cap: skipped -> 72
 await fs.writeFile(path.join(d144,'3.png'),big);await fs.writeFile(path.join(d72,'3.png'),big);// over the cap everywhere -> question glyph
 const skips=[],r=new IconResolver({iconDir:d144,iconFallbackDirs:[d72]},[],e=>skips.push(e.id));
 const snap={enabled:true,icons:{1:1,2:2,3:3,4:99,5:undefined,6:'unresolved'}};
 const b64=b=>b.toString('base64'),S=i=>render.slot(snap,i,r);
 a.ok(S(1).includes(b64(A))&&!S(1).includes(b64(B)));
 a.ok(S(2).includes(b64(B))&&S(2).includes('<image x="0" y="0" width="144" height="144"'));a.deepEqual(skips.slice(0,1),[2]);
 for(const i of [3,4,6]){const s=S(i);a.equal(s,render.QUESTION);a.ok(!/<text|<image/.test(s));}
 a.equal(S(5),render.BLANK);a.equal(S(9),render.BLANK);
 a.equal(render.slot(snap,1,null),render.QUESTION);   // no resolver (tile too large retry) -> question glyph
});

test('size distribution of the real 144 px library (if built): all files within the cap',async()=>{
 const dir=path.resolve(__dirname,'../icon-library-144');let files;try{files=await fs.readdir(dir);}catch{return;}
 if(files.length<100)return;
 let max=0;for(const f of files.slice(0,3000)){const n=(await fs.stat(path.join(dir,f))).size;if(n>max)max=n;}
 a.ok(max<=MAX_EMBED_BYTES,'largest sampled file '+max);
});

test('plugin vs size-limited host: every setImage stays under the limit, oversized icon falls back to question glyph and is logged',{timeout:30000},async t=>{
 const logFile=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/logs/streonordock.jsonl'),logStart=await fs.stat(logFile).then(x=>x.size,()=>0);
 const LIMIT=40000,dir=await fs.mkdtemp(path.join(__dirname,'tmp-payload-')),dir72=await fs.mkdtemp(path.join(__dirname,'tmp-payload72-'));
 const file=path.join(dir,'StreonorDock.lua'),cfg=path.join(dir,'config.json');
 await fs.writeFile(file,await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8'));
 const A=encode(img(144,'gradient')),B=encode(img(72,'gradient'));
 await fs.writeFile(path.join(dir,'136096.png'),A);                      // Moonfire: 144 px, embedded
 await fs.writeFile(path.join(dir,'134829.png'),encode(img(96,'noise')));  // potion: 144 file over the cap -> skipped
 await fs.writeFile(path.join(dir72,'134829.png'),B);                    // ... so the 72 px set is used
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,iconDir:dir,iconFallbackDirs:[dir72]}));
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','PAY','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let diagnostics='',stderr='';child.stdout.on('data',d=>diagnostics+=d);child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();await fs.rm(dir,{recursive:true,force:true});await fs.rm(dir72,{recursive:true,force:true});});
 await host.wait(m=>m.event==='registerPlugin');
 for(let i=1;i<=15;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.key${i}`,context:`K${i}`,payload:{}});
 const k1=await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&decodeURIComponent(m.payload.image).includes(A.toString('base64')));
 const k2=await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&decodeURIComponent(m.payload.image).includes(B.toString('base64')));
 const s1=decodeURIComponent(k1.payload.image),s2=decodeURIComponent(k2.payload.image);
 for(const s of [s1,s2]){a.match(s,/<image x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice" xlink:href="data:image\/png;base64,/);a.ok(!/<text|<rect/.test(s));}
 const rejected=host.messages.filter(m=>m.event==='setImage'&&m.payload.image.length>LIMIT);
 a.equal(rejected.length,0,'host would drop tiles over '+LIMIT+' chars: '+rejected.map(m=>m.context+':'+m.payload.image.length));
 a.ok(k1.payload.image.length<LIMIT);
 const logged=async()=>(await fs.readFile(logFile,'utf8').catch(()=>'')).slice(logStart);
 for(let i=0;i<60&&!(await logged()).includes('iconSkipped');i++)await sleep(50);
 a.match(await logged(),/"event":"iconSkipped".*too large/);a.equal(stderr,'');
});
