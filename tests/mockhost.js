'use strict';
// Minimal RFC6455 server, loopback only. No third-party packages.
const http=require('node:http'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
class MockHost extends EventEmitter{
 constructor(){super();this.messages=[];this.sockets=new Set();this.server=http.createServer();this.server.on('upgrade',(req,socket,head)=>{
  this.socket=socket;this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));socket.on('error',()=>{});
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  let buffer=head,fragments=[];const consume=()=>{while(buffer.length>=2){let len=buffer[1]&127,offset=2;const mask=!!(buffer[1]&128),op=buffer[0]&15,fin=!!(buffer[0]&128);if(len===126){if(buffer.length<4)return;len=buffer.readUInt16BE(2);offset=4;}else if(len===127){if(buffer.length<10)return;len=Number(buffer.readBigUInt64BE(2));offset=10;}if(len>2*1024*1024){socket.destroy();return;}if(buffer.length<offset+(mask?4:0)+len)return;const key=mask?buffer.subarray(offset,offset+4):null;offset+=mask?4:0;const payload=Buffer.from(buffer.subarray(offset,offset+len));buffer=buffer.subarray(offset+len);if(mask)for(let i=0;i<payload.length;i++)payload[i]^=key[i%4];if(op===8){socket.end();return;}if(op===9){this.frame(payload,10);continue;}if(op===1||op===0){fragments.push(payload);if(fin){try{const m=JSON.parse(Buffer.concat(fragments).toString('utf8'));this.messages.push(m);this.emit('message',m);}catch{}fragments=[];}}}};
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);consume();});consume();
 });}
 async listen(){await new Promise(r=>this.server.listen(0,'127.0.0.1',r));return this.server.address().port;}
 frame(payload,opcode=1,fin=true){const size=payload.length;let h;if(size<126){h=Buffer.from([(fin?128:0)|opcode,size]);}else if(size<65536){h=Buffer.alloc(4);h[0]=(fin?128:0)|opcode;h[1]=126;h.writeUInt16BE(size,2);}else{h=Buffer.alloc(10);h[0]=(fin?128:0)|opcode;h[1]=127;h.writeBigUInt64BE(BigInt(size),2);}this.socket.write(Buffer.concat([h,payload]));}
 send(m,fragment=false){const payload=Buffer.from(JSON.stringify(m));if(fragment){const half=Math.floor(payload.length/2);this.frame(payload.subarray(0,half),1,false);this.frame(payload.subarray(half),0,true);}else this.frame(payload);}
 async wait(predicate,ms=12000){const found=this.messages.find(predicate);if(found)return found;return new Promise((resolve,reject)=>{const on=m=>{if(predicate(m)){clearTimeout(timer);this.off('message',on);resolve(m);}};const timer=setTimeout(()=>{this.off('message',on);reject(Error('Mock host timeout'));},ms);this.on('message',on);});}
 async close(){for(const s of this.sockets)s.destroy();await new Promise(r=>this.server.close(r));}
}
module.exports={MockHost};
