// WRITE ONLY: mocks do not certify live persistence or multiplayer.
const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../.test-build/runtime.js');
const {courierSettings,inZone}=require('../.test-build/modules/courier/contracts.js');
const {COURIER_PROPERTY,courierState}=require('../.test-build/modules/courier/state.js');
const {CHAT_INBOX}=require('../.test-build/modules/chat/contracts.js');
// Synthetic test coordinates only, never a usable Skyrim route.
const route={id:'test-route',displayName:'ทดสอบ Courier',pickup:{label:'Pickup',cell:'3c:Skyrim.esm',pos:[0,0,0]},delivery:{label:'Delivery',cell:'3c:Skyrim.esm',pos:[1000,0,0]},radius:100,reputationReward:3};
const initial={schemaVersion:1,activeContractId:null,lifecycle:'idle',completedDeliveries:0,reputation:0};
function fixture(options={}){
  const actor=0xff000000,values=options.values??new Map(),writes=[];
  let at=10000,guid='first',connected=true,location={cellOrWorldDesc:route.pickup.cell,pos:[0,0,0]},failure='',calls=0;
  const mp={get:(id,key)=>key==='onlinePlayers'?[actor]:key==='profileId'?1:key==='locationalData'?location:values.get(id+':'+key)??null,
    set:(id,key,value)=>{assert.equal(id,actor);assert.ok(['private.rp.v1.identity',COURIER_PROPERTY,CHAT_INBOX].includes(key));
      if(key===COURIER_PROPERTY){calls++;if(failure==='before')throw Error('write failed');if(failure==='ignore')return;if(failure==='partial'){values.set(id+':'+key,{schemaVersion:1,reputation:value.reputation});return;}}
      values.set(id+':'+key,structuredClone(value));writes.push([id,key]);if(key===COURIER_PROPERTY&&failure==='after')throw Error('ambiguous native failure');},
    getActorName:()=> 'Courier name',getDescFromId:()=> '0',getUserByActor:id=>id===actor?0:65535,getUserActor:()=>actor,
    getUserGuid:()=>guid,isConnected:()=>connected,makeProperty(){},makeEventSource(){}};
  const runtime=createRuntime(mp,{courier:{route,...options.config},chat:{now:()=>at},scheduler:{every:()=>()=>{}},logger:{info(){},error(){}}});
  return {runtime,values,writes,mp,actor,send:async(text,id)=>{await runtime.chat.receive(actor,{v:1,id:id??'r'+at,text});at+=1000;},
    raw:(request)=>runtime.chat.receive(actor,request),state:()=>values.get(actor+':'+COURIER_PROPERTY),
    messages:()=>values.get(actor+':'+CHAT_INBOX).messages.map(m=>m.text),atPickup:()=>location={cellOrWorldDesc:route.pickup.cell,pos:[0,0,0]},
    atDelivery:()=>location={cellOrWorldDesc:route.delivery.cell,pos:[1000,0,0]},setLocation:v=>location=v,
    disconnect:()=>connected=false,reconnect:()=>{connected=true;guid='second';},fail:v=>failure=v,calls:()=>calls};
}
test('route/settings validation disables placeholders and invalid or overlapping routes',()=>{
  assert.equal(courierSettings({}).route,null);
  assert.equal(courierSettings({route}).route.id,'test-route');
  for(const invalid of [{...route,pickup:{...route.pickup,pos:[null,0,0]}},{...route,delivery:{...route.delivery,pos:[200,0,0]}},{...route,radius:0},{...route,reputationReward:-1},{...route,pickup:{...route.pickup,cell:'not-a-cell'}},{...route,delivery:{...route.delivery,pos:[Infinity,0,0]}}])assert.equal(courierSettings({route:invalid}).route,null);
  assert.equal(courierSettings({development:false,devpos:true}).devpos,false);
  assert.equal(courierSettings({development:true,devpos:true}).devpos,true);
});
test('3D range boundary, descriptor casing and wrong cell/invalid coordinates fail closed',()=>{
  const zone=courierSettings({route}).route.pickup;
  assert.equal(inZone({cell:'3C:SKYRIM.ESM',pos:[60,0,80]},zone,100),true);
  assert.equal(inZone({cell:zone.cell,pos:[0,0,101]},zone,100),false);
  assert.equal(inZone({cell:'1:Skyrim.esm',pos:[0,0,0]},zone,100),false);
  assert.equal(inZone({cell:zone.cell,pos:[NaN,0,0]},zone,100),false);
});
test('accept/travel/deliver rewards once, status and abandon preserve prior progress',async()=>{
  const e=fixture();await e.runtime.start();const identity=structuredClone(e.values.get(e.actor+':private.rp.v1.identity'));
  await e.send('/job');await e.send('/job status');assert.equal(e.state(),undefined);
  await e.send('/job deliver');assert.equal(e.calls(),0);
  await e.send('/job accept','accept');assert.equal(e.state().lifecycle,'active');assert.equal(e.calls(),1);
  await e.send('/job accept','accept');await e.send('/job accept');assert.equal(e.calls(),1);
  await e.send('/job deliver');assert.equal(e.calls(),1);
  e.setLocation({cellOrWorldDesc:'1:Skyrim.esm',pos:[1000,0,0]});await e.send('/job deliver');assert.equal(e.calls(),1);assert.equal(e.state().lifecycle,'active');
  e.atDelivery();await e.send('/job deliver','deliver');assert.deepEqual(e.state(),{...initial,completedDeliveries:1,reputation:3});assert.equal(e.calls(),2);
  await e.send('/job deliver','deliver');await e.send('/job deliver');assert.equal(e.calls(),2);
  e.atPickup();await e.send('/job accept');await e.send('/job abandon');assert.deepEqual(e.state(),{...initial,completedDeliveries:1,reputation:3});
  assert.deepEqual(e.values.get(e.actor+':private.rp.v1.identity'),identity);
  assert.ok(e.messages().some(t=>t.includes('Delivery completed')));
  for(const name of ['job','roll','try','me','do','whoami','profile'])assert.ok(e.runtime.commands.list().includes(name));
  await e.runtime.stop();assert.deepEqual(e.runtime.commands.list(),[]);
});
test('wrong pickup/world/missing location/invalid arguments and client-supplied flags do not write jobs',async()=>{
  const e=fixture();await e.runtime.start();e.atDelivery();await e.send('/job accept');
  e.setLocation({cellOrWorldDesc:'1:Skyrim.esm',pos:[0,0,0]});await e.send('/job accept');
  e.setLocation(null);await e.send('/job accept');await e.send('/job accept other-player');await e.send('/job unknown');
  await e.raw({v:1,id:'forged',text:'/job accept',pos:[0,0,0],actorId:e.actor,success:true});assert.equal(e.calls(),0);
  const disabled=fixture({config:{route:null}});await disabled.runtime.start();await disabled.send('/job accept');assert.equal(disabled.calls(),0);
});
test('native ownership, development own-position helper and rapid submit checks',async()=>{
  const e=fixture();await e.runtime.start();await e.send('/job devpos');assert.ok(e.messages().some(t=>t.includes('disabled')));
  assert.equal((await e.runtime.commands.dispatch('/job accept',{actorId:e.actor+1})).ok,false);
  e.disconnect();await e.send('/job accept');assert.equal(e.calls(),0);e.reconnect();
  await e.raw({v:1,id:'a',text:'/job accept'});await e.raw({v:1,id:'b',text:'/job abandon'});assert.equal(e.calls(),1);assert.equal(e.state().lifecycle,'active');
  const dev=fixture({config:{development:true,devpos:true}});await dev.runtime.start();await dev.send('/job devpos');
  assert.ok(dev.messages().some(t=>t.includes('3c:Skyrim.esm')&&t.includes('[0,0,0]')));assert.equal(dev.calls(),0);
  await dev.send('/job devpos 123');assert.equal(dev.calls(),0);
});
test('reconnect and new runtime reload the native actor state; simulated restart is not live verification',async()=>{
  const e=fixture();await e.runtime.start();await e.send('/job accept');e.disconnect();e.runtime.chat.sync();e.reconnect();await e.send('/job status');assert.equal(e.state().activeContractId,route.id);
  await e.runtime.stop();const reloaded=fixture({values:new Map(structuredClone([...e.values]))});await reloaded.runtime.start();
  reloaded.atDelivery();await reloaded.send('/job deliver');await reloaded.runtime.stop();
  const again=fixture({values:new Map(structuredClone([...reloaded.values]))});await again.runtime.start();await again.send('/job deliver');
  assert.deepEqual(again.state(),{...initial,completedDeliveries:1,reputation:3});assert.equal(again.calls(),0);
});
test('corrupt/future/unknown contract metadata is preserved; coherent write failures never separately reward',async()=>{
  for(const stored of [{...initial,schemaVersion:2},{...initial,reputation:-1},{...initial,lifecycle:'active',activeContractId:'unknown'},{...initial,extra:'preserve'}]){
    const e=fixture();await e.runtime.start();e.values.set(e.actor+':'+COURIER_PROPERTY,structuredClone(stored));
    await e.send('/job accept');await e.send('/job deliver');await e.send('/job abandon');assert.deepEqual(e.state(),stored);assert.equal(e.calls(),0);
  }
  assert.throws(()=>courierState({...initial,activeContractId:route.id}));
  for(const failure of ['before','ignore','after']){
    const e=fixture();await e.runtime.start();await e.send('/job accept');e.atDelivery();e.fail(failure);await e.send('/job deliver');
    e.fail('');await e.send('/job deliver');
    assert.deepEqual(e.state(),{...initial,completedDeliveries:1,reputation:3});
    await e.send('/job deliver');assert.equal(e.state().reputation,3);
  }
  const partial=fixture();await partial.runtime.start();await partial.send('/job accept');partial.atDelivery();partial.fail('partial');await partial.send('/job deliver');
  const preserved=structuredClone(partial.state()),count=partial.calls();partial.fail('');await partial.send('/job deliver');await partial.send('/job abandon');assert.deepEqual(partial.state(),preserved);assert.equal(partial.calls(),count);
});

test('bounded progress refuses overflow without clearing the outstanding contract',async()=>{
  const e=fixture();await e.runtime.start();
  const stored={...initial,lifecycle:'active',activeContractId:route.id,completedDeliveries:1000000000,reputation:1000000000};
  e.values.set(e.actor+':'+COURIER_PROPERTY,stored);e.atDelivery();await e.send('/job deliver');assert.equal(e.calls(),0);assert.deepEqual(e.state(),stored);
});

test('development beacon previews are owner/session scoped, never mutate Courier progress and reject arbitrary model paths',async()=>{
 const e=fixture({config:{development:true,beaconPreview:true}});await e.runtime.start();try{
 await e.send('/job accept');assert.equal(e.values.get(e.actor+':'+CHAT_INBOX).navigation.style,'amber','real Courier jobs default to amber');const before=structuredClone(e.state()),writes=e.calls();await e.send('/beacon orb');assert.equal(e.values.get(e.actor+':'+CHAT_INBOX).navigation.style,'orb');assert.deepEqual(e.state(),before);assert.equal(e.calls(),writes);
 await e.send('/beacon ../../bad.nif');assert.ok(e.messages().at(-1).includes('Usage'));assert.equal(e.calls(),writes);
 await e.send('/beacon default');assert.equal(e.values.get(e.actor+':'+CHAT_INBOX).navigation.style,'amber','default clears the preview override');
 await e.send('/beacon off');assert.equal(e.values.get(e.actor+':'+CHAT_INBOX).navigation.style,'off');e.reconnect();await e.send('/job status');assert.equal(e.values.get(e.actor+':'+CHAT_INBOX).navigation.style,'amber');
 }finally{await e.runtime.stop();}
 const prod=fixture();await prod.runtime.start();try{await prod.send('/beacon next');assert.equal(prod.calls(),0);assert.ok(!prod.values.get(prod.actor+':'+CHAT_INBOX).commands.includes('/beacon'));}finally{await prod.runtime.stop();}
});
