const {test}=require('node:test'),assert=require('node:assert/strict');
const {developmentIdentitySources}=require('../.test-build/client/development-identity.js');
test('owner source probes once, waits for arm, and maps before the stock renderer without retaining forms',()=>{
 const source=developmentIdentitySources(),events=[],updates=[],sp={storage:{worldModel:{forms:[]}},settings:{'skymp5-client':{'server-ip':'127.0.0.1','server-port':17777}},mpClientPlugin:{isConnected:()=>true},on:(_,f)=>{updates.push(f);return {};},off(){},printConsole(){},Game:{getModByName:n=>n==='Skyrim.esm'?0:17,getModName:i=>i===0?'Skyrim.esm':'FrostveilNPCTest.esp',getFormFromFile:(id,n)=>({getFormID:()=>id+(n==='Skyrim.esm'?0:17*0x1000000),getType:()=>43,getName:()=> 'test'})},ActorBase:{from:f=>f},getFileInfo:()=>({crc32:42,size:123})};
 const eventCtx={sp,sendEvent:p=>events.push(p)},owner={sp,getMyFormIdInServerFormat:()=>0xff000000};new Function('ctx',source.event)(eventCtx);
 const spec={version:1,nonce:'n',op:'challenge',profileHash:'p',catalogHash:'c',plugins:[{filename:'Skyrim.esm',size:123,crc32:42},{filename:'FrostveilNPCTest.esp',size:123,crc32:42}],bases:[{plugin:'Skyrim.esm',localId:0x39f83,serverId:0x39f83},...[0x5901,0x5906].map(localId=>({plugin:'FrostveilNPCTest.esp',localId,serverId:6*0x1000000+localId}))]};
 owner.value=spec;new Function('ctx',source.owner)(owner);assert.equal(events.length,1);assert.equal(events[0].ok,true);new Function('ctx',source.owner)(owner);assert.equal(events.length,1);
 owner.value={op:'verified',nonce:'n',profileHash:'p',catalogHash:'c'};new Function('ctx',source.owner)(owner);assert.equal(events[1].op,'armed');assert.equal(sp.storage.__fvNpcDevelopmentIdentity.verified,true);
 // Native GamemodeUpdateService invokes owner functions each update, not only
 // when values change. A late stream must be translated before stock WorldView.
 sp.storage.worldModel.forms.push({baseId:0x6005901,refrId:0xff000005,frostveilNpcQualifiedBase:{version:1,catalogHash:'c',base:'5901:FrostveilNPCTest.esp'}});
 new Function('ctx',source.owner)(owner);assert.equal(sp.storage.worldModel.forms[0].baseId,0x11005901);assert.equal(events.length,2);
 sp.storage.worldModel.forms.push({baseId:0x6005902,refrId:0xff000006,frostveilNpcQualifiedBase:{version:1,catalogHash:'c',base:'5901:FrostveilNPCTest.esp'}});
 new Function('ctx',source.owner)(owner);assert.equal(events[2].op,'mappingFault');new Function('ctx',source.owner)(owner);assert.equal(sp.storage.__fvNpcDevelopmentIdentity.verified,false,'Old verified property must not re-arm a faulted nonce');
 eventCtx._expired=true;updates[0]();assert.equal(sp.storage.__fvNpcDevelopmentIdentity,undefined);
});
