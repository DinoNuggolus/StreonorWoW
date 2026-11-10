'use strict';
// The icon-library builder wrapper against a LOCAL http server with generated fixture art (no network, no game art).
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const {encode}=require('../scripts/png');
const root=path.join(__dirname,'..'),ps1=path.join(root,'installer','Build-IconLibrary.ps1'),tool=path.join(root,'scripts','build-icon-library.js');
function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'sd-icons-'));}
function img(seed){const size=256,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const o=(y*size+x)*4;data[o]=(x+seed*40)%256;data[o+1]=y;data[o+2]=seed*50%256;data[o+3]=255;}return encode({width:size,height:size,data});}
function fixtures(){
 const d=tmp(),pngs=path.join(d,'src','png','png_icons');fs.mkdirSync(pngs,{recursive:true});
 for(const [n,s] of [['inv_a',1],['inv_b',2],['inv_c',3]])fs.writeFileSync(path.join(pngs,n+'.png'),img(s));
 const zip=path.join(d,'pack.zip');
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-Command',`Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${path.join(d,'src')}','${zip}')`],{encoding:'utf8'});
 a.equal(r.status,0,r.stderr);
 const list=path.join(d,'list.csv');fs.writeFileSync(list,['101;interface/icons/inv_a.blp','102;interface/icons/inv_b.blp','103;interface/icons/inv_c.blp','104;interface/icons/inv_missing.blp'].join('\n'));
 return {zip:fs.readFileSync(zip),list:fs.readFileSync(list)};
}
function serve(files){
 const log=[];
 const server=http.createServer((req,res)=>{
  const body=files[req.url];if(!body){res.writeHead(404).end();return;}
  log.push({method:req.method,url:req.url,range:req.headers.range||null});
  if(req.method==='HEAD'){res.writeHead(200,{'Content-Length':body.length,'Accept-Ranges':'bytes'}).end();return;}
  const m=/^bytes=(\d+)-$/.exec(req.headers.range||'');
  if(m){const start=Number(m[1]);res.writeHead(206,{'Content-Length':body.length-start,'Content-Range':`bytes ${start}-${body.length-1}/${body.length}`}).end(body.subarray(start));return;}
  res.writeHead(200,{'Content-Length':body.length}).end(body);
 });
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>r({server,log,base:`http://127.0.0.1:${server.address().port}`})));
}
function run(args){
 return new Promise(resolve=>{const c=cp.spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',ps1,'-NoPause',...args],{windowsHide:true});let out='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>out+=d);c.on('close',code=>resolve({code,out}));});
}
const common=(base,work,lib)=>['-Yes','-WorkDir',work,'-LibraryDir',lib,'-PackUrl',base+'/pack.zip','-ListfileUrl',base+'/list.csv','-NodePath',process.execPath,'-Tool',tool,'-MinFreeGB','0'];

test('end to end: download, unpack, build 144 px images, clean up the downloads',{timeout:120000},async t=>{
 const f=fixtures(),s=await serve({'/pack.zip':f.zip,'/list.csv':f.list});t.after(()=>s.server.close());
 const work=path.join(tmp(),'work'),lib=path.join(tmp(),'lib');
 const r=await run(common(s.base,work,lib));
 a.equal(r.code,0,r.out);a.match(r.out,/Step 1 of 3/);a.match(r.out,/Step 3 of 3/);a.match(r.out,/Done: 3 icons are ready/);a.match(r.out,/restart Streonor/i);
 a.deepEqual(fs.readdirSync(lib).sort(),['101.png','102.png','103.png']);
 for(const n of fs.readdirSync(lib)){const b=fs.readFileSync(path.join(lib,n));a.deepEqual([...b.subarray(0,4)],[137,80,78,71]);a.ok(b.length<=20*1024,n);}
 a.ok(!fs.existsSync(work),'downloads and the unpacked pack are removed');
 a.ok(s.log.some(x=>x.method==='GET'&&x.url==='/pack.zip')&&s.log.some(x=>x.url==='/list.csv'));
});
test('a second run is incremental: nothing rebuilt, still succeeds',{timeout:120000},async t=>{
 const f=fixtures(),s=await serve({'/pack.zip':f.zip,'/list.csv':f.list});t.after(()=>s.server.close());
 const work=path.join(tmp(),'work'),lib=path.join(tmp(),'lib');
 a.equal((await run(common(s.base,work,lib))).code,0);
 const before=fs.statSync(path.join(lib,'101.png')).mtimeMs;
 const r=await run(common(s.base,work,lib));a.equal(r.code,0,r.out);a.match(r.out,/skipped 3 existing/);a.equal(fs.statSync(path.join(lib,'101.png')).mtimeMs,before);
});
test('an interrupted download resumes with a Range request instead of starting over',{timeout:120000},async t=>{
 const f=fixtures(),s=await serve({'/pack.zip':f.zip,'/list.csv':f.list});t.after(()=>s.server.close());
 const work=path.join(tmp(),'work'),lib=path.join(tmp(),'lib');fs.mkdirSync(work,{recursive:true});
 const half=Math.floor(f.zip.length/2);fs.writeFileSync(path.join(work,'png_icons.zip.part'),f.zip.subarray(0,half));
 const r=await run(common(s.base,work,lib));a.equal(r.code,0,r.out);a.match(r.out,/Resuming Icon pack/);
 a.ok(s.log.some(x=>x.range===`bytes=${half}-`),JSON.stringify(s.log));
 a.deepEqual(fs.readdirSync(lib).sort(),['101.png','102.png','103.png']);
});
test('dry run checks everything but downloads nothing; low disk and missing Node give plain messages',{timeout:120000},async t=>{
 const f=fixtures(),s=await serve({'/pack.zip':f.zip,'/list.csv':f.list});t.after(()=>s.server.close());
 const work=path.join(tmp(),'work'),lib=path.join(tmp(),'lib');
 const dry=await run([...common(s.base,work,lib),'-DryRun']);a.equal(dry.code,0,dry.out);a.match(dry.out,/Dry run: nothing downloaded/);a.match(dry.out,/Download sizes/);
 a.ok(!s.log.some(x=>x.method==='GET'),'no download in a dry run');a.ok(!fs.existsSync(path.join(work,'png_icons.zip.part')));
 const low=await run([...common(s.base,work,lib).filter((x,i,arr)=>arr[i-1]!=='-MinFreeGB'&&x!=='-MinFreeGB'),'-MinFreeGB','999999999']);
 a.equal(low.code,1);a.match(low.out,/Not enough free disk space/);
 const args=common(s.base,work,lib);args[args.indexOf('-NodePath')+1]=path.join(tmp(),'nonexistent','node.exe');
 const nonode=await run(args);a.equal(nonode.code,1);a.match(nonode.out,/Node was not found/);
 const offline=await run(common('http://127.0.0.1:1',work,lib));a.equal(offline.code,1);a.match(offline.out,/Something went wrong/);
});
test('the wrapper shows source and size before asking, and never writes game art into the repo or release',()=>{
 const text=fs.readFileSync(ps1,'utf8');
 a.match(text,/github\.com\/qcy-hash\/wow-forever-icons-png/);a.match(text,/github\.com\/wowdev\/wow-listfile/);a.match(text,/about 1\.7 GB/);a.match(text,/Ask \(/);
 a.doesNotMatch(text,/[^\x00-\x7f]/,'ASCII only (Windows PowerShell 5.1 reads files without a BOM as ANSI)');
 const bat=fs.readFileSync(path.join(root,'installer','Build Icon Library.bat'),'utf8');a.match(bat,/-ExecutionPolicy Bypass -File "%~dp0Build-IconLibrary\.ps1"/);
 const gi=fs.readFileSync(path.join(root,'.gitignore'),'utf8');a.match(gi,/^\*\.png$/m);a.match(gi,/^dist\/$/m);
});
