const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('../../../skyrim-rp-launcher/node_modules/esbuild');
function load(file, dependencies) {
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {loader: 'ts', format: 'cjs', target: 'node22'}).code;
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { console })(name => dependencies[name] || {}, module, module.exports);
  return module.exports;
}
function setup({ id = 0xff000123, dialogue = false, dead = false, deleted = false, isActor = true, missingBase = false } = {}) {
  const events = {}, emitted = {}, queued = [], calls = [];
  let actor;
  const player = { getPositionX:()=>0, getPositionY:()=>0, getPositionZ:()=>0 };
  const ref = {
    getFormID:()=>id, getBaseObject:()=>missingBase ? null : {}, isDisabled:()=>false, isDeleted:()=>deleted, isDead:()=>dead,
    isInDialogueWithPlayer:()=>dialogue, getDialogueTarget:()=>null, getRace:()=>null,
    blockActivation:()=>calls.push('block'), setPosition:()=>calls.push('move'),
    disableNoWait:()=>calls.push('disableNoWait'),
    disable:()=>{ calls.push('disable'); return Promise.resolve(); },
    delete:()=>{ calls.push('delete'); return Promise.resolve(); },
  };
  actor = isActor ? ref : null;
  const sp = {
    Game: {getPlayer:()=>player,findRandomActor:()=>actor,getFormEx:()=>ref},
    Actor:{from:()=>actor}, ObjectReference:{from:()=>ref},
    TESModPlatform:{setWeaponDrawnMode:()=>calls.push('weapon')},
  };
  const controller = {on:(e,fn)=>events[e]=fn, once:(e,fn)=>queued.push(fn), emitter:{on:(e,fn)=>emitted[e]=fn}};
  const {WorldCleanerService} = load('services/services/worldCleanerService.ts', {
    './clientListener':{ClientListener:class{}}, '../../extensions/objectReferenceEx':{ObjectReferenceEx:{getPos:()=>[0,0,0],getWorldOrCell:()=>1}},
  });
  const cleaner = new WorldCleanerService(sp, controller);
  return {cleaner, calls, ref, sp, controller, events, emitted, flush:()=>{for(const cb of queued.splice(0))cb();}};
}
test('world cleanup hides an active NPC without marking its live AI actor deleted', async()=>{
  const h=setup(); h.events.update(); await Promise.resolve();
  assert.deepEqual(h.calls, ['disableNoWait']);
  h.events.update(); assert.deepEqual(h.calls, ['disableNoWait'], 'retirement must not be requested twice while the engine disables');
});
test('preplaced bodies and protected/player/deleted actors are retained',()=>{
  for(const options of [{id:0x14},{deleted:true},{id:0x123,dead:true},{id:0xff000124}]){
    const h=setup(options); if(options.id===0xff000124)h.cleaner.modWcProtection(options.id,1);
    h.events.update(); assert.ok(!h.calls.includes('delete')); assert.ok(!h.calls.includes('disableNoWait'));
  }
});
test('retiring an owned actor defers native work, releases its lease once, and hides without deletion',()=>{
  const h=setup(); h.cleaner.modWcProtection(0xff000123,1);
  h.cleaner.retireForm(0xff000123); h.cleaner.retireForm(0xff000123);
  assert.deepEqual(h.calls,[]); h.flush();
  assert.equal(h.cleaner.getWcProtection(0xff000123),0);
  assert.deepEqual(h.calls,['weapon','disableNoWait']);
});
test('pending retirement respects another owner and newly acquired protection',()=>{
  const h=setup(); h.cleaner.modWcProtection(0xff000123,1); h.cleaner.retireForm(0xff000123);
  h.cleaner.modWcProtection(0xff000123,1); h.flush();
  assert.equal(h.cleaner.getWcProtection(0xff000123),1); assert.deepEqual(h.calls,[]);
});
test('save transition invalidates pending retirement before reused form IDs can be touched',()=>{
  const h=setup(); h.cleaner.modWcProtection(0xff000123,1); h.cleaner.retireForm(0xff000123);
  h.events.preLoadGame(); h.events.update(); h.events.loadGame();
  h.cleaner.modWcProtection(0xff000123,1); h.flush();
  assert.deepEqual(h.calls,[]); assert.equal(h.cleaner.getWcProtection(0xff000123),1);
});
test('owned non-actor references still delete; already deleted references never receive native cleanup',()=>{
  for(const deleted of [false,true]){
    const h=setup({isActor:false,deleted}); h.cleaner.retireForm(0xff000123); h.flush();
    assert.deepEqual(h.calls,deleted?[]:['delete']);
  }
});
test('dialogue actor retirement hides without killing or deleting',()=>{
  const h=setup({dialogue:true}); h.events.update();
  assert.ok(h.calls.includes('disableNoWait')); assert.ok(!h.calls.includes('delete'));
});
test('destroy detaches the view immediately and schedules only one ownership release',()=>{
  const h=setup(); const retired=[];
  const {FormView}=load('view/formView.ts',{
    skyrimPlatform:{...h.sp,once:(e,cb)=>h.controller.once(e,cb)},
    '../services/spApiInteractor':{SpApiInteractor:{getControllerInstance:()=>({lookupListener:()=>({retireForm:id=>retired.push(id)})})}},
  });
  const view=Object.create(FormView.prototype); Object.assign(view,{refrId:0xff000123,ready:true,removeNickname:()=>{}});
  view.destroy(); view.destroy(); h.flush();
  assert.equal(view.getLocalRefrId(),0); assert.equal(view.ready,false);
  assert.deepEqual(retired,[0xff000123]); assert.deepEqual(h.calls,[]);
});

test('actors missing their base are not passed to AI/dialogue/weapon/disable operations',()=>{
  for(const owned of [false,true]){
    const h=setup({missingBase:true});
    if(owned){h.cleaner.retireForm(0xff000123);h.flush();}else h.events.update();
    assert.deepEqual(h.calls,[]);
  }
});
function spawnHarness() {
  const h=setup(); h.cleaner.modWcProtection(0xff000123,1);
  let native=false, completed=0;
  const stage=name=>{assert.equal(native,true,`${name} must run on update`);h.calls.push(name);return Promise.resolve();};
  Object.assign(h.ref,{setPosition:()=>stage('position'),enable:()=>stage('enable'),resurrect:()=>stage('resurrect')});
  const {SpawnProcess}=load('view/spawnProcess.ts',{
    skyrimPlatform:{...h.sp,once:(e,cb)=>h.controller.once(e,cb)},
    '../services/spApiInteractor':{SpApiInteractor:{getControllerInstance:()=>({lookupListener:()=>h.cleaner})}},
    '../sync/appearance':{applyTints:()=>{assert.equal(native,true);h.calls.push('tints');}},
  });
  const flush=async()=>{native=true;h.flush();native=false;await Promise.resolve();await Promise.resolve();};
  new SpawnProcess(null,[1,2,3],0xff000123,()=>{assert.equal(native,true);completed++;});
  return {...h,flush,completed:()=>completed};
}
test('normal spawn performs position, enable, resurrection and completion on updates',async()=>{
  const h=spawnHarness(); assert.deepEqual(h.calls,[]);
  for(let i=0;i<4;i++)await h.flush();
  assert.deepEqual(h.calls,['position','enable','resurrect']); assert.equal(h.completed(),1);
});
test('detachment during positioning prevents a late enable or resurrection',async()=>{
  const h=spawnHarness(); await h.flush(); h.cleaner.retireForm(0xff000123);
  for(let i=0;i<4;i++)await h.flush();
  assert.ok(!h.calls.includes('enable')); assert.ok(!h.calls.includes('resurrect')); assert.equal(h.completed(),0);
});
test('a new save session cannot resume a pending spawn for a reused protected form ID',async()=>{
  const h=spawnHarness(); await h.flush(); h.events.preLoadGame();h.events.loadGame();h.cleaner.modWcProtection(0xff000123,1);
  for(let i=0;i<4;i++)await h.flush();
  assert.deepEqual(h.calls,['position']); assert.equal(h.completed(),0);
});
test('a replacement ownership lease cannot revive the previous spawn process',async()=>{
  const h=spawnHarness(); await h.flush(); h.cleaner.retireForm(0xff000123);h.cleaner.modWcProtection(0xff000123,1);
  for(let i=0;i<4;i++)await h.flush();
  assert.deepEqual(h.calls,['position']); assert.equal(h.completed(),0);assert.equal(h.cleaner.getWcProtection(0xff000123),1);
});
test('retirement after resurrection cancels the stale completion callback',async()=>{
  const h=spawnHarness();for(let i=0;i<3;i++)await h.flush();
  assert.deepEqual(h.calls,['position','enable','resurrect']);h.cleaner.retireForm(0xff000123);
  await h.flush();assert.equal(h.completed(),0);assert.ok(h.calls.includes('disableNoWait'));
});
test('an old view destroyed after loading cannot release a new owner of its reused ID',()=>{
  const h=setup();h.cleaner.modWcProtection(0xff000123,1);
  const guard=h.cleaner.getFormRetirementGuard();
  h.events.preLoadGame();h.events.loadGame();h.cleaner.modWcProtection(0xff000123,1);
  h.cleaner.retireForm(0xff000123,guard);h.flush();
  assert.equal(h.cleaner.getWcProtection(0xff000123),1);assert.deepEqual(h.calls,[]);
});
test('separate owners retiring in one frame each release once, with one native retirement',()=>{
  for(const isActor of [true,false]){
    const h=setup({isActor});h.cleaner.modWcProtection(0xff000123,2);
    const first=h.cleaner.getFormRetirementGuard(),second=h.cleaner.getFormRetirementGuard();
    h.cleaner.retireForm(0xff000123,first);h.cleaner.retireForm(0xff000123,second);h.cleaner.retireForm(0xff000123,first);
    h.flush();
    assert.equal(h.cleaner.getWcProtection(0xff000123),0);
    assert.deepEqual(h.calls,isActor?['weapon','disableNoWait']:['delete']);
    h.cleaner.retireForm(0xff000123,first);h.cleaner.retireForm(0xff000123,second);h.flush();
    assert.deepEqual(h.calls,isActor?['weapon','disableNoWait']:['delete']);
  }
});
test('aggregated old-owner releases preserve a newer owner, including repeated released guards',()=>{
  const h=setup();h.cleaner.modWcProtection(0xff000123,2);
  const first=h.cleaner.getFormRetirementGuard(),second=h.cleaner.getFormRetirementGuard();
  h.cleaner.retireForm(0xff000123,first);h.cleaner.retireForm(0xff000123,second);
  h.cleaner.modWcProtection(0xff000123,1);h.flush();
  assert.equal(h.cleaner.getWcProtection(0xff000123),1);assert.deepEqual(h.calls,[]);
  h.cleaner.retireForm(0xff000123,first);h.cleaner.retireForm(0xff000123,second);h.flush();
  assert.equal(h.cleaner.getWcProtection(0xff000123),1);assert.deepEqual(h.calls,[]);
});
function orderedLoadHarness() {
  const {EventEmitter}=require('node:events'),nativeEvents=new EventEmitter(),emitter=new EventEmitter();
  const controller={on:nativeEvents.on.bind(nativeEvents),once:nativeEvents.once.bind(nativeEvents),emitter};
  const calls=[];let updating=false;
  const player={getPositionX:()=>0,getPositionY:()=>0,getPositionZ:()=>0};
  const actor={getFormID:()=>0x106c22,getBaseObject:()=>({}),isDeleted:()=>false,isDisabled:()=>false,
    isInDialogueWithPlayer:()=>false,getDialogueTarget:()=>null,isDead:()=>false,getRace:()=>({getFormID:()=>0xa919d}),
    killSilent:()=>calls.push('kill'),blockActivation:()=>calls.push('block'),disableNoWait:()=>calls.push('disable'),setAlpha:()=>calls.push('alpha')};
  const sp={Game:{getPlayer:()=>{assert.ok(updating,'native player lookup must run on update');return player;},findRandomActor:()=>actor}};
  const spawnResume=load('services/services/spawnResume.ts',{});
  const {LoadGameService}=load('services/services/loadGameService.ts',{'./clientListener':{ClientListener:class{}},'./spawnResume':spawnResume});
  new LoadGameService(sp,controller);
  const {WorldCleanerService}=load('services/services/worldCleanerService.ts',{
    './clientListener':{ClientListener:class{}},'../../logging':{logTrace:()=>{}},
    '../../extensions/objectReferenceEx':{ObjectReferenceEx:{getPos:ref=>{if(ref===player)calls.push('capture');return [0,0,0];},getWorldOrCell:()=>1,getDistanceNoZ:()=>0}},
  });
  new WorldCleanerService(sp,controller);
  return {calls,emit:e=>nativeEvents.emit(e),update:()=>{updating=true;try{nativeEvents.emit('update');}finally{updating=false;}}};
}
test('loader-first gameLoad emission captures position on the following update and preserves chicken workaround',()=>{
  const h=orderedLoadHarness();h.emit('loadGame');assert.deepEqual(h.calls,[]);h.update();
  assert.deepEqual(h.calls,['capture','kill','block','disable','alpha']);
});
test('another preload invalidates a pending initial snapshot until the next session loads',()=>{
  const h=orderedLoadHarness();h.emit('loadGame');h.emit('preLoadGame');h.update();assert.deepEqual(h.calls,[]);
  h.emit('loadGame');h.update();assert.deepEqual(h.calls,['capture','kill','block','disable','alpha']);
});
