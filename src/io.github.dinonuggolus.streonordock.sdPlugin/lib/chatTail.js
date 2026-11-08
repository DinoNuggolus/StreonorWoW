'use strict';
// Read-only incremental reader for WoWChatLog.txt. Opens the file for reading each poll (never holds a
// handle, so the client and the post-exit log cleanup are never blocked), reads only bytes appended
// since the last poll and returns COMPLETE lines. Handles: first start (only the last INITIAL_BYTES),
// partial last line (kept until its newline arrives), truncation / rotation / replacement (offset
// reset to 0), a deleted file (state reset; a new file is read from its start) and unbounded growth
// (at most CHUNK bytes per read, at most MAX_PENDING bytes of partial line kept).
const fsp=require('node:fs/promises');
const INITIAL_BYTES=1024*1024, CHUNK=256*1024, MAX_PENDING=64*1024, MAX_READS=8;
class ChatTail{
 constructor(file,io=fsp){this.file=file;this.io=io;this.reset();this.started=false;}
 reset(){this.offset=0;this.pending='';this.identity=null;this.dropFirst=false;}
 async poll(){
  const lines=[];let st;
  try{st=await this.io.stat(this.file);}catch{ // missing / unreadable: forget everything; a recreated file starts at 0
   this.reset();this.started=true;return lines;}
  if(!st.isFile())return lines;
  const identity=`${st.ino}:${Math.floor(st.birthtimeMs||0)}`;
  if(this.identity&&(identity!==this.identity||st.size<this.offset)){const wasStarted=this.started;this.reset();this.started=wasStarted;}
  this.identity=identity;
  if(!this.started){ // first sight of the file: replay only the tail (older lines predate any saved value anyway)
   this.started=true;if(st.size>INITIAL_BYTES){this.offset=st.size-INITIAL_BYTES;this.dropFirst=true;}
  }
  let handle;
  try{
   handle=await this.io.open(this.file,'r');
   for(let n=0;n<MAX_READS&&this.offset<st.size;n++){
    const buf=Buffer.alloc(Math.min(CHUNK,st.size-this.offset));
    const {bytesRead}=await handle.read(buf,0,buf.length,this.offset);if(!bytesRead)break;
    this.offset+=bytesRead;
    let text=this.pending+buf.subarray(0,bytesRead).toString('utf8');
    const cut=text.lastIndexOf('\n');
    if(cut<0){this.pending=text.length>MAX_PENDING?'':text;continue;}
    this.pending=text.slice(cut+1).length>MAX_PENDING?'':text.slice(cut+1);
    const complete=text.slice(0,cut).split('\n');
    if(this.dropFirst){complete.shift();this.dropFirst=false;} // we started mid-line
    for(const line of complete)lines.push(line.replace(/\r$/,''));
   }
  }catch{ /* busy or vanished: try again next poll */ }
  finally{if(handle)await handle.close().catch(()=>{});}
  return lines;
 }
}
module.exports={ChatTail,INITIAL_BYTES,CHUNK,MAX_PENDING};
