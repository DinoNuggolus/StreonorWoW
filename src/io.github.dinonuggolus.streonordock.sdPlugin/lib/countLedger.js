'use strict';
// In-memory display logic only. No clocks, files, input or game API calls.
const MAX_COUNT=999999;
const count=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?Math.min(MAX_COUNT,Math.floor(v)):undefined;
class CountLedger {
 constructor(consumableItemIds=[]){
  this.consumables=new Set((Array.isArray(consumableItemIds)?consumableItemIds:[]).filter(id=>Number.isInteger(id)&&id>0&&id<=2147483647));
  this.signature=null;this.generation={};this.presses=new Map();this.accepted=new WeakSet();
 }
 load(snapshot){
  // Deliberately reset everything on a different savedAt/export/mtime rather than
  // guess which presses a delayed save already includes. Age/stale are view-only.
  const signature=snapshot?JSON.stringify([snapshot.savedAt,snapshot.mtimeMs,snapshot.page,snapshot.slots,snapshot.readouts]):null;
  if(signature!==this.signature){this.signature=signature;this.generation={};this.presses.clear();}
  this.snapshot=snapshot;
 }
 capture(slot){
  const item=Number.isInteger(slot)&&slot>=1&&slot<=15?this.snapshot?.slots?.[slot]:null;
  if(item?.kind!=='item'||!this.consumables.has(item.id)||count(item.count)===undefined)return null;
  return {generation:this.generation,slot,id:item.id};
 }
 accept(token){
  if(!token||token.generation!==this.generation||this.accepted.has(token))return;
  this.accepted.add(token);this.presses.set(token.id,Math.min(MAX_COUNT,(this.presses.get(token.id)||0)+1));
 }
 view(snapshot){
  if(!snapshot)return null;
  let estimated=false;
  const area=entries=>Object.fromEntries(Object.entries(entries||{}).map(([i,item])=>{
   const n=count(item.count),used=item.kind==='item'?this.presses.get(item.id||item.itemID)||0:0;
   if(n===undefined)return [i,item];
   if(used)estimated=true;
   return [i,{...item,count:Math.max(0,n-used),countEstimated:used>0}];
  }));
  const slots=area(snapshot.slots),readouts=area(snapshot.readouts);
  return {...snapshot,slots,readouts,countsEstimated:estimated};
 }
}
module.exports={CountLedger};
