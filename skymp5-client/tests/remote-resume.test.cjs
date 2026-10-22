const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const esbuild = require('../../../skyrim-rp-launcher/node_modules/esbuild');

function harness(actorId=0xff000001,owned=true) {
  const native=new EventEmitter(),events=new EventEmitter(),promises=[],retired=[],destroyed=[],equipment=[];
  let inUpdate=false,epoch=1,ready;
  const originalEmit=native.emit.bind(native);
  native.emit=(name,...args)=>{const prior=inUpdate;inUpdate=name==='update';try{return originalEmit(name,...args);}finally{inUpdate=prior;}};
  const actor={getFormID:()=>actorId};
  const storage={worldModel:{forms:[undefined,{idx:1,refrId:0xff000100}],playerCharacterFormIdx:-1},
    idManager:{getId:id=>id,allocateIdFor:id=>id}};
  const sp={storage,on:(...args)=>native.on(...args),once:(...args)=>native.once(...args),
    Game:{getPlayer:()=>actor,getFormEx:()=>actor,getModCount:()=>0},Actor:{from:a=>a},
    Utility:{wait:()=>({then:fn=>promises.push(fn)})}};
  class RespawnNeededError extends Error {}
  class LoadGameService {}
  class WorldCleanerService {}
  const loadService={spawnPlayer:(d,n,l,t,fn)=>{ready=fn;},getSpawnEpoch:()=>epoch,isCurrentSpawn:e=>e===epoch};
  const fallback=new Proxy(function(){},{get:()=>fallback});
  let formViews;
  const req=name=>{
    if(name==='skyrimPlatform')return sp;
    if(name==='./clientListener')return {ClientListener:class{}};
    if(name==='./loadGameService')return {LoadGameService};
    if(name==='./worldCleanerService')return {WorldCleanerService};
    if(name.endsWith('/errors'))return {RespawnNeededError};
    if(name.endsWith('/nameof'))return {nameof:s=>s};
    if(name.endsWith('/worldViewMisc'))return {getViewFromStorage:()=>({getFormViews:()=>formViews}),remoteIdToLocalId:()=>actorId};
    if(name.endsWith('/logging'))return {logTrace(){},logError(){}};
    if(name==='./spawnResume')return {isSpawnResumeHeld:()=>false};
    if(name.endsWith('/equipment'))return {isBadMenuShown:()=>false,applyEquipment:()=>{assert.ok(inUpdate,'equipment natives require update');equipment.push(epoch);}};
    if(name.endsWith('/messages'))return {MsgType:{SetInventory:28}};
    return fallback;
  };
  function load(file) {
    const mod={exports:{}};
    const js=esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,'../src',file),'utf8'),{loader:'ts',format:'cjs'}).code;
    vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{Date:{now:()=>0},console})(req,mod,mod.exports);
    return mod.exports;
  }
  const {FormViewArray}=load('view/formViewArray.ts');formViews=new FormViewArray();
  if(owned)formViews.formViews[1]={getLocalRefrId:()=>actorId,destroy:()=>destroyed.push(actorId)};
  const {RemoteServer}=load('services/services/remoteServer.ts');
  const controller={on:(...args)=>native.on(...args),once:(...args)=>native.once(...args),emitter:events,
    lookupListener:cls=>cls===LoadGameService?loadService:cls===WorldCleanerService?{retireForm:id=>retired.push(id)}:{getTime:()=>({newGameHourValue:12})}};
  const remote=new RemoteServer(sp,controller);
  return {native,events,promises,retired,destroyed,equipment,remote,formViews,
    update:()=>native.emit('update'),invalidate:()=>epoch++,
    spawn(){remote.onCreateActorMessage({message:{idx:0,isMe:true,refrId:0xff000000,baseId:7,
      transform:{worldOrCell:0x13a8c,pos:[1,2,3],rot:[0,0,0]},equipment:{},customPropsJsonDumps:[]}});
      native.once('update',()=>ready());native.emit('update');},
    death(){events.on('applyDeathStateEvent',()=>{throw new RespawnNeededError();});
      remote.onDeathStateContainerMessage({message:{tIsDead:{idx:1,propName:'isDead',data:false}}});native.emit('update');}};
}

test('dynamic respawn detaches the actual owning FormViewArray slot, enabling replacement without double retirement',()=>{
  const h=harness();h.death();assert.deepEqual(h.destroyed,[0xff000001]);
  assert.equal(h.formViews.getNthFormView(1),undefined);assert.deepEqual(h.retired,[]);
});
test('unowned dynamic respawn retires safely; player and placed actor are untouched',()=>{
  const h=harness(0xff000002,false);h.death();assert.deepEqual(h.retired,[0xff000002]);
  for(const id of [0x14,0x12345]){const safe=harness(id);safe.death();assert.deepEqual(safe.retired,[]);assert.deepEqual(safe.destroyed,[]);}
});
test('delayed inventory/equipment apply waits for update and rejects stale generation before and after queuing',()=>{
  const h=harness();h.spawn();assert.equal(h.equipment.length,1);
  h.promises.shift()();assert.equal(h.equipment.length,1);h.update();assert.equal(h.equipment.length,2);
  const staleBefore=harness();staleBefore.spawn();staleBefore.invalidate();staleBefore.promises.shift()();staleBefore.update();assert.equal(staleBefore.equipment.length,1);
  const staleAfter=harness();staleAfter.spawn();staleAfter.promises.shift()();staleAfter.invalidate();staleAfter.update();assert.equal(staleAfter.equipment.length,1);
});
