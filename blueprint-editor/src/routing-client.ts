import {ElkLayoutWorker} from './elk-browser';
import type {RoutingGraph,RoutingResult,LayoutResult} from './routing-types';
interface WorkerLike {onmessage:((event:any)=>void)|null;onerror:((event:any)=>void)|null;postMessage(value:any):void;terminate():void;}
export class CancelledTask extends Error {constructor(){super('Computation cancelled');}}
export class TaskRunner<I,O>{
 private worker?:WorkerLike;private id=0;private pending?:{id:number;resolve:(value:O)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
 constructor(private factory:()=>WorkerLike,private timeout=15000){}
 run(input:I):Promise<O>{
  this.cancel();const id=++this.id;
  return new Promise((resolve,reject)=>{try{
   this.worker??=this.factory();
   const timer=setTimeout(()=>{if(this.pending?.id!==id)return;this.pending=undefined;this.worker?.terminate();this.worker=undefined;reject(Error('Routing computation timed out'));},this.timeout);
   this.pending={id,resolve,reject,timer};
   this.worker.onmessage=event=>{const p=this.pending;if(!p||event.data?.id!==p.id)return;clearTimeout(p.timer);this.pending=undefined;event.data.error?p.reject(Error(event.data.error)):p.resolve(event.data.value);};
   this.worker.onerror=event=>{const p=this.pending;if(!p)return;clearTimeout(p.timer);this.pending=undefined;this.worker?.terminate();this.worker=undefined;p.reject(Error(event.message||'Routing worker failed'));};
   this.worker.postMessage({id,input});
  }catch(error){if(this.pending)clearTimeout(this.pending.timer);this.pending=undefined;this.worker?.terminate();this.worker=undefined;reject(error instanceof Error?error:Error(String(error)));}});
 }
 cancel(){if(!this.pending)return;const p=this.pending;this.pending=undefined;clearTimeout(p.timer);this.worker?.terminate();this.worker=undefined;p.reject(new CancelledTask());}
 dispose(){this.cancel();this.worker?.terminate();this.worker=undefined;}
}
export type RouteInput={graph:RoutingGraph;previous?:{graph:RoutingGraph;result:RoutingResult}};
export const createRouteClient=()=>new TaskRunner<RouteInput,RoutingResult>(()=>new Worker(new URL('./manual-routing.worker.ts',import.meta.url),{type:'module'}));
export const createLayoutClient=()=>new TaskRunner<RoutingGraph,LayoutResult>(()=>new ElkLayoutWorker(),20000);
