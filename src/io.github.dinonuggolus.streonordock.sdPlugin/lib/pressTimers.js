'use strict';
// Plugin-side, press-started cooldown timers. In-memory only (lost on plugin restart). No I/O.
// A timer starts when the sender ACCEPTS a physical press on an item slot whose export entry carries
// a known cooldownSeconds. Timers are keyed by the entry's poolKey (items sharing a lock share one
// timer) or by item. A press while that timer runs never restarts or extends it.
const keyOf=item=>typeof item.poolKey==='string'?item.poolKey:`item:${item.id||item.itemID}`;
const known=item=>item?.kind==='item'&&Number.isFinite(item.cooldownSeconds)&&item.cooldownSeconds>1.5&&item.cooldownSeconds<=86400&&(item.id||item.itemID)>0;
class PressTimers {
 constructor(now=Date.now){this.now=now;this.ends=new Map();}
 start(item){
  if(!known(item))return false;const now=this.now(),key=keyOf(item);
  if((this.ends.get(key)||0)>now)return false;
  this.ends.set(key,now+item.cooldownSeconds*1000);return true;
 }
 // Seconds left (> 0) or 0.
 remaining(item){
  if(item?.kind!=='item')return 0;const end=this.ends.get(keyOf(item));if(!end)return 0;
  const left=(end-this.now())/1000;if(left<=0){this.ends.delete(keyOf(item));return 0;}return left;
 }
 active(){const now=this.now();for(const [k,end] of this.ends){if(end>now)return true;this.ends.delete(k);}return false;}
}
module.exports={PressTimers,known,keyOf};
