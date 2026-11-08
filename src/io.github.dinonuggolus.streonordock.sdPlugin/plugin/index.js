'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
const {cadence,nextDelay}=require('../lib/cadence'),{LogCleanup}=require('../lib/logCleanup'),{PressTimers}=require('../lib/pressTimers'),{ExportReader}=require('../lib/exportReader'),{IconResolver}=require('../lib/icons'),render=require('../lib/render');
const {ChatTail}=require('../lib/chatTail'),{Estimator}=require('../lib/estimator');
const PREFIX='io.github.dinonuggolus.streonordock.';
function args(argv){const o={};for(let i=0;i<argv.length;i+=2){if(!/^-(port|pluginUUID|registerEvent|info)$/.test(argv[i])||argv[i+1]===undefined)throw Error('Invalid host arguments');o[argv[i].slice(1)]=argv[i+1];}if(!/^\d+$/.test(o.port)||+o.port<1||+o.port>65535||!o.pluginUUID||o.pluginUUID.length>256||!/^registerPlugin$/.test(o.registerEvent))throw Error('Missing host arguments');return o;}
function logger(){const dir=path.join(__dirname,'..','logs'),file=path.join(dir,'streonordock.jsonl');let last='',at=0;return(event,data)=>{try{let entry={time:new Date().toISOString(),event,data};if(JSON.stringify(entry).length>3000)entry.data=JSON.stringify(data).slice(0,2000);const line=JSON.stringify(entry)+'\n';const identity=JSON.stringify({event,data:entry.data});if(identity===last&&Date.now()-at<60000)return;last=identity;at=Date.now();fs.mkdirSync(dir,{recursive:true});if(fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>1048576){const old=file+'.previous';if(fs.existsSync(old))fs.unlinkSync(old);fs.renameSync(file,old);}fs.appendFileSync(file,line);}catch{}};}
async function main(){
 const log=logger();let options;try{options=args(process.argv.slice(2));}catch(e){log('launchError',e.message);return;}
 let config={};try{const file=process.env.STREONORDOCK_CONFIG||path.join(__dirname,'config.json');if(fs.statSync(file).size>65536)throw Error('Config too large');config=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Config must be object');}catch(e){log('configError',e.message);config={};}
 for(const k of ['savedVariablesPath','gamePath','iconDir','gameProcess','logDir'])if(typeof config[k]!=='string'||config[k].length>4096)delete config[k];
 if(config.iconDir&&!path.isAbsolute(config.iconDir))config.iconDir=path.resolve(__dirname,'..',config.iconDir);
 config.iconFallbackDirs=Array.isArray(config.iconFallbackDirs)?config.iconFallbackDirs.filter(d=>typeof d==='string'&&d&&d.length<=4096).slice(0,4).map(d=>path.isAbsolute(d)?d:path.resolve(__dirname,'..',d)):[];
 if(config.gameProcess&&!/^[a-zA-Z0-9_.-]+(?:\.exe)?$/.test(config.gameProcess))delete config.gameProcess;
 const reader=new ExportReader(config),icons=new IconResolver(config,[],e=>log('iconSkipped',e)),contexts=new Map(),held=new Set();let timer=null,busy=false,stopping=false,lastError='';
 // Live estimates: read-only tail of the client chat log (own money/currency gains only), applied on top of the last saved value.
 const estimator=new Estimator(),estimating=config.liveEstimates!==false,est={estimator,marker:config.showEstimateMarker===true};
 const tail=estimating?new ChatTail(typeof config.chatLogPath==='string'&&config.chatLogPath&&path.isAbsolute(config.chatLogPath)&&config.chatLogPath.length<4096?config.chatLogPath:path.join(config.logDir||path.join(config.gamePath||'G:/World of Warcraft/_forever_','Logs'),'WoWChatLog.txt')):null;
 let pressId=0;const heldIds=new Map(),fireOn=config.fireOn==='release'?'release':'press';const timers=new PressTimers(),pending=new Map();
 const dry=process.env.STREONORDOCK_DRY_RUN==='1';
 const relayArgs=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'sender.ps1'),'-Port',options.port,'-GameProcess',config.gameProcess||'Wow.exe','-ParentPid',String(process.pid)];if(dry)relayArgs.push('-DryRun');
 const bridge=spawn('powershell.exe',relayArgs,{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const pendingImages=new Map();
 const procWaiters=new Map();let procReq=0;
 // Game-running check: the relay only COUNTS processes by name (no handle to the game is opened).
 function gameRunning(){return new Promise(resolve=>{const req=++procReq;const t=setTimeout(()=>{procWaiters.delete(req);resolve(null);},4000);procWaiters.set(req,n=>{clearTimeout(t);resolve(n>0);});command({kind:'procCount',req});});}
 const cleanup=new LogCleanup({dir:config.logDir||path.join(config.gamePath||'G:/World of Warcraft/_forever_','Logs'),enabled:config.deleteLogsOnLogout!==false,isRunning:gameRunning,log,retryMs:Number(process.env.STREONORDOCK_LOG_RETRY_MS)||30000});
 let lastExportMtime;
 function command(value){if(!bridge.stdin.destroyed)bridge.stdin.write(JSON.stringify(value)+'\n');}
 function flushImages(){if(stopping||bridge.stdin.destroyed)return;while(pendingImages.size&&bridge.stdin.writableLength<65536){const [context,value]=pendingImages.entries().next().value;pendingImages.delete(context);command({kind:'send',message:JSON.stringify(value)});}}
 bridge.stdin.on('drain',flushImages);
 function send(value){if(value.event==='setImage'){pendingImages.set(value.context,value);flushImages();}else command({kind:'send',message:JSON.stringify(value)});}
 const MAX_TILE_CHARS=40000;
 const encodeTile=svg=>'data:image/svg+xml;charset=utf8,'+encodeURIComponent(svg);
 function draw(context,entry){const s=reader.view();const make=r=>entry.type==='key'?render.slot(s,entry.index,Date.now(),r,timers):entry.type==='readout'?render.readout(s,entry.index,Date.now(),r,timers,est):render.status(s);let svg=make(icons),image=encodeTile(svg);if(image.length>MAX_TILE_CHARS){log('tileTooLarge',{type:entry.type,index:entry.index,chars:image.length});svg=make(null);image=encodeTile(svg);}if(svg===entry.last)return;entry.last=svg;send({event:'setImage',context,payload:{target:0,image}});}
 const redrawMs=Math.max(50,Number(process.env.STREONORDOCK_REDRAW_MS)||30000);let lastFull=Date.now(),firstLogged=false;
 // Heartbeat: forget what we last sent so every visible action is re-sent. Without this a host that dropped an image (page/profile switch, sleep, app restart) stays blank until the snapshot changes.
 async function tick(){if(busy||stopping)return;busy=true;try{if(tail){const lines=await tail.poll();if(lines.length){const added=estimator.addLines(lines);if(added)log('chatDeltas',{added});}}const changed=await reader.poll();if(changed&&reader.snapshot){const mt=reader.snapshot.mtimeMs;if(lastExportMtime!==undefined&&mt!==lastExportMtime)cleanup.request('export-saved');lastExportMtime=mt;}if(changed&&reader.snapshot){log('snapshotLoaded',{file:path.basename(reader.file||''),savedAt:reader.snapshot.savedAt,page:reader.snapshot.page,filled:Object.values(reader.snapshot.slots).filter(x=>x.kind!=='empty').length});}
  if(Date.now()-lastFull>=redrawMs){lastFull=Date.now();for(const [,e]of contexts)e.last=undefined;}
if(reader.error!==lastError){lastError=reader.error;if(lastError)log('snapshotError',lastError);}for(const [context,entry]of contexts)draw(context,entry);if(changed)log('redrawAll',{reason:reader.snapshot?'snapshot':'no-snapshot',contexts:contexts.size});}catch(e){log('tickError',e.message);}finally{busy=false;}}
 const cad=cadence(config);let ticking=false;
 // ONE shared timer: slow cadence normally, fast only while a press timer has <= cad.within seconds left; cancelled when idle.
 function arm(){if(!contexts.size||timer||stopping)return;timer=setTimeout(async()=>{timer=null;await tick();arm();},nextDelay(timers.minLeft(),cad));}
 function ensureTimer(){if(contexts.size){if(!timer&&!ticking){ticking=true;tick().finally(()=>{ticking=false;arm();});}}else if(timer){clearTimeout(timer);timer=null;}}
 function releaseContext(context){const e=contexts.get(context);heldIds.delete(context);if(e?.type==='key')held.delete(context);}
 function handle(m){
  if(typeof m.context!=='string'||m.context.length>256)return;
  if(m.event==='willAppear'){
   if(contexts.size>=128&&!contexts.has(m.context))return;
   const match=new RegExp('^'+PREFIX.replace(/\./g,'\\.')+'(key(1[0-5]|[1-9])|readout([1-3])|status)$').exec(m.action||'');if(!match)return;
   if(!firstLogged){firstLogged=true;log('firstAppear',{snapshot:!!reader.snapshot,error:reader.error});}
   releaseContext(m.context);const entry={type:match[2]?'key':match[3]?'readout':'status',index:Number(match[2]||match[3]||0)};contexts.set(m.context,entry);draw(m.context,entry);ensureTimer();
  }else if(m.event==='willDisappear'){releaseContext(m.context);contexts.delete(m.context);pendingImages.delete(m.context);ensureTimer();}
  else if(m.event==='keyDown'||m.event==='keyUp'){
   const e=contexts.get(m.context);if(e?.type!=='key')return;const down=m.event==='keyDown';
   // One physical press = at most ONE tap (down ~30 ms up) sent to the game, on press or on release (config fireOn).
   // Auto-repeat/held keys never repeat: a second keyDown is ignored until the matching keyUp.
   if(down){
    if(held.has(m.context))return;held.add(m.context);const id=++pressId;heldIds.set(m.context,id);
    if(pending.size>=128)pending.delete(pending.keys().next().value);pending.set(id,{slot:e.index,item:reader.view()?.slots?.[e.index]});
    if(fireOn==='press')command({kind:'tap',slot:e.index,pressId:id});
   }else{
    if(!held.delete(m.context))return;const id=heldIds.get(m.context);heldIds.delete(m.context);
    if(fireOn==='release'&&id!==undefined)command({kind:'tap',slot:e.index,pressId:id});
   }
  }else if(m.event==='didReceiveSettings'){const e=contexts.get(m.context);if(e)draw(m.context,e);}
 }
 function stop(){if(stopping)return;stopping=true;cleanup.stop();if(timer)clearInterval(timer);command({kind:'stop'});bridge.stdin.end();const deadline=setTimeout(()=>bridge.kill(),3000);deadline.unref();}
 bridge.stdin.on('error',e=>log('relayInputError',e.message));bridge.stderr.on('data',d=>log('relayStderr',d.toString().slice(0,1000)));
 bridge.on('error',e=>{log('relayError',e.message);stop();});bridge.on('exit',code=>{log('relayExit',code);if(timer)clearInterval(timer);process.stdin.pause();process.exitCode=code||0;});
 readline.createInterface({input:bridge.stdout}).on('line',line=>{if(line.length>2*1048576)return;try{const m=JSON.parse(line);if(m.bridge){if(dry)process.stdout.write(JSON.stringify(m)+'\n');if(m.bridge==='procs'){const w=procWaiters.get(m.req);procWaiters.delete(m.req);if(w)w(Number(m.count)||0);return;}if(m.bridge==='disconnected')log('hostDisconnected',m);if(m.bridge==='ready'){cleanup.request('start');send({event:options.registerEvent,uuid:options.pluginUUID});log('started',{dryRun:dry});}else{log('relay',m);if(m.bridge==='accepted'||m.bridge==='refused'){const p=pending.get(m.pressId);pending.delete(m.pressId);if(m.bridge==='accepted'&&p?.slot===m.slot&&p.item&&timers.start(p.item)){log('timerStarted',{slot:m.slot,seconds:p.item.cooldownSeconds,pool:p.item.poolKey});for(const [context,e]of contexts)draw(context,e);}}if(m.bridge==='refused'||m.bridge==='error'){for(const [context,e]of contexts)if(e.type==='key'&&(!m.slot||e.index===m.slot))send({event:'showAlert',context});}}}else handle(m);}catch(e){log('messageError',e.message);}});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('uncaughtException',e=>{log('fatal',e.message);stop();});process.on('unhandledRejection',e=>{log('fatal',String(e));stop();});
 // Host-launched plugins may have stdin closed; only the harness uses stdin EOF to stop.
 if(dry){process.stdin.resume();process.stdin.on('end',stop);}
}
if(require.main===module)main();
module.exports={args};
