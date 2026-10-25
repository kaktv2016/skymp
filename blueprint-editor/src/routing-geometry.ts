import {NODE_WIDTH,nodeHeight,nodeHandles,type Canvas} from './mapping';
import type {RoutingGraph,RoutingNode,RoutingEdge} from './routing-types';
export function buildRoutingGeometry(canvas:Canvas,entry:string){
 const warnings:string[]=[],nodes:RoutingNode[]=[];
 for(const n of canvas.nodes){if(!Number.isFinite(n.position.x)||!Number.isFinite(n.position.y)){warnings.push(n.id+': invalid position');continue;}
  const handles=nodeHandles(n.data.runtime);let order=0;
  nodes.push({id:n.id,type:n.data.runtime.type,x:n.position.x,y:n.position.y,width:NODE_WIDTH,height:nodeHeight(n.data.runtime),ports:handles.map(h=>({id:encodeURIComponent(n.id)+'/'+h.type+'/'+encodeURIComponent(h.id??'input'),handle:h.id??null,side:h.type==='source'?'EAST' as const:'WEST' as const,x:h.type==='source'?h.x+(h.width??12):h.x,y:h.y+(h.height??12)/2,order:h.type==='source'?order++:0}))});
 }
 const byId=new Map(nodes.map(n=>[n.id,n])),edges:RoutingEdge[]=[];
 for(const e of canvas.edges){const source=byId.get(e.source),target=byId.get(e.target),output=source?.ports.find(p=>p.side==='EAST'&&p.handle===e.sourceHandle),input=target?.ports.find(p=>p.side==='WEST'&&p.handle===(e.targetHandle??null));
  if(!source||!target||!output||!input){warnings.push(e.id+': missing node or exact handle');continue;}
  edges.push({id:e.id,source:e.source,target:e.target,sourceHandle:e.sourceHandle!,start:{x:source.x+output.x,y:source.y+output.y},end:{x:target.x+input.x,y:target.y+input.y},order:output.order});
 }
 const graph:RoutingGraph={nodes,edges,entry};return {graph,warnings,key:geometryKey(graph)};
}
export function geometryKey(graph:RoutingGraph){return JSON.stringify([graph.entry,graph.nodes.map(n=>[n.id,n.type,n.x,n.y,n.width,n.height,n.ports.map(p=>[p.id,p.x,p.y,p.order])]),graph.edges.map(e=>[e.id,e.source,e.target,e.sourceHandle,e.start,e.end,e.order])]);}
export {repositionGeometry} from './routing-types';
