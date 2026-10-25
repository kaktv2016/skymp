import {routeSmart} from './orthogonal-router';
import type {RouteInput} from './routing-client';
self.onmessage=event=>{const {id,input}:{id:number;input:RouteInput}=event.data;try{self.postMessage({id,value:routeSmart(input.graph,input.previous)});}catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}};
