import {Position,type Node as FlowNode,type Edge,type Connection,type NodeHandle} from '@xyflow/react';
import type {Graph,Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';
export type BlueprintNode=FlowNode<{runtime:Node;targetLabel?:string;related?:boolean;spotlight?:boolean;onPortFocus?:(source:string,handle:string|null,mode?:'hover'|'focus')=>void},'blueprint'>;
export interface Canvas {nodes:BlueprintNode[];edges:Edge[];}
export type Layout=Record<string,{x:number;y:number}>;
export const NODE_WIDTH=304;
export function outputRows(node:Node){
 const rows=node.type==='choices'?(node.choices??[]).map(c=>({id:'choice:'+c.id,label:c.text||'Untitled choice'})):node.type==='end'?[]:node.type==='condition'?[{id:'next',label:'เมื่อเงื่อนไขเป็นจริง'},{id:'otherwise',label:'เมื่อเงื่อนไขเป็นเท็จ'}]:[{id:'next',label:node.type==='action'?'หลังใช้บริการ':'ดำเนินเรื่องต่อ'}];
 return rows.map(row=>{let units=0;for(const c of row.label.normalize('NFC'))units+=/\p{Mark}/u.test(c)?0:/[MW@%]/.test(c)?1.7:(c.codePointAt(0)??0)>=0x1f000?2.4:(c.codePointAt(0)??0)>=0x2e80?2:/[A-Z]/.test(c)?1.3:/[\u0e00-\u0e7f]/.test(c)?1.2:1;return {...row,height:Math.max(44,Math.ceil(units/24)*20+18)};});
}
export function nodeHeight(node:Node):number {
 return node.type==='choices'?132+Math.max(44,outputRows(node).reduce((s,r)=>s+r.height,0)):node.type==='npc'?280:node.type==='condition'?248:node.type==='end'?148:190;
}
/** Fixed card geometry lets React Flow navigate/route unmounted viewport nodes. */
export function nodeHandles(node:Node):NodeHandle[]{
 const height=nodeHeight(node),outputs=outputRows(node);
 const handles:NodeHandle[]=node.type==='entry'?[]:[{id:null,type:'target',position:Position.Left,x:-6,y:height/2-6,width:12,height:12}];
 let y=height-36-outputs.reduce((s,r)=>s+r.height,0);
 outputs.forEach(row=>{handles.push({id:row.id,type:'source',position:Position.Right,x:NODE_WIDTH-6,y:y+row.height/2-6,width:12,height:12});y+=row.height;});
 return handles;
}
/** Layer by first reachable depth, keeping return links out of the ranking.
 * Drafts may have cycles, missing links and detached nodes; layout must still terminate. */
export function arrange(canvas:Canvas,entry:string):Canvas {
 const depths=new Map<string,number>(), ids=new Set(canvas.nodes.map(n=>n.id));
 const start=ids.has(entry)?entry:canvas.nodes[0]?.id;
 if(start)depths.set(start,0);
 const queue=start?[start]:[];
 for(let i=0;i<queue.length;i++)for(const edge of canvas.edges.filter(e=>e.source===queue[i])){
  if(ids.has(edge.target)&&!depths.has(edge.target)){depths.set(edge.target,depths.get(queue[i]!)!+1);queue.push(edge.target);}
 }
 let last=Math.max(0,...depths.values());
 for(const node of canvas.nodes)if(!depths.has(node.id))depths.set(node.id,last+1);
 last=Math.max(0,...depths.values());
 for(const node of canvas.nodes)if(node.data.runtime.type==='end')depths.set(node.id,last+1);
 const columns=new Map<number,BlueprintNode[]>();
 for(const node of canvas.nodes){const depth=depths.get(node.id)!;const col=columns.get(depth)??[];col.push(node);columns.set(depth,col);}
 const layout:Layout={};
 for(const [depth,nodes]of columns){
  const total=nodes.reduce((sum,n)=>sum+nodeHeight(n.data.runtime)+32,0)-32;
  let y=-total/2;
  for(const n of nodes){layout[n.id]={x:depth*(NODE_WIDTH+128),y};y+=nodeHeight(n.data.runtime)+32;}
 }
 return {...canvas,nodes:canvas.nodes.map(n=>({...n,position:layout[n.id]!}))};
}
export function overlaps(canvas:Canvas):boolean {
 return canvas.nodes.some((a,i)=>canvas.nodes.slice(i+1).some(b=>a.position.x<b.position.x+NODE_WIDTH&&a.position.x+NODE_WIDTH>b.position.x&&a.position.y<b.position.y+nodeHeight(b.data.runtime)&&a.position.y+nodeHeight(a.data.runtime)>b.position.y));
}
export function toCanvas(graph:Graph,layout:Layout={}):Canvas {
 const nodes=graph.nodes.map((runtime,i)=>({id:runtime.id,type:'blueprint' as const,position:Object.hasOwn(layout,runtime.id)?layout[runtime.id]!:{x:(i%4)*300,y:Math.floor(i/4)*200},data:{runtime:structuredClone(runtime)}}));
 const edges=edgesFromNodes(graph.nodes);
 const automatic=arrange({nodes,edges},graph.entry);
 const result={nodes:automatic.nodes.map(n=>Object.hasOwn(layout,n.id)?{...n,position:layout[n.id]!}:n),edges};
 // Saved/manual positions are authoritative, even when overlapping. Only the
 // explicit arrange operation may relocate them.
 return result;
}
export function fromCanvas(header:Pick<Graph,'schemaVersion'|'id'|'version'|'entry'>,canvas:Canvas):Graph {
 const nodes=canvas.nodes.map(n=>structuredClone(n.data.runtime));
 for(const n of nodes){const target=(handle:string)=>canvas.edges.find(e=>e.source===n.id&&e.sourceHandle===handle)?.target??'';
  if(n.type==='choices')n.choices=n.choices?.map(c=>({...c,next:target('choice:'+c.id)}));
  else if(n.type!=='end'){n.next=target('next');if(n.type==='condition')n.otherwise=target('otherwise');}
 }
 return {...header,nodes};
}
export function validConnection(connection:Connection,canvas:Canvas):boolean {
 const source=canvas.nodes.find(n=>n.id===connection.source)?.data.runtime,target=canvas.nodes.find(n=>n.id===connection.target)?.data.runtime;
 if(!source||!target||source.id===target.id||target.type==='entry'||source.type==='end')return false;
 const handle=connection.sourceHandle;
 if(source.type==='choices')return !!source.choices?.some(c=>'choice:'+c.id===handle);
 return handle==='next'||source.type==='condition'&&handle==='otherwise';
}
export function connect(connection:Connection,canvas:Canvas):Canvas {
 if(!validConnection(connection,canvas))throw Error('Invalid connection');
 const edge={id:connection.source+':'+connection.sourceHandle,source:connection.source!,sourceHandle:connection.sourceHandle!,target:connection.target!};
 return {...canvas,edges:[...canvas.edges.filter(e=>!(e.source===edge.source&&e.sourceHandle===edge.sourceHandle)),edge]};
}
export function positions(canvas:Canvas):Layout{return Object.fromEntries(canvas.nodes.map(n=>[n.id,n.position]));}

export function edgesFromNodes(nodes:readonly Node[]):Edge[]{
 const edges:Edge[]=[];
 for(const n of nodes){const add=(handle:string,target:string|undefined)=>{if(target)edges.push({id:n.id+':'+handle,source:n.id,sourceHandle:handle,target});};
  if(n.type==='choices')n.choices?.forEach(c=>add('choice:'+c.id,c.next));
  else if(n.type!=='end'){add('next',n.next);if(n.type==='condition')add('otherwise',n.otherwise);}
 }
 return edges;
}
