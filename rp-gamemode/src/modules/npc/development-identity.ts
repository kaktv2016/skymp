import {randomUUID} from 'node:crypto';
import {validateRuntimeIdentitySpec} from './runtime-identity-spec';
export interface DevelopmentIdentitySpec {
 version:1|2;catalogHash:string;profileHash:string;revision?:number;specHash?:string;
 catalogs?:{catalogHash:string;approvalId:string;manifestHash:string;templateIds?:string[]}[];
 plugins:{filename:string;sha256:string;crc32:number;size:number;serverIndex:number;masters?:string[];light?:boolean}[];
 bases:{plugin:string;localId:number;serverId:number;templateId?:string;catalogHash?:string;approvalId?:string}[];
}
/** All calls run in the current Skyrim update; only numbers/strings escape. */
export function probeDevelopmentClient(sp:any,spec:DevelopmentIdentitySpec):any {
 const result:any={ok:false,plugins:[],bases:[],mapper:'g241d-owner-before-view-v1'};
 try{
  if(![1,2].includes(spec.version)||spec.plugins.length>16||!spec.bases.length||spec.bases.length>32||spec.version===2&&!/^[a-f0-9]{64}$/.test(spec.specHash??''))throw Error('Invalid identity spec');
  for(const p of spec.plugins){
   const index=sp.Game.getModByName(p.filename);
   if(!Number.isInteger(index)||index<0||index>=254||sp.Game.getModName(index).toLowerCase()!==p.filename.toLowerCase())throw Error('Required full plugin is not loaded: '+p.filename);
   const file=sp.getFileInfo(p.filename);
   if(file.size!==p.size||(file.crc32|0)!==(p.crc32|0))throw Error('Plugin content differs: '+p.filename);
   result.plugins.push({filename:p.filename,index,crc32:file.crc32|0,size:file.size});
  }
  for(const b of spec.bases){
   const plugin=result.plugins.find((p:any)=>p.filename===b.plugin);
   const form=sp.Game.getFormFromFile(b.localId,b.plugin);
   if(!plugin||!form||!sp.ActorBase.from(form)||form.getType()!==43||form.getFormID()!==plugin.index*0x1000000+b.localId)throw Error('ActorBase resolution failed: '+b.plugin+':'+b.localId.toString(16));
   if(spec.version===2){const exact=sp.Game.getFormEx(form.getFormID());if(!exact||!sp.ActorBase.from(exact)||exact.getType()!==43||exact.getFormID()!==form.getFormID())throw Error('Runtime form identity differs');}
   result.bases.push({plugin:b.plugin,localId:b.localId,runtimeId:form.getFormID(),type:43,name:typeof form.getName==='function'?form.getName():'',editorId:'UNAVAILABLE_API'});
  }
  result.ok=true;
 }catch(error){result.reason=String(error).slice(0,200);}
 return result;
}
/** Existing owner updater executes before WorldView. Map only the exact
 * qualified static bases in the approved isolated spec; validate registry tags
 * whenever present. Invalid candidates are removed, never assigned a fallback.
 * FF actor identities are never transformed. */
export function mapDevelopmentModels(models:any[],proof:any,spec:DevelopmentIdentitySpec):{ok:boolean;changed:number} {
 let ok=true,changed=0;
 if(!Array.isArray(models))return {ok:false,changed:0};
 const cache=(mapDevelopmentModels as any).__identityCache??=(( {specs:new WeakMap(),models:new WeakMap()}));
 let table=cache.specs.get(spec);
 if(!table||table.proof!==proof){
  table={proof,qualified:new Map(),server:new Map(),client:new Map(),resolved:new Map()};
  for(const b of spec.bases){if(!(spec.version===2?b.templateId!==undefined:b.plugin.endsWith('.esp')))continue;const key=b.localId.toString(16)+':'+b.plugin,r=proof?.bases?.find((r:any)=>r.plugin===b.plugin&&r.localId===b.localId);table.qualified.set(key,b);table.server.set(b.serverId,b);if(r){table.client.set(r.runtimeId,b);table.resolved.set(key,r);}}
  cache.specs.set(spec,table);
 }
 const indices=Object.keys(models).filter(k=>/^(0|[1-9][0-9]*)$/.test(k)),overflow=indices.length>4096;
 if(overflow)ok=false;
 for(const index of indices){const i=Number(index);
  const model=models[i];if(!model||model.isMyClone===true)continue;const tag=model.frostveilNpcQualifiedBase;
  // Native place() can subscribe before tags. Remember only JS model identity
  // and primitive IDs: swapped plugin indices may make a rewritten client ID
  // equal another server base. Repeated frames must not reinterpret that ID.
  const memo=cache.models.get(model),remembered=memo?.spec===spec&&memo.refrId===model.refrId&&memo.clientId===model.baseId?memo.target:undefined;
  const target=tag?table.qualified.get(tag.base):remembered??table.server.get(model.baseId)??table.client.get(model.baseId);
  if(!tag&&!target)continue;
  const resolved=target&&table.resolved.get(target.localId.toString(16)+':'+target.plugin);
  if(overflow||!proof?.ok||(tag&&(tag.version!==1||tag.catalogHash!==(target?.catalogHash??spec.catalogHash)))||!target||!resolved||resolved.type!==43||
     !Number.isInteger(model.refrId)||model.refrId<0xff000000||model.refrId>0xffffffff||
     (model.baseId!==target.serverId&&model.baseId!==resolved.runtimeId)){
   models[i]=undefined;ok=false;continue;
  }
  if(model.baseId!==resolved.runtimeId){model.baseId=resolved.runtimeId;changed++;}
  cache.models.set(model,{spec,refrId:model.refrId,clientId:resolved.runtimeId,target});
  // This owner pass runs before FormView.applyAll. Correct the actual input to
  // stock movement, rather than letting it start walking and fighting it later.
  const pose=model.frostveilNpcPose;
  if(pose?.policy?.movement==='STATIONARY'){
   const cell=typeof pose.cell==='string'?/^([a-f0-9]{1,6}):((?:Skyrim|Update|Dawnguard|HearthFires|Dragonborn)\.esm)$/i.exec(pose.cell):null;
   const plugin=cell&&proof.plugins?.find((p:any)=>p.filename.toLowerCase()===cell[2]!.toLowerCase());
   if(pose.policy.version!==1||!cell||!plugin||!Number.isInteger(plugin.index)||plugin.index<0||plugin.index>=5||!parseInt(cell[1]!,16)||![pose.pos,pose.rot].every(a=>Array.isArray(a)&&a.length===3&&a.every((v:any)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e7))){models[i]=undefined;ok=false;continue;}
   const movement=model.movement,world=plugin.index*0x1000000+parseInt(cell[1]!,16);
   if(movement&&(movement.runMode!=='Standing'||movement.speed!==0||movement.direction!==0||movement.isInJumpState!==false||movement.lookAt!==undefined||movement.worldOrCell!==world||!Array.isArray(movement.pos)||!Array.isArray(movement.rot)||pose.pos.some((v:number,i:number)=>v!==movement.pos[i])||pose.rot.some((v:number,i:number)=>v!==movement.rot[i]))){
    Object.assign(movement,{pos:pose.pos.slice(),rot:pose.rot.slice(),worldOrCell:world,runMode:'Standing',speed:0,direction:0,isInJumpState:false,lookAt:undefined});
    // FormView gates stock movement on this local change counter. Advance only
    // when projection changes input, never once per stable frame.
    model.numMovementChanges=(Number.isSafeInteger(model.numMovementChanges)&&model.numMovementChanges>=0&&model.numMovementChanges<Number.MAX_SAFE_INTEGER?model.numMovementChanges:0)+1;
   }
  }
 }
 return {ok,changed};
}
export class DevelopmentIdentity {
 private pending=new Map<number,{nonce:string;session:string;principal:string;at:number}>();
 private issuedAt=new Map<number,number>();
 private verified=new Map<number,{session:string;principal:string;nonce:string;armed:boolean}>();
 constructor(readonly spec:DevelopmentIdentitySpec,private authority:(actor:number)=>string|null,private session:(actor:number)=>string,private now=Date.now){
  validateRuntimeIdentitySpec(spec);this.spec=structuredClone(spec);
 }
 issue(actor:number){const principal=this.authority(actor);if(!principal)throw Error('Authorized development session required');const session=this.session(actor),now=this.now(),existing=this.pending.get(actor);if(existing&&existing.session===session&&existing.principal===principal&&now-existing.at>=0&&now-existing.at<60000)return {op:'challenge',nonce:existing.nonce,...this.spec};if(now-(this.issuedAt.get(actor)??-Infinity)<3000)throw Error('Wait three seconds before another identity probe');if(this.pending.size>2)this.clear();const pending={nonce:randomUUID(),session,principal,at:now};this.issuedAt.set(actor,now);this.pending.set(actor,pending);this.verified.delete(actor);return {op:'challenge',nonce:pending.nonce,...this.spec};}
 receive(actor:number,raw:any):boolean {
  const p=this.pending.get(actor);if(!p||!raw||typeof raw!=='object'||JSON.stringify(raw).length>16384||raw.nonce!==p.nonce)return false;
  this.pending.delete(actor);this.verified.delete(actor);
  try{
   if(this.now()-p.at<0||this.now()-p.at>60000||this.authority(actor)!==p.principal||this.session(actor)!==p.session||raw.version!==this.spec.version||raw.catalogHash!==this.spec.catalogHash||raw.profileHash!==this.spec.profileHash||this.spec.version===2&&raw.specHash!==this.spec.specHash||raw.ok!==true||raw.mapper!=='g241d-owner-before-view-v1')return false;
   if(!Array.isArray(raw.plugins)||raw.plugins.length!==this.spec.plugins.length||!Array.isArray(raw.bases)||raw.bases.length!==this.spec.bases.length)return false;
   const indices=new Set<number>();for(const expected of this.spec.plugins){const matches=raw.plugins.filter((p:any)=>p.filename===expected.filename);if(matches.length!==1)return false;const p=matches[0];if(!Number.isInteger(p.index)||p.index<0||p.index>=254||indices.has(p.index)||p.size!==expected.size||p.crc32!==(expected.crc32|0))return false;indices.add(p.index);}
   for(const expected of this.spec.bases){const matches=raw.bases.filter((b:any)=>b.plugin===expected.plugin&&b.localId===expected.localId);if(matches.length!==1)return false;const b=matches[0],plugin=raw.plugins.find((p:any)=>p.filename===b.plugin);if(!plugin||b.type!==43||b.runtimeId!==plugin.index*0x1000000+b.localId)return false;}
   // Official synchronized headparts/items/cells remain numerically identical.
   for(const plugin of this.spec.plugins.filter(p=>/^(Skyrim|Update|Dawnguard|HearthFires|Dragonborn)\.esm$/.test(p.filename))){if(raw.plugins.find((p:any)=>p.filename===plugin.filename)?.index!==plugin.serverIndex)return false;}
   this.verified.set(actor,{session:p.session,principal:p.principal,nonce:p.nonce,armed:false});return true;
  }catch{return false;}
 }
 arm(actor:number,nonce:string,specHash?:string){const v=this.verified.get(actor);try{if((this.spec.version===1||specHash===this.spec.specHash)&&v&&v.nonce===nonce&&this.session(actor)===v.session&&this.authority(actor)===v.principal){v.armed=true;return true;}}catch{}return false;}
 fault(actor:number,nonce:string,specHash?:string){const v=this.verified.get(actor);if(!v||v.nonce!==nonce||this.spec.version===2&&specHash!==this.spec.specHash||!this.ready(actor))return false;this.verified.delete(actor);return true;}
 ready(actor:number){const v=this.verified.get(actor);try{if(v&&this.session(actor)===v.session&&this.authority(actor)===v.principal)return v.armed;}catch{}this.verified.delete(actor);return false;}
 anyReady(){return [...this.verified.keys()].some(actor=>this.ready(actor));}
 clear(){this.pending.clear();this.verified.clear();this.issuedAt.clear();}
}
