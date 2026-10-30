import {probeDevelopmentClient,mapDevelopmentModels} from '../modules/npc/development-identity';
/** Existing gamemode event source. No installed JS/DLL patch, browser or file write. */
function installDevelopmentIdentity(ctx:any,probe:any,map:any){
 const sp=ctx.sp,key='__fvNpcDevelopmentIdentity';
 sp.storage[key]?.dispose?.();let disposed=false,handle:any;
 const manager:any={spec:null,proof:null,nonce:null,actor:0,verified:false,
  dispose(){disposed=true;if(sp.storage[key]===manager)delete sp.storage[key];if(handle)sp.off(handle);},
  receive(value:any,owner:any){
   if(disposed||ctx._expired||!sp.mpClientPlugin.isConnected())return;
   const settings=sp.settings['skymp5-client'];
   if(settings?.['server-ip']!=='127.0.0.1'||settings?.['server-port']!==17777)return;
   const actor=owner.getMyFormIdInServerFormat();
   if(manager.actor&&manager.actor!==actor){manager.dispose();return;}manager.actor=actor;
   if(value?.op==='challenge'&&[1,2].includes(value.version)&&value.nonce!==manager.nonce){
    manager.spec=JSON.parse(JSON.stringify(value));manager.nonce=value.nonce;manager.verified=false;manager.blockedNonce=null;
    manager.proof=probe(sp,manager.spec);
    ctx.sendEvent({...manager.proof,op:'proof',version:value.version,nonce:value.nonce,profileHash:value.profileHash,catalogHash:value.catalogHash,...(value.version===2?{specHash:value.specHash}:{})});
   }else if(value?.op==='verified'&&value.nonce===manager.nonce&&value.nonce!==manager.blockedNonce&&value.profileHash===manager.spec?.profileHash&&value.catalogHash===manager.spec?.catalogHash&&(manager.spec.version===1||value.specHash===manager.spec.specHash)){manager.verified=manager.proof?.ok===true;if(manager.verified&&manager.armed!==value.nonce){manager.armed=value.nonce;ctx.sendEvent({op:'armed',version:manager.spec.version,nonce:value.nonce,...(manager.spec.version===2?{specHash:manager.spec.specHash}:{})});}}
   else if(value?.op==='revoked')manager.verified=false;
   const forms=sp.storage.worldModel?.forms;
   if(Array.isArray(forms)&&manager.spec){
    const result=map(forms,manager.verified?manager.proof:null,manager.spec);
    if(!result.ok&&manager.verified){manager.verified=false;manager.blockedNonce=manager.nonce;ctx.sendEvent({op:'mappingFault',version:manager.spec.version,nonce:manager.nonce,...(manager.spec.version===2?{specHash:manager.spec.specHash}:{})});sp.printConsole('[Frostveil development] fixture hidden: identity mapping failed');}
   }
  }};
 sp.storage[key]=manager;
 handle=sp.on('update',()=>{if(ctx._expired||!sp.mpClientPlugin.isConnected())manager.dispose();});
}
export function developmentIdentitySources(){return {event:'('+installDevelopmentIdentity.toString()+')(ctx,'+probeDevelopmentClient.toString()+','+mapDevelopmentModels.toString()+');',owner:'var d=ctx.sp.storage.__fvNpcDevelopmentIdentity;if(d)d.receive(ctx.value,ctx);'};}
