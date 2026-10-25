import ELK from 'elkjs/lib/elk-api';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import {layoutWithElk} from './elk-layout';
// Use the installed ELK native worker protocol, not elk.bundled inside a worker:
// that bundle detects self and cannot construct its emulated Worker in that context.
export class ElkLayoutWorker {
 onmessage:((event:any)=>void)|null=null;onerror:((event:any)=>void)|null=null;
 private native=new Worker(workerUrl);private engine=new ELK({workerFactory:()=>this.native});private stopped=false;private fixed?:Worker;
 postMessage({id,input}:any){this.native.onerror=event=>this.onerror?.(event);void layoutWithElk(input,this.engine,graph=>new Promise((resolve,reject)=>{const worker=this.fixed=new Worker(new URL('./manual-routing.worker.ts',import.meta.url),{type:'module'});worker.onmessage=event=>{worker.terminate();this.fixed=undefined;event.data.error?reject(Error(event.data.error)):resolve(event.data.value);};worker.onerror=event=>{worker.terminate();this.fixed=undefined;reject(Error(event.message));};worker.postMessage({id:1,input:{graph}});})).then(value=>{if(!this.stopped)this.onmessage?.({data:{id,value}});}).catch(error=>{if(!this.stopped)this.onmessage?.({data:{id,error:error instanceof Error?error.message:String(error)}});});}
 terminate(){this.stopped=true;this.native.terminate();this.fixed?.terminate();}
}
