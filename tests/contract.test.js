'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin');
test('manifest complete fixed actions and original icon exists',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));a.equal(m.Version,'0.1.0');a.equal(m.Nodejs.Version,'20');a.equal(m.Actions.length,19);a.equal(new Set(m.Actions.map(x=>x.UUID)).size,19);
 for(let i=0;i<19;i++){a.deepEqual(m.Actions[i].Controllers,[i<15?'Keypad':'Information']);a.equal(m.Actions[i].SupportedInMultiActions,false);a.ok(fs.existsSync(path.join(root,m.Actions[i].Icon)));}
});
test('host launch argument validation',()=>{
 const {args}=require(path.join(root,'plugin/index'));a.equal(args(['-port','123','-pluginUUID','x','-registerEvent','registerPlugin','-info','{}']).port,'123');
 for(const argv of [[],['-port','65536'],['-port','123;bad'],['-bad','x']])a.throws(()=>args(argv));
});
