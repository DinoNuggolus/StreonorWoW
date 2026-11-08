'use strict';
// Live estimate = exact value from the last SAVED export + the player's own gains read from the chat
// log AFTER that save. A new save (different savedAt) is the new truth: only deltas stamped after it
// are kept in effect, everything older is already inside the saved value. Memory is bounded.
const {parseLine}=require('./chatParser');
const MAX_DELTAS=2000, MAX_SEEN=2000, MAX_AGE_MS=48*3600*1000;
class Estimator{
 constructor(deps={}){this.now=deps.now||Date.now;this.deltas=[];this.seen=new Set();this.applied=0;this.ignored=0;}
 addLines(lines){
  let added=0;const now=this.now();
  for(const line of lines){
   const d=parseLine(line,now);if(!d){this.ignored++;continue;}
   if(this.seen.has(d.key))continue;                 // duplicate line (re-read after rotation, repeated flush)
   this.seen.add(d.key);if(this.seen.size>MAX_SEEN)this.seen.delete(this.seen.values().next().value);
   this.deltas.push(d);added++;this.applied++;
  }
  if(this.deltas.length>MAX_DELTAS)this.deltas.splice(0,this.deltas.length-MAX_DELTAS);
  const old=now-MAX_AGE_MS;if(this.deltas.length&&this.deltas[0].t<old)this.deltas=this.deltas.filter(d=>d.t>=old);
  return added;
 }
 // Deltas that happened after the save second ended (savedAt is server seconds = epoch seconds).
 after(savedAt){const cut=(savedAt+1)*1000;return this.deltas.filter(d=>d.t>=cut);}
 // entry: normalized readout ({kind:'money',copper} | {kind:'currency',currencyID,name,quantity,maxQuantity}).
 // Returns {value, estimated} or null when the entry has no numeric baseline.
 value(entry,savedAt){
  if(!entry||!Number.isFinite(savedAt))return null;
  const pending=this.after(savedAt);
  if(entry.kind==='money'){
   if(!Number.isFinite(entry.copper))return null;
   const sum=pending.reduce((n,d)=>d.kind==='money'?n+d.copper:n,0);
   return {value:entry.copper+sum,estimated:sum!==0};
  }
  if(entry.kind==='currency'){
   if(!Number.isFinite(entry.quantity))return null;
   const name=typeof entry.name==='string'?entry.name.toLowerCase():undefined;
   const sum=pending.reduce((n,d)=>{
    if(d.kind!=='currency')return n;
    const match=d.currencyID!==undefined&&entry.currencyID!==undefined?d.currencyID===entry.currencyID:(name!==undefined&&typeof d.name==='string'&&d.name.toLowerCase()===name);
    return match?n+d.amount:n;
   },0);
   let value=entry.quantity+sum;if(Number.isFinite(entry.maxQuantity)&&entry.maxQuantity>0)value=Math.min(value,entry.maxQuantity);
   return {value,estimated:value!==entry.quantity};
  }
  return null;
 }
}
module.exports={Estimator,MAX_DELTAS};
