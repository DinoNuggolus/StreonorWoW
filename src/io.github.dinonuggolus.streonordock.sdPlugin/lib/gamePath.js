'use strict';
// Finds the WoW: Forever install when config.gamePath is empty: every drive letter, the usual folders.
// Returns the first folder that contains WTF\Account; otherwise the most common default (the export reader then
// reports "no saved export" and the keys stay blank until the path is configured).
const fs=require('node:fs'),path=require('node:path');
const FLAVOR='_forever_';
function candidates(drives){
 const out=[];
 for(const d of drives)for(const sub of ['World of Warcraft','Program Files (x86)\\World of Warcraft','Program Files\\World of Warcraft','Games\\World of Warcraft'])out.push(`${d}:\\${sub}\\${FLAVOR}`);
 return out;
}
function detectGamePath(exists=fs.existsSync,drives='CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')){
 const list=candidates(drives);
 for(const c of list){try{if(exists(path.join(c,'WTF','Account')))return c;}catch(e){}}
 return list[0];
}
module.exports={detectGamePath,candidates};
