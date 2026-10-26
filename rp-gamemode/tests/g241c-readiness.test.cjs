'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assessReadiness,verifyIdentity}=require('../scripts/g241c-readiness.cjs');
const names=['Skyrim.esm','Update.esm','Dawnguard.esm','HearthFires.esm','Dragonborn.esm','FrostveilCourierNavigation.esp','FrostveilNPCTest.esp'];
const headers=Object.fromEntries(names.map(n=>[n.toLowerCase(),{light:false}]));
function fixture(){return {explicitLocalAuthorization:true,isolated:true,productionApprovalDisabled:true,sourceMatchesStage:true,catalogMatches:true,hardFailures:[],visualUncertainties:['EMPTY_FACE_TINT'],identity:{source:'installed-activation',active:[...names],fullOrder:[...names],headers:structuredClone(headers),serverOrder:[...names],contentIdentities:Object.fromEntries(names.map(n=>[n.toLowerCase(),{server:'a'.repeat(64),client:'a'.repeat(64)}])),baseIdentities:[['5901:FrostveilNPCTest.esp','FV_GuildClerk_Test',0x06005901],['5906:FrostveilNPCTest.esp','FV_Warrior_Test',0x06005906],['39f83:Skyrim.esm',null,0x39f83]].map(([qualified,editorId,id])=>({qualified,source:'loaded-client-and-native-server',clientType:'NPC_',serverType:'NPC_',clientEditorId:editorId,serverEditorId:editorId,clientGlobalId:id,serverGlobalId:id}))},delivery:'local-reference'};}
test('development assessment permits explicit visual uncertainty only after hard gates; never grants catalog approval',()=>{
 const r=assessReadiness(fixture()); assert.equal(r.candidateReady,true);assert.equal(r.catalogApproval,'DISABLED');assert.equal(r.productionReady,false);
});
test('present but inactive ESP cannot pass identity or fixture gate',()=>{
 const f=fixture();f.identity.active=names.slice(0,-1);const r=assessReadiness(f);assert.equal(r.candidateReady,false);assert(r.blockers.includes('PLUGIN_INACTIVE:FrostveilNPCTest.esp'));
});
test('mapping must match every network plugin index, not only the custom NPC',()=>{
 const f=fixture();f.identity.fullOrder=[...names.slice(0,5),'Other.esp',...names.slice(5)];assert.equal(assessReadiness(f).candidateReady,false);
});
test('unknown metadata, duplicate order, light records, changed hashes and stale catalog fail closed',()=>{
 for(const mutate of [f=>f.identity.source='proposed-plan',f=>f.identity.fullOrder.push(names[0]),f=>f.identity.headers['frostveilnpctest.esp'].light=true,f=>f.sourceMatchesStage=false,f=>f.catalogMatches=false]){
  const f=structuredClone(fixture());mutate(f);assert.equal(assessReadiness(f).candidateReady,false);
 }
});
test('authorization, isolation, production gate and delivery cannot be waived by visual policy',()=>{
 for(const mutate of [f=>f.explicitLocalAuthorization=false,f=>f.isolated=false,f=>f.productionApprovalDisabled=false,f=>f.delivery='unsigned-distribution',f=>f.hardFailures=['MISSING_HEADPART']]){
  const f=fixture();mutate(f);assert.equal(assessReadiness(f).candidateReady,false);
 }
});
test('wrong qualified identities and unsupported visual waivers are rejected',()=>{
 const f=fixture();f.visualUncertainties=['BASE_ID_MISMATCH'];assert.equal(assessReadiness(f).candidateReady,false);
 assert(verifyIdentity({...fixture().identity,serverOrder:[...names.slice(0,-1),'Wrong.esp']}).length);
});
test('matching indices cannot replace base type, editor identity, content and legacy Clerk proof',()=>{
 for(const mutate of [f=>f.identity.baseIdentities=[],f=>f.identity.baseIdentities[0].clientEditorId='UnrelatedActor',f=>f.identity.baseIdentities[1].clientGlobalId++,f=>f.identity.baseIdentities[2].clientType='REFR',f=>f.identity.contentIdentities['skyrim.esm'].client='b'.repeat(64)]){
  const f=fixture();mutate(f);assert.equal(assessReadiness(f).candidateReady,false);
 }
});
