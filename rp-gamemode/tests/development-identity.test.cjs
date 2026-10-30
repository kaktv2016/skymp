const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DevelopmentIdentity,probeDevelopmentClient,mapDevelopmentModels}=require('../.test-build/modules/npc/development-identity.js');
const spec={version:1,catalogHash:'a'.repeat(64),profileHash:'b'.repeat(64),plugins:[{filename:'Skyrim.esm',sha256:'c'.repeat(64),crc32:42,size:123,serverIndex:0},{filename:'FrostveilNPCTest.esp',sha256:'d'.repeat(64),crc32:43,size:124,serverIndex:6},{filename:'FrostveilCourierNavigation.esp',sha256:'e'.repeat(64),crc32:44,size:125,serverIndex:5}],bases:[{plugin:'Skyrim.esm',localId:0x39f83,serverId:0x39f83},{plugin:'FrostveilNPCTest.esp',localId:0x5901,serverId:0x6005901},{plugin:'FrostveilNPCTest.esp',localId:0x5906,serverId:0x6005906}]};
function sp(){return {Game:{getModByName:n=>({'Skyrim.esm':0,'FrostveilNPCTest.esp':17,'FrostveilCourierNavigation.esp':9}[n]??255),getModName:i=>({0:'Skyrim.esm',17:'FrostveilNPCTest.esp',9:'FrostveilCourierNavigation.esp'}[i]??''),getFormFromFile:(id,n)=>({getFormID:()=>((n==='Skyrim.esm'?0:17)*0x1000000+id),getType:()=>43,getName:()=>n+' '+id})},ActorBase:{from:f=>f},getFileInfo:n=>({crc32:spec.plugins.find(p=>p.filename===n).crc32,size:spec.plugins.find(p=>p.filename===n).size})};}

test('verified stationary pose wins BEFORE movement application without changing animation, equipment or unrelated actors',()=>{
 const pose={cell:'3c:Skyrim.esm',pos:[10,20,30],rot:[0,0,90],policy:{version:1,movement:'STATIONARY',combat:'PASSIVE_PROTECTED'}};
 const actor={baseId:0x6005901,refrId:0xff000005,frostveilNpcQualifiedBase:{version:1,catalogHash:spec.catalogHash,base:'5901:FrostveilNPCTest.esp'},frostveilNpcPose:pose,movement:{runMode:'Walking',speed:160,pos:[-200,0,0],rot:[0,0,0],worldOrCell:60,isBlocking:true,healthPercentage:0.8},animation:{animEventName:'IdleDialogueExpressive',numChanges:1},equipment:{numChanges:4}};
 const unrelated={baseId:0x39f83,refrId:0xff000009,movement:{runMode:'Walking',speed:100}},before=structuredClone(unrelated),models=[actor,unrelated];mapDevelopmentModels(models,probeDevelopmentClient(sp(),spec),spec);
 assert.equal(actor.movement.runMode,'Standing','stock movement must never receive the stale Walking model');assert.equal(actor.movement.speed,0);assert.deepEqual(actor.movement.pos,[10,20,30]);assert.deepEqual(actor.movement.rot,[0,0,90]);assert.equal(actor.movement.isBlocking,true);assert.equal(actor.movement.healthPercentage,0.8);assert.equal(actor.animation.animEventName,'IdleDialogueExpressive');assert.equal(actor.equipment.numChanges,4);assert.deepEqual(unrelated,before);
 actor.movement={...actor.movement,runMode:'Running',speed:300};mapDevelopmentModels(models,probeDevelopmentClient(sp(),spec),spec);assert.equal(actor.movement.runMode,'Standing');assert.equal(actor.refrId,0xff000005);
});
test('malformed or unverified stationary world references are hidden rather than driving an actor to guessed coordinates',()=>{
 for(const cell of ['800:Unknown.esp','0:Skyrim.esm','garbage']){const model={baseId:0x6005901,refrId:0xff000005,frostveilNpcPose:{cell,pos:[10,20,30],rot:[0,0,0],policy:{version:1,movement:'STATIONARY'}},movement:{runMode:'Walking'}};const models=[model];assert.equal(mapDevelopmentModels(models,probeDevelopmentClient(sp(),spec),spec).ok,false);assert.equal(models[0],undefined);}
});
test('actual probe resolves exact qualified bases at different full indices, leaving dynamic actor IDs untouched',()=>{
 const p=probeDevelopmentClient(sp(),spec);assert.equal(p.ok,true);assert.equal(p.bases[1].runtimeId,0x11005901);assert.equal(p.bases[0].runtimeId,0x39f83);
 const models=[{baseId:0x6005901,refrId:0xff000005,frostveilNpcQualifiedBase:{version:1,catalogHash:spec.catalogHash,base:'5901:FrostveilNPCTest.esp'}},{baseId:0x39f83,refrId:0xff000006}];
 const result=mapDevelopmentModels(models,p,spec);assert.equal(result.ok,true);assert.equal(models[0].baseId,0x11005901);assert.equal(models[0].refrId,0xff000005);assert.equal(models[1].baseId,0x39f83);
});
test('unloaded, wrong plugin/type/file, FE and numeric aliases cannot produce positive runtime proof',()=>{
 for(const edit of [s=>s.Game.getModByName=()=>255,s=>s.Game.getModByName=()=>254,s=>s.Game.getModName=()=> 'Wrong.esp',s=>s.Game.getFormFromFile=()=>({getFormID:()=>0x6005901,getType:()=>43}),s=>s.ActorBase.from=()=>null,s=>s.getFileInfo=()=>({crc32:1,size:1})]){const s=sp();edit(s);assert.equal(probeDevelopmentClient(s,spec).ok,false);}
});
test('bad mapping is removed before rendering; unrelated models never change',()=>{
 const models=[{baseId:0x6005902,refrId:0xff000005,frostveilNpcQualifiedBase:{version:1,catalogHash:spec.catalogHash,base:'5901:FrostveilNPCTest.esp'}},{baseId:7}];
 assert.equal(mapDevelopmentModels(models,probeDevelopmentClient(sp(),spec),spec).ok,false);assert.equal(models[0],undefined);assert.deepEqual(models[1],{baseId:7});
});
test('initial native place subscription before tag publication still resolves only the two declared static bases',()=>{
 const models=[{baseId:0x6005901,refrId:0xff000005},{baseId:0x6005906,refrId:0xff000006},{baseId:0x39f83,refrId:0xff000007}];
 assert.equal(mapDevelopmentModels(models,probeDevelopmentClient(sp(),spec),spec).ok,true);assert.equal(models[0].baseId,0x11005901);assert.equal(models[1].baseId,0x11005906);assert.equal(models[2].baseId,0x39f83);
});
test('server challenge is actor/session/authority bound; replay, drift and spoofed replies fail',()=>{
 let guid='one',authorized=true,now=1000;const runtime=new DevelopmentIdentity(spec,a=>authorized&&a===1?'owner':null,()=>guid,()=>now);
 assert.throws(()=>runtime.issue(2));assert.equal(runtime.ready(1),false);const challenge=runtime.issue(1),reply={...probeDevelopmentClient(sp(),spec),nonce:challenge.nonce,profileHash:spec.profileHash,catalogHash:spec.catalogHash,version:1};
 assert.equal(runtime.receive(2,reply),false);assert.equal(runtime.receive(1,{...reply,nonce:'wrong'}),false);assert.equal(runtime.receive(1,reply),true);assert.equal(runtime.ready(1),false);assert.equal(runtime.arm(1,'wrong'),false);assert.equal(runtime.arm(1,reply.nonce),true);assert.equal(runtime.ready(1),true);assert.equal(runtime.receive(1,reply),false);
 guid='new';assert.equal(runtime.ready(1),false);now+=3001;const c=runtime.issue(1);now+=61000;assert.equal(runtime.receive(1,{...reply,nonce:c.nonce}),false);authorized=false;assert.equal(runtime.ready(1),false);
});
test('runtime validates all base and plugin observations instead of accepting an ok boolean',()=>{
 let now=1000;const d=new DevelopmentIdentity(spec,()=> 'owner',()=> 's',()=>now);for(const edit of [r=>r.bases[1].runtimeId++,r=>r.bases[2].type=0,r=>r.plugins[0].crc32++,r=>r.plugins[1].index=254,r=>r.catalogHash='f'.repeat(64)]){now+=3001;const c=d.issue(1),r={...probeDevelopmentClient(sp(),spec),nonce:c.nonce,profileHash:spec.profileHash,catalogHash:spec.catalogHash,version:1};edit(r);assert.equal(d.receive(1,r),false);assert.equal(d.ready(1),false);}
});
test('duplicate requests coalesce and failed/new probes are rate limited',()=>{let now=1000;const d=new DevelopmentIdentity(spec,()=> 'owner',()=> 's',()=>now);const a=d.issue(1);assert.equal(d.issue(1).nonce,a.nonce);d.receive(1,{nonce:a.nonce,ok:false});assert.throws(()=>d.issue(1),/three seconds/);now+=3000;assert.notEqual(d.issue(1).nonce,a.nonce);});
test('installed client invokes owner update before WorldView and retains explicit property transport',()=>{
 const root=path.resolve(__dirname,'../..'),index=fs.readFileSync(path.join(root,'skymp5-client/src/index.ts'),'utf8');assert(index.indexOf('new GamemodeUpdateService(')<index.indexOf('new WorldView('));
 const remote=fs.readFileSync(path.join(root,'skymp5-client/src/services/services/remoteServer.ts'),'utf8');assert(remote.includes('element.propName] = parsed'));assert(remote.includes('storage["worldModel"] as WorldModel'));
});
