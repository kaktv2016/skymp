import type {Node as FlowNode,Edge,Connection} from '@xyflow/react';
import type {Graph,Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';
export type BlueprintNode=FlowNode<{runtime:Node},'blueprint'>;
export interface Canvas {nodes:BlueprintNode[];edges:Edge[];}
export type Layout=Record<string,{x:number;y:number}>;
export function toCanvas(graph:Graph,layout:Layout={}):Canvas {
 const nodes=graph.nodes.map((runtime,i)=>({id:runtime.id,type:'blueprint' as const,position:Object.hasOwn(layout,runtime.id)?layout[runtime.id]!:{x:(i%4)*300,y:Math.floor(i/4)*200},data:{runtime:structuredClone(runtime)}}));
 const edges:Edge[]=[];
 for(const n of graph.nodes){const add=(handle:string,target:string|undefined)=>{if(target)edges.push({id:n.id+':'+handle,source:n.id,sourceHandle:handle,target});};
  if(n.type==='choices')n.choices?.forEach(c=>add('choice:'+c.id,c.next));
  else if(n.type!=='end'){add('next',n.next);if(n.type==='condition')add('otherwise',n.otherwise);}
 }
 return {nodes,edges};
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
