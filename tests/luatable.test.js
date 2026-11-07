'use strict';
const {test}=require('node:test'), a=require('node:assert/strict');
const {parse}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/luatable');
test('assignments, mixed keys, comments, numbers and nil',()=>{
 const x=parse('-- hello\nDB={ [1]=true, ["k"]={name=-2.5e2}, hex=0xFF, missing=nil; 7, } --[[end]]\nOther=false');
 a.equal(x.DB[1],7); a.equal(x.DB.k.name,-250); a.equal(x.DB.hex,255); a.equal(x.DB.missing,undefined); a.equal(x.Other,false);
});
test('Lua escapes and long strings',()=>{
 a.equal(parse('X="a\\n\\\"\\\\\\065"').X,'a\n"\\A');
 a.equal(parse('X=[=[\nhello ]] world]=]').X,'hello ]] world');
 a.equal(parse('--[=[comment]=]\nX="\\255"').X,'ÿ');
});
for(const s of ['X=os.execute("bad")','X={','X="\\999"','X=1 trailing','X=1e999','X={ [true]=1 }','X="unterminated','X=[=[bad','X={a=1 b=2}','X=0x','X=1+2']) test('reject '+s,()=>a.throws(()=>parse(s)));
test('size, nesting, prototype pollution and BOM',()=>{
 a.throws(()=>parse(' '.repeat(5*1024*1024+1)),/size/i);
 a.throws(()=>parse('X='+ '{'.repeat(65)+'}'.repeat(65)),/depth/i);
 const x=parse('\uFEFFX={__proto__={polluted=true},constructor=2}'); a.equal({}.polluted,undefined); a.equal(Object.getPrototypeOf(x.X),Object.prototype); a.equal(x.X.__proto__.polluted,true);
});
test('bounded flat entries and additional Lua 5.1 escape/numeric forms',()=>{
 a.throws(()=>parse('X={'+ '0,'.repeat(200001)+'}'),/entry/i);
 const x=parse('X={ -0x10, .5, 2., 1E-2, "a\\\nb", "\\a\\b\\f\\r\\t\\v", [=[\nline\n]=] }');
 a.equal(x.X[1],-16);a.equal(x.X[2],.5);a.equal(x.X[3],2);a.equal(x.X[4],.01);a.equal(x.X[5],'a\nb');a.equal(x.X[6],'\x07\b\f\r\t\v');a.equal(x.X[7],'line\n');
});
