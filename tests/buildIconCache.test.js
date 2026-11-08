'use strict';
const {test}=require('node:test'), a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
const {build,idsFromExport,idsFromList,loadListfile,parseArgs}=require('../scripts/build-icon-cache');
const {IconResolver,MAX_ICON_BYTES}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/icons');
const fixture=path.join(__dirname,'fixtures','StreonorDock.lua');

// Tiny generated 256x256 grey PNG (no Blizzard art). Seed varies the pixel colour.
function crc32(buf){let c,crc=~0;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return ~crc>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc]);}
function png(size=256,seed=0){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
 const row=Buffer.concat([Buffer.from([0]),Buffer.alloc(size*3,seed)]);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(Array(size).fill(row)))),chunk('IEND',Buffer.alloc(0))]);
}
function tmp(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'icache-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}

test('export IDs are collected from every page/table, ignoring invalid values',t=>{
 const d=tmp(t),f=path.join(d,'StreonorDock.lua');
 fs.writeFileSync(f,'StreonorDockDB={export={icons={[1]={iconFileID=111},[2]={iconFileID=222}},slots={[1]={iconFileID=333}}},other={deep={iconFileID=444,bad={iconFileID=-5}},x={iconFileID="9"}}}');
 a.deepEqual([...idsFromExport(f)].sort((x,y)=>x-y),[111,222,333,444]);
 a.ok(idsFromExport(fixture).size>=1);
});

test('ids file: comments, commas, whitespace, junk ignored',t=>{
 const d=tmp(t),f=path.join(d,'ids.txt');fs.writeFileSync(f,'# comment\n132845, 134414\n  132794 # trailing\nabc 0 -4 99999999999\n');
 a.deepEqual([...idsFromList(f)],[132845,134414,132794]);
});

test('resolves by ID-named pack files, copies only needed, skips existing, keeps pack intact',t=>{
 const d=tmp(t),pack=path.join(d,'pack','sub'),cache=path.join(d,'cache');fs.mkdirSync(pack,{recursive:true});
 for(const n of [1,2,3])fs.writeFileSync(path.join(pack,n+'.png'),png(256,n));
 const ids=path.join(d,'ids.txt');fs.writeFileSync(ids,'1 2 9');
 const r=build({pack:path.join(d,'pack'),cache,idsFile:ids});
 a.deepEqual(r.copied.map(x=>x.id),[1,2]);a.deepEqual(r.unresolved.map(x=>x.id),[9]);
 a.deepEqual(fs.readdirSync(cache).sort(),['1.png','2.png']);a.deepEqual(fs.readdirSync(pack).sort(),['1.png','2.png','3.png']);
 fs.writeFileSync(path.join(cache,'1.png'),'keep');
 const r2=build({pack:path.join(d,'pack'),cache,idsFile:ids});
 a.deepEqual(r2.existing,[1,2]);a.equal(fs.readFileSync(path.join(cache,'1.png'),'utf8'),'keep');
});

test('name-based pack resolves through a listfile (case-insensitive); non-icons ignored',t=>{
 const d=tmp(t),pack=path.join(d,'pack'),cache=path.join(d,'cache');fs.mkdirSync(pack);
 fs.writeFileSync(path.join(pack,'inv_misc_food_01.png'),png(256,7));
 const list=path.join(d,'list.csv');
 fs.writeFileSync(list,'100;interface/icons/INV_Misc_Food_01.blp\n200;interface/icons/missing_icon.blp\n300;world/not/an/icon.blp\n');
 const ids=path.join(d,'ids.txt');fs.writeFileSync(ids,'100 200 300 400');
 a.deepEqual([...loadListfile(list,new Set([100,200,300]))],[[100,'inv_misc_food_01'],[200,'missing_icon']]);
 const r=build({pack,cache,idsFile:ids,listfile:list});
 a.deepEqual(r.copied.map(x=>[x.id,x.via]),[[100,'name']]);a.deepEqual(r.unresolved.map(x=>x.id),[200,300,400]);
});

test('rejects non-PNG and oversize files; dry run writes nothing',t=>{
 const d=tmp(t),pack=path.join(d,'pack'),cache=path.join(d,'cache');fs.mkdirSync(pack);
 fs.writeFileSync(path.join(pack,'5.png'),'not a png');
 fs.writeFileSync(path.join(pack,'6.png'),Buffer.concat([png(8),Buffer.alloc(MAX_ICON_BYTES)]));
 fs.writeFileSync(path.join(pack,'7.png'),png(8));
 const ids=path.join(d,'ids.txt');fs.writeFileSync(ids,'5 6 7');
 const dry=build({pack,cache,idsFile:ids,dryRun:true});
 a.equal(dry.copied.length,1);a.equal(fs.existsSync(cache),false);
 const r=build({pack,cache,idsFile:ids});
 a.deepEqual(r.rejected.map(x=>x.id),[5,6]);a.deepEqual(fs.readdirSync(cache),['7.png']);
});

test('cached 256x256 PNG is accepted by the plugin IconResolver (no downscale needed)',t=>{
 const d=tmp(t),pack=path.join(d,'pack'),cache=path.join(d,'cache');fs.mkdirSync(pack);
 const bytes=png(256,9);a.ok(bytes.length<MAX_ICON_BYTES);fs.writeFileSync(path.join(pack,'42.png'),bytes);
 const ids=path.join(d,'ids.txt');fs.writeFileSync(ids,'42');build({pack,cache,idsFile:ids});
 a.match(new IconResolver({iconDir:cache}).uri({iconFileID:42}),/^data:image\/png;base64,/);
 a.equal(new IconResolver({iconDir:cache}).uri({iconFileID:43}),null);
});

test('argument parsing rejects unknown flags and missing values',()=>{
 a.deepEqual(parseArgs(['--pack','p','--dry-run']),{dryRun:true,pack:'p'});
 a.throws(()=>parseArgs(['--nope']));a.throws(()=>parseArgs(['--pack']));
});

test('shipped plugin config points at the private cache outside the plugin folder',()=>{
 const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','src','io.github.dinonuggolus.streonordock.sdPlugin','plugin','config.json'),'utf8'));
 a.ok(path.win32.isAbsolute(cfg.iconDir));a.match(cfg.iconDir,/icon-library-144$/);
 const gi=fs.readFileSync(path.join(__dirname,'..','.gitignore'),'utf8');a.match(gi,/^icon-cache\/$/m);a.match(gi,/^\*\.png$/m);
});
