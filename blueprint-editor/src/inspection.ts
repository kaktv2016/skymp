import type {Edge} from '@xyflow/react';
import type {Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';

export type Selection={kind:'node'|'edge'|'group';id:string}|null;
export type TraceMode='direct'|'upstream'|'downstream';
export const nodeInfo={entry:{label:'เริ่มบทสนทนา',icon:'↗',hint:'จุดเริ่มต้นของเรื่องราว'},npc:{label:'บทพูด NPC',icon:'“',hint:'ข้อความที่ผู้เล่นจะเห็น'},choices:{label:'ตัวเลือกผู้เล่น',icon:'☷',hint:'แตกแขนงเส้นทางบทสนทนา'},condition:{label:'ตรวจเงื่อนไข',icon:'◇',hint:'เลือกเส้นทางตามสถานะ'},action:{label:'บริการกิลด์',icon:'⚒',hint:'ใช้บริการ Courier ที่มีอยู่'},end:{label:'จบบทสนทนา',icon:'✓',hint:'กลับสู่โลกของ Frostveil'}};
export const actionLabels:Record<string,string>={contracts:'ดูสัญญาส่งของ',rank:'ตรวจแรงก์ Courier',permits:'ดูใบอนุญาตกิลด์',accept:'รับสัญญาส่งของ',buyPermit:'ซื้อใบอนุญาต'};
export const conditionLabels:Record<string,string>={always:'ผ่านเงื่อนไขเสมอ',courierIdle:'ผู้เล่นไม่มีงาน Courier อยู่'};
export const nodeColors:Record<string,string>={entry:'#d9b773',npc:'#72c8b9',choices:'#7eaeef',action:'#b5a0db',condition:'#e7a879',end:'#8daba2'};
export function title(node:Node){return node.type==='action'?actionLabels[node.action??'']??nodeInfo[node.type].label:nodeInfo[node.type].label;}
export interface GraphIndex {nodes:Map<string,Node>;edges:Map<string,Edge>;incoming:Map<string,Edge[]>;outgoing:Map<string,Edge[]>;}
export function graphIndex(nodes:readonly Node[],edges:readonly Edge[]):GraphIndex {
 const index:GraphIndex={nodes:new Map(nodes.map(n=>[n.id,n])),edges:new Map(),incoming:new Map(),outgoing:new Map()};
 for(const edge of edges){index.edges.set(edge.id,edge);for(const [map,id]of [[index.incoming,edge.target],[index.outgoing,edge.source]] as const){const list=map.get(id)??[];list.push(edge);map.set(id,list);}}
 return index;
}
export function connection(index:GraphIndex,edge:Edge){
 const source=index.nodes.get(edge.source),target=index.nodes.get(edge.target),issues:string[]=[];
 let output='Unknown output',choiceNumber:number|undefined;
 if(!source)issues.push('Missing source node');
 else if(source.type==='choices'){
  const i=source.choices?.findIndex(c=>'choice:'+c.id===edge.sourceHandle)??-1;
  if(i<0)issues.push('Missing source choice');else{choiceNumber=i+1;output=source.choices![i]!.text||'(empty choice)';}
 }else if(source.type==='end')issues.push('End node cannot have an output');
 else if(edge.sourceHandle==='next')output=source.type==='condition'?'True · ผ่านเงื่อนไข':'ดำเนินเรื่องต่อ';
 else if(source.type==='condition'&&edge.sourceHandle==='otherwise')output='False · ไม่ผ่านเงื่อนไข';
 else issues.push('Unknown source handle');
 if(!target)issues.push('Missing target node');else if(target.type==='entry')issues.push('Entry node cannot receive connections');
 if(edge.targetHandle)issues.push('Unknown target input');
 const input=edge.targetHandle??'default input';
 const meaning=`${source?title(source):edge.source} [${edge.source}] → ${choiceNumber?'ตัวเลือก '+choiceNumber+': ':''}${output} → ${target?title(target):edge.target} [${edge.target}]`;
 return {source,target,output,choiceNumber,input,meaning,issues};
}
export function validSelection(index:GraphIndex,selection:Selection,groupIds?:ReadonlySet<string>):Selection {
 if(!selection)return null;
 if(selection.kind==='group')return groupIds?.has(selection.id)?selection:null;
 return (selection.kind==='node'?index.nodes.has(selection.id):index.edges.has(selection.id))?selection:null;
}
export function openingNodes(index:GraphIndex,entry:string):string[]{
 const found:string[]=[],visited=new Set<string>(),queue=[entry];
 for(let i=0;i<queue.length&&found.length<8;i++){
  const id=queue[i]!;if(visited.has(id))continue;visited.add(id);
  const node=index.nodes.get(id);if(!node)continue;found.push(id);
  if(node.type==='choices'||node.type==='end')continue;
  for(const edge of index.outgoing.get(id)??[])if(!visited.has(edge.target))queue.push(edge.target);
 }
 return found;
}
export function trace(index:GraphIndex,selection:Selection,mode:TraceMode){
 const nodes=new Set<string>(),edges=new Set<string>();
 if(!selection||selection.kind==='group')return {nodes,edges};
 if(selection.kind==='edge'){const edge=index.edges.get(selection.id);if(edge){nodes.add(edge.source);nodes.add(edge.target);edges.add(edge.id);}return {nodes,edges};}
 if(!index.nodes.has(selection.id))return {nodes,edges};
 nodes.add(selection.id);const queue=[selection.id];
 // Each node is queued once. Even cyclic/dangling drafts take O(V+E) work.
 for(let i=0;i<queue.length&&i<=index.nodes.size;i++){
  const id=queue[i]!;
  const links=mode==='upstream'?index.incoming.get(id)??[]:mode==='downstream'?index.outgoing.get(id)??[]:[...(index.incoming.get(id)??[]),...(index.outgoing.get(id)??[])];
  for(const edge of links){edges.add(edge.id);const next=mode==='upstream'?edge.source:mode==='downstream'?edge.target:edge.source===id?edge.target:edge.source;
   if(!nodes.has(next)){nodes.add(next);if(mode!=='direct'&&index.nodes.has(next))queue.push(next);}
  }
 }
 return {nodes,edges};
}
const normal=(text:string)=>text.normalize('NFKC').toLocaleLowerCase();
export function search(index:GraphIndex,query:string,targets:ReadonlyMap<string,string>){
 const words=normal(query.trim()).split(/\s+/).filter(Boolean);
 return [...index.nodes.values()].filter(n=>{const text=normal([n.id,n.type,title(n),n.text??'',n.action??'',n.condition??'',conditionLabels[n.condition??'']??'',n.argument??'',targets.get(n.argument??'')??'',...(n.choices??[]).map(c=>c.text)].join(' '));return words.every(w=>text.includes(w));});
}
