import {randomUUID} from 'node:crypto';
import type {ActorId} from '../../engine/ids';
import type {SkyMpAdapter} from '../../engine/adapter';
import type {NpcService} from './npc-service';
import type {TemplateAssignment} from './template-catalog';

interface Principal {actor:ActorId;principal:string;identity:string;}
interface Change {operation:'create'|'rename';templateId:string;configurationId:string;catalogHash:string;catalogVersion:number;name:string;npcId:string|null;revisionToken:string|null;}
const fields=(value:any,keys:string)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.split(',').sort().join(','))throw Error('Invalid NPC management fields');};
const restriction='Live appearance/outfit reassignment is unavailable: safe per-instance replication and recoverable replacement are not proven. Create a new catalog NPC instead. Existing NPC UUIDs are preserved.';

/** Short-lived review capabilities; journal persistence belongs exclusively to NpcService. */
export class NpcManagementService {
 private integrityStatus:'AVAILABLE'|'ASSET_MISSING'|'INCOMPATIBLE'='AVAILABLE';
 private reviews=new Map<string,{change:Change;assignment:TemplateAssignment;who:string;expires:number;location:ReturnType<SkyMpAdapter['fullLocation']>}>();
 constructor(private npc:NpcService,private adapter:SkyMpAdapter,private verifyIntegrity:()=>void,private dialogue:(id:string)=>{id:string;version:number}|null=()=>null,private now=Date.now){}
 private identity(p:Principal){const s=this.adapter.sessionForActor(p.actor);return JSON.stringify([p.actor,p.principal,p.identity,s.userId,s.profileId,s.guid]);}
 private prune(){for(const [k,v]of this.reviews)if(v.expires<=this.now())this.reviews.delete(k);}
 clear(){this.reviews.clear();}
 private integrity(){try{this.verifyIntegrity();this.integrityStatus='AVAILABLE';}catch(e){this.integrityStatus=/ENOENT|missing|unavailable/i.test(String(e))?'ASSET_MISSING':'INCOMPATIBLE';throw Error(this.integrityStatus+': approved resource/hash validation failed; inspect private server diagnostics');}}
 private snapshot(actor:ActorId){const s=this.npc.managementSnapshot(actor);try{this.integrity();}catch{}return {...s,npcs:s.npcs.map(n=>({...n,dialogue:this.dialogue(n.id)})),templates:s.templates.map(t=>({...t,configurationId:t.id+':fixed',resourceStatus:this.integrityStatus,availability:this.integrityStatus!=='AVAILABLE'?this.integrityStatus:s.identityReady?'DEVELOPMENT_ONLY':'IDENTITY_UNVERIFIED',renderProof:'PENDING_RENDER_PROOF',restrictions:['Local isolated development only','Detailed FaceGen/outfit acceptance pending','Fixed authored outfit only; no arbitrary weapon/equipment changes']})),reassignment:{supported:false,reason:restriction},weaponLoadout:{editable:false,reason:'Only authored base inventory is described; no dynamic weapon assignment.'}};}
 execute(operation:string,input:unknown,p:Principal):unknown {
  this.prune();this.identity(p); // Resolve a live server character, never a browser-supplied actor.
  if(operation==='snapshot'){fields(input,'');return this.snapshot(p.actor);}
  if(operation==='review'){
   fields(input,'operation,templateId,configurationId,catalogHash,catalogVersion,name,npcId,revisionToken');const c=structuredClone(input) as Change;
   if(!['create','rename'].includes(c.operation)||typeof c.name!=='string'||!c.name.trim()||[...c.name].length>64||/[\x00-\x1f\x7f-\x9f]/.test(c.name))throw Error('Invalid NPC operation or name');
   const s=this.npc.managementSnapshot(p.actor);if(!s.identityReady)throw Error('Development identity unverified; use /npc identity');
   const t=s.templates.find(t=>t.id===c.templateId);if(!t||c.configurationId!==t.id+':fixed')throw Error('Unknown or incompatible fixed configuration');
   if(c.catalogHash!==t.assignment.catalogHash||c.catalogVersion!==t.assignment.catalogVersion)throw Error('Catalog revision conflict');
   let before=null;
   if(c.operation==='create'){if(c.npcId!==null||c.revisionToken!==null)throw Error('Invalid create identity');}
   else{const n=s.npcs.find(n=>n.id===c.npcId);if(!n||n.template==='clerk'||n.deleted)throw Error('Unknown or read-only managed NPC');if(n.template!==t.id)throw Error(restriction);if(n.revisionToken!==c.revisionToken)throw Error('NPC revision conflict');before=n;}
   const location=this.adapter.fullLocation(p.actor);if(!/:(Skyrim|Update|Dawnguard|HearthFires|Dragonborn)\.esm$/i.test(location.cell))throw Error('Unsupported development world/cell');
   // Integrity is rechecked again at apply, never inferred from a stale review.
   this.integrity();if(this.reviews.size>=64)throw Error('Review capacity exceeded');const token=randomUUID(),expires=this.now()+60000;
   this.reviews.set(token,{change:c,assignment:structuredClone(t.assignment),who:this.identity(p),expires,location:structuredClone(location)});
   return {token,expires,operation:c.operation,before,after:{name:c.name,template:t.displayName,configuration:t.details.fixedOutfit,location:c.operation==='create'?location:before!.location},notice:c.operation==='create'?'Creates one additional NPC at your reviewed player position. Existing fixtures are not replaced.':'Changes the name only. UUID, appearance, outfit, anchor, policy and dialogue remain unchanged.'};
  }
  if(operation==='apply'){
   fields(input,'token');const token=(input as {token:unknown}).token;if(typeof token!=='string'||token.length>64)throw Error('Invalid review token');
   const r=this.reviews.get(token);if(!r||r.who!==this.identity(p))throw Error('Review expired, already used, or belongs to another session');
   this.reviews.delete(token); // Consume before any native/journal side effect, including failures.
   const s=this.npc.managementSnapshot(p.actor);if(!s.identityReady)throw Error('Development identity unverified; use /npc identity');
   this.integrity();const t=s.templates.find(t=>t.id===r.change.templateId);
   if(!t||JSON.stringify(t.assignment)!==JSON.stringify(r.assignment))throw Error('Catalog revision conflict');
   const position=this.adapter.fullLocation(p.actor);
   if(position.cell!==r.location.cell||Math.hypot(position.pos[0]-r.location.pos[0],position.pos[1]-r.location.pos[1])>16||Math.abs(position.pos[2]-r.location.pos[2])>64)throw Error('Player location changed; refresh and review again');
   const c=r.change;
   const result=c.operation==='create'?this.npc.managementCreate(p.actor,c.templateId,r.assignment,c.name):this.npc.managementRename(p.actor,c.npcId!,c.revisionToken!,c.name);
   return {...result,message:'Server operation applied. Actual Skyrim rendering remains owner verification.'};
  }
  throw Error('Unknown NPC management operation');
 }
}
