// Synthetic coordinates + real temporary journals. Not Skyrim route certification.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRuntime}=require('../.test-build/runtime.js');
const {COURIER_PROPERTY}=require('../.test-build/modules/courier/state.js');
const {CHAT_INBOX}=require('../.test-build/modules/chat/contracts.js');
const basic={id:'test-basic',displayName:'งานเริ่มต้น',pickup:{label:'รับ',cell:'3c:Skyrim.esm',pos:[0,0,0]},delivery:{label:'ส่ง',cell:'3c:Skyrim.esm',pos:[1000,0,0]},radius:100,reputationReward:1,reward:25,xpReward:10,requiredRank:0,requiredPermit:null,tier:'local',enabled:true};
const regional={...basic,id:'test-regional',displayName:'งานภูมิภาค',delivery:{...basic.delivery,pos:[3000,0,0]},reward:60,xpReward:25,requiredRank:1,requiredPermit:'regional',tier:'regional'};
function fixture(options={}){
 const root=options.root??fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-g13-')),values=options.values??new Map(),actor=0xff000000;
 let at=100000,guid='one',connected=true,location={cellOrWorldDesc:basic.pickup.cell,pos:[0,0,0]},fault='',profile=1;
 const mp={get:(_,key)=>key==='onlinePlayers'?[actor]:key==='profileId'?profile:key==='locationalData'?location:values.get(key)??null,set:(_,key,value)=>{assert.ok(['private.rp.v1.identity',COURIER_PROPERTY,CHAT_INBOX].includes(key));values.set(key,structuredClone(value));},getDescFromId:()=> 'ff000000',getActorName:()=> 'ทดสอบ',getUserByActor:id=>id===actor?0:65535,getUserActor:()=>actor,getUserGuid:()=>guid,isConnected:()=>connected,makeProperty(){},makeEventSource(){}};
 const config=options.config??{route:basic,routes:[basic,regional]};
 const runtime=createRuntime(mp,{courier:config,economy:{storageRoot:root,now:()=>at,fault:p=>{if(p===fault)throw Error(p);}},chat:{now:()=>at},scheduler:{every:()=>()=>{}},logger:{info(){},error(){}}});
 return{root,values,runtime,actor,mp,send:async text=>{at+=1000;return runtime.commands.dispatch(text,{actorId:actor});},state:()=>runtime.economy.inspect(actor),move:r=>location={cellOrWorldDesc:r.delivery.cell,pos:[...r.delivery.pos]},pickup:()=>location={cellOrWorldDesc:basic.pickup.cell,pos:[0,0,0]},advance:n=>at+=n,now:()=>at,fault:p=>fault=p,reconnect:()=>guid='two',setProfile:p=>profile=p,sync:()=>runtime.chat.sync(),inbox:()=>values.get(CHAT_INBOX),chat:async text=>{at+=1000;await runtime.chat.receive(actor,{v:1,id:'r'+at,text});}};
}
async function earn(e,route=basic){e.pickup();assert.equal((await e.send('/job accept '+route.id)).ok,true);e.move(route);assert.equal((await e.send('/job deliver')).ok,true);}
test('G1.3 listings, default compatibility, rank/permit locks and immutable selected destination',async()=>{
 const e=fixture();await e.runtime.start();try{
  const list=await e.send('/job list');assert.equal(list.ok,true);assert.match(list.data.systemMessage,/test-basic/);assert.match(list.data.systemMessage,/test-regional/);
  assert.equal((await e.send('/job accept test-regional')).ok,false);assert.equal((await e.send('/job accept unknown')).ok,false);
  assert.equal((await e.send('/job accept')).ok,true);assert.equal((await e.send('/job accept')).ok,false);assert.equal((await e.send('/job deliver')).ok,false);
  assert.equal(e.state().activeJob.contract.id,basic.id);assert.equal(e.state().activeJob.xpReward,10);
  e.sync();assert.deepEqual(e.inbox().navigation.pos,basic.delivery.pos);assert.ok(e.inbox().commands.includes('/job guild buy regional'));
  assert.equal((await e.send('/job cancel')).ok,true);e.sync();assert.equal(e.inbox().navigation,null);assert.equal(e.state().balance,0);assert.equal(e.state().progression.xp,0);
 }finally{await e.runtime.stop();}
});
test('G1.3 payout and XP commit once, unlock permit spending, preserve Satchel and survive reopen',async()=>{
 const e=fixture();await e.runtime.start();try{
  for(let i=0;i<8;i++)await earn(e);assert.equal(e.state().balance,200);assert.equal(e.state().progression.xp,80);
  assert.equal((await e.send('/job upgrade satchel')).ok,true);assert.equal(e.state().balance,100);
  assert.equal((await e.send('/job guild buy regional')).ok,true);assert.equal(e.state().balance,0);assert.deepEqual(e.state().progression.permits,['regional']);assert.equal((await e.send('/job guild buy regional')).ok,false);
  assert.equal((await e.send('/job guild buy long-distance')).ok,false);assert.equal((await e.send('/job guild buy regional 0')).ok,false);
  await earn(e,regional);assert.equal(e.state().balance,65);assert.equal(e.state().progression.xp,105);assert.equal((await e.send('/job deliver')).ok,false);assert.equal(e.state().progression.xp,105);
  e.sync();assert.equal(e.inbox().navigation,null);assert.equal(e.state().satchelLevel,1);assert.match((await e.send('/job rank')).data.systemMessage,/105/);
 }finally{await e.runtime.stop();}
 const reopened=fixture({root:e.root,values:e.values});await reopened.runtime.start();try{assert.equal(reopened.state().progression.xp,105);assert.deepEqual(reopened.state().progression.permits,['regional']);assert.equal(reopened.state().balance,65);assert.equal(reopened.state().satchelLevel,1);}finally{await reopened.runtime.stop();}
});
test('G1.3 accepted snapshot survives changed/removed/disabled routes and read-only reconnect navigation',async()=>{
 const e=fixture();await e.runtime.start();await e.send('/job accept');const quote=e.state().activeJob;await e.runtime.stop();
 const changed={...basic,enabled:false,reward:999,xpReward:999,delivery:{...basic.delivery,pos:[9000,0,0]}};
 for(const config of [{route:changed,routes:[changed]},{route:null,routes:[]}]){
  const next=fixture({root:e.root,values:e.values,config});await next.runtime.start();try{
   next.sync();assert.deepEqual(next.inbox().navigation.pos,basic.delivery.pos);assert.deepEqual(next.state().activeJob,quote);
   assert.equal((await next.send('/job status')).ok,true);
  }finally{await next.runtime.stop();}
 }
 const finish=fixture({root:e.root,values:e.values,config:{route:null,routes:[]}});await finish.runtime.start();try{finish.advance(2000);finish.move(basic);assert.equal((await finish.send('/job deliver')).ok,true);assert.equal(finish.state().balance,25);assert.equal(finish.state().progression.xp,10);}finally{await finish.runtime.stop();}
});
test('G1.3 permit and XP crash boundaries recover from the same joint journal',async()=>{
 for(const fault of ['before-write','partial-write','after-sync']){
  const e=fixture();await e.runtime.start();try{for(let i=0;i<4;i++)await earn(e);e.fault(fault);assert.equal((await e.send('/job guild buy regional')).ok,false);e.fault('');const committed=fault==='after-sync';assert.equal(e.state().balance,committed?0:100);assert.deepEqual(e.state().progression.permits,committed?['regional']:[]);await e.send('/job guild buy regional');assert.equal(e.state().balance,0);assert.deepEqual(e.state().progression.permits,['regional']);}finally{await e.runtime.stop();}
 }
});
test('G1.3 concurrent purchases, route repetition and short-time delivery guards',async()=>{
 const e=fixture();await e.runtime.start();try{
  for(let i=0;i<4;i++)await earn(e);e.advance(1000);const results=await Promise.all([e.runtime.commands.dispatch('/job guild buy regional',{actorId:e.actor}),e.runtime.commands.dispatch('/job guild buy regional',{actorId:e.actor})]);assert.equal(results.filter(x=>x.ok).length,1);assert.equal(e.state().balance,0);
 }finally{await e.runtime.stop();}
 const timed={...basic,minimumTravelMs:10000,repeatCooldownMs:20000},t=fixture({config:{route:timed,routes:[timed]}});await t.runtime.start();try{await t.send('/job accept');t.move(timed);assert.equal((await t.send('/job deliver')).ok,false);t.advance(10000);assert.equal((await t.send('/job deliver')).ok,true);t.pickup();assert.equal((await t.send('/job accept')).ok,false);t.advance(20000);assert.equal((await t.send('/job accept')).ok,true);}finally{await t.runtime.stop();}
});
test('G1.3 legacy schema-one money and active quote migrate without backpay or loss',async()=>{
 const {EconomyJournal}=require('../.test-build/modules/economy/journal.js'),e=fixture();await e.runtime.start();const state=e.state();await e.runtime.stop();
 const old={schemaVersion:1,identity:state.identity,revision:2,balance:123,satchelLevel:1,courier:{schemaVersion:1,lifecycle:'active',activeContractId:basic.id,completedDeliveries:17,reputation:20},activeJob:{id:'2:12345678-1234-1234-1234-123456789abc',reward:25},lastMutationAt:0,lastTransaction:{id:'2:12345678-1234-1234-1234-123456789abc',kind:'accept',jobId:'2:12345678-1234-1234-1234-123456789abc'}};
 const journal=new EconomyJournal(e.root);journal.append(state.identity,old);journal.close();
 const migrated=fixture({root:e.root,values:e.values});await migrated.runtime.start();try{assert.equal(migrated.state().schemaVersion,2);assert.equal(migrated.state().balance,123);assert.equal(migrated.state().satchelLevel,1);assert.equal(migrated.state().progression.xp,0);assert.equal(migrated.state().courier.completedDeliveries,17);migrated.move(basic);assert.equal((await migrated.send('/job deliver')).ok,true);assert.equal(migrated.state().balance,148);assert.equal(migrated.state().progression.xp,10);}finally{await migrated.runtime.stop();}
});

test('G1.3 money, XP and completion recover together across delivery flush faults',async()=>{
 for(const point of ['before-write','partial-write','after-sync']){
  const e=fixture();await e.runtime.start();try{await e.send('/job accept');e.move(basic);e.fault(point);assert.equal((await e.send('/job deliver')).ok,false);e.fault('');const committed=point==='after-sync',state=e.state();assert.equal(state.balance,committed?25:0);assert.equal(state.progression.xp,committed?10:0);assert.equal(state.courier.completedDeliveries,committed?1:0);await e.send('/job deliver');assert.equal(e.state().balance,25);assert.equal(e.state().progression.xp,10);await e.send('/job deliver');assert.equal(e.state().progression.xp,10);}finally{await e.runtime.stop();}
 }
});
test('G1.3 reconnect navigation reads snapshots without journal creation, repair or fsync',async()=>{
 const e=fixture();await e.runtime.start();await e.send('/job accept');const s=e.state(),file=path.join(e.root,s.identity,'journal.jsonl');await e.runtime.stop();const before=fs.readFileSync(file);fs.appendFileSync(file,'torn fixture suffix');
 const next=fixture({root:e.root,values:e.values}),sync=fs.fsyncSync;
 try{fs.fsyncSync=()=>{throw Error('No ambient financial flush allowed');};await next.runtime.start();next.sync();assert.deepEqual(next.inbox().navigation.pos,basic.delivery.pos);assert.equal(fs.existsSync(path.join(e.root,'writer.lock')),false);assert.deepEqual(fs.readFileSync(file),Buffer.concat([before,Buffer.from('torn fixture suffix')]));}
 finally{fs.fsyncSync=sync;await next.runtime.stop();}
});
test('G1.3 disabled routes, rank/balance limits, forged arguments and delayed cancelled delivery',async()=>{
 const disabled={...regional,enabled:false},e=fixture({config:{route:basic,routes:[basic,disabled]}});await e.runtime.start();try{
  assert.match((await e.send('/job list')).data.systemMessage,/ยังไม่เปิด/);assert.equal((await e.send('/job accept test-regional')).ok,false);
  for(let i=0;i<3;i++)await earn(e);const before=e.state();assert.equal((await e.send('/job guild buy regional')).ok,false);assert.deepEqual(e.state(),before);
  for(const c of ['/job guild buy regional 0','/job accept test-basic 999','/job deliver 25','/job rank 999','/job cancel other'])assert.equal((await e.send(c)).ok,false);
  e.pickup();await e.send('/job accept');await e.send('/job cancel');e.move(basic);assert.equal((await e.send('/job deliver')).ok,false);assert.equal(e.state().balance,75);assert.equal(e.state().progression.xp,30);
 }finally{await e.runtime.stop();}
});
test('G1.3 XP overflow and corrupt progression fail closed without losing wallet/active contract',async()=>{
 const {EconomyJournal}=require('../.test-build/modules/economy/journal.js');
 for(const change of [{xp:1000000000},{xp:-1},{xp:Number.MAX_SAFE_INTEGER},{permits:['regional','regional']}]){
  const e=fixture();await e.runtime.start();await e.send('/job accept');const state=e.state();await e.runtime.stop();const journal=new EconomyJournal(e.root);journal.append(state.identity,{...state,progression:{...state.progression,...change}});journal.close();const file=path.join(e.root,state.identity,'journal.jsonl'),before=fs.readFileSync(file);
  const n=fixture({root:e.root,values:e.values});await n.runtime.start();try{n.advance(2000);n.move(basic);assert.equal((await n.send('/job deliver')).ok,false);assert.deepEqual(fs.readFileSync(file),before);}finally{await n.runtime.stop();}
 }
});

test('G1.3 full permit chain unlocks a long-distance contract and preserves one quoted payout',async()=>{
 const advanced={...regional,id:'test-long',requiredRank:2,requiredPermit:'long-distance',tier:'long-distance',reward:90,xpReward:40,delivery:{...basic.delivery,pos:[5000,0,0]}},e=fixture({config:{route:basic,routes:[basic,regional,advanced]}});
 await e.runtime.start();try{
  for(let i=0;i<14;i++)await earn(e);assert.equal(e.state().balance,350);assert.equal(e.state().progression.xp,140);
  assert.equal((await e.send('/job guild buy long-distance')).ok,false);
  assert.equal((await e.send('/job guild buy regional')).ok,true);assert.equal((await e.send('/job guild buy long-distance')).ok,true);assert.equal(e.state().balance,0);
  e.pickup();assert.equal((await e.send('/job accept test-long')).ok,true);e.sync();assert.deepEqual(e.inbox().navigation.pos,advanced.delivery.pos);
  e.move(advanced);assert.equal((await e.send('/job deliver')).ok,true);assert.equal(e.state().balance,90);assert.equal(e.state().progression.xp,180);assert.equal((await e.send('/job deliver')).ok,false);
 }finally{await e.runtime.stop();}
 // Economy-free compatibility embeddings must not silently bypass permit gates.
 const direct=createRuntime(e.mp,{courier:{route:advanced},chat:{now:()=>999999},scheduler:{every:()=>()=>{}},logger:{info(){},error(){}}});await direct.start();try{e.pickup();assert.equal((await direct.commands.dispatch('/job accept',{actorId:e.actor})).ok,false);}finally{await direct.stop();}
});
