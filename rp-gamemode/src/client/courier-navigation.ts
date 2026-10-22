import type {BeaconStyle} from '../modules/courier/beacon-styles';
import type {CourierWaypoint} from '../modules/chat/contracts';

interface LocalReference {
  getFormID():number;
  disableNoWait(fade:boolean):void; delete():Promise<void>; isDeleted():boolean;
  setPosition(x:number,y:number,z:number):Promise<void>;setAngle(x:number,y:number,z:number):Promise<void>;
  setScale(scale:number):Promise<void>;enable(fade:boolean):Promise<void>;
}
interface LocalBaseForm {getFormID():number;tempClone():LocalBaseForm|null;setWorldModelPath(path:string):void;getWorldModelPath():string;}
interface PlayerReference {
  is3DLoaded():boolean;getParentCell():{getFormID():number}|null;getWorldSpace():{getFormID():number}|null;
  getPositionX():number;getPositionY():number;getPositionZ():number;
  placeAtMe(form:unknown,count:number,persist:boolean,disabled:boolean):LocalReference|null;
}
interface NavigationContext {
  _expired?:boolean;getMyFormIdInServerFormat():number;
  sp:{storage:Record<string,any>;Game:{getPlayer():PlayerReference|null;getFormFromFile(id:number,file:string):unknown;getFormEx(id:number):unknown};
    ObjectReference:{from(form:unknown):LocalReference|null};Ui:{isMenuOpen(name:string):boolean};mpClientPlugin:{isConnected():boolean};
    on(name:string,callback:(event:any)=>void):unknown;unsubscribe(handle:unknown):void;printConsole?(text:string):void;
    writeLogs?(plugin:string,text:string):void;
    createText?(x:number,y:number,text:string,color:number[]):number;destroyText?(id:number):void;setTextSize?(id:number,size:number):void;
    setTextRefr?(id:number,ref:number):void;setTextRefrOffset?(id:number,offset:number[]):void;worldPointToScreenPoint?(...points:number[][]):number[][];};
}

/** Serialized server-delivered client function. Only owns its temporary local FX. */
export function installCourierNavigation(ctx:NavigationContext,styles:readonly BeaconStyle[]) {
  var sp=ctx.sp,key='__rpCourierNavigationV1',old=sp.storage[key];
  var previousReady=true;
  if(old && typeof old==='object' && typeof old.dispose==='function'){
    previousReady=false;Promise.resolve(old.dispose()).then(function(){previousReady=true;settle();},function(){});
  }
  var target:CourierWaypoint|null=null,token='',generation=0,actor=0,disposed=false;
  var reference:LocalReference|null=null,placing:Promise<void>|null=null,removing:Promise<void>|null=null;
  var retired:LocalReference|null=null,lastTick=0,retryAt=0,cellToken='',lastError='';
  var handles:unknown[]=[];
  var projected:number[]=[],gate='',waitReason='';
  var effectName='',canProject=false;
  function beamBase(style:BeaconStyle):LocalBaseForm {
    var beamModel=style.model;
    var cache=sp.storage.__rpCourierBeamBasesV2;
    if(!cache || typeof cache!=='object' || Array.isArray(cache)){cache={};sp.storage.__rpCourierBeamBasesV2=cache;}
    var cached=cache[style.id];
    if(typeof cached==='number' && cached>=0xff000000){
      var existing=sp.Game.getFormEx(cached) as LocalBaseForm|null;
      if(existing && existing.getWorldModelPath().toLowerCase()===beamModel.toLowerCase())return existing;
    }
    var source=sp.Game.getFormFromFile(0x877f8,'Skyrim.esm') as LocalBaseForm|null;
    if(!source || typeof source.tempClone!=='function')throw Error('SKSE Form.TempClone unavailable');
    var clone=source.tempClone();
    if(!clone || clone.getFormID()<0xff000000 || clone.getFormID()===0x877f8)throw Error('SKSE TempClone did not return a distinct local dynamic form');
    // Only the session-local clone changes. Never alter a vanilla base form.
    clone.setWorldModelPath(beamModel);
    if(clone.getWorldModelPath().toLowerCase()!==beamModel.toLowerCase())throw Error('Cloned beam model path was not accepted');
    cache[style.id]=clone.getFormID();
    trace('session-local beam base prepared: '+clone.getFormID()+' '+beamModel);
    return clone;
  }
  function trace(message:string){var line='[rp-navigation] '+message;if(typeof sp.printConsole==='function')sp.printConsole(line);if(typeof sp.writeLogs==='function'){try{sp.writeLogs('rpNavigation',line);}catch{}}}
  function clearProjection(){projected.forEach(function(id){try{sp.destroyText!(id);}catch{}});projected=[];}
  function projectionVisible(point:CourierWaypoint):boolean {
    if(typeof sp.worldPointToScreenPoint!=='function')return false;
    var p=sp.worldPointToScreenPoint([point.pos[0],point.pos[1],point.pos[2]+400])[0];
    return !!p && p.length===3 && p.every(Number.isFinite) && p[2]!>0 && p[2]!<1 && p[0]!>0 && p[0]!<1 && p[1]!>0 && p[1]!<1;
  }
  function project(pc:PlayerReference,point:CourierWaypoint){
    if(!previousReady || !['createText','destroyText','setTextSize','setTextRefr','setTextRefrOffset'].every(function(name){return typeof (sp as unknown as Record<string,unknown>)[name]==='function';}))return;
    try{
      if(!projectionVisible(point)){clearProjection();return;}
      if(!projected.length){
        var id=sp.createText!(0,0,'[Courier]',[1,0.72,0.15,1]);projected.push(id);sp.setTextSize!(id,0.45);sp.setTextRefr!(id,0x14);
        trace('native Courier label created');
      }
      projected.forEach(function(id,i){sp.setTextRefrOffset!(id,[point.pos[0]-pc.getPositionX(),point.pos[1]-pc.getPositionY(),point.pos[2]-pc.getPositionZ()+100+i*230]);});
    }catch(error){clearProjection();problem('native projection unavailable: '+String(error).slice(0,180));}
  }
  var cleanupHandle:unknown=null,resolveDisposed:()=>void;
  var disposedDone=new Promise<void>(function(resolve){resolveDisposed=resolve;});
  function settle(){
    if(!disposed)return;
    if(previousReady && !placing && !retired && !removing){if(cleanupHandle!==null){sp.unsubscribe(cleanupHandle);cleanupHandle=null;}if(sp.storage[key]===manager)delete sp.storage[key];resolveDisposed();}
    else if(cleanupHandle===null)cleanupHandle=sp.on('update',function(){if(retired && !removing && Date.now()>=retryAt)remove(retired);settle();});
  }
  function problem(message:string){if(message!==lastError){lastError=message;trace(message);}}
  function remove(ref:LocalReference){
    retired=ref;
    try{ref.disableNoWait(false);}catch{problem('Could not disable local beacon; cleanup retained');}
    if(removing)return;
    removing=Promise.resolve().then(function(){return ref.delete();}).then(function(){if(retired===ref)retired=null;},function(){problem('Local beacon deletion pending; retrying without creating another');retryAt=Date.now()+2000;}).finally(function(){removing=null;settle();});
  }
  function clearReference(){canProject=false;clearProjection();if(reference){var ref=reference;reference=null;remove(ref);}}
  function receive(value:CourierWaypoint|null){
    if(disposed)return;
    var next:CourierWaypoint|null=null;
    if(value && typeof value.id==='string' && value.id.length<=160 && typeof value.label==='string' && value.label.length<=128 && /^([0-9a-f]{1,6}):skyrim\.esm$/i.test(value.cell) && Array.isArray(value.pos) && value.pos.length===3 && value.pos.every(function(v){return Number.isFinite(v)&&Math.abs(v)<10000000;}))next={id:value.id,cell:value.cell.toLowerCase(),pos:[value.pos[0],value.pos[1],value.pos[2]],label:value.label,...(value.style?{style:value.style==='off'||styles.some(function(s){return s.id===value.style;})?value.style:'off'}:{})};
    var nextToken=JSON.stringify(next);if(nextToken===token)return;token=nextToken;target=next;++generation;clearReference();
    trace(next?'active target received: '+next.cell:'target cleared');
    if(sp.mpClientPlugin.isConnected())actor=ctx.getMyFormIdInServerFormat();
  }
  var manager={receive:receive,dispose:function(){if(disposed)return disposedDone;disposed=true;target=null;++generation;clearReference();handles.forEach(function(h){sp.unsubscribe(h);});handles=[];settle();return disposedDone;}};
  sp.storage[key]=manager;
  trace('G1.2 navigation controller installed');
  handles.push(sp.on('update',function(){
    if(ctx._expired){manager.dispose();return;}
    // Native text projection otherwise retains its previous screen position
    // when depth goes behind the camera. Hide immediately on that boundary.
    if(projected.length && target){try{if(!projectionVisible(target))clearProjection();}catch{clearProjection();}}
    // TextApi only reprojects dirty labels. Refresh offsets each render update;
    // object lifecycle and native FX creation remain throttled to 500ms.
    if(canProject && target){
      try{var drawingPlayer=sp.Game.getPlayer();if(drawingPlayer && drawingPlayer.is3DLoaded() && !sp.Ui.isMenuOpen('Loading Menu') && !sp.Ui.isMenuOpen('Main Menu'))project(drawingPlayer,target);else clearProjection();}catch{clearProjection();}
    }
    var now=Date.now();if(now-lastTick<500)return;lastTick=now;
    if(retired && !removing && now>=retryAt)remove(retired);
    var current=sp.mpClientPlugin.isConnected()?ctx.getMyFormIdInServerFormat():0;
    if(!current || (actor && actor!==current)){receive(null);actor=current;return;}actor=current;
    try{
      var pc=sp.Game.getPlayer(),nextCell=pc?String(pc.getParentCell()?.getFormID()??0):'';
      var targetCell=target?parseInt(target.cell.split(':')[0]!,16):0;
      var valid=!!(target && target.style!=='off' && pc && pc.is3DLoaded() && !sp.Ui.isMenuOpen('Loading Menu') && !sp.Ui.isMenuOpen('Main Menu') && (pc.getWorldSpace()?.getFormID()===targetCell || pc.getParentCell()?.getFormID()===targetCell) && Math.hypot(pc.getPositionX()-target.pos[0],pc.getPositionY()-target.pos[1],pc.getPositionZ()-target.pos[2])<=8192);
      var currentGate=JSON.stringify({target:!!target,valid:valid,loaded:pc?.is3DLoaded()??false,cell:nextCell,world:pc?.getWorldSpace()?.getFormID()??0,loading:sp.Ui.isMenuOpen('Loading Menu'),main:sp.Ui.isMenuOpen('Main Menu')});
      if(currentGate!==gate){gate=currentGate;trace('gate '+gate);}
      if(nextCell!==cellToken){cellToken=nextCell;++generation;clearReference();}
      if(!valid){++generation;clearReference();return;}
      canProject=true;
      if(pc && target)project(pc,target);
      if(reference){if(reference.isDeleted()){reference=null;}else return;}
      var waiting=!previousReady?'predecessor cleanup':placing?'placement pending':retired||removing?'reference cleanup':now<retryAt?'retry backoff':'';
      if(waiting){if(waitReason!==waiting){waitReason=waiting;trace('waiting: '+waiting);}return;}waitReason='';
      if(!pc || !target)return;
      // The shipped ambient beam is static art; no animation/event/spell is
      // needed. Its original MSTT cannot be instantiated here, so use a local
      // cloned, non-scripted ACTI with that model (SKSE-provided APIs).
      var style=styles.find(function(s){return s.id===(target!.style??'beam');});
      if(!style)throw Error('Unknown beam preview style');
      var base=beamBase(style);effectName=style.label;
      trace('attempting local ambient beam');
      var placed=pc.placeAtMe(base,1,false,true);
      if(!placed){problem('local beam placeAtMe returned null; retry in five seconds');retryAt=now+5000;return;}
      // SP3 pool wrappers expire between native/event turns. Retain only the
      // numeric identity; resolve a fresh wrapper immediately before each call.
      const formId=placed.getFormID();
      function fresh(){var value=sp.ObjectReference.from(sp.Game.getFormEx(formId));if(!value)throw Error('Local beacon reference unavailable: '+formId);return value;}
      const ref:LocalReference={getFormID:function(){return formId;},
        disableNoWait:function(fade){fresh().disableNoWait(fade);},delete:function(){return fresh().delete();},isDeleted:function(){return fresh().isDeleted();},
        setPosition:function(x,y,z){return fresh().setPosition(x,y,z);},setAngle:function(x,y,z){return fresh().setAngle(x,y,z);},
        setScale:function(scale){return fresh().setScale(scale);},enable:function(fade){return fresh().enable(fade);}};
      var version=generation,pos=target.pos;
      function stale(){return disposed || ctx._expired || version!==generation || !sp.mpClientPlugin.isConnected() || ctx.getMyFormIdInServerFormat()!==actor || sp.Ui.isMenuOpen('Loading Menu') || String(sp.Game.getPlayer()?.getParentCell()?.getFormID()??0)!==cellToken;}
      trace('vanilla effect placement started');
      placing=Promise.resolve().then(function(){return ref.setPosition(pos[0],pos[1],pos[2]);}).then(function(){if(stale())throw Error('cancelled');return ref.setAngle(0,0,0);}).then(function(){if(stale())throw Error('cancelled');return ref.setScale(style!.scale);}).then(function(){if(stale())throw Error('cancelled');return ref.enable(false);}).then(function(){if(stale())remove(ref);else{reference=ref;lastError='';trace('vanilla effect enabled: '+effectName);}},function(error){remove(ref);if(String(error)!=='Error: cancelled'){problem('Beacon placement failed: '+String(error).slice(0,180));retryAt=Date.now()+2000;}}).finally(function(){placing=null;settle();});
    }catch(error){++generation;clearReference();problem('Beacon update failed: '+String(error).slice(0,180));retryAt=now+2000;}
  }));
  handles.push(sp.on('loadGame',function(){++generation;clearReference();cellToken='';}));
}
