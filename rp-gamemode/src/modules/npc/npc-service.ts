import {randomUUID} from 'node:crypto';
import {EconomyJournal} from '../economy/journal';
import type {SkyMpAdapter, TransformLocation} from '../../engine/adapter';
import type {ActorId} from '../../engine/ids';
import type {CommandResult} from '../../core/command-registry';

const KEY='7'.repeat(64), TAG='private.frostveil.npc', LABEL='frostveilNpcName', POSE='frostveilNpcPose';
export const npcHints=['help','list','create clerk','select','info','rename','move here','rotate','disable','enable','delete','restore'];
interface Definition {id:string;template:'clerk';name:string;location:TransformLocation;enabled:boolean;deleted:boolean;formId:number|null;appearanceProfile:null;equipmentProfile:null;dialogueProfile:null;}
interface Native {place(base:number):number;get(id:number,key:string):unknown;set(id:number,key:string,value:unknown):void;setEnabled(id:number,value:boolean):void;lookupEspmRecordById(id:number):{record?:{type:string}};makeProperty(name:string,options:unknown):void;}

/** Neighbor updates run in FormView's update context, after vanilla movement.
 * Only registered stationary clerks receive this property. No native wrappers
 * or asynchronous work survive the current update or cell transition. */
function updateNpcPose(ctx:any){
 const p=ctx.value,r=ctx.refr,sp=ctx.sp;
 if(!p||!r||r.isDeleted()||!r.is3DLoaded())return;
 const actor=sp.Actor.from(r);if(!actor)return;
 const parts=p.cell.split(':');
 const target=sp.Game.getFormFromFile(parseInt(parts[0],16),parts[1]);
 if(!target)return;
 const cell=sp.Cell.from(target),world=sp.WorldSpace.from(target);
 if(!cell&&!world)return;
 const worldId=target.getFormID();
 const current=world?r.getWorldSpace():r.getParentCell();
 // Do not move a streamed actor across cells here; the server owns streaming.
 if(!current||current.getFormID()!==worldId)return;
 const id=r.getFormID();
 if(ctx.state.npcPoseActor!==id){actor.enableAI(true);actor.setDontMove(true);ctx.state.npcPoseActor=id;}
 actor.clearKeepOffsetFromActor();
 const movement=ctx._model.movement;
 if(movement){Object.assign(movement,{pos:p.pos.slice(),rot:p.rot.slice(),worldOrCell:worldId,runMode:'Standing',direction:0,speed:0,isInJumpState:false,lookAt:undefined});}
 const yaw=Math.abs(((r.getAngleZ()-p.rot[2]+540)%360)-180);
 if(Math.hypot(r.getPositionX()-p.pos[0],r.getPositionY()-p.pos[1])>2||Math.abs(r.getPositionZ()-p.pos[2])>64||yaw>1||Math.abs(r.getAngleX())>1||Math.abs(r.getAngleY())>1){
  sp.TESModPlatform.moveRefrToPosition(r,cell,world,p.pos[0],p.pos[1],p.pos[2],0,0,p.rot[2]*Math.PI/180);
 }
}
function upright(location:TransformLocation):TransformLocation{return {...location,rot:[0,0,((location.rot[2]%360)+360)%360]};}

function validate(value:unknown):Definition[]{
 if(!Array.isArray(value)||value.length>64)throw Error('Invalid NPC registry');
 const ids=new Set<string>(),forms=new Set<number>();
 for(const d of value){
  if(!d||typeof d!=='object'||Object.keys(d).sort().join(',')!=='appearanceProfile,deleted,dialogueProfile,enabled,equipmentProfile,formId,id,location,name,template'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(d.id)||ids.has(d.id)||d.template!=='clerk'||typeof d.name!=='string'||!d.name.trim()||[...d.name].length>64||/[\x00-\x1f\x7f-\x9f]/.test(d.name)||typeof d.enabled!=='boolean'||typeof d.deleted!=='boolean'||!d.location||typeof d.location.cell!=='string'||d.location.cell.length>128||!/^([a-f0-9]+):[^:]+\.(esm|esp|esl)$/i.test(d.location.cell)||![d.location.pos,d.location.rot].every(a=>Array.isArray(a)&&a.length===3&&a.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7))||![d.appearanceProfile,d.equipmentProfile,d.dialogueProfile].every(v=>v===null)||!(d.formId===null||(Number.isInteger(d.formId)&&d.formId>=0xff000000&&d.formId<=0xffffffff&&!forms.has(d.formId))))throw Error('Invalid NPC definition');
  ids.add(d.id);if(d.formId!==null)forms.add(d.formId);
 }
 return structuredClone(value);
}
/** Uses the existing checksummed, fsynced journal in a separate NPC directory.
 * Interrupted provisioning fails closed rather than creating a second actor. */
export class NpcService {
 private definitions:Definition[]=[];private selections=new Map<ActorId,{guid:string;id:string}>();private journal:EconomyJournal;private ready=false;
 constructor(private native:Native,private adapter:SkyMpAdapter,directory:string,private allowed:(actor:ActorId)=>boolean,private log:(text:string)=>void){this.journal=new EconomyJournal(directory);}
 start(){try{
  for(const name of ['place','get','set','setEnabled','lookupEspmRecordById','makeProperty'] as const)if(typeof this.native[name]!=='function')throw Error('NPC API missing: '+name);
  if(this.native.lookupEspmRecordById(0x39f83).record?.type!=='NPC_')throw Error('Clerk template is not NPC_');
  // PartOne requires owner visibility for any neighbor payload/updater.
  // Owner updater remains empty; these properties belong only to NPC actors.
  this.native.makeProperty(LABEL,{isVisibleByOwner:true,isVisibleByNeighbors:true,updateOwner:'',updateNeighbor:'if(ctx.refr && !ctx.refr.isDeleted() && typeof ctx.value === "string" && ctx.state.lastNpcName !== ctx.value){ if(ctx.refr.setDisplayName(ctx.value,true)) ctx.state.lastNpcName=ctx.value; }'});
  this.native.makeProperty(POSE,{isVisibleByOwner:true,isVisibleByNeighbors:true,updateOwner:'',updateNeighbor:'('+updateNpcPose.toString()+')(ctx);'});
  this.definitions=validate(this.journal.read(KEY)??[]);
  for(const d of this.definitions){if(d.formId===null)throw Error('Interrupted NPC provisioning: '+d.id);this.verify(d);this.apply(d);}
  this.ready=true;this.log('[rp-npc] ready definitions='+this.definitions.length);
 }catch(e){this.ready=false;this.log('[rp-npc] unavailable; existing data preserved: '+String(e));}}
 stop(){this.ready=false;this.selections.clear();this.journal.close();}
 prune(){for(const [actor,selection] of this.selections){try{if(!this.allowed(actor)||this.adapter.sessionForActor(actor).guid!==selection.guid)this.selections.delete(actor);}catch{this.selections.delete(actor);}}}
 private save(next:Definition[]){const checked=validate(next);this.journal.append(KEY,checked);this.definitions=checked;}
 private verify(d:Definition){if(d.formId===null||this.native.get(d.formId,TAG)!==d.id||this.native.get(d.formId,'baseDesc')!=='39f83:Skyrim.esm')throw Error('NPC native identity mismatch: '+d.id);}
 private apply(d:Definition,previous?:Definition){
  this.verify(d);
  if(!previous||JSON.stringify(previous.location)!==JSON.stringify(d.location)){
   const location=upright(d.location);
   this.native.set(d.formId!,'locationalData',{cellOrWorldDesc:location.cell,pos:[...location.pos],rot:[...location.rot]});
   this.native.set(d.formId!,POSE,location);
  }
  if(!previous||previous.name!==d.name)this.native.set(d.formId!,LABEL,d.name);
  if(!previous||previous.enabled!==d.enabled||previous.deleted!==d.deleted)this.native.setEnabled(d.formId!,d.enabled&&!d.deleted);
 }
 execute(actor:ActorId,args:readonly string[]):CommandResult{
  const fail=(message:string):CommandResult=>{this.log(`[rp-npc] actor=${actor.toString(16)} result=rejected reason=${message}`);return {ok:false,code:'NPC_REJECTED',message};};
  try{
   if(!this.allowed(actor)){this.selections.delete(actor);return fail('Admin permission required');}
   const session=this.adapter.sessionForActor(actor);if(!this.ready)return fail('NPC registry unavailable; check server log');
   const a=[...args],command=a.shift();let message='';
   if(command==='help'&&!a.length)message='/npc '+npcHints.join(' | /npc ');
   else if(command==='list'&&!a.length)message=this.definitions.map(d=>`${d.id.slice(0,8)} ${d.name} ${d.deleted?'deleted':d.enabled?'enabled':'disabled'}`).join('\n')||'No registered NPCs';
   else if(command==='create'&&a.length===1&&a[0]==='clerk'){
    if(this.definitions.length>=64)return fail('NPC limit reached (64 including deleted)');
    const d:Definition={id:randomUUID(),template:'clerk',name:'Courier Guild Clerk',location:upright(this.adapter.fullLocation(actor)),enabled:true,deleted:false,formId:null,appearanceProfile:null,equipmentProfile:null,dialogueProfile:null};
    this.save([...this.definitions,d]);
    try{const id=this.native.place(0x39f83);if(!Number.isInteger(id)||id<0xff000000||id>0xffffffff)throw Error('Invalid spawned actor');this.native.setEnabled(id,false);this.native.set(id,TAG,d.id);d.formId=id;this.save(this.definitions.map(v=>v.id===d.id?d:v));this.apply(d);}catch(e){this.ready=false;throw e;}
    this.selections.set(actor,{guid:session.guid,id:d.id});message='Created and selected '+d.name;
   }else if(command==='select'&&!a.length){
    const p=this.adapter.fullLocation(actor);const candidates=this.definitions.filter(d=>d.location.cell.toLowerCase()===p.cell.toLowerCase()).map(d=>({d,distance:Math.hypot(...d.location.pos.map((n,i)=>n-p.pos[i]!))})).filter(v=>v.distance<=256&&(v.distance<64||((v.d.location.pos[0]-p.pos[0])*Math.sin(p.rot[2]*Math.PI/180)+(v.d.location.pos[1]-p.pos[1])*Math.cos(p.rot[2]*Math.PI/180))/Math.max(1,v.distance)>0.5)).sort((x,y)=>x.distance-y.distance);
    if(!candidates[0])return fail('Look toward a registered Frostveil NPC within 256 units');
    if(candidates[1]&&candidates[1].distance-candidates[0].distance<32)return fail('Selection ambiguous; move closer to the desired NPC');
    this.verify(candidates[0].d);this.selections.set(actor,{guid:session.guid,id:candidates[0].d.id});message='Selected '+candidates[0].d.name;
   }else{
    const selection=this.selections.get(actor);if(!selection||selection.guid!==session.guid)return fail('Select a registered NPC first');
    const current=this.definitions.find(d=>d.id===selection.id)!;this.verify(current);const d=structuredClone(current);
    if(command==='info'&&!a.length)message=JSON.stringify(d);
    else{
     if(command==='rename'&&a.length)d.name=a.join(' ');
     else if(command==='move'&&a.length===1&&a[0]==='here')d.location=upright(this.adapter.fullLocation(actor));
     else if(command==='rotate'&&a.length===1&&/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(a[0]!)){const degrees=Number(a[0]);if(!Number.isFinite(degrees)||Math.abs(degrees)>3600)return fail('Rotation must be within -3600..3600 degrees');d.location.rot=[0,0,((degrees%360)+360)%360];}
     else if(command==='disable'&&!a.length)d.enabled=false;
     else if(command==='enable'&&!a.length&&!d.deleted)d.enabled=true;
     else if(command==='delete'&&!a.length){d.deleted=true;d.enabled=false;}
     else if(command==='restore'&&!a.length){d.deleted=false;d.enabled=true;}
     else return fail('Invalid command; /npc help');
     if(JSON.stringify(d)!==JSON.stringify(current)){this.save(this.definitions.map(v=>v.id===d.id?d:v));try{this.apply(d,current);}catch(e){this.ready=false;throw e;}}message='NPC updated: '+d.name;
    }
   }
   this.log(`[rp-npc] actor=${actor.toString(16)} command=${command} result=ok`);return {ok:true,data:{systemMessage:message}};
  }catch(e){this.log('[rp-npc] command failed: '+String(e));return fail('NPC operation failed safely; check server log');}
 }
}
