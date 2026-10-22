export interface QuestTarget {id:string;targetKey:string;explicitDoors?:boolean;}
export interface QuestCatalogueEntry {key:string;quest:number;reference:number;title?:string;destination?:string;cell:string;pos:readonly number[];testOnly?:boolean;approaches?:readonly {cell:string;reference:number}[];}
/** Server-serialized function. All runtime helpers live inside it; never retain native wrappers across awaits. */
export function installQuestNavigation(ctx:{sp:any;_expired?:boolean;getMyFormIdInServerFormat():number},catalogue:readonly QuestCatalogueEntry[],clock:()=>number=Date.now){
 var sp=ctx.sp,key='__rpQuestNavigationV1',previous=sp.storage[key],ready=false;
 var target:QuestTarget|null=null,token='',shown='',lastJob='',tracked=true,actor=0,generation=0,disposed=false,finished=false,lastTick=-Infinity,lastError='',cleanupNeeded=true,ownsNative=false;
 // Native promises only deliver primitive results. Their continuations may run
 // without SP's VM stack; all follow-up natives belong to the next update.
 var pending:{entry:QuestCatalogueEntry;value:QuestTarget;expected:number;wanted:string;phase:'start'|'stage';done:boolean;result?:boolean;error?:string}|null=null;
 var resolveDispose:()=>void;var disposal=new Promise<void>(function(resolve){resolveDispose=resolve;});
 var handles:any[]=[];var plugin='FrostveilCourierNavigation.esp';
 function trace(text:string){if(typeof sp.writeLogs==='function')try{sp.writeLogs('rpQuestLifecycle',text);}catch{}}
 function notice(text:string){if(sp.browser&&typeof sp.browser.executeJavaScript==='function')try{sp.browser.executeJavaScript('if(window.__rpChatUiV1)window.__rpChatUiV1.nativeNotice("quest",'+JSON.stringify(text?('หมุดเควสไม่พร้อม: '+text):'')+');');}catch{}}
 function log(text:string){if(text!==lastError){lastError=text;notice(text);if(typeof sp.printConsole==='function')sp.printConsole('[rp-quest] '+text);if(typeof sp.writeLogs==='function')try{sp.writeLogs('rpQuest',text);}catch{}}}
 function quest(id:number){var form=sp.Game.getFormFromFile(id,plugin);if(!form||!sp.Quest||typeof sp.Quest.from!=='function')throw Error('Quest/plugin unavailable: '+plugin);var q=sp.Quest.from(form);if(!q)throw Error('Quest form unavailable');return q;}
 function alias(id:number){var a=quest(id).getAlias(0);if(!a)return null;var ref=sp.ReferenceAlias&&sp.ReferenceAlias.from(a);if(!ref)throw Error('ReferenceAlias cast unavailable');return ref;}
 function clear(){shown='';var stopped=true;for(var i=0;i<catalogue.length;i++){var q=quest(catalogue[i]!.quest);if(q.isStopped())continue;stopped=false;ownsNative=true;if(q.isRunning()){q.setObjectiveDisplayed(10,false,false);q.setActive(false);q.stop();}}cleanupNeeded=!stopped;if(stopped)ownsNative=false;return stopped;}
 function finish(){finished=true;handles.forEach(function(h){sp.unsubscribe(h);});resolveDispose();}

 function valid(value:any):QuestTarget|null{if(!value||typeof value!=='object'||typeof value.id!=='string'||!value.id||value.id.length>160||typeof value.targetKey!=='string'||!catalogue.some(function(c){return c.key===value.targetKey;})||value.explicitDoors!==undefined&&typeof value.explicitDoors!=='boolean')return null;return{id:value.id,targetKey:value.targetKey,...(value.explicitDoors===true?{explicitDoors:true}:{})};}
 function reference(entry:QuestCatalogueEntry,explicit:boolean){var id=entry.reference,file=plugin;
  if(explicit&&entry.approaches){var p=sp.Game.getPlayer(),w=p&&p.getWorldSpace(),c=p&&p.getParentCell(),cell=w?w.getFormID():c?c.getFormID():0;var route=entry.approaches.find(function(a){return parseInt(a.cell.split(':')[0]!,16)===cell;});if(route){id=route.reference;file='Skyrim.esm';}}
  var r=sp.ObjectReference.from(sp.Game.getFormFromFile(id,file));if(!r)throw Error('Persistent destination unavailable');return r;
 }
 function targetToken(value:QuestTarget|null){if(!value)return'';var entry=catalogue.find(function(c){return c.key===value.targetKey;})!;var world='';if(value.explicitDoors&&entry.approaches){var p=sp.Game.getPlayer(),w=p&&p.getWorldSpace(),c=p&&p.getParentCell();world=String(w?w.getFormID():c?c.getFormID():0);}return value.id+':'+value.targetKey+':'+(value.explicitDoors?'doors':'native')+':'+world;}
 function waitFor(result:Promise<boolean>,work:NonNullable<typeof pending>){pending=work;Promise.resolve(result).then(function(value){work.result=value;work.done=true;},function(error){work.error=String(error);work.done=true;});}
 function update(){if(finished)return;if(ctx._expired)manager.dispose();var at=clock();if(at-lastTick<250)return;lastTick=at;
  try{var next=!ctx._expired&&sp.mpClientPlugin.isConnected()?ctx.getMyFormIdInServerFormat():0;
   if(next!==actor){var first=actor===0&&next>0;actor=next;generation++;shown='';cleanupNeeded=true;if(!first){target=null;token='';}}
   if(!next||sp.Ui.isMenuOpen('Main Menu')){if(target){target=null;token='';generation++;cleanupNeeded=true;}}
   if(!ready||sp.Ui.isMenuOpen('Loading Menu'))return;
   if(pending){if(!pending.done)return;var work=pending;pending=null;
    if(disposed||work.expected!==generation||!next||targetToken(target)!==work.wanted){cleanupNeeded=true;}
    else{if(work.error)throw Error(work.error);var entry=work.entry;
     if(work.phase==='start'){
      if(!work.result||!quest(entry.quest).isRunning())throw Error('Quest start failed: '+entry.key+'; running='+quest(entry.quest).isRunning()+'; stopped='+quest(entry.quest).isStopped()+'; install corrected navigation ESP via Launcher');
      var a=alias(entry.quest);
      if(a){a.forceRefTo(reference(entry,work.value.explicitDoors===true));
       var bound=alias(entry.quest)!.getReference();
       if(!bound||bound.getFormID()!==reference(entry,work.value.explicitDoors===true).getFormID())throw Error('Destination alias failed to bind: '+entry.key);
      }else{
       // Installed SP3 converts returned objects by TESForm type only. Skyrim
       // aliases are non-forms, so GetAlias returns null despite a live alias.
       // This signed ESP already encodes its persistent forced reference.
       if(typeof quest(entry.quest).getNumAliases!=='function'||quest(entry.quest).getNumAliases()!==1)throw Error('Navigation alias definition count unavailable: '+entry.key);
       var fixed=reference(entry,false),wantedRef=reference(entry,work.value.explicitDoors===true);
       if(fixed.getFormID()!==wantedRef.getFormID())throw Error('Explicit door rebinding unavailable in installed SP3; select native routing');
       trace('using ESP forced reference; SP3 alias-return conversion unavailable '+entry.key);
      }
      waitFor(quest(entry.quest).setCurrentStageID(10),{entry:entry,value:work.value,expected:work.expected,wanted:work.wanted,phase:'stage',done:false});return;
     }
     if(!work.result)throw Error('Quest journal stage unavailable/failed');
     quest(entry.quest).setObjectiveDisplayed(10,true,true);quest(entry.quest).setActive(tracked);lastJob=work.value.id+':'+work.value.targetKey;shown=work.wanted;lastError='';notice('');trace('displayed '+entry.key);
    }
   }
   if(disposed){if(clear())finish();return;}
   if(shown&&target&&lastJob===target.id+':'+target.targetKey){var current=catalogue.find(function(c){return c.key===target!.targetKey;})!;tracked=quest(current.quest).isActive();}
   if(cleanupNeeded&&!clear())return;
   if(!next)return;
   var wanted=targetToken(target);if(wanted===shown)return;if(!target)return;
   if(shown&&!clear())return;
   var entry=catalogue.find(function(c){return c.key===target!.targetKey;})!;ownsNative=true;quest(entry.quest).reset();
   waitFor(quest(entry.quest).start(),{entry:entry,value:target,expected:generation,wanted:wanted,phase:'start',done:false});
  }catch(error){cleanupNeeded=true;log(String(error));lastTick=clock()+1750;}
 }
 var manager={receive:function(value:any){if(disposed)return;var next=valid(value),identity=next?JSON.stringify(next):'';if(identity===token)return;if(!next||!target||next.id!==target.id||next.targetKey!==target.targetKey){lastJob='';tracked=true;}target=next;token=identity;generation++;cleanupNeeded=true;if(!next){lastError='';notice('');}},status:function(){return{error:lastError,displayed:!!shown&&!!target&&!cleanupNeeded&&!disposed&&!ctx._expired,tracked:tracked,targetKey:target?target.targetKey:''};},dispose:function(){if(!disposed){disposed=true;target=null;generation++;cleanupNeeded=true;if(!ownsNative&&!pending)finish();}return disposal;}};
 sp.storage[key]=manager;
 handles.push(sp.on('update',update));handles.push(sp.on('loadGame',function(){generation++;shown='';cleanupNeeded=true;}));
 if(previous&&typeof previous==='object'&&typeof previous.dispose==='function')Promise.resolve(previous.dispose()).then(function(){ready=true;});
 else ready=true;
}
