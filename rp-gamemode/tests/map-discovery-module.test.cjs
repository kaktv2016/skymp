const test=require('node:test'),assert=require('node:assert/strict');
const {mapDiscoveryModule}=require('../.test-build/modules/map-discovery/map-discovery-module.js');
const {MAP_DISCOVERY_EVENT,MAP_DISCOVERY_PROPERTY,MAP_DISCOVERY_INBOX}=require('../.test-build/modules/map-discovery/map-discovery-service.js');
const {SkyMpAdapter}=require('../.test-build/engine/adapter.js');
const {EventRouter}=require('../.test-build/core/event-router.js');
test('standalone module owns private transport and rejects extra packet arguments; shutdown revokes callbacks',()=>{
 const properties=[],sources=[],timers=[],cleanup=[],callbacks=new Map(),values=new Map();
 const mp={get:(_id,k)=>k==='onlinePlayers'?[1]:k==='profileId'?1:values.get(k),set:(_id,k,v)=>values.set(k,v),getActorName:()=> 'Player',getDescFromId:()=> '1',getUserByActor:()=>0,getUserActor:()=>1,isConnected:()=>true,getUserGuid:()=> 'one',makeProperty:(name,options)=>properties.push({name,...options}),makeEventSource:(name,body)=>sources.push({name,body}),on:(n,f)=>callbacks.set(n,f)};
 mapDiscoveryModule(mp,new SkyMpAdapter(mp),new EventRouter(mp),{every:(_ms,f)=>{timers.push(f);return()=>timers.splice(timers.indexOf(f),1);}},{info(){},error(){}}).initialize({defer:f=>cleanup.push(f)});
 assert.deepEqual(properties.map(p=>p.name),[MAP_DISCOVERY_PROPERTY,MAP_DISCOVERY_INBOX]);assert.ok(properties.every(p=>p.isVisibleByOwner&&!p.isVisibleByNeighbors&&p.updateNeighbor===''));assert.equal(sources.length,1);assert.equal(sources[0].name,MAP_DISCOVERY_EVENT);assert.ok(sources[0].body.length<24000);
 mp[MAP_DISCOVERY_EVENT](1,{v:1,kind:'hello',epoch:'test'},'extra');assert.equal(values.has(MAP_DISCOVERY_INBOX),false);mp[MAP_DISCOVERY_EVENT](1,{v:1,kind:'hello',epoch:'test'});assert.equal(values.get(MAP_DISCOVERY_INBOX).epoch,'test');
 for(const f of cleanup.reverse())f();assert.equal(mp[MAP_DISCOVERY_EVENT],undefined);assert.equal(timers.length,0);callbacks.get('disconnect')(0);
});
