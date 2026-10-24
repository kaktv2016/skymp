import type {Node as FlowNode,Edge,Connection} from '@xyflow/react';
import type {Graph,Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';
export type BlueprintNode=FlowNode<{runtime:Node;targetLabel?:string},'blueprint'>;
export interface Canvas {nodes:BlueprintNode[];edges:Edge[];}
export type Layout=Record<string,{x:number;y:number}>;
export const NODE_WIDTH=272;
export function nodeHeight(node:Node):number {
 return node.type==='choices'?132+Math.max(1,node.choices?.length??0)*38:node.type==='npc'?230:node.type==='condition'?208:node.type==='end'?126:170;
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
 const edges:Edge[]=[];
 for(const n of graph.nodes){const add=(handle:string,target:string|undefined)=>{if(target)edges.push({id:n.id+':'+handle,source:n.id,sourceHandle:handle,target});};
  if(n.type==='choices')n.choices?.forEach(c=>add('choice:'+c.id,c.next));
  else if(n.type!=='end'){add('next',n.next);if(n.type==='condition')add('otherwise',n.otherwise);}
 }
 const automatic=arrange({nodes,edges},graph.entry);
 const result={nodes:automatic.nodes.map(n=>Object.hasOwn(layout,n.id)?{...n,position:layout[n.id]!}:n),edges};
 // Migrate the old overlapping grid in memory; a subsequent explicit Save stores it.
 return overlaps(result)?automatic:result;
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
