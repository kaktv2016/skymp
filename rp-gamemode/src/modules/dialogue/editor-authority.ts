import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import type {ActorId} from '../../engine/ids';
export interface EditorPrincipal {principal:string;identity:string;}
interface Grant extends EditorPrincipal {actor:ActorId;expires:number;}
interface Session extends Grant {csrf:string;window:number;requests:number;}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** In-memory credentials disappear at restart. Resolver must recheck the actual
 * game session and existing server authority; client identities are never input. */
export class EditorAuthority {
 private grants=new Map<string,Grant>();private sessions=new Map<string,Session>();private closed=false;
 constructor(private resolve:(actor:ActorId)=>EditorPrincipal|null,private now=Date.now){}
 private live(g:Grant){let p:EditorPrincipal|null=null;try{p=this.resolve(g.actor);}catch{}if(this.closed||g.expires<=this.now()||!p||p.principal!==g.principal||p.identity!==g.identity)throw Error('Editor authorization expired');return p;}
 private prune(){for(const [k,v]of this.grants)if(v.expires<=this.now())this.grants.delete(k);for(const [k,v]of this.sessions)if(v.expires<=this.now())this.sessions.delete(k);}
 issue(actor:ActorId){if(this.closed)throw Error('Editor closed');const p=this.resolve(actor);if(!p||typeof p.principal!=='string'||!p.principal||typeof p.identity!=='string'||!p.identity)throw Error('Admin permission required');this.prune();if(this.grants.size>=64)throw Error('Login grant limit');const secret=token();this.grants.set(digest(secret),{...p,actor,expires:this.now()+60000});return secret;}
 exchange(secret:unknown){if(!valid(secret))throw Error('Invalid editor login');const k=digest(secret),g=this.grants.get(k);this.grants.delete(k);if(!g)throw Error('Invalid editor login');this.live(g);this.prune();if(this.sessions.size>=64)throw Error('Session limit');const sessionToken=token(),csrf=token();this.sessions.set(digest(sessionToken),{...g,expires:this.now()+15*60000,csrf:digest(csrf),window:this.now(),requests:0});return {token:sessionToken,csrf,expires:this.now()+15*60000};}
 verify(secret:unknown,csrf:unknown){if(!valid(secret)||!valid(csrf))throw Error('Invalid editor credentials');const k=digest(secret),s=this.sessions.get(k);if(!s)throw Error('Invalid editor credentials');try{this.live(s);}catch(e){this.sessions.delete(k);throw e;}if(!timingSafeEqual(Buffer.from(s.csrf,'hex'),Buffer.from(digest(csrf),'hex')))throw Error('Invalid CSRF token');if(this.now()-s.window>=60000){s.window=this.now();s.requests=0;}if(++s.requests>120)throw Error('Editor request rate exceeded');return {actor:s.actor,principal:s.principal,identity:s.identity};}
 logout(secret:unknown){if(valid(secret))this.sessions.delete(digest(secret));}
 close(){this.closed=true;this.grants.clear();this.sessions.clear();}
}
