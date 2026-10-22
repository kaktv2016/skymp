import { randomBytes } from 'node:crypto';
import { SkyMpAdapter, ActorSession } from '../../engine/adapter';
import { ActorId, actorId } from '../../engine/ids';
import { NativeMp, nativeMp } from '../../engine/mp-api';

// Registered owner-only state: makeProperty rejects dotted names, and the
// pinned native create-actor snapshot does not filter unregistered private keys.
export const MAP_DISCOVERY_PROPERTY = 'rpMapDiscoveryStateV1';
export const MAP_DISCOVERY_INBOX = 'rpMapDiscoveryInboxV1';
export const MAP_DISCOVERY_EVENT = '_onRpMapDiscoveryV1';
export interface MapMarker { id:string; world:string; cell:string; pos:readonly number[]; type:number; name:string|null; showAllHidden:boolean; }
export interface DiscoveryState {schemaVersion:1;markers:{id:string;canTravelTo:boolean}[];}
export interface MapDiscoveryOptions {now?:()=>number;nonce?:()=>string;}
interface Session {native:ActorSession;epoch:string;token:string;lastHello:number;tokens:number;lastRefill:number;issued:Set<string>;acks:Set<string>;lastPublished:string;}
const MAX_MARKERS=2048, RANGE=4096, PROBE_RANGE=8192, MAX_PROBES=16;
const MAX_ACKS=32;
function record(v:unknown):v is Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function desc(v:unknown):v is string{return typeof v==='string'&&/^[0-9a-f]{1,6}:(skyrim|update|dawnguard|hearthfires|dragonborn)\.esm$/.test(v);}
function epoch(v:unknown):v is string{return typeof v==='string'&&/^[a-zA-Z0-9_-]{1,96}$/.test(v);}
function requestId(v:unknown):v is string{return typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v);}
function text(v:unknown):v is string{return typeof v==='string'&&v.length<=256&&!/[\x00-\x1f\x7f]/.test(v);}
function same(a:ActorSession,b:ActorSession){return a.actorId===b.actorId&&a.userId===b.userId&&a.profileId===b.profileId&&a.guid===b.guid;}
export function discoveryState(raw:unknown):DiscoveryState {
 if(!record(raw)||raw.schemaVersion!==1||Object.keys(raw).some(k=>k!=='schemaVersion'&&k!=='markers')||!Array.isArray(raw.markers)||raw.markers.length>MAX_MARKERS)throw Error('Invalid map discovery state; existing data preserved');
 const seen=new Set<string>();const markers=raw.markers.map(v=>{if(!record(v)||Object.keys(v).some(k=>k!=='id'&&k!=='canTravelTo')||!desc(v.id)||typeof v.canTravelTo!=='boolean'||seen.has(v.id))throw Error('Invalid map discovery marker; existing data preserved');seen.add(v.id);return{id:v.id,canTravelTo:v.canTravelTo};});return{schemaVersion:1,markers};
}
/** Cosmetic native-map metadata only. No inventory, quest, XP or global travel writes. */
export class MapDiscoveryService {
 private readonly mp:NativeMp;
 private readonly catalogue:readonly MapMarker[];
 private readonly sessions=new Map<ActorId,Session>();
 private readonly now:()=>number;private readonly nonce:()=>string;
 constructor(raw:unknown,private readonly adapter:SkyMpAdapter,catalogue:readonly MapMarker[],options:MapDiscoveryOptions={}){
  this.mp=nativeMp(raw);this.now=options.now??Date.now;this.nonce=options.nonce??(()=>randomBytes(16).toString('hex'));
  const seen=new Set<string>();if(catalogue.length>MAX_MARKERS)throw Error('Map catalogue exceeds bounded state');
  for(const c of catalogue){if(!desc(c.id)||!desc(c.world)||!desc(c.cell)||seen.has(c.id)||c.pos.length!==3||!c.pos.every(Number.isFinite)||!Number.isInteger(c.type)||c.type<1||c.type>59||c.name!==null&&!text(c.name)||typeof c.showAllHidden!=='boolean')throw Error('Invalid map marker catalogue');seen.add(c.id);}
  this.catalogue=catalogue.map(c=>({...c,pos:[...c.pos]}));
 }
 private session(actor:ActorId):Session {
  const native=this.adapter.sessionForActor(actor);let s=this.sessions.get(actor);
  if(!s||!same(s.native,native)){s={native,epoch:'',token:'',lastHello:-Infinity,tokens:16,lastRefill:this.now(),issued:new Set(),acks:new Set(),lastPublished:''};this.sessions.set(actor,s);}return s;
 }
 private read(actor:ActorId):DiscoveryState{const raw=this.mp.get(actor,MAP_DISCOVERY_PROPERTY);return raw==null?{schemaVersion:1,markers:[]}:discoveryState(raw);}
 private publish(actor:ActorId,s:Session,state:DiscoveryState,force=false):void {
  const markers=state.markers.flatMap(saved=>{const c=this.catalogue.find(c=>c.id===saved.id);return c?[{id:c.id,world:c.world,type:c.type,canTravelTo:saved.canTravelTo}]:[];});
  const saved=new Set(state.markers.map(m=>m.id));let probes:{id:string;world:string;type:number;name:string|null;showAllHidden:boolean}[]=[];
  try{const location=this.adapter.location(actor),world=location.cell.toLowerCase();probes=this.catalogue.filter(c=>!saved.has(c.id)&&c.world===world&&c.pos.reduce((n,p,i)=>n+(p-location.pos[i]!)**2,0)<=PROBE_RANGE**2)
   .sort((a,b)=>a.pos.reduce((n,p,i)=>n+(p-location.pos[i]!)**2,0)-b.pos.reduce((n,p,i)=>n+(p-location.pos[i]!)**2,0)||a.id.localeCompare(b.id)).slice(0,MAX_PROBES)
   .map(c=>({id:c.id,world:c.world,type:c.type,name:c.name,showAllHidden:c.showAllHidden}));}catch{}
  s.issued=new Set(probes.map(p=>p.id));const payload={v:1,actor,epoch:s.epoch,token:s.token,markers,probes,acks:[...s.acks]},signature=JSON.stringify(payload);
  if(!force&&signature===s.lastPublished)return;s.lastPublished=signature;this.mp.set(actor,MAP_DISCOVERY_INBOX,payload);
 }
 receive(sender:unknown,packet:unknown):boolean {
  try{
   const actor=actorId(sender),s=this.session(actor),at=this.now();
   s.tokens=Math.min(16,s.tokens+Math.max(0,at-s.lastRefill)/1000*4);s.lastRefill=at;if(s.tokens<1)return false;s.tokens--;
   if(!record(packet)||packet.v!==1||!epoch(packet.epoch))return false;
   if(packet.kind==='hello'){
    if(Object.keys(packet).some(k=>!['v','kind','epoch'].includes(k))||at-s.lastHello<500)return false;
    const state=this.read(actor);s.lastHello=at;s.epoch=packet.epoch;s.token=this.nonce();s.acks.clear();s.lastPublished='';this.publish(actor,s,state,true);return true;
   }
   if(packet.kind!=='discover'||Object.keys(packet).some(k=>!['v','kind','epoch','token','probeId','requestId','world','name','markerType','isVisible','canTravelTo','isShowAllHidden'].includes(k))||packet.epoch!==s.epoch||typeof packet.token!=='string'||!s.token||packet.token!==s.token||!desc(packet.world)||!text(packet.name)||!Number.isInteger(packet.markerType)||packet.isVisible!==true||typeof packet.canTravelTo!=='boolean'||typeof packet.isShowAllHidden!=='boolean'||packet.probeId!==undefined&&!desc(packet.probeId)||packet.requestId!==undefined&&!requestId(packet.requestId))return false;
   const location=this.adapter.location(actor);if(location.cell.toLowerCase()!==packet.world)return false;
   // FULL is an unresolved STRINGS ID in localized masters. For these records,
   // world/type + authoritative proximity must identify exactly one reference.
   // Never accept a client reference ID, coordinate or closest-of-many guess.
   const limit=packet.probeId===undefined?RANGE:PROBE_RANGE;
   if(packet.probeId!==undefined&&(!s.issued.has(packet.probeId)||packet.canTravelTo!==true))return false;
   const matches=this.catalogue.filter(c=>(packet.probeId===undefined||c.id===packet.probeId)&&c.world===packet.world&&c.type===packet.markerType&&c.showAllHidden===packet.isShowAllHidden&&(c.name===null||c.name===packet.name)&&c.pos.reduce((n,p,i)=>n+(p-location.pos[i]!)**2,0)<=limit**2);
   if(matches.length!==1)return false;const c=matches[0]!,state=this.read(actor),saved=state.markers.find(m=>m.id===c.id);
   const changed=saved?(packet.canTravelTo&&!saved.canTravelTo):true;
   if(!changed&&!requestId(packet.requestId))return false;
   if(!saved&&state.markers.length>=MAX_MARKERS)return false;
   if(!same(s.native,this.adapter.sessionForActor(actor)))return false;
   if(changed){if(saved)saved.canTravelTo=true;else state.markers.push({id:c.id,canTravelTo:packet.canTravelTo});this.mp.set(actor,MAP_DISCOVERY_PROPERTY,state);}
   if(requestId(packet.requestId)){s.acks.add(packet.requestId);while(s.acks.size>MAX_ACKS)s.acks.delete(s.acks.values().next().value!);}
   this.publish(actor,s,state);return true;
  }catch{return false;}
 }
 sync():void{const online=this.adapter.onlineActors();for(const actor of this.sessions.keys())if(!online.includes(actor))this.sessions.delete(actor);for(const actor of online){try{const s=this.session(actor);if(s.token)this.publish(actor,s,this.read(actor));}catch{this.sessions.delete(actor);}}}
 connectionEvent(user:unknown):void{for(const [actor,s]of this.sessions)if(s.native.userId===user)this.sessions.delete(actor);}
 clear():void{this.sessions.clear();}
}
