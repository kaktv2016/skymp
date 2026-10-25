/** View-only geometry. No routing fields enter the executable dialogue schema. */
export interface Point {x:number;y:number;}
export interface RoutingPort {id:string;handle:string|null;side:'EAST'|'WEST';x:number;y:number;order:number;}
export interface RoutingNode {id:string;type:string;x:number;y:number;width:number;height:number;ports:RoutingPort[];}
export interface RoutingEdge {id:string;source:string;target:string;sourceHandle:string;start:Point;end:Point;order:number;}
export interface RoutingGraph {nodes:RoutingNode[];edges:RoutingEdge[];entry:string;}
export interface RoutedPath {id:string;points:Point[];returning:boolean;status:'clean'|'fallback';origin:'smart'|'elk';reason?:string;}
export interface RoutingResult {routes:Map<string,RoutedPath>;warnings:string[];elapsedMs:number;recomputed:number;reused:number;}
export interface LayoutResult extends RoutingResult {positions:Record<string,Point>;}
export function repositionGeometry(graph:RoutingGraph,positions:Record<string,Point>):RoutingGraph{
 const old=new Map(graph.nodes.map(n=>[n.id,n])),nodes=graph.nodes.map(n=>({...n,...positions[n.id]})),next=new Map(nodes.map(n=>[n.id,n]));
 return {...graph,nodes,edges:graph.edges.map(e=>{const s=old.get(e.source)!,t=old.get(e.target)!,ns=next.get(e.source)!,nt=next.get(e.target)!;return {...e,start:{x:e.start.x-s.x+ns.x,y:e.start.y-s.y+ns.y},end:{x:e.end.x-t.x+nt.x,y:e.end.y-t.y+nt.y}};})};
}
