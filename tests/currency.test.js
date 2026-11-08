'use strict';
// Fixture lines are AUTHORED from the client's enUS format strings (tests/fixtures/WoWChatLog.authored.txt).
// Replace/extend with real, name-scrubbed samples once the user supplies them.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const lib=p=>require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/'+p);
const {parseLine}=lib('chatParser'),{ChatTail,MAX_PENDING}=lib('chatTail'),{Estimator}=lib('estimator'),render=lib('render'),readout=lib('readout');
const {normalize}=lib('exportReader');
const NOW=new Date(2026,10,8,15,0,0).getTime();
const fixture=path.join(__dirname,'fixtures','WoWChatLog.authored.txt');
const ms=(m,d,h,mi,s,msec=0)=>new Date(2026,m-1,d,h,mi,s,msec).getTime();

test('parser: own money gains, shares, currency links, honor; exact amounts and timestamps',async()=>{
 const lines=(await fs.readFile(fixture,'utf8')).split('\n');
 const out=lines.map(l=>parseLine(l,NOW)).filter(Boolean);
 a.deepEqual(out.map(x=>x.rule),['loot-money','share-money','currency','currency','honor']);
 a.equal(out[0].copper,12005);a.equal(out[0].t,ms(11,8,14,3,22,123));a.equal(out[1].copper,304);
 a.deepEqual([out[2].currencyID,out[2].name,out[2].amount],[1901,'Honor',15]);
 a.deepEqual([out[3].currencyID,out[3].name,out[3].amount],[2000,'Token',1]);
 a.deepEqual([out[4].currencyID,out[4].name,out[4].amount],[undefined,'Honor',12]);
});
test('parser: other players, channels, partial or unknown formats and garbage are ignored, never guessed',()=>{
 const bad=['11/8 14:03:23.001  [Trade] Someone: You loot 99 Gold.','11/8 14:03:24.500  Other says: You loot 50 Gold.',
  '11/8 14:03:29.000  You loot 5 Gold and a boot.','11/8 14:03:29.000  You loot 5 Gold','11/8 14:03:29.000  You loot 0 Copper.',
  '11/8 14:03:29.000  You loot 5 Platinum.','11/8 14:03:29.000  Someone loots 5 Gold.','You loot 5 Gold.','',
  '11/8 14:03:29.000  You receive currency: [Honor] xabc.','11/8 14:03:29.000  You receive currency: Honor.',
  '13/40 14:03:29.000  You loot 5 Gold.','11/8 14:03:29.000  You have been awarded 0 honor points.',
  '11/8 14:03:29.000  You loot '+'1 Gold, '.repeat(50)+'.','x'.repeat(5000)];
 for(const line of bad)a.equal(parseLine(line,NOW),null,line.slice(0,60));
 a.equal(parseLine(null,NOW),null);
 a.equal(parseLine('11/8 14:03:29.000  You loot 7 Gold.\r',NOW).copper,70000);
 // a December log line read in January belongs to the previous year
 const jan=new Date(2027,0,2,12).getTime();a.equal(parseLine('12/31 23:59:59.000  You loot 1 Copper.',jan).t,new Date(2026,11,31,23,59,59).getTime());
});

test('tail: appended lines only, partial last line waits for its newline, CRLF handled',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-tail-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'WoWChatLog.txt'),tail=new ChatTail(file);
 a.deepEqual(await tail.poll(),[]);                       // no file yet
 await fs.writeFile(file,'one\r\ntwo\r\npart');
 a.deepEqual(await tail.poll(),['one','two']);
 await fs.appendFile(file,'ial\nthree\n');
 a.deepEqual(await tail.poll(),['partial','three']);
 a.deepEqual(await tail.poll(),[]);
});
test('tail: truncation, replacement and deletion restart cleanly; no replay of old lines',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-tail-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'WoWChatLog.txt'),tail=new ChatTail(file);
 await fs.writeFile(file,'aaaaaaaaaa\nbbbbbbbbbb\n');await tail.poll();
 await fs.writeFile(file,'c\n');                            // truncated and rewritten shorter
 a.deepEqual(await tail.poll(),['c']);
 await fs.rm(file);a.deepEqual(await tail.poll(),[]);
 await fs.writeFile(file,'d\ne\n');                          // recreated: read from its start
 a.deepEqual(await tail.poll(),['d','e']);
 await fs.appendFile(file,'f\n');a.deepEqual(await tail.poll(),['f']);
});
test('tail: first start replays only a bounded tail; runaway line without newline stays bounded',async t=>{
 const dir=await fs.mkdtemp(path.join(__dirname,'tmp-tail-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'WoWChatLog.txt'),big=('x'.repeat(99)+'\n').repeat(20000);   // 2 MB
 await fs.writeFile(file,big+'last\n');
 const tail=new ChatTail(file),lines=await tail.poll();
 a.ok(lines.length<=10500&&lines.length>10000);a.equal(lines.at(-1),'last');a.ok(lines.every(l=>l==='last'||l.length===99),'no cut first line');
 await fs.appendFile(file,'y'.repeat(MAX_PENDING*2));a.deepEqual(await tail.poll(),[]);
 await fs.appendFile(file,'\nnext\n');const more=await tail.poll();a.ok(more.includes('next'));
});

const lootAt=(d,text)=>`11/${d[0]} ${d[1]}  ${text}`;
test('estimator: gains after the save add to the exact baseline; earlier lines and duplicates do not',()=>{
 const savedAt=Math.floor(ms(11,8,14,3,25,0)/1000);                       // server seconds
 const est=new Estimator({now:()=>NOW});
 a.equal(est.addLines([
  '11/8 14:03:22.123  You loot 1 Gold, 20 Silver, 5 Copper.',            // before the save: already inside the baseline
  '11/8 14:03:26.000  You loot 2 Silver.',
  '11/8 14:03:26.000  You loot 2 Silver.',                                // duplicate line
  '11/8 14:03:27.000  You receive currency: |Hcurrency:1901:0|h[Honor]|h|r x15.',
  '11/8 14:03:28.000  You have been awarded 5 honor points.',
  '11/8 14:03:29.000  You receive currency: |Hcurrency:2000:0|h[Token]|h|r.',
  '11/8 14:03:30.000  [Say] Other: You loot 9 Gold.']),5);
 const gold={kind:'money',copper:100000},honor={kind:'currency',currencyID:1901,name:'Honor',quantity:250,maxQuantity:300};
 a.deepEqual(est.value(gold,savedAt),{value:100200,estimated:true});
 a.deepEqual(est.value(honor,savedAt),{value:270,estimated:true});
 a.deepEqual(est.value({kind:'currency',currencyID:2000,name:'Token',quantity:7},savedAt),{value:8,estimated:true});
 a.deepEqual(est.value({kind:'currency',currencyID:1602,name:'Conquest',quantity:0},savedAt),{value:0,estimated:false});
 a.deepEqual(est.value({...honor,maxQuantity:260},savedAt),{value:260,estimated:true},'clamped at the cap');
 a.equal(est.value({kind:'money'},savedAt),null);a.equal(est.value(gold,undefined),null);a.equal(est.value({kind:'item'},savedAt),null);
});
test('estimator: a newer save resets the baseline and discards deltas older than it',()=>{
 const est=new Estimator({now:()=>NOW});
 est.addLines(['11/8 14:03:26.000  You loot 2 Silver.','11/8 14:10:00.000  You loot 3 Silver.']);
 const gold=c=>({kind:'money',copper:c});
 a.equal(est.value(gold(1000),Math.floor(ms(11,8,14,3,0,0)/1000)).value,1500);
 a.equal(est.value(gold(5000),Math.floor(ms(11,8,14,5,0,0)/1000)).value,5300,'only the 14:10 gain still applies');
 a.deepEqual(est.value(gold(9000),Math.floor(ms(11,8,14,11,0,0)/1000)),{value:9000,estimated:false});
});
test('estimator: bounded memory and age',()=>{
 const est=new Estimator({now:()=>NOW});const lines=[];
 for(let i=0;i<5000;i++)lines.push(`11/8 14:${String(Math.floor(i/60)%60).padStart(2,'0')}:${String(i%60).padStart(2,'0')}.${String(i%1000).padStart(3,'0')}  You loot ${i%99+1} Copper.`);
 est.addLines(lines);a.ok(est.deltas.length<=2000);
 const old=new Estimator({now:()=>NOW});old.addLines(['11/1 01:00:00.000  You loot 1 Gold.']);a.equal(old.deltas.length,0);
});

test('readout tile: icon, short name and big plain value; no age/stale words; marker only when enabled',()=>{
 const s={savedAt:1000,mtimeMs:2000000,page:{index:2,count:3},slots:{},readouts:{
  1:{kind:'money',copper:123456},2:{kind:'currency',currencyID:1901,name:'Honor',iconFileID:5,quantity:1234567},3:{kind:'currency',currencyID:9,name:'X<&',quantity:3}}};
 const est={estimator:{value:(e)=>({value:(e.copper??e.quantity)+10,estimated:true})},marker:false};
 const m=render.readout(s,1,0,null,null,est);a.match(m,/>12g 34s 66c</);a.match(m,/>Gold</);a.match(m,/P2 · 1/);
 const h=render.readout(s,2,0,null,null,est);a.match(h,/>1,234,577</);a.match(h,/>Honor</);
 a.match(render.readout(s,3,0,null,null,est),/X&lt;&amp;/);
 for(const svg of [m,h])for(const bad of ['STALE','SNAPSHOT','saved','Age','age ']){a.ok(!svg.includes(bad),bad);}
 a.ok(!m.includes('~'));a.match(render.readout(s,1,0,null,null,{...est,marker:true}),/>~12g 34s 66c</);
 a.match(render.readout(s,1,0,null,null,null),/>12g 34s 56c</,'no estimator: exact saved value');
 const broken=render.readout(s,1,0,null,null,{estimator:{value(){throw Error('x');}}});a.match(broken,/>12g 34s 56c</);
 a.equal(readout.money(0),'0c');a.equal(readout.money(10000),'1g');a.equal(readout.money(NaN),'?');a.equal(readout.count(-1),'?');
 s.readouts[1]={kind:'money'};a.match(render.readout(s,1,0,null,null,est),/>\?</);
});
test('export reader keeps money and currency readouts and sanitizes them',()=>{
 const n=normalize({schema:1,savedAt:100,page:{index:1,count:1},slots:{},readouts:{
  1:{kind:'money',copper:42,junk:1},2:{kind:'currency',currencyID:1901,name:'Honor\u0001',iconFileID:9,quantity:5,maxQuantity:0,x:1},3:{kind:'currency',currencyID:-1}}},1);
 a.deepEqual(n.readouts[1],{kind:'money',copper:42});
 a.deepEqual(n.readouts[2],{kind:'currency',currencyID:1901,iconFileID:9,name:'Honor',quantity:5});
 a.deepEqual(n.readouts[3],{kind:'empty'});
});
