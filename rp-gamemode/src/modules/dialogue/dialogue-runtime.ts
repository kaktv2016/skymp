import {randomUUID} from 'node:crypto';
import {EconomyJournal} from '../economy/journal';
import type {ActorId} from '../../engine/ids';
import type {SkyMpAdapter} from '../../engine/adapter';
import type {CommandResult} from '../../core/command-registry';
import {validateGraph} from './graph-model';
import type {Graph,Node} from './graph-model';
export {validateGraph} from './graph-model';
export type {Graph,Node} from './graph-model';
export function clerkGraph(routes:readonly string[],permits:readonly string[]):Graph{
 const nodes:Node[]=[{id:'entry',type:'entry',next:'welcome'},{id:'welcome',type:'npc',text:'ยินดีต้อนรับสู่ Courier Guild — ต้องการใช้บริการใด?',next:'menu'},{id:'menu',type:'choices',choices:[{id:'contracts',text:'ดูสัญญาส่งของ',next:'contracts'},{id:'rank',text:'ตรวจแรงก์ Courier',next:'rank'},{id:'permits',text:'ดูใบอนุญาตกิลด์',next:'permits'},...routes.map(id=>({id:'accept-'+id,text:'รับงาน: '+id,next:'accept-'+id})),...permits.map(id=>({id:'buy-'+id,text:'ซื้อใบอนุญาต: '+id,next:'buy-'+id})),{id:'exit',text:'ออก / Exit',next:'end'}]},{id:'end',type:'end'}];
 for(const action of ['contracts','rank','permits'] as const)nodes.push({id:action,type:'action',action,next:'menu'});
 for(const id of routes)nodes.push({id:'accept-'+id,type:'action',action:'accept',argument:id,next:'menu'});
 for(const id of permits)nodes.push({id:'buy-'+id,type:'action',action:'buyPermit',argument:id,next:'menu'});
 return {schemaVersion:1,id:'courier-clerk',version:1,entry:'entry',nodes};
}
export class DialogueStore{
 private journal:EconomyJournal;private graph?:Graph;private key='8'.repeat(64);
 constructor(directory:string,private routes:readonly string[],private permits:readonly string[]){this.journal=new EconomyJournal(directory);}
 load(){const saved=this.journal.read(this.key);this.graph=validateGraph(saved??clerkGraph(this.routes,this.permits),this.routes,this.permits);if(saved===null)this.journal.append(this.key,this.graph);return structuredClone(this.graph);}
 update(value:unknown){const g=validateGraph(value,this.routes,this.permits);if(!this.graph||g.id!==this.graph.id||g.version<=this.graph.version)throw Error('Graph version must increase');this.journal.append(this.key,g);this.graph=g;}
 close(){this.journal.close();}
}
interface Npc {id:string;name:string;formId:number|null;enabled:boolean;deleted:boolean;location:{cell:string;pos:readonly number[]};}
interface Conversation {graph:Graph;identity:string;npc:string;token:string;node:string;expires:number;text:string;}
export class DialogueRuntime{
 private sessions=new Map<ActorId,Conversation>();private opened=new Map<ActorId,number>();
 constructor(private adapter:SkyMpAdapter,private graph:Graph,private lookup:(id:number|string)=>Npc|undefined,private service:(actor:ActorId,args:string[])=>CommandResult,private publish:(actor:ActorId,payload:unknown)=>void,private now=Date.now,private graphForNpc?:(npcId:string)=>Graph|undefined){}
 private identity(actor:ActorId){const s=this.adapter.sessionForActor(actor);return JSON.stringify([s.userId,s.profileId,s.guid]);}
 private valid(actor:ActorId,npc:Npc){const p=this.adapter.fullLocation(actor);return npc.enabled&&!npc.deleted&&p.cell.toLowerCase()===npc.location.cell.toLowerCase()&&Math.hypot(...p.pos.map((v,i)=>v-npc.location.pos[i]!))<=256;}
 close(actor:ActorId){if(this.sessions.delete(actor))this.publish(actor,{closed:true});}
 connectionEvent(user:unknown){if(typeof user!=='number'||!Number.isInteger(user))return;for(const [actor,c] of this.sessions)if(JSON.parse(c.identity)[0]===user){try{this.close(actor);}catch{this.sessions.delete(actor);}this.opened.delete(actor);}}
 clear(){for(const actor of this.sessions.keys())try{this.close(actor);}catch{this.sessions.delete(actor);}this.opened.clear();}
 prune(){for(const [actor,c] of this.sessions)try{const npc=this.lookup(c.npc);if(c.expires<=this.now()||this.identity(actor)!==c.identity||!npc||!this.valid(actor,npc))this.close(actor);}catch{this.sessions.delete(actor);}for(const [a,t] of this.opened)if(this.now()-t>5000)this.opened.delete(a);}
 receive(actor:ActorId,p:any){try{
 if(!p||typeof p!=='object'||Array.isArray(p)||JSON.stringify(p).length>1024)return false;
 const identity=this.identity(actor);
 if(p.op==='open'){
  if(Object.keys(p).sort().join(',')!=='npc,op'||!Number.isSafeInteger(p.npc)||this.now()-(this.opened.get(actor)??-Infinity)<750)return false;
  this.opened.set(actor,this.now());const npc=this.lookup(p.npc);if(!npc||!this.valid(actor,npc))return false;
  // Copy at open so publication and later authoring cannot mutate a live session.
  const graph=structuredClone(this.graphForNpc?.(npc.id)??this.graph);
  this.sessions.set(actor,{graph,identity,npc:npc.id,token:randomUUID(),node:graph.entry,expires:this.now()+60000,text:''});return this.advance(actor);
 }
 const c=this.sessions.get(actor),npc=c&&this.lookup(c.npc);
 if(!c||!npc||identity!==c.identity||!this.valid(actor,npc)||c.expires<=this.now()){this.close(actor);return false;}
 if(p.token!==c.token)return false;
 if(p.op==='cancel'&&Object.keys(p).sort().join(',')==='op,token'){this.close(actor);return true;}
 if(p.op!=='choose'||Object.keys(p).sort().join(',')!=='choice,node,op,token'||p.node!==c.node)return false;
 const n=c.graph.nodes.find(n=>n.id===c.node);const choice=n?.choices?.find(v=>v.id===p.choice);if(n?.type!=='choices'||!choice)return false;
 // Consume this capability before any service mutation. Duplicate packets cannot execute it twice.
 c.token=randomUUID();c.node=choice.next;c.expires=this.now()+60000;c.text='';return this.advance(actor);
 }catch{this.close(actor);return false;}}
 private advance(actor:ActorId){const c=this.sessions.get(actor)!;for(let i=0;i<128;i++){
 const n=c.graph.nodes.find(n=>n.id===c.node)!;
 if(n.type==='end'){this.close(actor);return true;}
 if(n.type==='choices'){const npc=this.lookup(c.npc)!;this.publish(actor,{token:c.token,node:n.id,npc:c.npc,title:npc.name,text:c.text,choices:n.choices,expires:c.expires,graph:c.graph.id,version:c.graph.version});return true;}
 if(n.type==='npc')c.text+=(c.text?'\n':'')+n.text;
 if(n.type==='condition'){c.node=(n.condition==='always'||this.adapter.readCourier(actor)?.lifecycle!=='active'?n.next:n.otherwise)!;continue;}
 if(n.type==='action'){
 const args=n.action==='contracts'?['list']:n.action==='rank'?['rank']:n.action==='permits'?['guild']:n.action==='accept'?['accept',n.argument!]:['guild','buy',n.argument!];
 const result=this.service(actor,args);c.text+=(result.ok?String((result.data as any).systemMessage??'เสร็จแล้ว'):result.message)+'\n';
 }
 c.node=n.next!;
 }throw Error('Dialogue traversal budget exceeded');}
}

