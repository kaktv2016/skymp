'use strict';
// Read-only readiness evidence, NEVER a catalog approval or an installer.
// The existing bootstrap/loader remains the only fixture activation authority.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
const key=s=>s.toLowerCase();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function hashFile(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
const VISUAL_ONLY=new Set(['EMPTY_FACE_TINT','UNPROVEN_SHADER_FALLBACK','UNSUPPORTED_VERTEX_WEIGHT_SEMANTICS']);

function verifyIdentity(e){
 const errors=[];
 if(!e||!['installed-activation','runtime'].includes(e.source))return ['PLUGIN_ORDER_UNVERIFIED'];
 for(const field of ['active','fullOrder','serverOrder']){
  if(!Array.isArray(e[field])||e[field].length>4096||e[field].some(n=>typeof n!=='string'||n.length>255||/[\\/:\x00-\x1f\x7f]/.test(n)||! /\.(esm|esp|esl)$/i.test(n)))return ['PLUGIN_ORDER_INVALID'];
  if(new Set(e[field].map(key)).size!==e[field].length)return ['PLUGIN_ORDER_DUPLICATE'];
 }
 for(const [index,name]of e.serverOrder.entries()){
  if(!e.active.some(n=>key(n)===key(name)))errors.push('PLUGIN_INACTIVE:'+name);
  if(!e.headers?.[key(name)]||e.headers[key(name)].light||/\.esl$/i.test(name))errors.push('PLUGIN_HEADER_UNSUPPORTED:'+name);
  if(key(e.fullOrder[index]??'')!==key(name))errors.push('PLUGIN_INDEX_MISMATCH:'+name);
 }
 if(!e.serverOrder.some(n=>key(n)==='frostveilnpctest.esp'))errors.push('NPC_PLUGIN_NOT_CONFIGURED');
 for(const name of e.serverOrder){
  const digest=e.contentIdentities?.[key(name)];
  if(!digest||! /^[a-f0-9]{64}$/.test(digest.client??'')||digest.client!==digest.server)errors.push('PLUGIN_CONTENT_UNVERIFIED:'+name);
 }
 // Matching order alone does not establish ActorBase identity. These facts
 // must come from the authorized client's loaded forms and native server
 // records, never from a proposed activation plan or an arbitrary offset.
 for(const [qualified,editorId]of [['5901:FrostveilNPCTest.esp','FV_GuildClerk_Test'],['5906:FrostveilNPCTest.esp','FV_Warrior_Test'],['39f83:Skyrim.esm',null]]){
  const fact=e.baseIdentities?.find(b=>b.qualified===qualified),[local,plugin]=qualified.split(':');
  const index=e.serverOrder.findIndex(n=>key(n)===key(plugin));
  const global=index*0x1000000+parseInt(local,16);
  if(!fact||index<0||fact.source!=='loaded-client-and-native-server'||fact.clientType!=='NPC_'||fact.serverType!=='NPC_'||fact.clientGlobalId!==global||fact.serverGlobalId!==global||
     (editorId&&(fact.clientEditorId!==editorId||fact.serverEditorId!==editorId)))errors.push('BASE_IDENTITY_UNVERIFIED:'+qualified);
 }
 return errors;
}
function assessReadiness(e){
 const blockers=[...verifyIdentity(e.identity),...(e.hardFailures??[])];
 for(const [name,ok]of Object.entries({LOCAL_TEST_AUTHORIZATION:e.explicitLocalAuthorization===true,ISOLATION:e.isolated===true,PRODUCTION_APPROVAL_DISABLED:e.productionApprovalDisabled===true,ASSET_HASHES:e.sourceMatchesStage===true,CATALOG_REVISION:e.catalogMatches===true}))if(!ok)blockers.push(name);
 if(!['local-reference','authenticated-development'].includes(e.delivery))blockers.push('DEVELOPMENT_DELIVERY_UNAVAILABLE');
 for(const issue of e.visualUncertainties??[])if(!VISUAL_ONLY.has(issue))blockers.push('NON_VISUAL_WAIVER_REJECTED:'+issue);
 return {candidateReady:!blockers.length,blockers:[...new Set(blockers)],visualUncertainties:e.visualUncertainties??[],productionReady:false,catalogApproval:'DISABLED',boundary:'Assessment only; no approval, installation, activation, signing or startup is performed'};
}

async function inspectActivation(game,configDirectory,launcherDirectory,auditDirectory){
 // Reuse the Launcher read-only reader and transaction PLANNER. Never invoke
 // managed writes, installation, a release signer or the Launcher storage.
 const esbuild=require(path.join(launcherDirectory,'node_modules/esbuild'));
 const outfile=path.join(auditDirectory,'launcher-readonly.cjs');
 const plugins=path.join(launcherDirectory,'src/main/modpack/plugins.ts');
 const activation=path.join(launcherDirectory,'src/main/management/activation.ts');
 await esbuild.build({stdin:{contents:`export {readOrderInputs,readPluginHeader} from ${JSON.stringify(plugins)}; export {planActivation} from ${JSON.stringify(activation)};`,resolveDir:launcherDirectory},outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const api=require(outfile),input=await api.readOrderInputs(game,configDirectory);
 const plan=await api.planActivation(game,[],input);
 const headers={};for(const name of plan.active)headers[key(name)]=await api.readPluginHeader(path.join(game,'Data',name));
 // Even an empty-requirement planner can propose native master reordering.
 // Such a proposal is NOT evidence that the installed order already matches.
 const verified=plan.status==='ready'&&!plan.configWrites.length&&!input.managed;
 return {source:verified?'installed-activation':'proposed-plan',active:plan.active,fullOrder:plan.order,headers,managed:input.managed,plannerStatus:plan.status,proposedWriteCount:plan.configWrites.length,issues:[...plan.blockers,...plan.manual],inputHashes:Object.fromEntries(['pluginsText','loadorderText','cccText'].map(k=>[k,input[k]===null?null:sha(Buffer.from(input[k]))])),implementationHashes:{reader:sha(fs.readFileSync(plugins)),planner:sha(fs.readFileSync(activation))}};
}

async function inspect(root){
 const {guard,manifest}=require('./g241-dev.cjs'),{sourceManifest}=require('./g241b-integrate.cjs');
 const before=manifest(),sourceBefore=sourceManifest(),g=guard(root);
 const audit=path.join(repo,'build/rp-audit/g241c');fs.mkdirSync(audit,{recursive:true});
 const output=path.join(audit,'readiness.json');
 try{
  const integration=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241b/integration-result.json')));
  const stage=fs.realpathSync(integration.stagingDirectory);
  assert.equal(path.dirname(stage),g.root,'Stage outside verified isolated root');
  const catalog=JSON.parse(fs.readFileSync(path.join(stage,'g241.json')));
  const assets=[{path:'Data/FrostveilNPCTest.esp',sha256:integration.pluginHash},...catalog.assets];
  const sourceMatchesStage=assets.length===5&&assets.every(a=>{
   const src=sourceBefore.find(s=>key(s.path)===key(a.path));
   return src?.sha256===a.sha256&&sha(fs.readFileSync(path.join(stage,a.path)))===a.sha256;
  });
  const {catalogHash}=require('../.test-build/modules/npc/template-catalog.js');
  const catalogMatches=catalog.catalogHash===catalogHash(catalog)&&catalog.catalogHash===integration.catalogHash;
  const game='C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition';
  const configDirectory=path.join(process.env.LOCALAPPDATA,'Skyrim Special Edition');
  const activationBefore=['plugins.txt','loadorder.txt'].map(n=>fs.existsSync(path.join(configDirectory,n))?sha(fs.readFileSync(path.join(configDirectory,n))):null);
  const identity=await inspectActivation(game,configDirectory,path.resolve(repo,'../skyrim-rp-launcher'),audit);
  identity.headers['frostveilnpctest.esp']=await require(path.join(audit,'launcher-readonly.cjs')).readPluginHeader(path.join(game,'Data/FrostveilNPCTest.esp'));
  const config={...g.config,loadOrder:[...g.config.loadOrder,path.join(stage,'Data/FrostveilNPCTest.esp')]};
  const {ScampServer}=require(path.join(repo,'build/dist/server/scam_native.node'));
  const mp=new ScampServer(JSON.stringify(config));
  identity.serverOrder=mp.getEspmLoadOrder().map(n=>path.basename(n));
  identity.contentIdentities={};
  for(const [index,name]of identity.serverOrder.entries()){
   const serverHash=await hashFile(config.loadOrder[index]);
   const clientHash=await hashFile(path.join(game,'Data',name));
   const pinned=catalog.plugins.find(p=>key(p.filename)===key(name));
   assert(pinned?.sha256===serverHash,'Native server plugin differs from staged catalog: '+name);
   identity.contentIdentities[key(name)]={server:serverHash,client:clientHash};
  }
  // Never substitute metadata for unavailable live client base resolution.
  identity.baseIdentities=[];
  assert.deepEqual(identity.serverOrder,config.loadOrder.map(n=>path.basename(n)));
  const approval=JSON.parse(fs.readFileSync(path.join(root,'g241-approval.json')));
  // The current task explicitly authorizes evaluating a local reference path.
  // This does NOT authorize editing plugins.txt or create an approval receipt.
  const assessment=assessReadiness({explicitLocalAuthorization:true,isolated:true,productionApprovalDisabled:approval.enabled===false,sourceMatchesStage,catalogMatches,identity,delivery:'local-reference',hardFailures:['PRACTICAL_RESOURCE_CHECKS_INCOMPLETE','NO_SUPPORTED_LOCAL_ACTIVATION_HANDOFF'],visualUncertainties:['EMPTY_FACE_TINT','UNSUPPORTED_VERTEX_WEIGHT_SEMANTICS']});
  const result={...assessment,sourceMatchesStage,catalogMatches,catalogHash:catalog.catalogHash,assetHashes:assets,identity,isolatedRoot:root,fixtureApproval:approval,installedConfigurationUnchanged:true,sourceUnchanged:true,productionUnchanged:true};
  assert.deepEqual(activationBefore,['plugins.txt','loadorder.txt'].map(n=>fs.existsSync(path.join(configDirectory,n))?sha(fs.readFileSync(path.join(configDirectory,n))):null));
  fs.writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({report:output,...assessment,sourceMatchesStage,catalogMatches,clientSource:identity.source,serverOrder:identity.serverOrder,clientFullOrder:identity.fullOrder}));
 }finally{
  assert.deepEqual(sourceManifest(),sourceBefore,'Owner assets changed');assert.deepEqual(manifest(),before,'Protected production data changed');
  fs.writeFileSync(path.join(audit,'protected-unchanged.json'),JSON.stringify({sourceBefore,sourceAfter:sourceManifest(),protectedSHA256:sha(JSON.stringify(before)),protectedAfterSHA256:sha(JSON.stringify(manifest())),unchanged:true},null,2));
 }
}
if(require.main===module){assert(process.argv.length===3,'Usage: node g241c-readiness.cjs <existing isolated root>');inspect(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={verifyIdentity,assessReadiness,inspectActivation};
