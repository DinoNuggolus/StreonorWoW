'use strict';
// Parses ONE line of the client's WoWChatLog.txt into a value change for the PLAYER's own money or
// currency. Conservative on purpose:
//  - the line must start with the log timestamp and the message text must START with one of the known
//    self-message formats (other players' chat always carries a "[Channel] Name:" / "Name says:" prefix,
//    so it can never match);
//  - the money / link part must match completely; anything else is ignored, never guessed;
//  - only gains with a known client format are produced. Spending (vendor purchases, repairs, mail,
//    auction) has no chat line, so it is corrected only by the next /reload.
// Formats are the enUS client strings (YOU_LOOT_MONEY, LOOT_MONEY_SPLIT, CURRENCY_GAINED*,
// COMBATLOG_HONORAWARD). To add a rule, add an entry to RULES and a fixture line to the tests.
const MAX_LINE=2000;
const STAMP=/^(\d{1,2})\/(\d{1,2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\s{1,2}(.*)$/s;
const UNIT='(?:\\d{1,9}) (?:Gold|Silver|Copper)';
const MONEY=`(${UNIT}(?:,? ${UNIT}){0,2})`;
const LINK='(?:(?:\\|c[0-9a-fA-F]{8})?\\|Hcurrency:(\\d{1,9})[^|]*\\|h\\[([^\\]|]{1,60})\\]\\|h(?:\\|r)?|\\[([^\\]|]{1,60})\\])';
const RULES=[
 {id:'loot-money',re:new RegExp(`^You loot ${MONEY}\\.$`),build:m=>({kind:'money',copper:copper(m[1])})},
 {id:'share-money',re:new RegExp(`^Your share of the loot is ${MONEY}\\.$`),build:m=>({kind:'money',copper:copper(m[1])})},
 {id:'currency',re:new RegExp(`^You receive currency: ${LINK}(?: ?x(\\d{1,9}))?\\.(?: \\([^)]{0,60}\\))?$`),
  build:m=>({kind:'currency',currencyID:m[1]?Number(m[1]):undefined,name:m[2]||m[3],amount:m[4]?Number(m[4]):1})},
 {id:'honor',re:/^You have been awarded (\d{1,9}) honor points\.$/,build:m=>({kind:'currency',name:'Honor',amount:Number(m[1])})},
];
function copper(text){
 let total=0;for(const part of text.matchAll(/(\d+) (Gold|Silver|Copper)/g)){const n=Number(part[1]);total+=part[2]==='Gold'?n*10000:part[2]==='Silver'?n*100:n;}
 return total;
}
// Log lines carry no year: assume the current one, or the previous when that would be far in the future.
function stampToMs(m,now){
 const d=new Date(new Date(now).getFullYear(),Number(m[1])-1,Number(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]));
 if(d.getMonth()!==Number(m[1])-1)return undefined;
 let t=d.getTime();if(t>now+36*3600*1000)t=new Date(d.getFullYear()-1,d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()).getTime();
 return t;
}
function parseLine(line,now=Date.now()){
 if(typeof line!=='string'||line.length>MAX_LINE)return null;
 const stamp=STAMP.exec(line.replace(/[\r\n]+$/,''));if(!stamp)return null;
 const text=stamp[7];
 for(const rule of RULES){
  const m=rule.re.exec(text);if(!m)continue;
  const t=stampToMs(stamp,now);if(t===undefined)return null;
  const change=rule.build(m);
  if(change.kind==='money'&&!(change.copper>0))return null;
  if(change.kind==='currency'&&!(Number.isInteger(change.amount)&&change.amount>0))return null;
  return {t,rule:rule.id,key:`${stamp[1]}/${stamp[2]} ${stamp[3]}:${stamp[4]}:${stamp[5]}.${stamp[6]}|${text}`,...change};
 }
 return null;
}
module.exports={parseLine,copper,RULES};
