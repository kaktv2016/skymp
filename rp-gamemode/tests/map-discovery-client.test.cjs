const test=require('node:test'),assert=require('node:assert/strict');
const {installMapDiscoveryClient,mapDiscoverySources}=require('../.test-build/client/map-discovery.js');
function fixture(){const handlers=new Map(),sent=[],calls=[],unsafe=[],logs=[];let actor=1,connected=true,loading=false,inUpdate=false,now=0;const refs=new Map([[0x123,{visible:false,travel:false,name:'ฟาร์ม'}],[0x124,{visible:false,travel:false,name:'โรงเลื่อย'}]]);
 function guard(name,f){return(...args)=>{if(!inUpdate){unsafe.push(name);throw Error('Native outside update');}if(args.some(Array.isArray))throw Error('SP3 array argument');calls.push({name,args});return f(...args);};}
 const ctx={getMyFormIdInServerFormat:()=>actor,sendEvent:p=>sent.push(p),sp:{storage:{},mpClientPlugin:{isConnected:()=>connected},Ui:{isMenuOpen:guard('menu',n=>loading&&n==='Loading Menu')},Game:{getModName:guard('modName',()=> 'Skyrim.esm'),getFormFromFile:guard('getForm',(id,file)=>file.toLowerCase()==='skyrim.esm'&&refs.has(id)?{id}:null)},ObjectReference:{from:guard('from',f=>f?{isMapMarkerVisible:guard('visible',()=>refs.get(f.id).visible),canFastTravelToMarker:guard('travel',()=>refs.get(f.id).travel),getDisplayName:guard('name',()=>refs.get(f.id).name),addToMap:guard('add',travel=>{const ref=refs.get(f.id);ref.visible=true;ref.travel=travel;emit('locationDiscovery',{worldSpaceId:60,name:ref.name,markerType:f.id===0x123?13:14,isVisible:true,canTravelTo:travel,isShowAllHidden:false});})}:null)},on:(n,f)=>{const a=handlers.get(n)??new Set();a.add(f);handlers.set(n,a);return[n,f];},unsubscribe:([n,f])=>handlers.get(n).delete(f),printConsole:s=>logs.push(s)}};
 function emit(n,v){for(const f of [...handlers.get(n)??[]])f(v);}function tick(){now+=250;inUpdate=true;try{emit('update');}finally{inUpdate=false;}}
 const install=()=>installMapDiscoveryClient(ctx,()=>now);install();const manager=()=>ctx.sp.storage.__rpMapDiscoveryV1;
 const entry={id:'123:skyrim.esm',world:'3c:skyrim.esm',type:13,canTravelTo:false};
 const ack=(entries=[entry],extra={})=>manager().receive({v:1,actor,epoch:sent.filter(p=>p.kind==='hello').at(-1)?.epoch,token:'token-a',markers:entries,...extra});
 return{ctx,sent,calls,unsafe,logs,refs,entry,install,manager,tick,ack,emit:(n,v)=>{inUpdate=true;try{emit(n,v);}finally{inUpdate=false;}},loading:v=>loading=v,disconnect:()=>connected=false,reconnect:(id=actor)=>{connected=true;actor=id;},actor:id=>actor=id};
}
test('restore uses owner flags and scalar update natives, skips missing markers, and never echoes discovery',()=>{
 const e=fixture();e.tick();e.ack([e.entry,{...e.entry,id:'999:skyrim.esm'}]);assert.equal(e.calls.some(c=>c.name==='add'),false);e.tick();assert.equal(e.refs.get(0x123).visible,true);assert.equal(e.refs.get(0x123).travel,false);assert.equal(e.sent.filter(p=>p.kind==='discover').length,0);assert.equal(e.logs.length,1);e.ack();e.tick();assert.equal(e.calls.filter(c=>c.name==='add').length,1);assert.deepEqual(e.unsafe,[]);
});
test('real discovery reports numeric native world IDs as stable plugin descriptors and preserves travel upgrades',()=>{
 const e=fixture();e.tick();e.ack();e.tick();e.emit('locationDiscovery',{worldSpaceId:60,name:'ฟาร์ม',markerType:13,isVisible:true,canTravelTo:true,isShowAllHidden:false});e.tick();const p=e.sent.filter(p=>p.kind==='discover').at(-1);assert.equal(p.world,'3c:skyrim.esm');assert.equal(p.canTravelTo,true);assert.equal(p.token,'token-a');assert.equal(p.name,'ฟาร์ม');assert.equal('pos' in p,false);assert.deepEqual(e.unsafe,[]);
});
test('discovery retries until the server owner snapshot acknowledges persistence',()=>{
 const e=fixture();e.tick();e.ack();e.tick();e.emit('locationDiscovery',{worldSpaceId:60,name:'ฟาร์ม',markerType:13,isVisible:true,canTravelTo:true,isShowAllHidden:false});e.tick();
 const first=e.sent.filter(p=>p.kind==='discover').at(-1);assert.ok(first.requestId,'discovery needs a server persistence acknowledgement id');
 for(let i=0;i<4;i++)e.tick();const sends=e.sent.filter(p=>p.kind==='discover');assert.equal(sends.length,2,'unacknowledged event must retry after a bounded delay');assert.equal(sends[1].requestId,first.requestId,'retry must remain idempotent');
 e.ack([e.entry],{acks:[first.requestId]});e.tick();for(let i=0;i<8;i++)e.tick();assert.equal(e.sent.filter(p=>p.kind==='discover').length,2,'acknowledged discovery must leave the outbox');assert.deepEqual(e.unsafe,[]);
});
test('pending discoveries survive network reconnect and client source replacement without crossing actors',()=>{
 const e=fixture();e.tick();e.ack();e.tick();e.emit('locationDiscovery',{worldSpaceId:60,name:'ฟาร์ม',markerType:13,isVisible:true,canTravelTo:true,isShowAllHidden:false});e.tick();const id=e.sent.filter(p=>p.kind==='discover').at(-1).requestId;
 e.disconnect();e.tick();e.reconnect();e.install();e.tick();assert.equal(e.sent.filter(p=>p.kind==='hello').length,2);e.ack([]);for(let i=0;i<5;i++)e.tick();const retry=e.sent.filter(p=>p.kind==='discover').at(-1);assert.equal(retry.requestId,id);
 const sentBeforeActorChange=e.sent.filter(p=>p.kind==='discover').length;e.actor(2);e.emit('loadGame');e.tick();assert.equal(e.sent.filter(p=>p.kind==='hello').length,3);assert.equal(e.sent.filter(p=>p.kind==='discover').length,sentBeforeActorChange,'pending requests for actor 1 must not be sent as actor 2');assert.deepEqual(e.unsafe,[]);
});
test('server-issued nearby probes report only native fast-travel discoveries and never add markers',()=>{
 const e=fixture();e.tick();e.refs.get(0x123).visible=true;e.refs.get(0x123).travel=false;
 e.ack([],{probes:[{id:'123:skyrim.esm',world:'3c:skyrim.esm',type:13,name:null,showAllHidden:false}]});e.tick();assert.equal(e.sent.filter(p=>p.kind==='discover').length,0);
 e.refs.get(0x123).travel=true;for(let i=0;i<4;i++)e.tick();const packet=e.sent.filter(p=>p.kind==='discover').at(-1);assert.equal(packet.probeId,'123:skyrim.esm');assert.equal(packet.canTravelTo,true);assert.equal(e.calls.filter(c=>c.name==='add').length,0);assert.deepEqual(e.unsafe,[]);
});
test('loading/reconnect drops old callbacks and actor changes wait for a fresh bootstrap load',()=>{
 const e=fixture();e.tick();const stale={v:1,actor:1,epoch:e.sent[0].epoch,token:'old',markers:[e.entry]};e.loading(true);e.ack();e.tick();assert.equal(e.refs.get(0x123).visible,false);e.emit('loadGame');e.manager().receive(stale);e.loading(false);e.tick();assert.equal(e.refs.get(0x123).visible,false);e.ack();e.tick();assert.equal(e.refs.get(0x123).visible,true);
 e.actor(2);e.tick();const count=e.sent.length;e.manager().receive(stale);e.tick();assert.equal(e.sent.length,count);e.emit('loadGame');e.tick();assert.equal(e.sent.at(-1).kind,'hello');assert.notEqual(e.sent.at(-1).epoch,stale.epoch);e.ack([{...e.entry,id:'124:skyrim.esm',type:14}]);e.tick();assert.equal(e.refs.get(0x124).visible,true);assert.deepEqual(e.unsafe,[]);
});
test('replacement/expiration removes subscriptions and old owner callbacks cannot restore markers',()=>{
 const e=fixture();e.tick();const old=e.manager();e.ack();e.install();old.receive({v:1,actor:1,epoch:e.sent[0].epoch,token:'stale',markers:[e.entry]});e.tick();assert.equal(e.refs.get(0x123).visible,false);e.ack();e.ctx._expired=true;e.tick();assert.equal(e.refs.get(0x123).visible,false);assert.deepEqual(e.unsafe,[]);
});
test('serialized sources install independently of chat and owner delivery performs no native calls',()=>{
 const e=fixture(),source=mapDiscoverySources();new Function('ctx',source.event)(e.ctx);e.tick();new Function('ctx',source.owner)({...e.ctx,value:{v:1,actor:1,epoch:e.sent.at(-1).epoch,token:'source-token',markers:[e.entry]}});e.tick();assert.equal(e.refs.get(0x123).visible,true);assert.deepEqual(e.unsafe,[]);assert.ok(source.event.length<24000);
});
test('transient missing native markers retry from update, while permanent failures stop after three attempts',()=>{
 const e=fixture();e.tick();e.ack([{...e.entry,id:'999:skyrim.esm'}]);e.tick();assert.equal(e.logs.length,1);e.tick();assert.equal(e.logs.length,1);e.refs.set(0x999,{visible:false,travel:false,name:'Restored later'});for(let i=0;i<5;i++)e.tick();assert.equal(e.refs.get(0x999).visible,true,'missing native wrapper should not permanently discard a saved marker');
 const missing=fixture();missing.tick();missing.ack([{...missing.entry,id:'999:skyrim.esm'}]);for(let i=0;i<30;i++)missing.tick();assert.equal(missing.logs.length,3,'permanently missing marker retries are bounded');assert.deepEqual(e.unsafe,[]);assert.deepEqual(missing.unsafe,[]);
});
test('warm reconnect of the same actor resumes without loadGame and rejects previous session snapshots',()=>{
 const e=fixture();e.tick();const stale={v:1,actor:1,epoch:e.sent.at(-1).epoch,token:'old',markers:[e.entry]};e.ack();e.tick();e.disconnect();e.tick();e.reconnect();e.tick();assert.equal(e.sent.at(-1).kind,'hello');assert.notEqual(e.sent.at(-1).epoch,stale.epoch);e.manager().receive(stale);e.tick();assert.equal(e.sent.filter(p=>p.kind==='discover').length,0);e.ack([{...e.entry,id:'124:skyrim.esm',type:14}]);e.tick();assert.equal(e.refs.get(0x124).visible,true);
});
test('manager replacement retains previous actor identity and refuses cross-character restore without fresh native load',()=>{
 const e=fixture();e.tick();e.ack();e.tick();e.actor(2);e.install();e.tick();const count=e.sent.length;assert.match(e.logs.join('\n'),/restart Skyrim/i);e.tick();assert.equal(e.sent.length,count);e.install();e.tick();assert.equal(e.sent.length,count,'replacement must not bypass cross-character guard');e.emit('loadGame');e.tick();assert.equal(e.sent.length,count+1);e.ack([{...e.entry,id:'124:skyrim.esm',type:14}]);e.tick();assert.equal(e.refs.get(0x124).visible,true);
});
test('a fresh load consumed by the current actor cannot authorize a later warm character change',()=>{
 const e=fixture();e.tick();e.ack();e.tick();e.emit('loadGame');e.tick();e.ack();e.tick();const hellos=e.sent.filter(p=>p.kind==='hello').length;e.actor(2);e.tick();assert.equal(e.sent.filter(p=>p.kind==='hello').length,hellos,'only a load belonging to this character change may authorize restoration');assert.match(e.logs.join('\n'),/restart Skyrim/i);
});

test('a silent native addToMap no-op is diagnosed and never reported as a restored marker',()=>{
 const e=fixture(),traces=[];e.ctx.sp.writeLogs=(_name,line)=>traces.push(line);
 const from=e.ctx.sp.ObjectReference.from;e.ctx.sp.ObjectReference.from=(form)=>{const ref=from(form);if(ref)ref.addToMap=()=>{};return ref;};
 e.tick();e.ack();for(let i=0;i<30;i++)e.tick();
 assert.equal(e.refs.get(0x123).visible,false);assert.equal(e.logs.length,3);assert.ok(e.logs.every(line=>/did not apply/.test(line)));
 assert.equal(traces.some(line=>line.startsWith('restored ')),false);
});

for(const delivery of ['same-object','equivalent-clones'])test('per-frame owner delivery drains all 33 markers exactly once: '+delivery,()=>{
 const e=fixture(),traces=[];e.ctx.sp.writeLogs=(_name,line)=>traces.push(line);e.tick();
 const entries=Array.from({length:33},(_,i)=>{const id=0x1000+i;e.refs.set(id,{visible:false,travel:false,name:'Marker '+i});return{...e.entry,id:id.toString(16)+':skyrim.esm',type:14};});
 const payload={v:1,actor:1,epoch:e.sent.at(-1).epoch,token:'frame-token',markers:entries};
 for(let frame=0;frame<12;frame++){const calls=e.calls.length;e.manager().receive(delivery==='same-object'?payload:structuredClone(payload));assert.equal(e.calls.length,calls,'owner delivery must not invoke natives');e.tick();}
 assert.ok(entries.every(m=>e.refs.get(parseInt(m.id,16)).visible),'repeated owner delivery must not starve markers after the first batch');
 assert.equal(e.calls.filter(c=>c.name==='add').length,33);assert.equal(traces.filter(line=>line.startsWith('owner snapshot accepted')).length,1);assert.equal(traces.filter(line=>line.startsWith('restored ')).length,33);assert.deepEqual(e.unsafe,[]);
});

test('stable owner objects skip repeated validation and dedupe accepts changed tokens, marker flags and fresh sessions',()=>{
 const e=fixture(),traces=[];e.ctx.sp.writeLogs=(_name,line)=>traces.push(line);e.tick();
 let reads=0;const payload={v:1,actor:1,epoch:e.sent.at(-1).epoch,token:'initial',get markers(){reads++;return[e.entry];}};
 e.manager().receive(payload);e.tick();const validatedReads=reads;for(let i=0;i<10;i++){e.manager().receive(payload);e.tick();}assert.equal(reads,validatedReads,'stable ctx.value must take an object identity fast path');
 e.ack([e.entry],{token:'replacement'});e.tick();e.emit('locationDiscovery',{worldSpaceId:60,name:'ฟาร์ม',markerType:13,isVisible:true,canTravelTo:true,isShowAllHidden:false});e.tick();assert.equal(e.sent.filter(p=>p.kind==='discover').at(-1).token,'replacement');
 e.ack([{...e.entry,canTravelTo:true}],{token:'replacement'});e.tick();assert.equal(e.refs.get(0x123).travel,true);assert.equal(e.calls.filter(c=>c.name==='add').length,2);
 e.emit('loadGame');e.tick();e.ack([{...e.entry,id:'124:skyrim.esm',type:14}],{token:'replacement'});e.tick();assert.equal(e.refs.get(0x124).visible,true);assert.equal(traces.filter(line=>line.startsWith('owner snapshot accepted')).length,4);assert.deepEqual(e.unsafe,[]);
});
