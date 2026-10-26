// Actual pinned addon/module boot, with an intentionally denying session gate.
// This is NOT an active owner profile or a Skyrim/runtime rendering proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),{guard,manifest}=require('./g241-dev.cjs');
async function probe(root){const {root:r,config}=guard(root),before=manifest();
 try{
  const c=JSON.parse(fs.readFileSync(path.join(r,'g241d-config.json'))),{ScampServer}=require(path.join(r,'scam_native.node')),mp=new ScampServer(JSON.stringify(config));mp._setSelf(mp);
  const {loadApprovedCatalog}=require(path.join(r,'runtime/modules/npc/catalog-loader.js')),{createDevelopmentVerifier}=require('./g241d-resources.cjs');
  const catalog=loadApprovedCatalog(path.join(r,c.packageDirectory),[{filename:'g241.json',sha256:c.policy.catalogHash}],config.loadOrder,mp,createDevelopmentVerifier({root:r,packageRoot:path.join(r,c.packageDirectory),dataRoot:path.join(c.game,'Data'),evidence:c.resourceEvidence,policy:c.policy,verifyIsolation:()=>config.g241d===true&&config.maxPlayers===1&&config.port===17777}));
  const {createRuntime}=require(path.join(repo,'rp-gamemode/.test-build/runtime.js'));
  const runtime=createRuntime(mp,{npc:{storageRoot:path.join(r,'npc-registry'),templateOptions:{catalog,development:{isolationId:'g241-pair',templates:['guild-clerk','warrior'],verifyIsolated:()=>config.g241DevelopmentOnly===true&&config.port===17777&&config.maxPlayers===1&&config.databaseName===path.join(r,'world')}},developmentIdentity:{spec:c.identitySpec,verifyProfile:()=>false}},admin:{authorize:()=>null},scheduler:{every:()=>()=>{}}});
  const started=performance.now();await runtime.start();const actorCount=mp.getAllForms(255).length;assert.equal(actorCount,0,'No custom actor may be automatically created');
  const result=await runtime.commands.dispatch('/npc fixture create',{actorId:0xff000000});assert.equal(result.ok,false);assert.equal(mp.getAllForms(255).length,0);
  await runtime.stop();assert.deepEqual(manifest(),before);const report={nativeModuleBoot:'PASS',runtimeProof:'NOT_CAPTURED',localProfile:'NOT_ACTIVATED',authorizationDenial:'PASS',customActorsCreated:0,moduleBootAndStopMs:performance.now()-started,productionUnchanged:true};fs.writeFileSync(path.join(repo,'build/rp-audit/g241d/native-runtime-probe.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{assert.deepEqual(manifest(),before);}
}
if(require.main===module)probe(process.argv[2]).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
