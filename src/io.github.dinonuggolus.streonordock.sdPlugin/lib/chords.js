'use strict';
const keys=['1','2','3','4','5','6','7','8','9','0','-','=','[',']','\\'];
const vks=[49,50,51,52,53,54,55,56,57,48,0xBD,0xBB,0xDB,0xDD,0xDC];
const scans=[2,3,4,5,6,7,8,9,10,11,12,13,26,27,43];
function chord(slot){return Number.isInteger(slot)&&slot>=1&&slot<=15?'ALT-CTRL-SHIFT-'+keys[slot-1]:null;}
function plan(slot,down){if(!chord(slot))throw Error('Invalid slot');const steps=[{vk:0xA2,scan:29,up:false},{vk:0xA0,scan:42,up:false},{vk:0xA4,scan:56,up:false},{vk:vks[slot-1],scan:scans[slot-1],up:false}];return down?steps:steps.reverse().map(x=>({...x,up:true}));}
module.exports={chord,plan};
