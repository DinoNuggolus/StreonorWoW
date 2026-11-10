const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
const {detectGamePath,candidates}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/gamePath');
test('game path detection: first drive/folder containing WTF\\Account, else the common default',()=>{
 const hit='E:\\Program Files (x86)\\World of Warcraft\\_forever_';
 a.equal(detectGamePath(p=>p===path.join(hit,'WTF','Account')),hit);
 a.equal(detectGamePath(()=>false),'C:\\World of Warcraft\\_forever_');
 a.equal(detectGamePath(()=>{throw Error('io');}),'C:\\World of Warcraft\\_forever_');
 const all=candidates(['C','D']);a.equal(all.length,8);for(const c of all)a.match(c,/^[CD]:\\.*World of Warcraft\\_forever_$/);
 a.equal(detectGamePath(p=>p.startsWith('C:'),['C']),'C:\\World of Warcraft\\_forever_');
});
test('export reader falls back to detection when gamePath is empty',async()=>{
 const {ExportReader}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
 const r=new ExportReader({gamePath:''},{fs:{readdir:async()=>{throw new Error('ENOENT');},stat:async()=>{throw new Error('x');}}});
 await r.poll();a.match(r.error,/ENOENT/);   // reached the (detected) base without crashing
});
