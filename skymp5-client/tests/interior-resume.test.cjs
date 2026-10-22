const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const esbuild = require('../../../skyrim-rp-launcher/node_modules/esbuild');

function harness() {
  let now = 0, currentCell = 0x3c, pos = [0, 0, 0], rot = [0, 0, 0], blocked = true;
  const events = new EventEmitter(), native = new EventEmitter(), moves = [], loads = [], notices = [], sent = [];
  let inUpdate = false;
  const emit = native.emit.bind(native);
  native.emit = (event, ...args) => {
    const before = inUpdate; inUpdate = event === 'update';
    try { return emit(event, ...args); } finally { inUpdate = before; }
  };
  const requireUpdate = () => assert.equal(inUpdate, true, 'Papyrus native calls require update, not networking tick/main menu');
  const player = { getWorldSpace: () => currentCell === 0x3c || currentCell === 0x12345 ? { getFormID: () => currentCell } : null,
    getParentCell: () => ({ getFormID: () => currentCell }), getPositionX: () => pos[0], getPositionY: () => pos[1], getPositionZ: () => pos[2],
    setAngle: (x,y,z) => { requireUpdate();rot=[0,0,z]; }, getAngleX: () => rot[0], getAngleY: () => rot[1], getAngleZ: () => rot[2] };
  const controls = [true, true, true, true], changed = [];
  let destroyedClients = 0;
  const sp = { Game: { setInChargen(){}, getPlayer: () => player, getFormEx: id => { requireUpdate(); return { id }; },
    isMovementControlsEnabled: () => controls[0], isFightingControlsEnabled: () => controls[1],
    isLookingControlsEnabled: () => controls[2], isActivateControlsEnabled: () => controls[3],
    disablePlayerControls: (m,f,c,l,s,u,a) => { [m,f,l,a].forEach((v,i) => { if(v) controls[i]=false; }); },
    enablePlayerControls: (m,f,c,l,s,u,a) => { changed.push([m,f,l,a]); [m,f,l,a].forEach((v,i) => { if(v) controls[i]=true; }); } },
    Cell: { from: f => { requireUpdate(); return f && f.id === 0x13a8c ? f : null; } },
    WorldSpace: { from: f => { requireUpdate(); return f && [0x3c, 0x12345].includes(f.id) ? f : null; } },
    TESModPlatform: { moveRefrToPosition: (p,c,w,...values) => { moves.push({ c,w,values }); if(!blocked){ currentCell=(c||w).id;pos=values.slice(0,3);rot=values.slice(3).map(radians=>radians*180/Math.PI);rot[0]=0;rot[1]=0; } } },
    loadGame: (...args) => { loads.push(args); currentCell=args[2];pos=args[0].slice();rot=args[1].slice(); },
    Debug: { messageBox: msg => notices.push(msg), notification: msg => notices.push(msg) }, printConsole: msg => notices.push(msg), storage: {},
    mpClientPlugin: { destroyClient(){destroyedClients++;}, tick(){}, send: msg => sent.push(msg), sendRaw: msg => sent.push(msg) } };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if(cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file,mod);
    const js=esbuild.transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs',target:'es2020'}).code;
    function req(name) {
      if(name==='skyrimPlatform') return sp;
      if(name.endsWith('/logging')) return { logTrace(){}, logError(){} };
      if(name==='./remoteServer') return { RemoteServer: class RemoteServer {} };
      return load(path.resolve(path.dirname(file),name+'.ts'));
    }
    vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{Date:{now:()=>now},console,Number,Math,JSON})(req,mod,mod.exports);
    return mod.exports;
  }
  let networking;
  const controller={on:(n,f)=>native.on(n,f),once:(n,f)=>native.once(n,f),emitter:events,
    lookupListener(cls){if(cls.name==='NetworkingService')return networking;throw Error('unexpected lookup');}};
  const root=path.resolve(__dirname,'../src/services/services');
  const {LoadGameService}=load(path.join(root,'loadGameService.ts'));
  const svc=new LoadGameService(sp,controller);
  const gate=load(path.join(root,'spawnResume.ts'));
  const {NetworkingService}=load(path.join(root,'networkingService.ts'));
  networking=new NetworkingService(sp,controller);
  const {SinglePlayerService}=load(path.join(root,'singlePlayerService.ts'));
  const singlePlayer=new SinglePlayerService(sp,controller);
  events.emit('connectionAccepted',{});
  const update=(ms=250)=>{now+=ms;native.emit('update',{});};
  return {svc,gate,events,native,sp,moves,loads,notices,sent,controls,changed,update,singlePlayer,destroyedClients:()=>destroyedClients,
    cold(){native.emit('tick');native.emit('tick');}, unblock(){blocked=false;},
    observe(c,p,r=[0,0,90]){currentCell=c;pos=p.slice();rot=r.slice();}, time(ms){now+=ms;native.emit('tick');}};
}
const dest={worldOrCell:0x13a8c,pos:[42,84,126],rot:[0,0,90]};

test('cold interior loads exterior locally, holds all output through long native block, restores cell position rotation',()=>{
  const h=harness();let ready=0;
  h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.cold();
  assert.equal(h.loads.length,1);assert.equal(h.loads[0][2],0x3c);
  h.native.emit('loadGame');h.native.emit('loadGame');
  for(let i=0;i<40;i++)h.update();
  assert.equal(ready,0);assert.equal(h.gate.isSpawnResumeHeld(),true);
  for(const t of [2,5,11,14,16,17,19,23,24,15])h.events.emit('sendMessage',{message:{t},reliability:'reliable'});
  h.events.emit('sendRawMessage',{rawMessage:new Uint8Array([1]),reliability:'reliable'});
  assert.equal(h.sent.length,0);
  h.events.emit('sendMessage',{message:{t:1,contentJsonDump:JSON.stringify({customPacketType:'loginWithSkympIo'})},reliability:'reliable'});
  assert.equal(h.sent.length,1);
  h.unblock();h.update();h.update();assert.equal(ready,1);assert.equal(h.gate.isSpawnResumeHeld(),false);
  assert.deepEqual(Array.from(dest.pos),[42,84,126]);assert.ok(h.moves.length<45);
});

test('wrong cell holds the guard, facing alone does not',()=>{
  const h=harness();h.svc.spawnPlayer(dest);h.cold();h.native.emit('loadGame');
  h.observe(0x3c,dest.pos,dest.rot);h.update();assert.equal(h.gate.isSpawnResumeHeld(),true);
  h.observe(dest.worldOrCell,dest.pos,[0,0,0]);h.update();assert.equal(h.gate.isSpawnResumeHeld(),false);
  h.observe(dest.worldOrCell,dest.pos,dest.rot);h.update();assert.equal(h.gate.isSpawnResumeHeld(),false);
});

test('another exterior worldspace stages safely at cold load and restores the authoritative destination',()=>{
  const h=harness();h.svc.spawnPlayer({...dest,worldOrCell:0x12345});h.cold();
  assert.equal(h.loads[0][2],0x3c);h.native.emit('loadGame');h.unblock();h.update();h.update();assert.equal(h.gate.isSpawnResumeHeld(),false);
  assert.equal(h.moves.at(-1).w.id,0x12345);
});

test('disconnect, denial, failure and acceptance invalidate pending cold load and old callbacks',()=>{
  for(const event of ['connectionDisconnect','connectionDenied','connectionFailed','connectionAccepted']){
    const h=harness();let ready=0;h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);
    h.events.emit(event,{});h.cold();h.native.emit('loadGame');h.update();
    assert.equal(h.loads.length,0);assert.equal(h.moves.length,0);assert.equal(ready,0);
  }
});

test('invalid destination and timeout remain guarded with a visible diagnostic',()=>{
  for(const target of [{...dest,pos:[NaN,0,0]},{...dest,worldOrCell:0x999},dest]){
    const h=harness();h.svc.spawnPlayer(target);h.cold();if(h.loads.length)h.native.emit('loadGame');h.time(180001);h.update();
    assert.equal(h.gate.isSpawnResumeHeld(),true);assert.ok(h.notices.length>0);
    const count=h.moves.length;h.update(10000);assert.equal(h.moves.length,count);
  }
});

test('warm resume retries, duplicate request is harmless, controls restore only those changed',()=>{
  const h=harness();h.controls[1]=false;let ready=0;
  h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.update();
  h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.unblock();h.update();h.update();
  assert.equal(ready,1);assert.equal(h.loads.length,0);assert.equal(h.controls[1],false);
  assert.equal(h.controls[0],true);
  h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.cold();h.update();
  assert.equal(ready,1);assert.equal(h.loads.length,0);
});

test('old cold-load callbacks cannot start a replacement session or complete its callback',()=>{
  const h=harness();let oldReady=0,newReady=0;
  h.svc.spawnPlayer(dest,undefined,[],undefined,()=>oldReady++);
  h.native.emit('tick');h.events.emit('connectionDisconnect',{});h.events.emit('connectionAccepted',{});
  const replacement={...dest,pos:[100,200,300]};
  h.svc.spawnPlayer(replacement,undefined,[],undefined,()=>newReady++);
  h.cold();assert.equal(h.loads.length,1);
  h.native.emit('loadGame');h.observe(dest.worldOrCell,dest.pos,dest.rot);h.update();
  assert.equal(newReady,0);assert.equal(oldReady,0);assert.equal(h.gate.isSpawnResumeHeld(),true);
  h.unblock();h.update();h.update();assert.equal(newReady,1);assert.equal(oldReady,0);
});

test('caller mutation cannot replace the saved destination while loading and callback runs before output resumes',()=>{
  const h=harness();const target={...dest,pos:dest.pos.slice(),rot:dest.rot.slice()};let heldAtReady;
  h.svc.spawnPlayer(target,undefined,[],undefined,()=>heldAtReady=h.gate.isSpawnResumeHeld());
  target.pos[0]=999;target.rot[2]=1;h.cold();h.native.emit('loadGame');h.unblock();h.update();h.update();
  assert.equal(heldAtReady,true);assert.equal(h.gate.isSpawnResumeHeld(),false);
  assert.equal(h.moves.at(-1).values[0],42);assert.ok(Math.abs(h.moves.at(-1).values[5]-Math.PI/2)<1e-9);
});

test('failed initialization remains guarded and can retry without clearing the destination',()=>{
  const h=harness();h.svc.spawnPlayer(dest,undefined,[],undefined,()=>{throw Error('inventory failure');});
  h.update();h.unblock();h.update();h.update();assert.equal(h.gate.isSpawnResumeHeld(),true);
  let ready=0;h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.update();
  assert.equal(ready,1);assert.equal(h.gate.isSpawnResumeHeld(),false);
});

test('arbitrary or malformed custom packets and refr/raw packets remain blocked; auth and transport tick survive',()=>{
  const h=harness();
  for(const contentJsonDump of ['{',JSON.stringify({customPacketType:'invokeAnimResult'}),JSON.stringify({customPacketType:'rpGameplay'})])
    h.events.emit('sendMessage',{message:{t:1,contentJsonDump},reliability:'reliable'});
  h.events.emit('sendMessageWithRefrId',{message:{t:2,_refrId:0xff000001},reliability:'reliable'});
  h.native.emit('tick');assert.equal(h.sent.length,0);
});

test('manual save loading cancels restoring and failed MP work even when SinglePlayerService.close emits no disconnect',()=>{
  for(const fail of [false,true]) {
    const h=harness();let ready=0;
    h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);h.update();
    const oldEpoch=h.svc.getSpawnEpoch();
    if(fail){h.time(180001);h.update();}
    // A queued caller must also lose permission to apply inventory after the manual load.
    h.native.once('update',()=>{if(h.svc.isCurrentSpawn(oldEpoch))ready++;});
    h.native.emit('loadGame');
    assert.equal(h.singlePlayer.isSinglePlayer,true);assert.equal(h.destroyedClients(),1);
    assert.equal(h.gate.isSpawnResumeHeld(),false);
    const before=h.moves.length;h.unblock();h.observe(0x12345,[999,999,999]);h.update();h.update();
    assert.equal(h.moves.length,before);assert.equal(ready,0);assert.ok(h.controls.every(Boolean));
    h.events.emit('connectionDisconnect',{});h.update();assert.equal(h.gate.isSpawnResumeHeld(),false);
    h.events.emit('connectionAccepted',{});assert.equal(h.gate.isSpawnResumeHeld(),true);
  }
});

test('a rejected native load cannot misclassify a later manual save as an owned multiplayer load',()=>{
  const h=harness();h.sp.loadGame=()=>{throw Error('native load failed');};
  h.svc.spawnPlayer(dest);h.cold();assert.equal(h.gate.isSpawnResumeHeld(),true);
  h.native.emit('loadGame');h.update();
  assert.equal(h.singlePlayer.isSinglePlayer,true);assert.equal(h.gate.isSpawnResumeHeld(),false);
  assert.equal(h.moves.length,0);
});

 test('native radian relocation settles at nonzero saved yaw instead of reopening the loading transition',()=>{
 const h=harness();let ready=0;
 const target={worldOrCell:0x3c,pos:[160981,-11641,-5805],rot:[3.4285593,0,317.35318]};
 h.svc.spawnPlayer(target,undefined,[],undefined,()=>ready++);h.cold();h.native.emit('loadGame');h.unblock();
 for(let i=0;i<20;i++)h.update();
 assert.equal(ready,1);assert.equal(h.gate.isSpawnResumeHeld(),false);assert.equal(h.moves.length,1);
});

test('native player pitch reset after load does not restart scene relocation or keep controls locked',()=>{
 const h=harness();const target={...dest,rot:[3.4285593,0,317.35318]};let ready=0;
 h.svc.spawnPlayer(target,undefined,[],undefined,()=>ready++);h.cold();h.native.emit('loadGame');h.unblock();
 for(let i=0;i<20;i++)h.update();
 assert.equal(ready,1);assert.equal(h.moves.length,1);assert.equal(h.gate.isSpawnResumeHeld(),false);assert.ok(h.controls.every(Boolean));
});

test('orientation-only correction uses SetAngle and never reopens a cell loading transition',()=>{
 const h=harness();let ready=0;h.svc.spawnPlayer(dest,undefined,[],undefined,()=>ready++);
 h.observe(dest.worldOrCell,dest.pos,[0,0,0]);h.update();h.update();
 assert.equal(ready,1);assert.equal(h.moves.length,0);assert.equal(h.loads.length,0);assert.equal(h.gate.isSpawnResumeHeld(),false);
});
