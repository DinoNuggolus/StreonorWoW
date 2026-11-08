'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs/promises'),fss=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {MockHost}=require('./mockhost');
const {encode}=require('../scripts/png');
const lib=require('../scripts/build-icon-library');
const {check}=require('../scripts/check-icons');
const plugin=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/index.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Generated art only (no Blizzard files). 256px so shrinking is exercised; noisy = hard to compress.
function img(size,kind,seed=0){const data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const o=(y*size+x)*4;
 if(kind==='noise'){const r=crypto.randomBytes(3);data[o]=r[0];data[o+1]=r[1];data[o+2]=r[2];}else{data[o]=(x+seed*40)%256;data[o+1]=y*255/size;data[o+2]=seed*50%256;}data[o+3]=255;}return encode({width:size,height:size,data});}
async function mk(t,prefix){const d=await fs.mkdtemp(path.join(__dirname,prefix));t.after(()=>fs.rm(d,{recursive:true,force:true}));return d;}

test('library build: listfile mapping (multi-ID, no-ID, no-pack), size guard, incremental re-run',async t=>{
 const d=await mk(t,'tmp-lib-'),pack=path.join(d,'pack'),out=path.join(d,'library');await fs.mkdir(pack);
 await fs.writeFile(path.join(pack,'inv_a.png'),img(256,'gradient',1));
 await fs.writeFile(path.join(pack,'Inv_Noise.png'),img(256,'noise'));      // hard: needs the shrink ladder
 await fs.writeFile(path.join(pack,'orphan_icon.png'),img(256,'gradient',2)); // no ID in listfile
 const list=path.join(d,'list.csv');
 await fs.writeFile(list,['10;interface/icons/inv_a.blp','11;interface/icons/INV_A.blp','12;interface/icons/inv_noise.blp','13;interface/icons/not_in_pack.blp','14;interface/icons/sub/inv_a.blp','15;world/foo.blp'].join('\n'));
 const r=await lib.build({pack,listfile:list,library:out,workers:1});
 a.equal(r.packIcons,3);a.equal(r.packIconsWithId,2);a.deepEqual(r.packNoId,['orphan_icon']);a.equal(r.idsNoPack,1);
 a.deepEqual(fss.readdirSync(out).sort(),['10.png','11.png','12.png']);   // 14 (nested) and 15 (not an icon) ignored
 for(const f of fss.readdirSync(out)){const n=fss.statSync(path.join(out,f)).size;a.ok(n<=lib.MAX_EMBED_BYTES,f+' '+n);}
 a.ok(fss.readFileSync(path.join(out,'10.png')).equals(fss.readFileSync(path.join(out,'11.png'))));
 a.deepEqual(fss.readdirSync(pack).sort(),['Inv_Noise.png','inv_a.png','orphan_icon.png']);   // pack untouched
 // Incremental: nothing rewritten; a deleted file and a too-large file are rebuilt.
 const mt=fss.statSync(path.join(out,'10.png')).mtimeMs;
 const r2=await lib.build({pack,listfile:list,library:out,workers:1});a.equal(r2.written,0);a.equal(fss.statSync(path.join(out,'10.png')).mtimeMs,mt);
 fss.rmSync(path.join(out,'11.png'));fss.writeFileSync(path.join(out,'12.png'),Buffer.alloc(lib.MAX_EMBED_BYTES+1));
 const r3=await lib.build({pack,listfile:list,library:out,workers:1});a.equal(r3.written,2);a.ok(fss.statSync(path.join(out,'12.png')).size<=lib.MAX_EMBED_BYTES);
});

test('library build: worker pool path gives the same result',{timeout:60000},async t=>{
 const d=await mk(t,'tmp-libw-'),pack=path.join(d,'pack'),out=path.join(d,'library');await fs.mkdir(pack);
 const png=img(96,'gradient',3),rows=[];
 for(let i=0;i<80;i++){await fs.writeFile(path.join(pack,`icon_${i}.png`),png);rows.push(`${1000+i};interface/icons/icon_${i}.blp`);}
 const list=path.join(d,'list.csv');await fs.writeFile(list,rows.join('\n'));
 const r=await lib.build({pack,listfile:list,library:out,workers:3});
 a.equal(r.written,80);a.equal(r.libraryFiles,80);a.equal(r.rejected.length,0);
});

test('check-icons reports present, missing and fallback-dir icons for an export',async t=>{
 const d=await mk(t,'tmp-chk-'),main=path.join(d,'main'),old=path.join(d,'old');await fs.mkdir(main);await fs.mkdir(old);
 await fs.writeFile(path.join(main,'111.png'),'x');await fs.writeFile(path.join(old,'222.png'),'x');
 const f=path.join(d,'StreonorDock.lua');
 await fs.writeFile(f,'StreonorDockDB={export={slots={[1]={kind="spell",name="A",iconFileID=111},[2]={kind="item",name="B",iconFileID=222},[3]={kind="item",name="C",iconFileID=333},[4]={kind="empty"}},readouts={[1]={kind="item",name="D"}}}}');
 const rows=check(f,[main,old]);
 a.deepEqual(rows.map(r=>[r.where,!!r.file]),[['slot 1',true],['slot 2',true],['slot 3',false],['readout 1',false]]);
});

test('runtime flow: export rewrite -> plugin re-reads slots -> icon looked up by iconFileID in library (+fallback dir) -> missing ID gives text tile; no network',{timeout:40000},async t=>{
 const d=await mk(t,'tmp-flow-'),library=path.join(d,'library'),old=path.join(d,'old');await fs.mkdir(library);await fs.mkdir(old);
 const file=path.join(d,'StreonorDock.lua'),cfg=path.join(d,'config.json');
 const fixture=await fs.readFile(path.join(__dirname,'fixtures/StreonorDock.lua'),'utf8');await fs.writeFile(file,fixture);
 const A=img(72,'gradient',1),B=img(72,'gradient',2),C=img(72,'gradient',3);
 await fs.writeFile(path.join(library,'136096.png'),A);   // Moonfire icon (slot 1)
 await fs.writeFile(path.join(library,'999001.png'),B);   // library icon used after the "new item on a button"
 await fs.writeFile(path.join(old,'134829.png'),C);       // only in the fallback dir (slot 2)
 await fs.writeFile(cfg,JSON.stringify({savedVariablesPath:file,iconDir:library,iconFallbackDirs:[old]}));
 const host=new MockHost(),port=await host.listen();
 const child=spawn(process.execPath,[plugin,'-port',String(port),'-pluginUUID','FLOW','-registerEvent','registerPlugin','-info','{}'],{env:{...process.env,STREONORDOCK_CONFIG:cfg,STREONORDOCK_DRY_RUN:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stderr='';child.stderr.on('data',x=>stderr+=x);
 t.after(async()=>{child.stdin.end();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);if(child.exitCode===null)child.kill();await host.close();});
 await host.wait(m=>m.event==='registerPlugin');
 for(let i=1;i<=2;i++)host.send({event:'willAppear',action:`io.github.dinonuggolus.streonordock.key${i}`,context:`K${i}`,payload:{}});
 const b64=buf=>buf.toString('base64'),svg=m=>decodeURIComponent(m.payload.image);
 const k1=svg(await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&svg(m).includes(b64(A))));
 a.ok(k1.includes(b64(A)),'slot 1 shows library icon 136096');a.ok(!/<text/.test(k1));
 const k2=svg(await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&svg(m).includes(b64(C))));
 a.ok(k2.includes(b64(C)),'slot 2 shows fallback-dir icon 134829');
 // /reload: addon writes a new export. Slot 1 now holds a new spell with icon 999001; slot 2 a never-seen ID.
 await fs.writeFile(file,fixture.replace('["name"]="Moonfire", ["iconFileID"]=136096','["name"]="NewSpell", ["iconFileID"]=999001').replace('["iconFileID"]=134829, ["chord"]','["iconFileID"]=777777, ["chord"]'));
 const n1=svg(await host.wait(m=>m.event==='setImage'&&m.context==='K1'&&svg(m).includes(b64(B))));
 a.ok(n1.includes(b64(B))&&!n1.includes(b64(A)),'slot 1 switched to the new library icon');
 const n2=svg(await host.wait(m=>m.event==='setImage'&&m.context==='K2'&&svg(m).includes('>MH<')));
 a.ok(!n2.includes('<image'));a.match(n2,/<rect/);a.ok(!n2.includes(b64(C)));   // missing icon -> text tile
 a.equal(stderr,'');
});

test('shipped plugin never touches the network and reads icons only from configured local dirs',async()=>{
 const root=path.join(__dirname,'..','src','io.github.dinonuggolus.streonordock.sdPlugin');
 for(const f of ['lib/icons.js','lib/render.js','plugin/index.js']){const code=await fs.readFile(path.join(root,f),'utf8');
  a.doesNotMatch(code,/require\(['"]node:(https?|net|dns|dgram|tls)['"]\)|require\(['"](https?|net|dns)['"]\)|fetch\(|XMLHttpRequest/,f);}
 const cfg=JSON.parse(await fs.readFile(path.join(root,'plugin','config.json'),'utf8'));
 a.match(cfg.iconDir,/icon-library-144$/);const fb=cfg.iconFallbackDirs.map(x=>path.win32.basename(x));a.deepEqual(fb.slice(0,2),['icon-library','icon-cache']);   // order: 144 px, 72 px, old cache
 a.match(await fs.readFile(path.join(__dirname,'..','.gitignore'),'utf8'),/^icon-library\/$/m);
});
