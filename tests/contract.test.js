'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin');
test('manifest: only the 15 fixed key actions, no readout/status actions; icon exists',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));a.equal(m.Version,'0.1.0');a.equal(m.Nodejs.Version,'20');a.equal(m.Actions.length,15);a.equal(new Set(m.Actions.map(x=>x.UUID)).size,15);
 for(let i=0;i<15;i++){a.equal(m.Actions[i].UUID,`io.github.dinonuggolus.streonordock.key${i+1}`);a.deepEqual(m.Actions[i].Controllers,['Keypad']);a.equal(m.Actions[i].SupportedInMultiActions,false);a.equal(m.Actions[i].States[0].ShowTitle,false);a.ok(fs.existsSync(path.join(root,m.Actions[i].Icon)));}
 a.ok(!/readout|status|cooldown|timer/i.test(JSON.stringify(m.Actions)));
});
test('host launch argument validation',()=>{
 const {args}=require(path.join(root,'plugin/index'));a.equal(args(['-port','123','-pluginUUID','x','-registerEvent','registerPlugin','-info','{}']).port,'123');
 for(const argv of [[],['-port','65536'],['-port','123;bad'],['-bad','x']])a.throws(()=>args(argv));
});
