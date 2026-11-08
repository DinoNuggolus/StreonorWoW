'use strict';
// Reproducible manifest + simple original grid icon. No downloads or dependencies.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../src/io.github.dinonuggolus.streonordock.sdPlugin');
const action=(id,name,controller,tip)=>({UUID:'io.github.dinonuggolus.streonordock.'+id,Name:name,Icon:'images/icon.png',Controllers:[controller],States:[{Image:'images/icon.png',ShowTitle:false}],SupportedInMultiActions:false,UserTitleEnabled:false,Tooltip:tip});
const Actions=Array.from({length:15},(_,i)=>action('key'+(i+1),'Dock Key '+(i+1),'Keypad','Fixed ALT-CTRL-SHIFT chord; icon and cooldown from saved addon data.'));
for(let i=1;i<=3;i++)Actions.push(action('readout'+i,'Dock Readout '+i,'Information','Item icon and cooldown from saved addon data. Display only.'));
Actions.push(action('status','Dock Status','Information','StreonorDock page; replaces one readout on the S15.'));
const manifest={SDKVersion:1,Author:'DinoNuggolus',Name:'StreonorDock',Icon:'images/icon.png',Category:'StreonorDock',CategoryIcon:'images/icon.png',Description:'15 fixed WoW chords and item icon and cooldown displays.',Version:'0.1.0',CodePathWin:'plugin/index.js',OS:[{Platform:'windows',MinimumVersion:'10'}],Software:{MinimumVersion:'3.10.188.226'},Nodejs:{Version:'20'},Actions};
fs.mkdirSync(path.join(root,'images'),{recursive:true});fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(128,0);ihdr.writeUInt32BE(128,4);ihdr[8]=8;ihdr[9]=2;
const raw=Buffer.alloc(128*(1+128*3));for(let y=0;y<128;y++)for(let x=0;x<128;x++){const tile=x>=19&&x<109&&y>=10&&y<118&&((x-19)%32<26)&&((y-10)%22<17),offset=y*385+1+x*3;raw.set(tile?[77,160,126]:[16,24,32],offset);}
fs.writeFileSync(path.join(root,'images/icon.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
