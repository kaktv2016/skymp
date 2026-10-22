const test=require('node:test'),assert=require('node:assert/strict');
const {SkyMpAdapter}=require('../.test-build/engine/adapter.js');
const {MapDiscoveryService,MAP_DISCOVERY_PROPERTY,MAP_DISCOVERY_INBOX}=require('../.test-build/modules/map-discovery/map-discovery-service.js');
const markers=[{id:'123:skyrim.esm',world:'3c:skyrim.esm',cell:'100:skyrim.esm',pos:[0,0,0],type:13,name:null,showAllHidden:false},{id:'124:skyrim.esm',world:'3c:skyrim.esm',cell:'100:skyrim.esm',pos:[20000,0,0],type:14,name:'Mill',showAllHidden:false}];
function fixture(persisted=new Map(),catalogue=markers){let now=0,guid='a',connected=true,actor=0xff000000,pos=[0,0,0],world='3c:Skyrim.esm',writes=[];
 const mp={get:(id,key)=>key==='onlinePlayers'?[actor]:key==='profileId'?1:key==='locationalData'?{cellOrWorldDesc:world,pos}:persisted.get(id+':'+key)??null,set:(id,key,v)=>{writes.push({id,key});persisted.set(id+':'+key,structuredClone(v));},getActorName:()=> 'Player',getDescFromId:id=>id.toString(16),getUserByActor:()=>0,getUserActor:()=>actor,isConnected:()=>connected,getUserGuid:()=>guid};
 let serial=0;const service=new MapDiscoveryService(mp,new SkyMpAdapter(mp),catalogue,{now:()=>now,nonce:()=>String(++serial).padStart(32,'0')});
 const receive=v=>service.receive(actor,v),hello=(epoch='load-a')=>{receive({v:1,kind:'hello',epoch});return inbox();},inbox=()=>persisted.get(actor+':'+MAP_DISCOVERY_INBOX);
 const discover=(overrides={})=>receive({v:1,kind:'discover',epoch:inbox().epoch,token:inbox().token,world:'3c:skyrim.esm',name:'ฟาร์ม',markerType:13,isVisible:true,canTravelTo:true,isShowAllHidden:false,...overrides});
 return{mp,service,persisted,writes,hello,inbox,discover,receive,advance:(n=1000)=>now+=n,position:p=>pos=p,world:w=>world=w,disconnect:()=>connected=false,reconnect:()=>{connected=true;guid+='x';},character:id=>actor=id,state:()=>persisted.get(actor+':'+MAP_DISCOVERY_PROPERTY)};
}
test('accepted native discovery survives a service restart and remains isolated by character, without duplicate writes',()=>{
 const e=fixture();e.hello();assert.equal(e.state(),undefined);assert.equal(e.discover(),true);assert.deepEqual(e.state(),{schemaVersion:1,markers:[{id:'123:skyrim.esm',canTravelTo:true}]});const count=e.writes.length;e.advance();assert.equal(e.discover(),false);assert.equal(e.writes.length,count);
 const restarted=fixture(e.persisted);const restored=restarted.hello();assert.deepEqual(restored.markers,[{id:'123:skyrim.esm',world:'3c:skyrim.esm',type:13,canTravelTo:true}]);assert.equal(restarted.writes.filter(w=>w.key===MAP_DISCOVERY_PROPERTY).length,0);
 restarted.character(0xff000001);restarted.advance();assert.deepEqual(restarted.hello('character-b').markers,[]);assert.equal(restarted.state(),undefined);
});
test('rejects forged references, remote/ambiguous markers, stale session tokens and invalid actor mappings',()=>{
 const e=fixture();const old=e.hello();assert.equal(e.discover({id:'124:skyrim.esm'}),false);assert.equal(e.discover({markerType:14,name:'Mill'}),false);e.world('1:skyrim.esm');assert.equal(e.discover(),false);e.world('3c:skyrim.esm');e.disconnect();assert.equal(e.discover(),false);e.reconnect();e.advance();e.hello('load-b');assert.equal(e.discover({token:old.token,epoch:old.epoch}),false);assert.equal(e.state(),undefined);
 const ambiguous=fixture(new Map(),[...markers,{...markers[0],id:'125:skyrim.esm',pos:[1,1,1]}]);ambiguous.hello();assert.equal(ambiguous.discover(),false);
});
test('bounds packets/rates, preserves corrupt persisted data and skips removed catalogue entries on restore',()=>{
 const e=fixture();e.hello();assert.equal(e.discover({name:'a'.repeat(257)}),false);assert.equal(e.discover({world:60}),false);assert.equal(e.discover({isVisible:false}),false);assert.equal(e.discover({isShowAllHidden:true}),false);
 for(let i=0;i<40;i++)e.discover({markerType:14});assert.equal(e.discover(),false);e.advance(10000);assert.equal(e.discover(),true);
 const bad=fixture();bad.persisted.set('4278190080:'+MAP_DISCOVERY_PROPERTY,{schemaVersion:99,doNotErase:true});assert.equal(bad.hello(),undefined);assert.deepEqual(bad.state(),{schemaVersion:99,doNotErase:true});
 const removed=fixture();removed.persisted.set('4278190080:'+MAP_DISCOVERY_PROPERTY,{schemaVersion:1,markers:[{id:'999:skyrim.esm',canTravelTo:true}]});assert.deepEqual(removed.hello().markers,[]);assert.deepEqual(removed.state().markers,[{id:'999:skyrim.esm',canTravelTo:true}]);
});
test('visibility-only discovery can upgrade its own travel flag but never downgrade an existing discovery',()=>{
 const e=fixture();e.hello();assert.equal(e.discover({canTravelTo:false}),true);e.advance();assert.equal(e.discover(),true);e.advance();assert.equal(e.discover({canTravelTo:false}),false);assert.equal(e.state().markers[0].canTravelTo,true);
});
test('owner snapshots issue only bounded nearby probes and do not republish an unchanged probe set',()=>{
 const e=fixture();const first=e.hello();assert.deepEqual(first.probes,[{id:'123:skyrim.esm',world:'3c:skyrim.esm',type:13,name:null,showAllHidden:false}]);
 const writes=e.writes.filter(w=>w.key===MAP_DISCOVERY_INBOX).length;e.service.sync();e.service.sync();assert.equal(e.writes.filter(w=>w.key===MAP_DISCOVERY_INBOX).length,writes);
 e.position([20000,0,0]);e.advance();e.service.sync();assert.deepEqual(e.inbox().probes,[{id:'124:skyrim.esm',world:'3c:skyrim.esm',type:14,name:'Mill',showAllHidden:false}]);
});
test('probe fallback accepts only an issued nearby marker and persists it once',()=>{
 const e=fixture();e.hello();assert.equal(e.discover({probeId:'124:skyrim.esm',markerType:14,name:'Mill'}),false,'unissued remote probe is rejected');
 assert.equal(e.discover({probeId:'123:skyrim.esm'}),true);assert.deepEqual(e.state(),{schemaVersion:1,markers:[{id:'123:skyrim.esm',canTravelTo:true}]});
 e.advance();assert.equal(e.discover({probeId:'123:skyrim.esm'}),false,'saved probe does not duplicate state');
});
test('duplicate discovery request after reconnect is acknowledged without another persistence write',()=>{
 const e=fixture();e.hello('session-a');assert.equal(e.discover({requestId:'request_1'}),true);assert.deepEqual(e.inbox().acks,['request_1']);
 const writes=e.writes.filter(w=>w.key===MAP_DISCOVERY_PROPERTY).length;const restarted=fixture(e.persisted);const second=restarted.hello('session-b');assert.deepEqual(second.markers,[{id:'123:skyrim.esm',world:'3c:skyrim.esm',type:13,canTravelTo:true}]);
 assert.equal(restarted.discover({requestId:'request_1'}),true);assert.deepEqual(restarted.inbox().acks,['request_1']);assert.equal(restarted.writes.filter(w=>w.key===MAP_DISCOVERY_PROPERTY).length,0);assert.equal(writes,1);
});
