const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../dist/rp-gamemode.cjs');
const {CHAT_INBOX}=require('../.test-build/modules/chat/contracts.js');
const {COURIER_PROPERTY}=require('../.test-build/modules/courier/state.js');
const route={id:'g12-route',displayName:'Courier',pickup:{label:'รับ',cell:'3c:Skyrim.esm',pos:[0,0,0]},delivery:{label:'ส่ง',cell:'3c:Skyrim.esm',pos:[1000,0,0]},radius:200,reputationReward:1};
function fixture(options={}){const values=new Map(),properties=[],timers=new Set();let now=0,guid='one',connected=true;
 const mp={get:(id,key)=>key==='onlinePlayers'?[0xff000000]:key==='profileId'?1:key==='locationalData'?{cellOrWorldDesc:'3c:Skyrim.esm',pos:[0,0,0]}:values.get(key)??null,
 set:(_id,key,value)=>values.set(key,structuredClone(value)),getActorName:()=> 'Courier',getDescFromId:()=> 'ff000000',getUserByActor:()=>0,getUserActor:()=>0xff000000,isConnected:()=>connected,getUserGuid:()=>guid,
 makeProperty:(name,options)=>properties.push({name,...options}),makeEventSource(){}};
 const runtime=createRuntime(mp,{courier:{route:options.route??route},admin:options.admin,scheduler:{every:(_ms,f)=>{timers.add(f);return()=>timers.delete(f);}},chat:{now:()=>now},logger:{info(){},error(){}}});
 return{runtime,values,properties,tick:()=>{now+=1000;timers.forEach(f=>f());},reconnect:()=>guid='two',connected:v=>connected=v,inbox:()=>values.get(CHAT_INBOX)};
}
test('server publishes existing active destination only to owner, clears invalid/idle jobs, restores on reconnect without progress writes',async()=>{
 const e=fixture();await e.runtime.start();try{
 assert.equal(e.inbox().navigation,null);e.tick();assert.ok(e.inbox().commands.includes('/wallet')===false);assert.ok(e.inbox().commands.includes('/job accept'));assert.ok(e.properties.every(p=>p.isVisibleByOwner===true&&p.isVisibleByNeighbors===false));
 const active={schemaVersion:1,lifecycle:'active',activeContractId:route.id,completedDeliveries:6,reputation:6};e.values.set(COURIER_PROPERTY,active);e.tick();assert.deepEqual(e.inbox().navigation,{id:route.id,cell:route.delivery.cell.toLowerCase(),pos:route.delivery.pos,label:route.delivery.label,style:'amber'});assert.deepEqual(e.values.get(COURIER_PROPERTY),active);
 const epoch=e.inbox().epoch;e.reconnect();e.tick();assert.notEqual(e.inbox().epoch,epoch);assert.equal(e.inbox().navigation.id,route.id);
 e.values.set(COURIER_PROPERTY,{...active,activeContractId:'deleted-route'});e.tick();assert.equal(e.inbox().navigation,null);
 e.values.set(COURIER_PROPERTY,{...active,lifecycle:'idle',activeContractId:null});e.tick();assert.equal(e.inbox().navigation,null);
 e.values.set(COURIER_PROPERTY,{schemaVersion:99});e.tick();assert.equal(e.inbox().navigation,null);assert.equal(e.values.get(COURIER_PROPERTY).schemaVersion,99);
 }finally{await e.runtime.stop();}
});
test('autocomplete catalog follows live registrations without granting command authority',async()=>{
 const e=fixture();await e.runtime.start();try{const unregister=e.runtime.commands.register('sample',()=>({ok:true,data:{}}),'fixture',['nested command']);e.tick();assert.ok(e.inbox().commands.includes('/sample nested'));assert.ok(e.inbox().commands.includes('/sample nested command'));unregister();e.tick();assert.ok(!e.inbox().commands.includes('/sample'));assert.equal((await e.runtime.commands.dispatch('/sample',{actorId:0xff000000})).ok,false);}finally{await e.runtime.stop();}
});

test('admin completions/state are private and immediately revoked; chat dispatch never broadcasts admin replies',async()=>{
 let permitted=true;const e=fixture({admin:{authorize:()=>permitted?'owner':null}});await e.runtime.start();try{
 e.tick();assert.ok(e.inbox().commands.includes('/admin fly on'));await e.runtime.chat.receive(0xff000000,{v:1,id:'fly',text:'/admin fly on'});assert.equal(e.inbox().admin.fly,true);assert.ok(e.inbox().messages.at(-1).text.startsWith('[ADMIN]'));assert.ok(!e.inbox().messages.some(m=>m.text.includes('Unsupported')));
 permitted=false;e.tick();assert.equal(e.inbox().admin,null);assert.ok(!e.inbox().commands.some(c=>c.startsWith('/admin')));assert.ok(e.properties.every(p=>!p.isVisibleByNeighbors));
 }finally{await e.runtime.stop();}
});

test('known destination gets native quest details; changed snapshots never silently point at an obsolete marker',async()=>{
 const c=require('../../../mod-work/frostveil-courier-navigation/catalogue.json')[2];const known={...route,id:c.routeId,delivery:{label:'โรงเลื่อย Heartwood',cell:c.cell,pos:c.pos}};const e=fixture({route:known});await e.runtime.start();try{
 e.values.set(COURIER_PROPERTY,{schemaVersion:1,lifecycle:'active',activeContractId:known.id,completedDeliveries:1,reputation:1});e.tick();assert.equal(e.inbox().quest.targetKey,c.key);assert.equal(e.inbox().quest.destination,known.delivery.label);e.reconnect();e.tick();assert.equal(e.inbox().quest.targetKey,c.key);
 const {questDetails}=require('../.test-build/modules/courier/quest-details.js');assert.equal(questDetails({...e.inbox().navigation,pos:[0,1,2]}),null);
 }finally{await e.runtime.stop();}
});
