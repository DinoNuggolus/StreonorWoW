'use strict';
// Redraw cadence for the single shared tick: slow normally, fast only while a timer has <= within seconds left.
const clampMs=(v,d)=>Number.isFinite(Number(v))&&Number(v)>=100&&Number(v)<=60000?Math.floor(Number(v)):d;
function cadence(config={}){return {slow:clampMs(config.redrawIntervalMs,1000),fast:clampMs(config.fastRedrawIntervalMs,500),within:Number.isFinite(Number(config.fastRedrawWithinSeconds))&&Number(config.fastRedrawWithinSeconds)>=0?Math.min(600,Number(config.fastRedrawWithinSeconds)):10};}
const nextDelay=(minLeft,cad)=>minLeft<=cad.within?Math.min(cad.fast,cad.slow):cad.slow;
module.exports={cadence,nextDelay,clampMs};
