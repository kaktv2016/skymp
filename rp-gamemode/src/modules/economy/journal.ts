import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

const LIMIT=16*1024*1024;
function hash(value:string){return createHash('sha256').update(value).digest('hex');}
function noLinks(file:string){let current=path.parse(path.resolve(file)).root;for(const part of path.resolve(file).slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('Journal redirected path');}}
function regular(file:string){noLinks(file);const s=fs.lstatSync(file);if(!s.isFile()||s.nlink!==1||s.size>LIMIT)throw Error('Unsafe journal file');return s;}
function decode(bytes:Buffer){
 const end=bytes.lastIndexOf(10)+1;if(!end)throw Error('Initialized economy journal has no committed prefix; manual recovery required');
 let state:unknown,seq=0,previous='0'.repeat(64);
 for(const line of bytes.subarray(0,end).toString('utf8').split('\n').slice(0,-1)){
  const record=JSON.parse(line);if(!record||Object.keys(record).sort().join(',')!=='body,hash'||typeof record.body!=='string'||hash(record.body)!==record.hash)throw Error('Economy journal checksum mismatch');
  const body=JSON.parse(record.body);if(!body||Object.keys(body).sort().join(',')!=='previous,seq,state'||body.seq!==seq+1||body.previous!==previous)throw Error('Economy journal chain mismatch');
  seq=body.seq;previous=record.hash;state=body.state;
 }
 return{state,seq,previous,end};
}
/** A single server process owns this root. No balance is acknowledged before fsync. */
export class EconomyJournal {
 private root?:string;private identity?:string;private token:string|undefined;private closed=false;
 private latest=new Map<string,{seq:number;hash:string}>();
 constructor(private readonly directory:string,private readonly fault?:(point:string)=>void){}
 private open(){
  if(this.closed)throw Error('Journal closed');
  if(!this.root){
   // Check existing ancestors before creating anything.
   let probe=path.resolve(this.directory);while(!fs.existsSync(probe)){const parent=path.dirname(probe);if(parent===probe)throw Error('Invalid journal root');probe=parent;}noLinks(probe);
   fs.mkdirSync(this.directory,{recursive:true});noLinks(this.directory);this.root=fs.realpathSync(this.directory);const stat=fs.statSync(this.root);this.identity=stat.dev+':'+stat.ino;
   const lock=path.join(this.root,'writer.lock');
   if(fs.existsSync(lock)){
    const observed=regular(lock),previous=JSON.parse(fs.readFileSync(lock,'utf8'));if(!Number.isSafeInteger(previous.pid)||previous.pid<1||typeof previous.token!=='string'||!/^[a-f0-9-]{36}$/.test(previous.token))throw Error('Invalid journal writer lease');
    let dead=false;try{process.kill(previous.pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')dead=true;else throw e;}if(!dead)throw Error('Economy journal writer already active');
    // Immutable, exclusive claim per stale token. Contenders cannot unlink a
    // successor's lease using their earlier stale observation. If takeover itself
    // crashes, retain the claim and require stopped-server operator recovery.
    const claim=path.join(this.root,'recovery-'+previous.token+'.lock'),claimFd=fs.openSync(claim,'wx',0o600);
    try{fs.writeFileSync(claimFd,JSON.stringify({pid:process.pid,staleToken:previous.token}));fs.fsyncSync(claimFd);}finally{fs.closeSync(claimFd);}
    const again=regular(lock),current=JSON.parse(fs.readFileSync(lock,'utf8'));
    if(again.dev!==observed.dev||again.ino!==observed.ino||again.ctimeMs!==observed.ctimeMs||current.token!==previous.token||current.pid!==previous.pid)throw Error('Journal writer changed during takeover');
    fs.unlinkSync(lock);
   }
   const fd=fs.openSync(lock,'wx',0o600);try{this.token=randomUUID();fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token:this.token}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  }
  noLinks(this.root);const stat=fs.statSync(this.root);if(stat.dev+':'+stat.ino!==this.identity||!this.token)throw Error('Journal root identity changed');
  const lock=path.join(this.root,'writer.lock');regular(lock);if(JSON.parse(fs.readFileSync(lock,'utf8')).token!==this.token)throw Error('Journal writer identity changed');
  return this.root;
 }
 private target(key:string){if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid character journal key');return path.join(this.open(),key,'journal.jsonl');}
 /** Visual hints only: no lease, directory creation, truncation, flush or financial acknowledgement. */
 peek(key:string):unknown|null {
  if(this.closed)throw Error('Journal closed');if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid character journal key');
  const directory=path.join(path.resolve(this.directory),key);if(!fs.existsSync(directory))return null;
  const file=path.join(directory,'journal.jsonl');regular(file);return decode(fs.readFileSync(file)).state;
 }
 read(key:string):unknown|null {
  const file=this.target(key),directory=path.dirname(file);this.latest.delete(key);
  if(!fs.existsSync(directory))return null;
  noLinks(directory);regular(file);const bytes=fs.readFileSync(file),{end,seq,previous,state}=decode(bytes);
  // A previous append may have written the newline and then failed fsync. Flush
  // even a complete prefix before exposing/acknowledging its recovered balance.
  const fd=fs.openSync(file,'r+');try{if(end!==bytes.length)fs.ftruncateSync(fd,end);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  this.latest.set(key,{seq,hash:previous});return state;
 }
 append(key:string,state:unknown){
  const current=this.read(key),file=this.target(key),last=this.latest.get(key),body=JSON.stringify({seq:(last?.seq??0)+1,previous:last?.hash??'0'.repeat(64),state});
  if(body.length>64*1024)throw Error('Economy record too large');const line=JSON.stringify({body,hash:hash(body)})+'\n';
  this.fault?.('before-write');if(current===null)fs.mkdirSync(path.dirname(file));
  const exists=fs.existsSync(file);if(exists&&regular(file).size+Buffer.byteLength(line)>LIMIT)throw Error('Economy journal capacity reached; maintenance required');
  const fd=fs.openSync(file,exists?'a':'wx',0o600);
  try{const bytes=Buffer.from(line),half=Math.floor(bytes.length/2);fs.writeFileSync(fd,bytes.subarray(0,half));this.fault?.('partial-write');fs.writeFileSync(fd,bytes.subarray(half));fs.fsyncSync(fd);this.fault?.('after-sync');}finally{fs.closeSync(fd);}
 }
 close(){if(this.closed)return;this.closed=true;if(this.root&&this.token){const lock=path.join(this.root,'writer.lock');regular(lock);if(JSON.parse(fs.readFileSync(lock,'utf8')).token!==this.token)throw Error('Journal writer identity changed');fs.unlinkSync(lock);this.token=undefined;}}
}
