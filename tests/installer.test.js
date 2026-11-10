'use strict';
// Installer logic against temp folders only. Never touches the real Streonor plugins folder or process
// (a process name that cannot exist is passed, and every run uses -PluginsDir).
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(__dirname,'..'),ID='io.github.dinonuggolus.streonordock.sdPlugin';
const NOPROC='StreonorDockTestNoSuchProcess';
// Personal identifiers must never ship (pattern assembled from parts so this file does not contain them).
const PERSONAL=new RegExp(['al'+'exv','vell'+'ucci','\\b'+'al'+'ex\\b','[A-Za-z]:\\\\(?!Program Files)[A-Za-z]'].join('|'),'i');
function ps(args,opts={}){return cp.spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass',...args],{encoding:'utf8',timeout:120000,...opts});}
function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'sd-inst-'));}
function build(){const out=tmp();const r=ps(['-File',path.join(root,'scripts','build-release.ps1'),'-OutDir',out]);a.equal(r.status,0,r.stdout+r.stderr);
 const zip=fs.readdirSync(out).find(f=>/^StreonorDock-Plugin-\d+\.\d+\.\d+\.zip$/.test(f));a.ok(zip,'zip built');return {out,zip:path.join(out,zip)};}
function entries(zip){const r=ps(['-Command',`Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${zip}'); $z.Entries|%{$_.FullName}; $z.Dispose()`]);a.equal(r.status,0,r.stderr);return r.stdout.split(/\r?\n/).filter(Boolean);}
function extract(zip){const d=tmp();const r=ps(['-Command',`Expand-Archive -LiteralPath '${zip}' -DestinationPath '${d}' -Force`]);a.equal(r.status,0,r.stderr);return path.join(d,fs.readdirSync(d)[0]);}
function install(src,plugins,extra=[]){return ps(['-File',path.join(src,'Install-StreonorDock.ps1'),'-PluginsDir',plugins,'-Source',src,'-ProcessName',NOPROC,'-Yes','-NoPause','-NoRestart',...extra]);}

test('release zip: only plugin files, installer, README and LICENSE; no art, logs, state or personal strings',()=>{
 const {zip}=build(),names=entries(zip);
 for(const n of names){a.ok(!n.includes('\\'),'forward slashes: '+n);a.doesNotMatch(n,/(^|\/)(logs|icons|icon-library|icon-library-144|icon-cache|state|tests|docs|_backups)(\/|$)/i,n);a.doesNotMatch(n,/config\.local\.json|\.previous$|\.jsonl$/i,n);}
 const pngs=names.filter(n=>/\.(png|jpe?g|webp|gif|blp|tga)$/i.test(n));a.deepEqual(pngs.map(n=>n.replace(/^[^/]+\//,'')),[`${ID}/images/icon.png`],'only the plugin\'s own icon');
 for(const need of [`${ID}/manifest.json`,`${ID}/plugin/index.js`,`${ID}/plugin/sender.ps1`,`${ID}/plugin/config.json`,'Install StreonorDock Plugin.bat','Uninstall StreonorDock Plugin.bat','Install-StreonorDock.ps1','README.txt','LICENSE'])a.ok(names.some(n=>n.endsWith('/'+need)),'missing '+need);
 const dir=extract(zip);
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 for(const f of walk(dir)){if(/\.png$/i.test(f))continue;const t=fs.readFileSync(f,'utf8');a.doesNotMatch(t,PERSONAL,f);}
 const cfg=JSON.parse(fs.readFileSync(path.join(dir,ID,'plugin','config.json'),'utf8'));a.equal(cfg.gamePath,'');a.equal(cfg.iconDir,'');
 const bat=fs.readFileSync(path.join(dir,'Install StreonorDock Plugin.bat'),'utf8');a.match(bat,/-ExecutionPolicy Bypass/);a.match(bat,/\r\n/);
});
test('install into an empty plugins folder; dry run changes nothing',()=>{
 const src=extract(build().zip),plugins=tmp();
 const dry=install(src,plugins,['-DryRun']);a.equal(dry.status,0,dry.stdout+dry.stderr);a.match(dry.stdout,/dry run/);a.deepEqual(fs.readdirSync(plugins),[]);
 const r=install(src,plugins);a.equal(r.status,0,r.stdout+r.stderr);
 a.ok(fs.existsSync(path.join(plugins,ID,'manifest.json')));a.ok(fs.existsSync(path.join(plugins,ID,'plugin','index.js')));
 a.match(r.stdout,/Dock Key 1/);a.match(r.stdout,/bottom-left/);a.deepEqual(fs.readdirSync(plugins),[ID]);
});
test('update: existing copy is backed up outside the plugins folder; user files and sibling plugins survive',()=>{
 const src=extract(build().zip),base=tmp(),plugins=path.join(base,'plugins');fs.mkdirSync(plugins);
 const target=path.join(plugins,ID);fs.mkdirSync(path.join(target,'icons'),{recursive:true});fs.mkdirSync(path.join(target,'logs'));
 fs.writeFileSync(path.join(target,'manifest.json'),'{"Version":"0.0.1"}');fs.writeFileSync(path.join(target,'icons','136096.png'),'x');
 fs.writeFileSync(path.join(target,'config.local.json'),'{"gamePath":"X:\\\\Game"}');fs.writeFileSync(path.join(target,'logs','a.jsonl'),'l');
 const sibling=path.join(plugins,'com.example.other.sdPlugin');fs.mkdirSync(sibling);fs.writeFileSync(path.join(sibling,'manifest.json'),'other');
 const r=install(src,plugins);a.equal(r.status,0,r.stdout+r.stderr);
 a.notEqual(JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8')).Version,'0.0.1');
 a.equal(fs.readFileSync(path.join(target,'icons','136096.png'),'utf8'),'x');a.ok(fs.existsSync(path.join(target,'config.local.json')));a.ok(fs.existsSync(path.join(target,'logs','a.jsonl')));
 a.equal(fs.readFileSync(path.join(sibling,'manifest.json'),'utf8'),'other');
 const backups=fs.readdirSync(path.join(base,'plugin-backups'));a.equal(backups.length,1);a.match(backups[0],new RegExp('^'+ID.replace(/\./g,'\\.')+'-\\d{8}-\\d{6}$'));
 a.deepEqual(fs.readdirSync(plugins).sort(),['com.example.other.sdPlugin',ID].sort(),'no backup inside the plugins folder');
});
test('uninstall removes only this plugin and keeps a backup',()=>{
 const src=extract(build().zip),base=tmp(),plugins=path.join(base,'plugins');fs.mkdirSync(plugins);
 const other=path.join(plugins,'com.example.other.sdPlugin');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'m'),'1');
 a.equal(install(src,plugins).status,0);
 const dry=install(src,plugins,['-Uninstall','-DryRun']);a.equal(dry.status,0);a.ok(fs.existsSync(path.join(plugins,ID)));
 const r=install(src,plugins,['-Uninstall']);a.equal(r.status,0,r.stdout+r.stderr);
 a.ok(!fs.existsSync(path.join(plugins,ID)));a.ok(fs.existsSync(path.join(other,'m')));a.equal(fs.readdirSync(path.join(base,'plugin-backups')).length,1);
 const again=install(src,plugins,['-Uninstall']);a.equal(again.status,0);a.match(again.stdout,/not installed/);
});
test('clear errors: no Streonor folders, or plugin files missing next to the installer',()=>{
 const src=extract(build().zip);
 const none=install(src,path.join(tmp(),'nope','plugins'));a.equal(none.status,1);a.match(none.stdout,/Streonor's plugin folder was not found/);
 const empty=tmp(),plugins=tmp();
 fs.copyFileSync(path.join(src,'Install-StreonorDock.ps1'),path.join(empty,'Install-StreonorDock.ps1'));
 const miss=install(empty,plugins);a.equal(miss.status,1);a.match(miss.stdout,/plugin files were not found/);a.deepEqual(fs.readdirSync(plugins),[]);
});
test('the .bat wrappers call the installer with ExecutionPolicy Bypass and the right switch',()=>{
 const i=fs.readFileSync(path.join(root,'installer','Install StreonorDock Plugin.bat'),'utf8'),u=fs.readFileSync(path.join(root,'installer','Uninstall StreonorDock Plugin.bat'),'utf8');
 a.match(i,/powershell\.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-StreonorDock\.ps1"\r?\n/);a.doesNotMatch(i,/-Uninstall/);
 a.match(u,/-ExecutionPolicy Bypass -File "%~dp0Install-StreonorDock\.ps1" -Uninstall/);
});
