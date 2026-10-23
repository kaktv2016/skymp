import {DialogueRuntime} from './dialogue-runtime';
import {validateGraph} from './graph-model';
import {actorId} from '../../engine/ids';
import type {SkyMpAdapter} from '../../engine/adapter';
/** Runs the production interpreter against private inert adapters. No real actor,
 * native reference, EconomyService, persistence or live transport is accepted. */
export function previewDialogue(input:unknown,choices:unknown,activeCourier:boolean,routes:readonly string[],permits:readonly string[]) {
 const graph=validateGraph(input,routes,permits);
 if(!Array.isArray(choices)||choices.length>128||choices.some(c=>typeof c!=='string'||c.length>64))throw Error('Preview choice limit');
 if(typeof activeCourier!=='boolean')throw Error('Invalid preview context');
 const actor=actorId(1),actions:string[][]=[];let current:any;
 const npc={id:'preview-clerk',name:'Preview Clerk',formId:1,enabled:true,deleted:false,location:{cell:'preview',pos:[0,0,0]}};
 const adapter={sessionForActor:()=>({userId:1,profileId:1,guid:'preview-only'}),fullLocation:()=>({cell:'preview',pos:[0,0,0]}),readCourier:()=>({lifecycle:activeCourier?'active':'idle'})} as unknown as SkyMpAdapter;
 const runtime=new DialogueRuntime(adapter,graph,()=>npc,(_actor,args)=>{actions.push(args.slice());return {ok:true,data:{systemMessage:'[Preview only] '+args.join(' ')}};},(_actor,payload)=>{current=structuredClone(payload);},()=>1000);
 try {
  if(!runtime.receive(actor,{op:'open',npc:1}))throw Error('Preview could not open');
  for(const choice of choices){if(current?.closed||!runtime.receive(actor,{op:'choose',token:current.token,node:current.node,choice}))throw Error('Invalid preview choice');}
  return {current:structuredClone(current),actions};
 }finally{runtime.clear();}
}
