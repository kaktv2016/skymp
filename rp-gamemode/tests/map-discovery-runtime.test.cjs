const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../.test-build/runtime.js');
const {MAP_DISCOVERY_EVENT,MAP_DISCOVERY_PROPERTY,MAP_DISCOVERY_INBOX}=require('../.test-build/modules/map-discovery/map-discovery-service.js');

test('production runtime wires independent map transport and persists no empty discovery record at boot',async()=>{
 const actor=0xff000000,values=new Map(),properties=[],sources=[],timers=new Set();
 const mp={get:(id,key)=>key==='onlinePlayers'?[actor]:key==='profileId'?1:key==='locationalData'?{cellOrWorldDesc:'3c:Skyrim.esm',pos:[0,0,0]}:values.get(key)??null,
  set:(_id,key,value)=>values.set(key,structuredClone(value)),getActorName:()=> 'Player',getDescFromId:()=> 'ff000000',
  getUserByActor:()=>0,getUserActor:()=>actor,isConnected:()=>true,getUserGuid:()=> 'runtime-one',
  makeProperty:(name,options)=>properties.push({name,...options}),makeEventSource:(name,body)=>sources.push({name,body})};
 const runtime=createRuntime(mp,{scheduler:{every:(_ms,fn)=>{timers.add(fn);return()=>timers.delete(fn);}},logger:{info(){},error(){}}});
 await runtime.start();
 try{
  const inbox=properties.find(p=>p.name===MAP_DISCOVERY_INBOX);assert.ok(inbox,'runtime must register map-discovery owner transport');
  assert.equal(inbox.isVisibleByOwner,true);assert.equal(inbox.isVisibleByNeighbors,false);
  const state=properties.find(p=>p.name===MAP_DISCOVERY_PROPERTY);assert.ok(state,'persistent map state must use registered visibility filtering');
  assert.equal(state.isVisibleByOwner,true);assert.equal(state.isVisibleByNeighbors,false);assert.equal(state.updateNeighbor,'');
  assert.ok(sources.some(s=>s.name===MAP_DISCOVERY_EVENT));assert.equal(values.has(MAP_DISCOVERY_PROPERTY),false);
  mp[MAP_DISCOVERY_EVENT](actor,{v:1,kind:'hello',epoch:'runtime_1'});
  assert.deepEqual(values.get(MAP_DISCOVERY_INBOX).markers,[]);assert.equal(values.has(MAP_DISCOVERY_PROPERTY),false);
 }finally{await runtime.stop();}
 assert.equal(mp[MAP_DISCOVERY_EVENT],undefined);assert.equal(timers.size,0);
});
