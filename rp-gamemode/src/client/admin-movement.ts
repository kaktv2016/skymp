/** Fixed operations only; this function is serialized into the owner event source. */
export function installAdminMovement(ctx:{sp:any;_expired?:boolean;getMyFormIdInServerFormat():number;sendEvent?(...args:unknown[]):void},clock:()=>number=Date.now){
 var sp=ctx.sp,key='__rpAdminMovementV1',previous=sp.storage[key];
 if(previous&&typeof previous==='object'&&typeof previous.dispose==='function')previous.dispose();else previous=null;
 var desired:{revision:number;fly:boolean;speed:number;teleportRequest?:{requestId:string;generation:number;targetCell:string;targetPos:readonly number[]}|null}|null=null,actor=0,fly=false,base=0,delta=0,weightDelta=0;
 var disposed=false,disposing=false,prepared=false,cleanupRequested=false,uncertain=false,lastTick=-Infinity,lastError='',lastAckedRequestId='',handles:any[]=[];
 function log(message:string){
  if(lastError===message)return;lastError=message;
  if(sp.browser&&typeof sp.browser.executeJavaScript==='function')try{sp.browser.executeJavaScript('if(window.__rpChatUiV1)window.__rpChatUiV1.nativeNotice("admin",'+JSON.stringify('โหมดแอดมินไม่พร้อม: '+message)+');');}catch{}
  if(typeof sp.printConsole==='function')sp.printConsole('[rp-admin] '+message);
  if(typeof sp.writeLogs==='function')try{sp.writeLogs('rpAdmin',message);}catch{}
 }
 function player(){var p=sp.Game.getPlayer();if(!p||p.getFormID()!==0x14)throw Error('Local player unavailable');return p;}
 function flight(value:boolean){
  if(value===fly)return;
  if(!sp.Debug||typeof sp.Debug.toggleCollisions!=='function')throw Error('TCL / Debug.toggleCollisions unavailable');
  if(uncertain)throw Error('TCL state unknown; restart Skyrim before enabling movement');
  try{sp.Debug.toggleCollisions();fly=value;}catch(error){uncertain=true;throw Error('TCL state unknown after native failure; restart Skyrim. '+String(error));}
 }
 function changeWeight(change:number){
  var p=player(),before=p.getActorValue('InventoryWeight');
  if(!Number.isFinite(before))throw Error('InventoryWeight baseline unavailable');
  var failure:unknown=null;try{p.modActorValue('InventoryWeight',change);}catch(error){failure=error;}
  var after:number;try{after=p.getActorValue('InventoryWeight');}catch(error){uncertain=true;throw Error('InventoryWeight readback failed after native write; restart Skyrim. '+String(error));}
  if(!Number.isFinite(after)){uncertain=true;throw Error('InventoryWeight readback unknown after native write; restart Skyrim');}
  weightDelta+=after-before;if(Math.abs(weightDelta)<0.00001)weightDelta=0;
  if(failure)throw failure;
  // Actor values are native float32; a 0.1 pulse at a large inventory weight
  // rounds by more than 1e-5 even when the engine accepts the full operation.
  if(Math.abs(after-before-change)>0.001)throw Error('InventoryWeight native apply/readback mismatch');
 }
 function finishRefresh(){if(weightDelta)changeWeight(-weightDelta);}
 function speed(multiplier:number){
  if(multiplier===1&&!delta)return;
  var p=player();if(typeof p.modActorValue!=='function'||typeof p.getActorValue!=='function')throw Error('SpeedMult modifier/readback unavailable');
  if(!delta){base=p.getActorValue('SpeedMult');if(!Number.isFinite(base)||base<=0||base>10000)throw Error('SpeedMult baseline unavailable');}
  var next=multiplier===1?0:base*(multiplier-1);if(next===delta)return;
  var before=p.getActorValue('SpeedMult');if(!Number.isFinite(before))throw Error('SpeedMult readback unavailable');
  var change=next-delta,nativeError:unknown=null;
  try{p.modActorValue('SpeedMult',change);}catch(error){nativeError=error;}
  var after:number;
  try{after=p.getActorValue('SpeedMult');}catch(error){uncertain=true;throw Error('SpeedMult readback failed after native write; restart Skyrim. '+String(error));}
  if(!Number.isFinite(after)){uncertain=true;throw Error('SpeedMult readback unknown after native write; restart Skyrim');}
  // Record observed ownership even when the native call throws after writing.
  // This lets reset undo a partial write without overwriting unrelated bonuses.
  delta+=after-before;if(Math.abs(delta)<0.05){delta=0;base=0;}
  if(nativeError)throw nativeError;
  if(Math.abs(after-(before+change))>0.05)throw Error('SpeedMult native apply/readback mismatch; movement change not confirmed');
  // Skyrim caches movement speed. Enderal's _00E_UpdateSpeedmult uses this
  // reversible InventoryWeight pulse across frames to invalidate that cache.
  // Keep only numbers across updates; never retain the native Actor wrapper.
  changeWeight(-0.1);
 }
 function reset(){
  var clean=true;
  try{flight(false);}catch(error){clean=false;log(String(error));}
  try{finishRefresh();speed(1);}catch(error){clean=false;log(String(error));}
  return clean&&!fly&&!delta&&!weightDelta;
 }
 function loaded(){
  desired=null;cleanupRequested=false;lastAckedRequestId='';
  if(!prepared&&(fly||delta||weightDelta)){uncertain=true;log('Load/character change without pre-cleanup: native movement state unknown; admin movement disabled until a clean game restart. Use /admin reset BEFORE loading a save.');}
  fly=false;base=0;delta=0;weightDelta=0;prepared=false;actor=0;
 }
 function finishDisposal(){disposed=true;handles.forEach(function(h){sp.unsubscribe(h);});handles=[];}
 function update(){
  if(disposed)return;
  if(previous){
   var prior=typeof previous.status==='function'?previous.status():null;
   if(prior&&prior.disposed===false)return;
   if(prior&&(prior.uncertain||prior.fly||prior.speed!==1||prior.refreshPending)){uncertain=true;log('Previous admin controller did not confirm cleanup; restart Skyrim before enabling movement.');}
   previous=null;
  }
  if(ctx._expired)disposing=true;
  var at=clock();if(at-lastTick<100)return;lastTick=at;
  try{
   // Identity/load checks must happen before touching an old actor's modifiers.
   var next=sp.mpClientPlugin.isConnected()?ctx.getMyFormIdInServerFormat():0;
   if(actor>0&&next>0&&next!==actor)loaded();
   if(next!==actor){var first=actor===0&&next>0;if(!first){desired=null;lastAckedRequestId='';}actor=next;}
   if(uncertain){if(disposing)finishDisposal();return;}
   if(disposing){desired=null;if(reset())finishDisposal();return;}
   finishRefresh();
   if(cleanupRequested){desired=null;prepared=reset();cleanupRequested=!prepared;return;}
   if(desired&&desired.teleportRequest&&typeof desired.teleportRequest.requestId==='string'&&desired.teleportRequest.requestId!==lastAckedRequestId){
    if(!sp.Ui.isMenuOpen('Loading Menu')&&!sp.Ui.isMenuOpen('Main Menu')){
     var p=sp.Game.getPlayer();
     if(p&&p.getFormID()===0x14){
      var currentPos=[p.getPositionX(),p.getPositionY(),p.getPositionZ()];
      var w=p.getWorldSpace(),c=p.getParentCell();
      var currentCell=w?w.getFormID():c?c.getFormID():0;
      lastAckedRequestId=desired.teleportRequest.requestId;
      if(typeof (ctx as any).sendEvent==='function'){
       (ctx as any).sendEvent({v:1,id:desired.teleportRequest.requestId,op:'tp-confirm',cell:currentCell.toString(16),pos:currentPos});
      }
     }
    }
   }
   if(!next||!desired){reset();return;}
   if(sp.Ui.isMenuOpen('Loading Menu')||sp.Ui.isMenuOpen('Main Menu')){desired=null;prepared=reset();return;}
   flight(desired.fly);speed(desired.speed);
  }catch(error){desired=null;log(String(error));reset();}
 }
 var manager={
  receive:function(value:any){
   if(uncertain||disposing||disposed)return;
   if(!value||typeof value!=='object'||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.fly!=='boolean'||!Number.isFinite(value.speed)||value.speed<1||value.speed>5){desired=null;return;}
   if(desired&&value.revision<desired.revision)return;
   desired={revision:value.revision,fly:value.fly,speed:value.speed,teleportRequest:value.teleportRequest??null};
  },
  // Callbacks may be tick events without VM access. Teardown is queued and
  // retains the update subscription until all owned native changes are undone.
  dispose:function(){if(disposed)return;desired=null;disposing=true;if(!fly&&!delta&&!weightDelta)finishDisposal();},
  status:function(){return{fly,speed:delta?1+delta/base:1,pending:desired!==null,refreshPending:weightDelta!==0,disposing,disposed,uncertain,nativeFlightVerified:false,error:lastError||(uncertain?'Restart Skyrim to reset unknown native movement state':'')};}
 };
 sp.storage[key]=manager;
 handles.push(sp.on('update',update));
 handles.push(sp.on('preLoadGame',function(){desired=null;cleanupRequested=true;}));
 handles.push(sp.on('loadGame',loaded));handles.push(sp.on('newGame',loaded));
}
