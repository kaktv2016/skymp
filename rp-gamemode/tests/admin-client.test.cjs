const test=require('node:test'),assert=require('node:assert/strict');
const {installAdminMovement}=require('../.test-build/client/admin-movement.js');
function fixture(){const handlers=new Map(),logs=[];let actor=1,connected=true,loading=false,speed=120,weight=25,toggles=0,now=0;
 const ctx={getMyFormIdInServerFormat:()=>actor,sp:{storage:{},Game:{getPlayer:()=>({getFormID:()=>0x14,getActorValue:k=>k==='InventoryWeight'?weight:speed,getBaseActorValue:()=>speed,setActorValue:(_k,v)=>speed=v,modActorValue:(k,v)=>{if(k==='SpeedMult')speed+=v;else if(k==='InventoryWeight')weight+=v;}})},Debug:{toggleCollisions(){toggles++;}},mpClientPlugin:{isConnected:()=>connected},Ui:{isMenuOpen:()=>loading},on:(n,f)=>{const set=handlers.get(n)??new Set();set.add(f);handlers.set(n,set);return[n,f];},unsubscribe:h=>handlers.get(h[0]).delete(h[1]),printConsole:s=>logs.push(s)}};
 installAdminMovement(ctx,()=>now);return{ctx,logs,manager:ctx.sp.storage.__rpAdminMovementV1,receive:v=>ctx.sp.storage.__rpAdminMovementV1.receive(v),emit(n){for(const f of handlers.get(n)??[])f();},setSpeed:v=>speed=v,tick(){now+=500;for(const f of handlers.get('update')??[])f();},speed:()=>speed,toggles:()=>toggles,disconnect:()=>connected=false,loading:v=>loading=v,reconnect:()=>{connected=true;actor++;}};
}
// A native actor-value write and the engine's cached movement speed are separate.
// InventoryWeight changes invalidate that cache in Skyrim (Enderal's native refresh pattern).
function engineFixture(initialWeight=25,float32=false){
 const e=fixture();let insideUpdate=false,physicalSpeed=120,weight=initialWeight,noSpeedWrite=false,failRestore=false;
 const p={getFormID:()=>0x14,getActorValue:key=>key==='SpeedMult'?e.speed():weight,
  modActorValue(key,value){assert.equal(insideUpdate,true,'all native writes must run in update');
   if(key==='SpeedMult'){if(!noSpeedWrite)e.setSpeed(e.speed()+value);}
   else if(key==='InventoryWeight'){if(failRestore&&value>0)throw Error('weight restore failed');weight=float32?Math.fround(weight+value):weight+value;physicalSpeed=e.speed();}
   else assert.fail('unexpected actor value '+key);
  }};
 e.ctx.sp.Game.getPlayer=()=>p;
 const toggle=e.ctx.sp.Debug.toggleCollisions;e.ctx.sp.Debug.toggleCollisions=()=>{assert.equal(insideUpdate,true,'TCL must run in update');toggle();};
 const tick=e.tick;e.tick=()=>{insideUpdate=true;try{tick();}finally{insideUpdate=false;}};
 return Object.assign(e,{physicalSpeed:()=>physicalSpeed,weight:()=>weight,noSpeedWrite:()=>noSpeedWrite=true,failRestore:v=>failRestore=v});
}
test('native movement requests do not toggle twice, multiply cumulatively, persist after revocation or accept invalid ranges',()=>{
 const e=fixture(),request={revision:1,fly:true,speed:2};e.receive(request);e.tick();assert.equal(e.toggles(),1);assert.equal(e.speed(),240);
 e.receive(request);e.tick();assert.equal(e.toggles(),1);assert.equal(e.speed(),240);e.receive({...request,revision:2,speed:3});e.tick();assert.equal(e.speed(),360);
 e.receive({...request,revision:3,speed:99});e.tick();assert.equal(e.speed(),120);assert.equal(e.toggles(),2);
 e.receive({...request,revision:4});e.tick();e.receive(null);e.tick();assert.equal(e.toggles(),4);assert.equal(e.speed(),120);
});
test('disconnect and disposal restore only owned changes; missing TCL never pretends success',()=>{
 const e=fixture();e.receive({revision:1,fly:true,speed:2});e.tick();e.disconnect();e.tick();assert.equal(e.speed(),120);assert.equal(e.toggles(),2);e.reconnect();e.tick();assert.equal(e.toggles(),2);
 e.ctx.sp.Debug={};e.receive({revision:2,fly:true,speed:1});e.tick();assert.ok(e.logs.some(x=>x.includes('unavailable')));
 e.manager.dispose();assert.equal(e.speed(),120);
});
test('load restores before loading and never subtracts old modifiers from a new character',()=>{
 const e=fixture();e.receive({revision:1,fly:true,speed:2});e.tick();e.emit('preLoadGame');assert.equal(e.speed(),240,'tick-event callback must not call native APIs');e.tick();assert.equal(e.speed(),120);assert.equal(e.toggles(),2);e.setSpeed(100);e.emit('loadGame');e.tick();assert.equal(e.speed(),100);assert.equal(e.toggles(),2);
 const abrupt=fixture();abrupt.receive({revision:1,fly:true,speed:2});abrupt.tick();abrupt.setSpeed(100);abrupt.emit('loadGame');abrupt.tick();assert.equal(abrupt.speed(),100);assert.equal(abrupt.toggles(),1);assert.equal(abrupt.manager.status().uncertain,true);
});
test('speed requests refresh cached movement and reset restores movement while preserving other modifiers',()=>{
 const e=engineFixture();e.receive({revision:1,fly:false,speed:2});e.tick();e.tick();assert.equal(e.physicalSpeed(),240);assert.equal(e.weight(),25);
 e.setSpeed(250);e.receive({revision:2,fly:false,speed:3});e.tick();e.tick();assert.equal(e.physicalSpeed(),370,'only owned delta changes');
 e.receive({revision:3,fly:false,speed:1});e.tick();e.tick();assert.equal(e.speed(),130);assert.equal(e.physicalSpeed(),130);assert.equal(e.weight(),25);
});
test('disposal and hot replacement defer native cleanup until update and do not leave owned movement behind',()=>{
 const e=engineFixture();e.receive({revision:1,fly:true,speed:2});e.tick();
 e.manager.dispose();assert.equal(e.speed(),240);assert.equal(e.toggles(),1);e.tick();e.tick();assert.equal(e.speed(),120);assert.equal(e.toggles(),2);assert.equal(e.weight(),25);assert.equal(e.manager.status().disposed,true);
 const hot=engineFixture();hot.receive({revision:1,fly:true,speed:2});hot.tick();installAdminMovement(hot.ctx);hot.tick();hot.tick();assert.equal(hot.speed(),120);assert.equal(hot.toggles(),2);assert.equal(hot.ctx.sp.storage.__rpAdminMovementV1.status().uncertain,false);
});
test('native SpeedMult no-op is reported instead of claiming applied speed',()=>{
 const e=engineFixture();e.noSpeedWrite();e.receive({revision:1,fly:false,speed:2});e.tick();assert.equal(e.manager.status().speed,1);assert.match(e.manager.status().error,/SpeedMult.*(readback|apply|unchanged)/i);assert.equal(e.speed(),120);
});
test('pending refresh cleanup retries after failure and stays visible until it succeeds',()=>{
 const e=engineFixture();e.receive({revision:1,fly:false,speed:2});e.tick();e.failRestore(true);e.manager.dispose();e.tick();assert.equal(e.manager.status().disposed,false);assert.match(e.manager.status().error,/restore failed/);e.failRestore(false);e.tick();e.tick();assert.equal(e.speed(),120);assert.equal(e.weight(),25);assert.equal(e.manager.status().disposed,true);
});
test('character change without pre-cleanup never subtracts old values or silently reports clean state',()=>{
 const e=engineFixture();e.receive({revision:1,fly:true,speed:2});e.tick();e.setSpeed(100);e.reconnect();e.tick();assert.equal(e.speed(),100);assert.equal(e.toggles(),1);assert.equal(e.manager.status().uncertain,true);
});
test('expired context also defers cleanup to update and disconnect finishes the pending refresh',()=>{
 const e=engineFixture();e.receive({revision:1,fly:true,speed:2});e.tick();e.ctx._expired=true;e.tick();e.tick();assert.equal(e.speed(),120);assert.equal(e.weight(),25);assert.equal(e.toggles(),2);assert.equal(e.manager.status().disposed,true);
 const disconnected=engineFixture();disconnected.receive({revision:1,fly:true,speed:2});disconnected.tick();disconnected.disconnect();disconnected.tick();disconnected.tick();assert.equal(disconnected.physicalSpeed(),120);assert.equal(disconnected.weight(),25);assert.equal(disconnected.toggles(),2);
});
test('an ambiguous native TCL exception is never blindly toggled a second time',()=>{
 const e=engineFixture();let attempts=0;e.ctx.sp.Debug.toggleCollisions=()=>{attempts++;throw Error('native TCL failed after dispatch');};e.receive({revision:1,fly:true,speed:1});e.tick();e.tick();assert.equal(attempts,1);assert.equal(e.manager.status().uncertain,true);assert.match(e.manager.status().error,/TCL/);
});
test('SpeedMult native failure after applying the delta still removes that owned delta',()=>{
 const e=engineFixture(),get=e.ctx.sp.Game.getPlayer;let fail=true;
 e.ctx.sp.Game.getPlayer=()=>{const p=get(),mod=p.modActorValue;return{...p,modActorValue(k,v){mod(k,v);if(k==='SpeedMult'&&fail){fail=false;throw Error('post-write native failure');}}};};
 e.receive({revision:1,fly:false,speed:2});e.tick();e.tick();assert.equal(e.speed(),120);assert.equal(e.physicalSpeed(),120);assert.match(e.manager.status().error,/post-write/);
});

test('an unused admin controller disposes immediately without native calls or extra event handlers',()=>{
 const e=engineFixture();e.manager.dispose();assert.equal(e.manager.status().disposed,true);assert.equal(e.toggles(),0);assert.equal(e.speed(),120);
});

for(const failedSign of [-1,1])test('InventoryWeight post-write exception never loses or reapplies its owned pulse: '+failedSign,()=>{
 const e=engineFixture(),get=e.ctx.sp.Game.getPlayer;let fail=true;
 e.ctx.sp.Game.getPlayer=()=>{const p=get(),mod=p.modActorValue;return{...p,modActorValue(k,v){mod(k,v);if(k==='InventoryWeight'&&Math.sign(v)===failedSign&&fail){fail=false;throw Error('post-write weight failure');}}};};
 e.receive({revision:1,fly:false,speed:2});for(let i=0;i<6;i++)e.tick();e.manager.dispose();for(let i=0;i<4;i++)e.tick();
 assert.equal(e.speed(),120);assert.ok(Math.abs(e.weight()-25)<1e-8,'owned weight must return to original value');assert.equal(e.manager.status().disposed,true);assert.equal(e.manager.status().refreshPending,false);
});

test('weight refresh tolerates actual float32 actor-value rounding without refusing movement',()=>{
 const e=engineFixture(2000,true);e.receive({revision:1,fly:false,speed:2});e.tick();e.tick();assert.equal(e.physicalSpeed(),240);assert.equal(e.manager.status().error,'');
 e.manager.dispose();e.tick();e.tick();assert.equal(e.weight(),2000);assert.equal(e.speed(),120);assert.equal(e.manager.status().disposed,true);
});
