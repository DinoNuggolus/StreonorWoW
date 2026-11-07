'use strict';
// Data grammar only. No Lua expressions, functions, metatables, or execution.
const MAX_BYTES=5*1024*1024, MAX_DEPTH=64, MAX_ENTRIES=200000;
function parse(input) {
 if(typeof input!=='string'||Buffer.byteLength(input,'utf8')>MAX_BYTES) throw Error('Lua size limit');
 const s=input.replace(/^\uFEFF/,''); let p=0, entries=0;
 const fail=msg=>{throw Error(`Lua ${msg} at ${p}`);};
 function long() {
  const m=/^\[(=*)\[/.exec(s.slice(p)); if(!m) return null;
  p+=m[0].length; const end=s.indexOf(']'+m[1]+']',p); if(end<0) fail('unterminated long string');
  const v=s.slice(p,end).replace(/^(\r\n|\n|\r)/,''); p=end+m[1].length+2; return v;
 }
 function space() {
  while(p<s.length) {
   if(/\s/.test(s[p])) {p++;continue;}
   if(s.slice(p,p+2)==='--') {p+=2;if(long()===null){while(p<s.length&&s[p]!=='\n'&&s[p]!=='\r')p++;}continue;}
   break;
  }
 }
 function ident() {const m=/^[A-Za-z_][A-Za-z_0-9]*/.exec(s.slice(p));if(!m)fail('expected identifier');p+=m[0].length;return m[0];}
 function expect(c) {space();if(s[p]!==c)fail('expected '+c);p++;}
 function put(o,k,v){if(++entries>MAX_ENTRIES)fail('entry limit');if(v===undefined)delete o[k];else Object.defineProperty(o,String(k),{value:v,writable:true,enumerable:true,configurable:true});}
 function string() {
  const quote=s[p++];let out='';
  while(p<s.length) {
   let c=s[p++];if(c===quote)return out;
   if(c==='\n'||c==='\r')fail('newline in string');
   if(c==='\\') {
    if(p>=s.length)fail('unterminated escape');c=s[p++];
    const escapes={a:'\x07',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v','\\':'\\','"':'"',"'":"'"};
    if(Object.hasOwn(escapes,c))c=escapes[c];
    else if(/[0-9]/.test(c)){let digits=c;while(digits.length<3&&/[0-9]/.test(s[p]||''))digits+=s[p++];if(+digits>255)fail('escape range');c=String.fromCharCode(+digits);}
    else if(c==='\n')c='\n';else if(c==='\r'){if(s[p]==='\n')p++;c='\n';}else fail('unsupported escape');
   }
   out+=c;
  }fail('unterminated string');
 }
 function value(depth) {
  space();if(depth>MAX_DEPTH)fail('depth limit');
  if(s[p]==='"'||s[p]==="'")return string();
  if(s[p]==='['){const v=long();if(v!==null)return v;fail('unexpected bracket');}
  if(s[p]==='{') {
   if(depth>=MAX_DEPTH)fail('depth limit');
   p++;const o={};let index=1;space();
   while(s[p]!=='}') {
    if(p>=s.length)fail('unterminated table');let k,v;
    if(s[p]==='['&&!/^\[(=*)\[/.test(s.slice(p))){p++;k=value(depth+1);if(typeof k!=='string'&&!(typeof k==='number'&&Number.isFinite(k)))fail('invalid key');expect(']');expect('=');v=value(depth+1);}
    else {
     const start=p,m=/^[A-Za-z_][A-Za-z_0-9]*/.exec(s.slice(p));
     if(m){p+=m[0].length;space();}
     if(m&&s[p]==='='){p++;k=m[0];v=value(depth+1);}else{p=start;k=index++;v=value(depth+1);}
    }
    put(o,k,v);space();if(s[p]===','||s[p]===';'){p++;space();}else if(s[p]!=='}')fail('expected separator');
   }p++;return o;
  }
  const n=/^-?(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(s.slice(p));
  if(n){p+=n[0].length;const v=/^-0[xX]/.test(n[0])?-Number(n[0].slice(1)):Number(n[0]);if(!Number.isFinite(v))fail('number range');return v;}
  const id=ident();if(id==='true')return true;if(id==='false')return false;if(id==='nil')return undefined;fail('unsupported value');
 }
 const result={};space();while(p<s.length){const name=ident();expect('=');put(result,name,value(0));space();if(s[p]===';'){p++;space();}}
 return result;
}
module.exports={parse,MAX_BYTES,MAX_DEPTH};
