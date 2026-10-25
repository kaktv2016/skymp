import type {ElkNode,ElkEdgeSection} from 'elkjs/lib/elk-api';
import type {RoutingGraph,LayoutResult,Point,RoutedPath} from './routing-types';
import {repositionGeometry} from './routing-types';
import {routeSmart} from './orthogonal-router';
export interface LayoutEngine {layout(graph:ElkNode):Promise<ElkNode>;}
export function toElkGraph(graph:RoutingGraph):ElkNode{
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),depth=new Map<string,number>([[graph.entry,0]]),queue=[graph.entry];
 for(let i=0;i<queue.length;i++)for(const e of graph.edges)if(e.source===queue[i]&&!depth.has(e.target)){depth.set(e.target,depth.get(e.source)!+1);queue.push(e.target);}
 return {id:'frostveil-view',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL','elk.randomSeed':'1','elk.spacing.nodeNode':'48','elk.spacing.componentComponent':'64','elk.layered.spacing.nodeNodeBetweenLayers':'104','elk.layered.spacing.edgeNodeBetweenLayers':'20','elk.layered.spacing.edgeEdgeBetweenLayers':'10','elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES','elk.layered.crossingMinimization.strategy':'LAYER_SWEEP','elk.layered.mergeEdges':'false'},children:graph.nodes.map(n=>({id:n.id,x:n.x,y:n.y,width:n.width,height:n.height,layoutOptions:{'elk.portConstraints':'FIXED_POS',...(n.id===graph.entry?{'elk.layered.layering.layerConstraint':'FIRST'}:n.type==='end'?{'elk.layered.layering.layerConstraint':'LAST'}:{})},ports:n.ports.map(p=>({id:p.id,x:p.x,y:p.y,width:0,height:0,layoutOptions:{'elk.port.side':p.side,'elk.port.index':String(p.order),'elk.port.borderOffset':'6'}}))})),edges:graph.edges.map(e=>({id:e.id,layoutOptions:{'elk.layered.priority.direction':String((depth.get(e.target)??0)>(depth.get(e.source)??0)?100:0)},sources:[nodes.get(e.source)!.ports.find(p=>p.side==='EAST'&&p.handle===e.sourceHandle)!.id],targets:[nodes.get(e.target)!.ports.find(p=>p.side==='WEST')!.id]}))};
}
function chain(sections:ElkEdgeSection[]):Point[]{
 if(!sections.length)throw Error('ELK did not return edge sections');
 const byId=new Map(sections.map(s=>[s.id,s])),seen=new Set<string|undefined>(),points:Point[]=[];
 let current=sections.find(s=>!s.incomingSections?.length);if(!current)throw Error('Cyclic ELK section chain');
 while(current){if(seen.has(current.id))throw Error('Cyclic ELK section chain');seen.add(current.id);for(const p of [current.startPoint,...(current.bendPoints??[]),current.endPoint])if(!points.length||points.at(-1)!.x!==p.x||points.at(-1)!.y!==p.y)points.push({...p});if((current.outgoingSections?.length??0)>1)throw Error('Unexpected split ELK edge');current=current.outgoingSections?.[0]?byId.get(current.outgoingSections[0]):undefined;}
 if(seen.size!==sections.length)throw Error('Disconnected ELK sections');return points;
}
/** Dense strongly connected drafts can explode Layered's dummy-node expansion.
 * Layout a deterministic spanning forest above 512 edges; keep those actual ELK
 * sections and obstacle-route ALL remaining executable edges at the new positions.
 * This is view-only decomposition, never a graph/schema edit. */
export function layoutBackbone(graph:RoutingGraph):RoutingGraph{
 if(graph.edges.length<=512)return graph;
 const seen=new Set<string>(),keep=new Set<string>();
 const outgoing=new Map<string,typeof graph.edges>();for(const e of graph.edges){const list=outgoing.get(e.source)??[];list.push(e);outgoing.set(e.source,list);}
 for(const start of [graph.entry,...graph.nodes.map(n=>n.id)]){if(seen.has(start))continue;seen.add(start);const queue=[start];for(let i=0;i<queue.length;i++)for(const e of outgoing.get(queue[i])??[])if(!seen.has(e.target)){keep.add(e.id);seen.add(e.target);queue.push(e.target);}}
 return {...graph,edges:graph.edges.filter(e=>keep.has(e.id))};
}
export async function layoutWithElk(graph:RoutingGraph,engine:LayoutEngine,fixedRouter:(graph:RoutingGraph)=>Promise<import('./routing-types').RoutingResult>=async g=>routeSmart(g)):Promise<LayoutResult>{
 const started=performance.now(),backbone=layoutBackbone(graph),output=await engine.layout(toElkGraph(backbone)),positions=Object.fromEntries((output.children??[]).map(n=>{if(!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('ELK returned an invalid position');return [n.id,{x:n.x!,y:n.y!}];}));
 if(Object.keys(positions).length!==graph.nodes.length)throw Error('ELK lost graph nodes');
 const moved=repositionGeometry(graph,positions),edges=new Map(moved.edges.map(e=>[e.id,e])),routes=new Map<string,RoutedPath>();
 for(const e of output.edges??[]){const original=edges.get(e.id);if(!original)throw Error('ELK returned an unknown edge');const points=chain(e.sections??[]);points[0]={...original.start};points[points.length-1]={...original.end};for(let i=1;i<points.length;i++)if(Math.abs(points[i]!.x-points[i-1]!.x)>1e-6&&Math.abs(points[i]!.y-points[i-1]!.y)>1e-6)throw Error('ELK returned a nonorthogonal edge');routes.set(e.id,{id:e.id,points,returning:original.end.x<=original.start.x,status:'clean',origin:'elk'});}
 if(routes.size!==backbone.edges.length)throw Error('ELK lost graph edges');const warnings:string[]=[];
 if(backbone!==graph){const remaining={...moved,edges:moved.edges.filter(e=>!routes.has(e.id))},fixed=await fixedRouter(remaining);for(const [id,route] of fixed.routes)routes.set(id,route);warnings.push(`Dense graph: ELK spanning layout (${backbone.edges.length} sections), Smart routing for ${remaining.edges.length} additional links`,...fixed.warnings);}
 if(routes.size!==graph.edges.length)throw Error('Layout lost graph links');return {positions,routes,warnings,elapsedMs:performance.now()-started,recomputed:routes.size,reused:0};
}
