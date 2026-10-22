import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {ActorSession} from '../../engine/adapter';
/** Offline localhost only: the OS operator explicitly approves a live session.
 * This is NOT master-account authentication. A profile/GUID alone never grants access.
 * Files are server-private capabilities; never serve this directory over HTTP. */
export class LocalAdminAuthority {
 private readonly boot=randomUUID();private sessions=new Map<number,{actorId:number;userId:number;profileId:number;nonce:string;guid:string;seen:number}>();private closed=false;
 constructor(private readonly directory:string,private readonly accounts:readonly string[]=[],private readonly now:()=>number=Date.now){
  if(accounts.some(a=>!/^[a-z][a-z0-9-]{0,63}$/.test(a)))throw Error('Invalid local operator account');
  fs.mkdirSync(directory,{recursive:true});this.safeDirectory();this.publish();
 }
 private safeDirectory(){const s=fs.lstatSync(this.directory);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe admin authority directory');}
 private publish(){this.safeDirectory();const file=path.join(this.directory,'sessions.json');if(fs.existsSync(file)){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('Unsafe admin inventory');}
  const temporary=path.join(this.directory,randomUUID()+'.tmp');fs.writeFileSync(temporary,JSON.stringify({boot:this.boot,accounts:this.accounts,sessions:[...this.sessions.values()].map(({guid,userId,seen,...s})=>s)}),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);
 }
 authorize=(s:ActorSession):string|null=>{
  try{if(this.closed)return null;this.safeDirectory();let entry=this.sessions.get(s.actorId);if(!entry||entry.guid!==s.guid||entry.userId!==s.userId||entry.profileId!==s.profileId||this.now()-entry.seen>60000){entry={actorId:s.actorId,userId:s.userId,profileId:s.profileId,guid:s.guid,nonce:randomUUID(),seen:this.now()};this.sessions.set(s.actorId,entry);for(const [id,e]of this.sessions)if(this.now()-e.seen>60000)this.sessions.delete(id);if(this.sessions.size>1000)throw Error('Admin inventory full');this.publish();}entry.seen=this.now();
   const file=path.join(this.directory,'approvals.json'),st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>65536)return null;
   const raw=JSON.parse(fs.readFileSync(file,'utf8'));if(raw?.boot!==this.boot||!Array.isArray(raw.grants)||raw.grants.length>1000)return null;
   const grant=raw.grants.find((g:any)=>g&&typeof g.account==='string'&&this.accounts.includes(g.account)&&g.actorId===s.actorId&&g.profileId===s.profileId&&g.nonce===entry!.nonce&&Number.isSafeInteger(g.expiresAt)&&g.expiresAt>this.now()&&g.expiresAt<=this.now()+1800000);
   return grant?'local-operator:'+grant.account+'#'+entry.nonce:null;
  }catch{return null;}
 };
 connectionEvent=(user:unknown)=>{if(this.closed||!Number.isInteger(user))return;for(const [id,s]of this.sessions)if(s.userId===user)this.sessions.delete(id);try{this.publish();}catch{/* A private filesystem failure must not abort other native login listeners. Authorization remains fail-closed. */}};
 close(){this.closed=true;this.sessions.clear();this.publish();}
}
