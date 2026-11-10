'use strict';
// StreonorDock controller plugin: 15 fixed chord keys whose tiles show only the icon from the addon's minimal export.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
const {ExportReader}=require('../lib/exportReader'),{IconResolver}=require('../lib/icons'),render=require('../lib/render');
const PREFIX='io.github.dinonuggolus.streonordock.';
function args(argv){const o={};for(let i=0;i<argv.length;i+=2){if(!/^-(port|pluginUUID|registerEvent|info)$/.test(argv[i])||argv[i+1]===undefined)throw Error('Invalid host arguments');o[argv[i].slice(1)]=argv[i+1];}if(!/^\d+$/.test(o.port)||+o.port<1||+o.port>65535||!o.pluginUUID||o.pluginUUID.length>256||!/^registerPlugin$/.test(o.registerEvent))throw Error('Missing host arguments');return o;}
// Plugin's own diagnostics only (its logs/ folder); rotation renames, nothing is ever deleted.
function logger(){const dir=path.join(__dirname,'..','logs'),file=path.join(dir,'streonordock.jsonl');let last='',at=0;return(event,data)=>{try{let entry={time:new Date().toISOString(),event,data};if(JSON.stringify(entry).length>3000)entry.data=JSON.stringify(data).slice(0,2000);const line=JSON.stringify(entry)+'\n';const identity=JSON.stringify({event,data:entry.data});if(identity===last&&Date.now()-at<60000)return;last=identity;at=Date.now();fs.mkdirSync(dir,{recursive:true});if(fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>1048576)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,line);}catch{}};}
async function main(){
 const log=logger();let options;try{options=args(process.argv.slice(2));}catch(e){log('launchError',e.message);return;}
 let config={};try{const file=process.env.STREONORDOCK_CONFIG||path.join(__dirname,'config.json');if(fs.statSync(file).size>65536)throw Error('Config too large');config=JSON.parse(fs.readFileSync(file,'utf8').replace(/^﻿/,''));if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Config must be object');}catch(e){log('configError',e.message);config={};}
 // Optional per-machine overrides (never shipped, never overwritten by the installer).
 try{const fileLocal=path.join(__dirname,'config.local.json');if(!process.env.STREONORDOCK_CONFIG&&fs.existsSync(fileLocal)&&fs.statSync(fileLocal).size<=65536){const extra=JSON.parse(fs.readFileSync(fileLocal,'utf8').replace(/^﻿/,''));if(extra&&typeof extra==='object'&&!Array.isArray(extra))config={...config,...extra};}}catch(e){log('configLocalError',e.message);}
 for(const k of ['savedVariablesPath','gamePath','iconDir','gameProcess'])if(typeof config[k]!=='string'||config[k].length>4096)delete config[k];
 if(config.iconDir&&!path.isAbsolute(config.iconDir))config.iconDir=path.resolve(__dirname,'..',config.iconDir);
 config.iconFallbackDirs=Array.isArray(config.iconFallbackDirs)?config.iconFallbackDirs.filter(d=>typeof d==='string'&&d&&d.length<=4096).slice(0,4).map(d=>path.isAbsolute(d)?d:path.resolve(__dirname,'..',d)):[];
 // The icon builder writes here (outside the plugin folder, so updates and the installer never touch it).
 if(process.env.LOCALAPPDATA&&config.iconFallbackDirs.length<8)config.iconFallbackDirs.push(path.join(process.env.LOCALAPPDATA,'StreonorDock','icons'));
 if(config.gameProcess&&!/^[a-zA-Z0-9_.-]+(?:\.exe)?$/.test(config.gameProcess))delete config.gameProcess;
 const reader=new ExportReader(config),icons=new IconResolver(config,[],e=>log('iconSkipped',e)),contexts=new Map(),held=new Set();let timer=null,busy=false,stopping=false,lastError='';
 let pressId=0;const heldIds=new Map(),fireOn=config.fireOn==='release'?'release':'press';
 const dry=process.env.STREONORDOCK_DRY_RUN==='1';
 const relayArgs=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'sender.ps1'),'-Port',options.port,'-GameProcess',config.gameProcess||'Wow.exe','-ParentPid',String(process.pid)];if(dry)relayArgs.push('-DryRun');
 const bridge=spawn('powershell.exe',relayArgs,{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const pendingImages=new Map();
 function command(value){if(!bridge.stdin.destroyed)bridge.stdin.write(JSON.stringify(value)+'\n');}
 function flushImages(){if(stopping||bridge.stdin.destroyed)return;while(pendingImages.size&&bridge.stdin.writableLength<65536){const [context,value]=pendingImages.entries().next().value;pendingImages.delete(context);command({kind:'send',message:JSON.stringify(value)});}}
 bridge.stdin.on('drain',flushImages);
 function send(value){if(value.event==='setImage'){pendingImages.set(value.context,value);flushImages();}else command({kind:'send',message:JSON.stringify(value)});}
 const MAX_TILE_CHARS=40000;
 const encodeTile=svg=>'data:image/svg+xml;charset=utf8,'+encodeURIComponent(svg);
 function draw(context,entry){const s=reader.view();let svg=render.slot(s,entry.index,icons),image=encodeTile(svg);if(image.length>MAX_TILE_CHARS){log('tileTooLarge',{index:entry.index,chars:image.length});svg=render.slot(s,entry.index,null);image=encodeTile(svg);}if(svg===entry.last)return;entry.last=svg;send({event:'setImage',context,payload:{target:0,image}});}
 const pollMs=Number.isFinite(Number(config.pollIntervalMs))&&Number(config.pollIntervalMs)>=250&&Number(config.pollIntervalMs)<=60000?Math.floor(Number(config.pollIntervalMs)):1000;
 const redrawMs=Math.max(50,Number(process.env.STREONORDOCK_REDRAW_MS)||30000);let lastFull=Date.now(),firstLogged=false;
 // File-change check for icon sync only (no game-state polling). The heartbeat re-sends every visible tile so a host
 // that dropped an image (page/profile switch, sleep, app restart) recovers.
 async function tick(){if(busy||stopping)return;busy=true;try{const changed=await reader.poll();
  if(changed&&reader.snapshot)log('exportLoaded',{file:path.basename(reader.file||''),schema:reader.snapshot.schema,enabled:reader.snapshot.enabled,page:reader.snapshot.page,filled:Object.values(reader.snapshot.icons).filter(x=>x!==undefined).length});
  if(Date.now()-lastFull>=redrawMs){lastFull=Date.now();for(const [,e]of contexts)e.last=undefined;}
  if(reader.error!==lastError){lastError=reader.error;if(lastError)log('exportError',lastError);}
  for(const [context,entry]of contexts)draw(context,entry);}catch(e){log('tickError',e.message);}finally{busy=false;}}
 function arm(){if(!contexts.size||timer||stopping)return;timer=setTimeout(async()=>{timer=null;await tick();arm();},pollMs);}
 let ticking=false;
 function ensureTimer(){if(contexts.size){if(!timer&&!ticking){ticking=true;tick().finally(()=>{ticking=false;arm();});}}else if(timer){clearTimeout(timer);timer=null;}}
 function releaseContext(context){heldIds.delete(context);held.delete(context);}
 function handle(m){
  if(typeof m.context!=='string'||m.context.length>256)return;
  if(m.event==='willAppear'){
   if(contexts.size>=128&&!contexts.has(m.context))return;
   // Only the 15 key actions render. Any other (obsolete) placed action is inert: no image, no state, no crash.
   const match=new RegExp('^'+PREFIX.replace(/\./g,'\\.')+'key(1[0-5]|[1-9])$').exec(m.action||'');if(!match)return;
   if(!firstLogged){firstLogged=true;log('firstAppear',{export:!!reader.snapshot,error:reader.error});}
   releaseContext(m.context);const entry={index:Number(match[1])};contexts.set(m.context,entry);draw(m.context,entry);ensureTimer();
  }else if(m.event==='willDisappear'){releaseContext(m.context);contexts.delete(m.context);pendingImages.delete(m.context);ensureTimer();}
  else if(m.event==='keyDown'||m.event==='keyUp'){
   const e=contexts.get(m.context);if(!e)return;const down=m.event==='keyDown';
   // One physical press = at most ONE tap (down ~30 ms up) sent to the game, on press or on release (config fireOn).
   // Auto-repeat/held keys never repeat: a second keyDown is ignored until the matching keyUp. Export state never gates chords.
   if(down){
    if(held.has(m.context))return;held.add(m.context);const id=++pressId;heldIds.set(m.context,id);
    if(fireOn==='press')command({kind:'tap',slot:e.index,pressId:id});
   }else{
    if(!held.delete(m.context))return;const id=heldIds.get(m.context);heldIds.delete(m.context);
    if(fireOn==='release'&&id!==undefined)command({kind:'tap',slot:e.index,pressId:id});
   }
  }else if(m.event==='didReceiveSettings'){const e=contexts.get(m.context);if(e)draw(m.context,e);}
 }
 function stop(){if(stopping)return;stopping=true;if(timer)clearTimeout(timer);command({kind:'stop'});bridge.stdin.end();const deadline=setTimeout(()=>bridge.kill(),3000);deadline.unref();}
 bridge.stdin.on('error',e=>log('relayInputError',e.message));bridge.stderr.on('data',d=>log('relayStderr',d.toString().slice(0,1000)));
 bridge.on('error',e=>{log('relayError',e.message);stop();});bridge.on('exit',code=>{log('relayExit',code);if(timer)clearTimeout(timer);process.stdin.pause();process.exitCode=code||0;});
 readline.createInterface({input:bridge.stdout}).on('line',line=>{if(line.length>2*1048576)return;try{const m=JSON.parse(line);if(m.bridge){if(dry)process.stdout.write(JSON.stringify(m)+'\n');if(m.bridge==='disconnected')log('hostDisconnected',m);if(m.bridge==='ready'){send({event:options.registerEvent,uuid:options.pluginUUID});log('started',{dryRun:dry});}else log('relay',m);}else handle(m);}catch(e){log('messageError',e.message);}});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('uncaughtException',e=>{log('fatal',e.message);stop();});process.on('unhandledRejection',e=>{log('fatal',String(e));stop();});
 // Host-launched plugins may have stdin closed; only the harness uses stdin EOF to stop.
 if(dry){process.stdin.resume();process.stdin.on('end',stop);}
}
if(require.main===module)main();
module.exports={args};
