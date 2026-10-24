import type {Graph} from './graph-model';
import {validateGraph} from './graph-model';
import {BlueprintStore,Layout} from './blueprint-store';
import {previewDialogue} from './preview';
export interface EditorNpc {id:string;name:string;enabled:boolean;deleted:boolean;}
/** Trusted transport supplies the verified author and enforces authorization.
 * This service exposes only declarative graph operations, never generic commands. */
export class BlueprintService {
 constructor(private store:BlueprintStore,private routes:readonly string[],private permits:readonly string[],private npcs:()=>EditorNpc[]){}
 read(operation:string,input:any){
  if(operation==='catalog')return {graphs:this.store.list(),npcs:this.npcs().filter(n=>n.enabled&&!n.deleted),routes:this.routes,permits:this.permits,revision:this.store.revision(),nodeTypes:['entry','npc','choices','condition','action','end'],actions:['contracts','rank','permits','accept','buyPermit'],conditions:['always','courierIdle']};
  if(operation==='graph')return {draft:this.store.draft(input.id),published:this.store.list().some(g=>g.id===input.id&&g.version>0)?this.store.published(input.id):null,history:this.store.history(input.id)};
  throw Error('Unknown read operation');
 }
 execute(operation:string,input:any,author:string){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid editor request');
  const fields:Record<string,string[]>={draft:['graph','layout','revision'],validate:['graph'],preview:['graph','choices','activeCourier'],publish:['id','draftRevision','version'],rollback:['id','targetVersion','version'],assign:['npc','id','revision']};
  if(!Object.hasOwn(fields,operation)||Object.keys(input).sort().join(',')!==fields[operation]!.slice().sort().join(','))throw Error('Invalid operation fields');
  switch(operation){
   case 'draft':return this.store.saveDraft(input.graph as Graph,input.layout as Layout,input.revision,author);
   case 'validate':return {graph:validateGraph(input.graph,this.routes,this.permits),valid:true};
   case 'preview':return previewDialogue(input.graph,input.choices,input.activeCourier,this.routes,this.permits);
   case 'publish':return this.store.publish(input.id,input.draftRevision,input.version,author);
   case 'rollback':return this.store.rollback(input.id,input.targetVersion,input.version,author);
   case 'assign':if(!this.npcs().some(n=>n.id===input.npc&&n.enabled&&!n.deleted))throw Error('NPC is not eligible');return {revision:this.store.assign(input.npc,input.id,input.revision,author)};
   default:throw Error('Unsupported editor operation');
  }
 }
}
