'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const render=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/render');
const {normalize}=require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
const view=(icons,names)=>({enabled:true,icons,names});
const png={uri:()=>'data:image/png;base64,AAAA'},none={uri:()=>null};
test('a resolved icon tile is still icon only: no text, no name',()=>{
 const svg=render.slot(view({1:100},{1:'Rejuvenation'}),1,png);
 a.match(svg,/<image /);a.doesNotMatch(svg,/<text|Rejuvenation/);
});
test('icon file missing or icon not known yet: coloured tile with the name; no name: question mark',()=>{
 for(const icons of [{1:100},{1:'unresolved'}]){
  const svg=render.slot(view(icons,{1:'Healing Touch'}),1,none);
  a.match(svg,/<text[^>]*>Healing<\/text>/);a.match(svg,/>Touch<\/text>/);a.match(svg,/hsl\(\d+,48%,26%\)/);a.doesNotMatch(svg,/<image/);
  a.match(svg,/^<svg [^>]*width="144" height="144"/);
 }
 a.equal(render.slot(view({1:100},{}),1,none),render.QUESTION);
 a.equal(render.slot(view({1:'unresolved'},undefined),1,none),render.QUESTION);
 a.equal(render.slot(view({},{1:'x'}),1,none),render.BLANK,'an empty slot never shows a name');
 a.equal(render.slot(null,1,none),render.BLANK);
});
test('names are escaped, wrapped to four lines at most, stable per name and different between names',()=>{
 const evil='<script>alert("x")</script> & \'q\'';
 const svg=render.slot(view({1:'unresolved'},{1:evil}),1,none);
 a.doesNotMatch(svg,/<script|alert\("/);a.match(svg,/&lt;script&gt;/);
 const long=render.slot(view({1:'unresolved'},{1:'Superlongwordthatneedscutting and many more words here again and again'}),1,none);
 a.ok((long.match(/<text /g)||[]).length<=4);
 const one=render.slot(view({1:'unresolved'},{1:'Fireball'}),1,none),two=render.slot(view({1:'unresolved'},{1:'Fireball'}),1,none),three=render.slot(view({1:'unresolved'},{1:'Frostbolt'}),1,none);
 a.equal(one,two);a.notEqual(one.match(/hsl\((\d+),/)[1],three.match(/hsl\((\d+),/)[1]);
});
test('the reader keeps only a short printable name and never any other text field',()=>{
 const base={schemaVersion:2,enabled:true,profileId:'p',page:1};
 const n=normalize({...base,icons:{1:{iconFileID:5,name:'  A\u0007  B\n  '+'x'.repeat(80),moneyCopper:5,count:3},2:{name:123},3:{unresolved:true,name:'   '}}});
 a.equal(n.names[1].length,40);a.match(n.names[1],/^A B x+$/);a.equal(n.names[2],undefined);a.equal(n.names[3],undefined);
 a.equal(JSON.stringify(n).includes('moneyCopper'),false);
});
