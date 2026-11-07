'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {chord,plan}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/chords');
const sender=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin/plugin/sender.ps1');
const {spawn}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('all 15 exactly match addon Core.lua list; VK scan and reverse release',()=>{
 // Expected list copied from Core.lua; also pin to the current owning source.
 const keys=['1','2','3','4','5','6','7','8','9','0','-','=','[',']','\\'];
 const core=fs.readFileSync(path.resolve(__dirname,'../../StreonorDock/src/StreonorDock/Core.lua'),'utf8');
 a.ok(core.includes('"1","2","3","4","5","6","7","8","9","0","-","=","[","]","\\\\"'));
 for(let i=1;i<=15;i++){a.equal(chord(i),`ALT-CTRL-SHIFT-${keys[i-1]}`);a.deepEqual(plan(i,false),plan(i,true).slice().reverse().map(x=>({...x,up:true})));a.deepEqual(plan(i,true).slice(0,3).map(x=>x.vk),[0xA2,0xA0,0xA4]);}
 a.deepEqual([11,12,13,14,15].map(i=>plan(i,true)[3].vk),[0xBD,0xBB,0xDB,0xDD,0xDC]);a.equal(chord(0),null);a.throws(()=>plan(16,true));
});
for(const guard of ['unfocused','conflict'])test('dry-run refusal '+guard,()=>{
 const input=[{kind:'chord',slot:1,down:true},{kind:'chord',slot:1,down:true},{kind:'chord',slot:1,down:false},{kind:'stop'}].map(JSON.stringify).join('\n')+'\n';
 const r=spawnSync('powershell.exe',['-NoProfile','-File',sender,'-DryRun','-DryRunGuard',guard],{input,encoding:'utf8',timeout:10000});a.equal(r.status,0,r.stderr);const out=r.stdout.trim().split(/\r?\n/).map(JSON.parse);a.equal(out.filter(m=>m.bridge==='refused').length,1);a.equal(out.filter(m=>m.bridge==='chord').length,0);
});
test('timeout release, no repeat after timeout, overlap refusal, EOF release', {timeout:15000},async t=>{
 const child=spawn('powershell.exe',['-NoProfile','-File',sender,'-DryRun'],{windowsHide:true});t.after(()=>child.kill());let output='',errors='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d);
 const send=o=>child.stdin.write(JSON.stringify(o)+'\n');
 for(let i=0;i<100&&!output.includes('ready');i++)await sleep(30);
 send({kind:'chord',slot:1,down:true});send({kind:'chord',slot:2,down:true});
 for(let i=0;i<100&&!output.includes('timeout');i++)await sleep(30);a.match(output,/timeout/);send({kind:'chord',slot:1,down:true});await sleep(100);
 a.equal((output.match(/"bridge":"chord"/g)||[]).length,2,output+errors);
 send({kind:'chord',slot:1,down:false});send({kind:'chord',slot:2,down:false});send({kind:'chord',slot:3,down:true});child.stdin.end();await new Promise(r=>child.once('exit',r));
 const messages=output.trim().split(/\r?\n/).map(JSON.parse);a.ok(messages.some(m=>m.reason==='overlap'));a.ok(messages.some(m=>m.reason==='stop'));a.equal(messages.filter(m=>m.bridge==='chord').length,4);a.equal(errors,'');
});
test('PowerShell syntax and actual helper dry-run mapping all slots',()=>{
 const syntax=spawnSync('powershell.exe',['-NoProfile','-Command',`$e=$null; $t=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${sender}',[ref]$t,[ref]$e); if($e.Count){$e | Out-String | Write-Error; exit 1}`],{encoding:'utf8'});a.equal(syntax.status,0,syntax.stderr);
 const lines=[];for(let slot=1;slot<=15;slot++){lines.push({kind:'chord',slot,down:true},{kind:'chord',slot,down:true},{kind:'chord',slot,down:false});}lines.push({kind:'stop'});
 const r=spawnSync('powershell.exe',['-NoProfile','-File',sender,'-DryRun'],{input:lines.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:20000});a.equal(r.status,0,r.stderr);
 const output=r.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x)).filter(x=>x.bridge==='chord');a.equal(output.length,30,r.stdout);
 for(let slot=1;slot<=15;slot++){a.deepEqual(output[(slot-1)*2].sequence,plan(slot,true));a.deepEqual(output[(slot-1)*2+1].sequence,plan(slot,false));}
});
