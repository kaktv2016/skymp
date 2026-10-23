import {createHash} from 'node:crypto';
import {EconomyJournal} from '../economy/journal';
import {Graph,validateGraph} from './graph-model';
export type Layout=Record<string,{x:number;y:number}>;
interface Draft {revision:number;graph:Graph;layout:Layout;author:string;at:number;}
interface Version {version:number;author:string;at:number;rollbackFrom:number|null;}
interface Catalog {schema:1;revision:number;drafts:string[];graphs:Record<string,{versions:Version[]}>;assignments:Record<string,string>;}
const key=(s:string)=>createHash('sha256').update('blueprint:'+s).digest('hex');
const validId=(s:unknown):s is string=>typeof s==='string'&&!['constructor','prototype','__proto__'].includes(s)&&/^[a-z][a-z0-9-]{0,63}$/.test(s);
const clone=<T>(v:T):T=>structuredClone(v);
/** Single server writer; content is durable before catalog pointers become visible.
 * Separate root, never uses character/economy keys. Orphan content after a failed
 * catalog append is harmless; callers cannot observe it through published(). */
export class BlueprintStore {
 private journal:EconomyJournal;private catalog:Catalog;
 constructor(directory:string,private routes:readonly string[],private permits:readonly string[],seed:Graph,private now=Date.now){
  this.journal=new EconomyJournal(directory);
  try {
  const saved=this.journal.read(key('catalog')) as Catalog|null;
  if(saved){this.validateCatalog(saved);this.catalog=saved;}
  else {const graph=validateGraph(seed,routes,permits);this.journal.append(key('version:'+graph.id+':'+graph.version),graph);this.catalog={schema:1,revision:0,drafts:[],graphs:{[graph.id]:{versions:[{version:graph.version,author:'bootstrap',at:this.now(),rollbackFrom:null}]}},assignments:{}};this.journal.append(key('catalog'),this.catalog);}
  }catch(error){this.journal.close();throw error;}
 }
 private validateCatalog(c:Catalog){
  if(!c||Object.keys(c).sort().join(',')!=='assignments,drafts,graphs,revision,schema'||c.schema!==1||!Number.isSafeInteger(c.revision)||c.revision<0||!Array.isArray(c.drafts)||c.drafts.length>64||new Set(c.drafts).size!==c.drafts.length||c.drafts.some(id=>!validId(id))||!c.graphs||Array.isArray(c.graphs)||!c.assignments||Array.isArray(c.assignments)||Object.keys(c.graphs).length>64||Object.keys(c.assignments).length>64)throw Error('Invalid blueprint catalog');
  for(const [id,item]of Object.entries(c.graphs)){
   if(!validId(id)||!item||Object.keys(item).join(',')!=='versions'||!Array.isArray(item.versions)||!item.versions.length||item.versions.length>100)throw Error('Invalid graph history');
   let previous=0;
   for(const v of item.versions){if(!v||Object.keys(v).sort().join(',')!=='at,author,rollbackFrom,version'||!Number.isSafeInteger(v.version)||v.version<=previous||!Number.isFinite(v.at)||v.rollbackFrom!==null&&(!Number.isSafeInteger(v.rollbackFrom)||v.rollbackFrom>=v.version||!item.versions.some(old=>old.version===v.rollbackFrom)))throw Error('Invalid graph history version');this.author(v.author);const graph=this.version(id,v.version);if(graph.id!==id||graph.version!==v.version)throw Error('Graph history identity mismatch');previous=v.version;}
  }
  for(const [npc,id]of Object.entries(c.assignments))if(!npc||npc.length>64||['constructor','prototype','__proto__'].includes(npc)||!validId(id)||!Object.hasOwn(c.graphs,id))throw Error('Invalid stored NPC assignment');
 }
 private author(author:string){if(typeof author!=='string'||!author||author.length>200)throw Error('Invalid author');}
 private commit(next:Catalog){if(Buffer.byteLength(JSON.stringify(next))>60000)throw Error('Blueprint catalog capacity reached');this.journal.append(key('catalog'),next);this.catalog=next;}
 private checkId(id:string){if(!validId(id))throw Error('Invalid graph ID');}
 list(){return [...new Set([...Object.keys(this.catalog.graphs),...this.catalog.drafts])].map(id=>({id,version:this.catalog.graphs[id]?.versions.at(-1)?.version??0,draftRevision:this.draft(id)?.revision??0}));}
 revision(){return this.catalog.revision;}
 published(id:string):Graph {this.checkId(id);const v=this.catalog.graphs[id]?.versions.at(-1);if(!v)throw Error('Unknown graph');return this.version(id,v.version);}
 private version(id:string,version:number){const g=this.journal.peek(key('version:'+id+':'+version));if(!g)throw Error('Published graph unavailable');return validateGraph(g,this.routes,this.permits);}
 history(id:string){this.checkId(id);return clone(this.catalog.graphs[id]?.versions??[]);}
 draft(id:string):Draft|null {this.checkId(id);return clone(this.journal.peek(key('draft:'+id)) as Draft|null);}
 saveDraft(graph:Graph,layout:Layout,expectedRevision:number,author:string):Draft {
  this.author(author);this.checkId(graph?.id);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Invalid revision');
  // Incomplete links are allowed while authoring. Executable validation is mandatory on publish.
  if(!graph||graph.schemaVersion!==1||!Array.isArray(graph.nodes)||graph.nodes.length>128||Buffer.byteLength(JSON.stringify(graph))>48000||!layout||Array.isArray(layout)||Object.keys(layout).length>128)throw Error('Invalid draft size');
  for(const [id,p]of Object.entries(layout))if(!validId(id)||!p||Object.keys(p).sort().join(',')!=='x,y'||![p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=100000))throw Error('Invalid layout');
  if(!Number.isSafeInteger(graph.version)||graph.version<1)throw Error('Invalid draft graph version');
  const old=this.draft(graph.id);if((old?.revision??0)!==expectedRevision)throw Error('Draft revision conflict');
  const draft={revision:expectedRevision+1,graph:clone(graph),layout:clone(layout),author,at:this.now()};if(Buffer.byteLength(JSON.stringify(draft))>60000)throw Error('Draft capacity reached');
  if(!this.catalog.drafts.includes(graph.id)&&this.catalog.drafts.length>=64)throw Error('Draft capacity reached');
  this.journal.append(key('draft:'+graph.id),draft);if(!this.catalog.drafts.includes(graph.id)){const next=clone(this.catalog);next.drafts.push(graph.id);next.revision++;this.commit(next);}return clone(draft);
 }
 publish(id:string,draftRevision:number,expectedVersion:number,author:string){const d=this.draft(id);if(!d||d.revision!==draftRevision)throw Error('Draft revision conflict');return this.publishGraph(d.graph,expectedVersion,author,null);}
 private publishGraph(input:Graph,expectedVersion:number,author:string,rollbackFrom:number|null){
  this.author(author);this.checkId(input.id);const latest=this.catalog.graphs[input.id]?.versions.at(-1)?.version??0;
  if(expectedVersion!==latest||!Number.isSafeInteger(expectedVersion))throw Error('Published version conflict');
  if(!this.catalog.graphs[input.id]&&Object.keys(this.catalog.graphs).length>=64)throw Error('Graph capacity reached');
  if((this.catalog.graphs[input.id]?.versions.length??0)>=100)throw Error('History capacity reached; archive required');
  if(!Number.isSafeInteger(input.version)||input.version<1)throw Error('Invalid graph version');
  const graph=validateGraph({...clone(input),version:latest+1},this.routes,this.permits);
  if(Buffer.byteLength(JSON.stringify(graph))>48000)throw Error('Published graph capacity reached');
  const next=clone(this.catalog);next.revision++;const record=next.graphs[graph.id]??{versions:[]};record.versions.push({version:graph.version,author,at:this.now(),rollbackFrom});next.graphs[graph.id]=record;
  this.journal.append(key('version:'+graph.id+':'+graph.version),graph);this.commit(next);return clone(graph);
 }
 rollback(id:string,version:number,expectedVersion:number,author:string){if(!this.history(id).some(v=>v.version===version))throw Error('Unknown history version');return this.publishGraph(this.version(id,version),expectedVersion,author,version);}
 assign(npcId:string,graphId:string,expectedRevision:number,author:string){this.author(author);if(typeof npcId!=='string'||!npcId||['constructor','prototype','__proto__'].includes(npcId)||npcId.length>64||Object.keys(this.catalog.assignments).length>=64&&!this.catalog.assignments[npcId])throw Error('Invalid NPC assignment');this.published(graphId);if(expectedRevision!==this.catalog.revision)throw Error('Assignment revision conflict');const next=clone(this.catalog);next.revision++;next.assignments[npcId]=graphId;this.commit(next);return next.revision;}
 forNpc(npcId:string){const id=this.catalog.assignments[npcId];return id?this.published(id):undefined;}
 close(){this.journal.close();}
}
