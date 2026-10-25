import {useEffect,useMemo,useRef,useState} from 'react';
import type {Canvas} from './mapping';
import {buildRoutingGeometry} from './routing-geometry';
import {createRouteClient,createLayoutClient,CancelledTask,type RouteInput,type TaskRunner} from './routing-client';
import type {RoutingGraph,RoutingResult,LayoutResult} from './routing-types';
type Candidate={canvas:Canvas;result:LayoutResult;baseGeneration:number;graphId:string;baseKey:string};
export function useGraphRouting(canvas:Canvas,entry:string,graphId:string,generation:number,revision:number){
 const [mode,setMode]=useState<'smart'|'legacy'>('smart'),[result,setResult]=useState<RoutingResult|null>(null),[routing,setRouting]=useState(false),[error,setError]=useState(''),[candidate,setCandidate]=useState<Candidate|null>(null),[layoutBusy,setLayoutBusy]=useState(false),[layoutMessage,setLayoutMessage]=useState('');
 const routeClient=useRef<TaskRunner<RouteInput,RoutingResult>|null>(null),layoutClient=useRef<TaskRunner<RoutingGraph,LayoutResult>|null>(null),layoutSeq=useRef(0),cache=useRef(new Map<string,RoutingResult>()),previous=useRef<RouteInput['previous']>(undefined),latest=useRef({canvas,generation,graphId});latest.current={canvas,generation,graphId};
 // Only settled revisions enter the router. React Flow still renders live drag
 // positions, using cheap attached endpoint previews until drop/worker response.
 const snapshot=useMemo(()=>buildRoutingGeometry(canvas,entry),[entry,graphId,revision]);
 function remember(key:string,value:RoutingResult){cache.current.delete(key);cache.current.set(key,value);while(cache.current.size>6)cache.current.delete(cache.current.keys().next().value!);}
 function cancelLayout(){layoutSeq.current++;layoutClient.current?.cancel();setCandidate(null);setLayoutBusy(false);setLayoutMessage('');}
 useEffect(()=>{cache.current.clear();previous.current=undefined;cancelLayout();setResult(null);},[graphId]);
 useEffect(()=>{
  let active=true;setError('');
  if(!graphId||!snapshot.graph.nodes.length||mode==='legacy'){setRouting(false);routeClient.current?.cancel();return;}
  const known=cache.current.get(snapshot.key);if(known){setResult(known);previous.current={graph:snapshot.graph,result:known};setRouting(false);return;}
  setRouting(true);routeClient.current??=createRouteClient();
  void routeClient.current.run({graph:snapshot.graph,previous:previous.current}).then(value=>{if(!active)return;remember(snapshot.key,value);previous.current={graph:snapshot.graph,result:value};setResult(value);setRouting(false);}).catch(e=>{if(!active||e instanceof CancelledTask)return;setError(e instanceof Error?e.message:String(e));setRouting(false);});
  return()=>{active=false;routeClient.current?.cancel();};
 },[snapshot.key,graphId,mode]);
 useEffect(()=>()=>{routeClient.current?.dispose();layoutClient.current?.dispose();layoutSeq.current++;},[]);
 async function requestLayout(){
  cancelLayout();const token=++layoutSeq.current,base=latest.current,geometry=buildRoutingGeometry(base.canvas,entry);if(!geometry.graph.nodes.length)return;
  setLayoutBusy(true);setLayoutMessage('Calculating ELK layered layout…');layoutClient.current??=createLayoutClient();
  try{const value=await layoutClient.current.run(geometry.graph);if(token!==layoutSeq.current||latest.current.graphId!==base.graphId||latest.current.generation!==base.generation)return;
   const next={...base.canvas,nodes:base.canvas.nodes.map(n=>{const position=value.positions[n.id];if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y))throw Error('Layout is missing a node position');return {...n,position:{...position}};})};
   setCandidate({canvas:next,result:value,baseGeneration:base.generation,graphId:base.graphId,baseKey:geometry.key});setLayoutMessage('Layout preview — Apply enables Smart routes. Nothing has been saved.'+(value.warnings[0]?.startsWith('Dense graph:')?' '+value.warnings[0]:''));
  }catch(e){if(token===layoutSeq.current&&!(e instanceof CancelledTask))setLayoutMessage('Auto Arrange failed: '+(e instanceof Error?e.message:String(e)));}finally{if(token===layoutSeq.current)setLayoutBusy(false);}
 }
 function applyLayout():Canvas|null{
  const c=candidate;if(!c||c.graphId!==latest.current.graphId||c.baseGeneration!==latest.current.generation||c.baseKey!==buildRoutingGeometry(latest.current.canvas,entry).key){cancelLayout();setLayoutMessage('Layout became outdated; calculate it again.');return null;}
  const geometry=buildRoutingGeometry(c.canvas,entry);remember(geometry.key,c.result);previous.current={graph:geometry.graph,result:c.result};setResult(c.result);setMode('smart');setCandidate(null);setLayoutMessage('');return c.canvas;
 }
 const displayedCanvas=candidate?.canvas??canvas,displayedResult=candidate?.result??result;
 return {mode,setMode,result:displayedResult,displayedCanvas,snapshot,routing,error,candidate,layoutBusy,layoutMessage,requestLayout,applyLayout,cancelLayout,warnings:[...snapshot.warnings,...(displayedResult?.warnings??[])]};
}
