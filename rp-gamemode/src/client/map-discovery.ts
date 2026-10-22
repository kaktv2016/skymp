/** Serialized as an independent server-delivered event source. Native wrappers
 * are local to an update/event callback; owner delivery queues primitives only. */
export function installMapDiscoveryClient(ctx:{sp:any;_expired?:boolean;sendEvent(value:unknown):void;getMyFormIdInServerFormat():number},clock:()=>number=Date.now){
 var sp=ctx.sp,key='__rpMapDiscoveryV1',old=sp.storage[key];
 if(old&&typeof old==='object'&&typeof old.dispose==='function')old.dispose();
 var outboxKey='__rpMapDiscoveryOutboxV1',outboxState=sp.storage[outboxKey];
 if(!outboxState||typeof outboxState!=='object'||outboxState.v!==1||!outboxState.actors||typeof outboxState.actors!=='object'||Array.isArray(outboxState.actors)){outboxState={v:1,seq:0,actors:{}};sp.storage[outboxKey]=outboxState;}
 if(!Number.isSafeInteger(outboxState.seq)||outboxState.seq<0)outboxState.seq=0;
 var lifecycle=sp.storage.__rpMapDiscoveryLifecycleV1;
 if(!lifecycle||typeof lifecycle!=='object'||lifecycle.v!==1){lifecycle={v:1,actor:0,loadSerial:0,boundLoad:0,blocked:false};sp.storage.__rpMapDiscoveryLifecycleV1=lifecycle;}
 var handles:any[]=[],disposed=false,actor=0,outboxActor=0,outbox:any[]=[],readyAfterLoad=!lifecycle.blocked,loadSerial=lifecycle.loadSerial,serial=0,blockedNotice=false;
 var epoch='',token='',lastHello=-Infinity,pending:any=null,restores:any[]=[],probes:any[]=[],completed:Record<string,boolean>={},suppressed:Record<string,boolean>={},failures:Record<string,{attempts:number;next:number}>={},lastProbe=-Infinity;
 var lastOwnerValue:any=null,lastSnapshotSignature='';
 function descriptor(value:any){return typeof value==='string'&&/^[0-9a-f]{1,6}:(skyrim|update|dawnguard|hearthfires|dragonborn)\.esm$/.test(value);}
 function text(value:any){return typeof value==='string'&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);}
 function validRequestId(value:any){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);}
 function storeOutbox(){if(!outboxActor)return;outboxState.actors[String(outboxActor)]=outbox.slice(0,64);sp.storage[outboxKey]=outboxState;}
 function selectOutbox(next:number){if(outboxActor===next)return;storeOutbox();outboxActor=next;var saved=outboxState.actors[String(next)];outbox=Array.isArray(saved)?saved.filter(function(item:any){return item&&validRequestId(item.requestId)&&descriptor(item.world)&&text(item.name)&&Number.isInteger(item.markerType)&&item.markerType>=1&&item.markerType<=59&&typeof item.canTravelTo==='boolean'&&typeof item.isShowAllHidden==='boolean'&&Number.isInteger(item.attempts)&&item.attempts>=0&&item.attempts<=100000&&Number.isFinite(item.next)&&item.next>=0&&(item.probeId===undefined||descriptor(item.probeId));}).slice(0,64).map(function(item:any){var normalized:any={requestId:item.requestId,world:item.world,name:item.name,markerType:item.markerType,isVisible:true,canTravelTo:item.canTravelTo,isShowAllHidden:item.isShowAllHidden,attempts:item.attempts,next:item.next};if(item.probeId)normalized.probeId=item.probeId;normalized.identity=item.world+'|'+item.markerType+'|'+item.name+'|'+item.canTravelTo+'|'+(item.probeId||'');return normalized;}):[];storeOutbox();}
 function enqueue(packet:any){if(!actor||outboxActor!==actor)return false;var identity=packet.world+'|'+packet.markerType+'|'+packet.name+'|'+packet.canTravelTo+'|'+(packet.probeId||'');if(outbox.some(function(item:any){return item.identity===identity;}))return true;if(outbox.length>=64){trace('discovery outbox full; report deferred');return false;}var id='d_'+clock().toString(36)+'_'+(++outboxState.seq).toString(36)+'_'+Math.random().toString(36).slice(2,10);var item:any={requestId:id,identity:identity,world:packet.world,name:packet.name,markerType:packet.markerType,isVisible:true,canTravelTo:packet.canTravelTo,isShowAllHidden:packet.isShowAllHidden,attempts:0,next:0};if(packet.probeId)item.probeId=packet.probeId;outbox.push(item);storeOutbox();return true;}
 function reset(){epoch=clock().toString(36)+'_'+(++serial)+'_'+Math.random().toString(36).slice(2);token='';lastHello=-Infinity;pending=null;restores=[];probes=[];completed={};suppressed={};failures={};lastProbe=-Infinity;lastOwnerValue=null;lastSnapshotSignature='';}
 function playable(){return !sp.Ui.isMenuOpen('Loading Menu')&&!sp.Ui.isMenuOpen('Main Menu');}
 function signature(world:string,type:number,name:string){return world+'|'+type+'|'+name;}
 function discover(event:any){if(disposed||ctx._expired||!actor||!epoch||!readyAfterLoad||!sp.mpClientPlugin.isConnected()||ctx.getMyFormIdInServerFormat()!==actor||!playable())return;
  if(!event||!Number.isInteger(event.worldSpaceId)||event.worldSpaceId<=0||event.worldSpaceId>=0xfe000000||!Number.isInteger(event.markerType)||event.markerType<1||event.markerType>59||!text(event.name)||event.isVisible!==true||typeof event.canTravelTo!=='boolean'||typeof event.isShowAllHidden!=='boolean')return;
  try{var file=sp.Game.getModName(Math.floor(event.worldSpaceId/0x1000000)),world=(event.worldSpaceId%0x1000000).toString(16)+':'+String(file).toLowerCase();if(!descriptor(world))return;
   var sig=signature(world,event.markerType,event.name);if(Object.prototype.hasOwnProperty.call(suppressed,sig)&&(!event.canTravelTo||suppressed[sig]))return;
   var packet={v:1,kind:'discover',epoch:epoch,world:world,name:event.name,markerType:event.markerType,isVisible:true,canTravelTo:event.canTravelTo,isShowAllHidden:event.isShowAllHidden};
   if(enqueue(packet))trace('native discovery queued; world='+world+' type='+event.markerType+' name='+event.name);
  }catch(error){log(error);}
 }
 function trace(message:string){if(typeof sp.writeLogs==='function')try{sp.writeLogs('rpMapDiscovery',message);}catch{}}
 function log(error:any){var message=String(error);if(typeof sp.printConsole==='function')sp.printConsole('[rp-map] '+message);trace(message);}
 function notice(message:string){if(sp.browser&&typeof sp.browser.executeJavaScript==='function')try{sp.browser.executeJavaScript('if(window.__rpChatUiV1)window.__rpChatUiV1.nativeNotice("map",'+JSON.stringify(message)+');');}catch{}}
 function update(){if(disposed)return;if(ctx._expired){manager.dispose();return;}
  try{var next=sp.mpClientPlugin.isConnected()?ctx.getMyFormIdInServerFormat():0;
   if(!next){if(actor){actor=0;selectOutbox(0);reset();}return;}
   if(next!==actor){var changed=lifecycle.actor&&next!==lifecycle.actor;
    readyAfterLoad=!lifecycle.blocked&&(!changed||loadSerial>lifecycle.boundLoad);
    if(changed&&loadSerial<=lifecycle.boundLoad){readyAfterLoad=false;lifecycle.blocked=true;}
    actor=next;selectOutbox(next);if(readyAfterLoad){lifecycle.actor=next;lifecycle.boundLoad=loadSerial;}reset();}
   if(!readyAfterLoad){if(!blockedNotice){blockedNotice=true;var message='Map restoration paused after character change. Restart Skyrim before playing another character.';log(message);notice(message);}return;}
   if(!playable())return;
   lifecycle.actor=actor;lifecycle.boundLoad=loadSerial;
   if(!token&&clock()-lastHello>=2000){lastHello=clock();ctx.sendEvent({v:1,kind:'hello',epoch:epoch});}
   if(pending){var value=pending;pending=null;if(value.actor===actor&&value.epoch===epoch){token=value.token;restores=value.markers;probes=value.probes;
    var activeProbes:Record<string,boolean>={};for(var probeIndex=0;probeIndex<probes.length;probeIndex++)activeProbes['probe|'+probes[probeIndex].id]=true;
    for(var completedKey in completed)if(completedKey.indexOf('probe|')===0&&!activeProbes[completedKey])delete completed[completedKey];
    trace('owner snapshot accepted; markers='+restores.length+' probes='+probes.length);}}
   if(!token)return;
   for(var i=0;i<16&&restores.length;i++){var saved=restores.shift(),done=saved.id+'|'+saved.canTravelTo;if(completed[done])continue;var failure=failures[done];if(failure&&failure.next>clock()){restores.push(saved);continue;}
    try{var parts=saved.id.split(':'),ref=sp.ObjectReference.from(sp.Game.getFormFromFile(parseInt(parts[0],16),parts[1]));if(!ref)throw Error('Saved marker unavailable: '+saved.id);
     var visible=ref.isMapMarkerVisible(),travel=ref.canFastTravelToMarker(),allow=saved.canTravelTo||travel;
     suppressed[signature(saved.world,saved.type,ref.getDisplayName())]=allow;
     if(!visible||saved.canTravelTo&&!travel)ref.addToMap(allow);
     if(!ref.isMapMarkerVisible()||saved.canTravelTo&&!ref.canFastTravelToMarker())throw Error('Native map restoration did not apply: '+saved.id);
     completed[done]=true;trace('restored '+saved.id+' travel='+allow);
    }catch(error){var attempts=(failure?failure.attempts:0)+1;failures[done]={attempts:attempts,next:clock()+1000};if(attempts>=3)completed[done]=true;else restores.push(saved);log(String(error)+'; attempt='+attempts+'/3');}
   }
   if(clock()-lastProbe>=1000){lastProbe=clock();for(var j=0;j<probes.length&&j<16;j++){var probe=probes[j],reported='probe|'+probe.id;if(completed[reported])continue;
    try{var probeParts=probe.id.split(':'),probeRef=sp.ObjectReference.from(sp.Game.getFormFromFile(parseInt(probeParts[0],16),probeParts[1]));if(!probeRef||probeRef.canFastTravelToMarker()!==true)continue;
     var probeName=probeRef.getDisplayName();if(!text(probeName))continue;
     if(enqueue({probeId:probe.id,world:probe.world,name:probeName,markerType:probe.type,canTravelTo:true,isShowAllHidden:probe.showAllHidden})){completed[reported]=true;trace('fast-travel probe queued; id='+probe.id);}
    }catch(error){log('Probe unavailable: '+probe.id+'; '+String(error));}
   }}
   for(var sendIndex=0;sendIndex<outbox.length;sendIndex++){var report=outbox[sendIndex];if(report.next>clock())continue;report.attempts++;report.next=clock()+Math.min(30000,1000*Math.pow(2,Math.min(report.attempts-1,5)));storeOutbox();ctx.sendEvent({v:1,kind:'discover',epoch:epoch,token:token,requestId:report.requestId,world:report.world,name:report.name,markerType:report.markerType,isVisible:true,canTravelTo:report.canTravelTo,isShowAllHidden:report.isShowAllHidden,...(report.probeId?{probeId:report.probeId}:{})});trace('discovery report sent; request='+report.requestId+' attempt='+report.attempts);break;}
  }catch(error){log(error);}
 }
 var manager={receive:function(value:any){if(disposed||value===lastOwnerValue)return;lastOwnerValue=value;
  // Native owner sources run every frame. Stable model values need no repeated
  // validation; equivalent replacement snapshots must not restart the batches.
  if(!value||value.v!==1||value.actor!==actor||value.epoch!==epoch||typeof value.token!=='string'||!value.token||value.token.length>128||!Array.isArray(value.markers)||value.markers.length>2048||value.probes!==undefined&&(!Array.isArray(value.probes)||value.probes.length>16)||value.acks!==undefined&&(!Array.isArray(value.acks)||value.acks.length>32||value.acks.some(function(id:any){return !validRequestId(id);})||new Set(value.acks).size!==value.acks.length))return;
  var markers:any[]=[],seen:Record<string,boolean>={};for(var i=0;i<value.markers.length;i++){var m=value.markers[i];if(!m||!descriptor(m.id)||!descriptor(m.world)||!Number.isInteger(m.type)||m.type<1||m.type>59||typeof m.canTravelTo!=='boolean'||seen[m.id])return;seen[m.id]=true;markers.push({id:m.id,world:m.world,type:m.type,canTravelTo:m.canTravelTo});}
  var rawProbes:any[]=value.probes||[],nextProbes:any[]=[];for(var j=0;j<rawProbes.length;j++){var p=rawProbes[j];if(!p||!descriptor(p.id)||!descriptor(p.world)||!Number.isInteger(p.type)||p.type<1||p.type>59||p.name!==null&&!text(p.name)||typeof p.showAllHidden!=='boolean'||seen[p.id])return;seen[p.id]=true;nextProbes.push({id:p.id,world:p.world,type:p.type,name:p.name,showAllHidden:p.showAllHidden});}
  if(value.acks&&value.acks.length){var accepted:Record<string,boolean>={};for(var ackIndex=0;ackIndex<value.acks.length;ackIndex++)accepted[value.acks[ackIndex]]=true;var remaining=outbox.filter(function(item:any){return !accepted[item.requestId];});if(remaining.length!==outbox.length){outbox=remaining;storeOutbox();trace('discovery persistence acknowledged; remaining='+outbox.length);}}
  markers.sort(function(a,b){return a.id<b.id?-1:a.id>b.id?1:0;});
  nextProbes.sort(function(a:any,b:any){return a.id<b.id?-1:a.id>b.id?1:0;});var acks=(value.acks||[]).slice().sort();var snapshotSignature=JSON.stringify([value.actor,value.epoch,value.token,markers,nextProbes,acks]);if(snapshotSignature===lastSnapshotSignature)return;lastSnapshotSignature=snapshotSignature;
  pending={actor:value.actor,epoch:value.epoch,token:value.token,markers:markers,probes:nextProbes};
 },dispose:function(){if(disposed)return;disposed=true;pending=null;restores=[];lastOwnerValue=null;lastSnapshotSignature='';storeOutbox();handles.forEach(function(h){sp.unsubscribe(h);});}};
 sp.storage[key]=manager;handles.push(sp.on('update',update));handles.push(sp.on('locationDiscovery',discover));handles.push(sp.on('loadGame',function(){loadSerial++;lifecycle.loadSerial=loadSerial;lifecycle.blocked=false;readyAfterLoad=true;blockedNotice=false;notice('');reset();}));
}
export function mapDiscoverySources():{event:string;owner:string}{return{
 event:'('+installMapDiscoveryClient.toString()+')(ctx);',
 owner:'var m=ctx.sp.storage.__rpMapDiscoveryV1;if(m&&typeof m==="object"&&typeof m.receive==="function")m.receive(ctx.value);',
};}
