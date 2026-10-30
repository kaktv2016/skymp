'use strict';
// Actual addon + existing approved assets, fresh private saves, no Skyrim/client launch.
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),audit=path.join(repo,'build/rp-audit/g244');
const handoff=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241d/owner-handoff.json'))),root=handoff.isolatedRoot;
async function child(phase,probe){
 a.equal(path.dirname(probe),audit);a.match(path.basename(probe),/^native-probe-/);
 const config=JSON.parse(fs.readFileSync(path.join(root,'server-settings.json'))),dev=JSON.parse(fs.readFileSync(path.join(root,'g241d-config.json')));
 a.equal(config.port,17777);a.equal(config.listenHost,'127.0.0.1');a.equal(config.g241d,true);
 fs.mkdirSync(path.join(probe,'data/scripts'),{recursive:true});
 const {ScampServer}=require(path.join(root,'scam_native.node'));
 const mp=new ScampServer(JSON.stringify({...config,port:17877,databaseName:path.join(probe,'world'),dataDir:path.join(probe,'data')}));mp._setSelf(mp);mp.attachSaveStorage();a.equal(mp.get(0,'combatVetoVersion'),1);
 const {createDevelopmentVerifier,HASH}=require('../../scripts/g241d-resources.cjs');
 const {loadApprovedCatalog}=require('../../.test-build/modules/npc/catalog-loader.js'),{NpcService}=require('../../.test-build/modules/npc/npc-service.js');
 const packageRoot=path.join(root,dev.packageDirectory),verifier=createDevelopmentVerifier({root,packageRoot,dataRoot:path.join(dev.game,'Data'),evidence:dev.resourceEvidence,policy:dev.policy,verifyIsolation:()=>true});
 const catalog=loadApprovedCatalog(packageRoot,[{filename:'g241.json',sha256:HASH}],config.loadOrder,mp,verifier);a.equal(catalog.list().length,2);
 const metadata=catalog.list().map(t=>({id:t.id,...t.details.metadata}));a.equal(metadata[0].raceLabel,'Nord');a.equal(metadata[1].raceLabel,'Imperial');a.equal(metadata[0].outfitItems[0].label,'Warlock Robes');a.equal(metadata[1].outfitItems[0].label,'Imperial Light Cuirass');a.equal(metadata[0].outfitItems.length,2);a.equal(metadata[1].outfitItems.length,2);a.ok(metadata.every(t=>t.faceGen.length===2));
 const adapter={sessionForActor:()=>({guid:'probe-not-a-real-client',userId:0,profileId:1}),fullLocation:()=>({cell:'3c:Skyrim.esm',pos:[123700,-65500,11778],rot:[0,0,90]})};
 const npc=new NpcService(mp,adapter,path.join(probe,'registry'),()=>true,s=>console.log(s),{catalog,development:{isolationId:'g244-probe',templates:['guild-clerk','warrior'],qualifiedIdentity:true,verifyIsolated:()=>true,verifySession:()=>true,canStream:()=>true}});npc.start();a.ok(npc.isReady);
 const identityFile=path.join(probe,'identities.json');let ids;
 if(phase==='write'){
  ids=[];for(const t of catalog.list()){const out=npc.managementCreate(0xfffffff0,t.id,t.assignment,'G244 native '+t.id);ids.push(out.id);}
  for(const n of npc.managementSnapshot(0xfffffff0).npcs){a.equal(mp.get(n.formId,'baseDesc'),n.templateAssignment.base);a.equal(mp.get(n.formId,'frostveilNpcPose').policy.combat,'PASSIVE_PROTECTED');a.equal(n.policy.movement,'STATIONARY');}
  const n=npc.managementSnapshot(0xfffffff0).npcs[0];npc.managementRename(0xfffffff0,n.id,n.revisionToken,'G244 native renamed');a.equal(npc.lookup(n.id).formId,n.formId);a.equal(npc.lookup(n.id).name,'G244 native renamed');
  fs.writeFileSync(identityFile,JSON.stringify(ids));const deadline=Date.now()+20000;let saved=false;while(Date.now()<deadline){mp.tick();await new Promise(r=>setTimeout(r,20));const folder=path.join(probe,'world/changeForms');if(fs.existsSync(folder)&&fs.readdirSync(folder).filter(n=>n.endsWith('.json')).length>=2){saved=true;break;}}a.ok(saved,'native save deadline');
 }else{ids=JSON.parse(fs.readFileSync(identityFile));a.deepEqual(npc.managementSnapshot(0xfffffff0).npcs.map(n=>n.id),ids);a.equal(npc.lookup(ids[0]).name,'G244 native renamed');}
 a.equal(mp.getAllForms(255).length,2);const result={phase,actualNative:true,npcCount:2,uuids:ids,metadata,simulatedOwnerSession:true,realClientRender:'PENDING_OWNER'};fs.writeFileSync(path.join(probe,phase+'-result.json'),JSON.stringify(result,null,2));npc.stop();console.log(JSON.stringify({phase,npcCount:2,preservedUUID:true}));process.exit(0);
}
if(process.argv[2])child(process.argv[2],path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exit(1);});
else{fs.mkdirSync(audit,{recursive:true});const probe=fs.mkdtempSync(path.join(audit,'native-probe-'));for(const phase of ['write','reload']){const run=spawnSync(process.execPath,[__filename,phase,probe],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(probe,phase+'.log'),(run.stdout??'')+(run.stderr??''));a.equal(run.status,0,'Native probe failed; complete diagnostics: '+path.join(probe,phase+'.log'));}console.log(JSON.stringify({probe,actualNativeCreateRenameRestart:true,originalNPCsUntouched:true,render:'PENDING_OWNER'}));}
