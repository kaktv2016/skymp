'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {isolated}=require('./g241-bootstrap.cjs');
const {createDevelopmentVerifier,HASH}=require('./g241d-resources.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assetCache=new Map();
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
function activeProfile(root){
 const config=JSON.parse(fs.readFileSync(path.join(root,'g241d-config.json')));
 const keyFile=path.join(config.metadataRoot,'auth-key'),journalFile=path.join(config.metadataRoot,'npc-development/journal.json');
 for(const f of [keyFile,journalFile]){const s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=4*1024*1024);}
 const key=fs.readFileSync(keyFile);assert.equal(key.length,32);const raw=JSON.parse(fs.readFileSync(journalFile));assert.equal(crypto.createHmac('sha256',key).update(raw.body).digest('hex'),raw.mac,'Local profile metadata authentication failed');
 const value=JSON.parse(raw.body);assert.equal(value.state,'active','Activate the prepared local Launcher development profile first');assert.equal(value.plan.policyHash,config.profileHash);assert.equal(sha(Buffer.from(canonical(config.policy))),config.profileHash,'Local policy differs from authenticated receipt');assert.equal(value.plan.source,'LOCAL OWNED REFERENCE ONLY');
 for(const write of value.plan.writes){assert(['plugins','settings'].includes(write.slot));const f=write.slot==='plugins'?path.join(config.clientConfig,'plugins.txt'):path.join(config.game,'Data/Platform/Plugins/skymp5-client-settings.txt');assert.equal(sha(fs.readFileSync(f)),sha(Buffer.from(write.after,'base64')),'Development profile changed');}
 for(const asset of config.policy.assets){const f=path.join(config.game,asset.path),s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size===asset.size);const stamp=[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,asset.sha256].join(':');if(assetCache.get(f)!==stamp){assert.equal(sha(fs.readFileSync(f)),asset.sha256,'Development asset changed');assetCache.set(f,stamp);}}
 return config;
}
function start(root,mp){
 const settings=isolated(root);assert.equal(settings.g241d,true);assert.equal(settings.maxPlayers,1);
 const config=activeProfile(root),packageRoot=path.join(root,config.packageDirectory);
 assert(/^staging-[A-Za-z0-9]+$/.test(config.packageDirectory));assert.equal(fs.realpathSync(packageRoot),packageRoot);
 const verifier=createDevelopmentVerifier({root,packageRoot,dataRoot:path.join(config.game,'Data'),evidence:config.resourceEvidence,policy:config.policy,verifyIsolation:()=>{isolated(root);return settings.port===17777&&settings.maxPlayers===1;}});
 const {loadApprovedCatalog}=require(path.join(root,'runtime/modules/npc/catalog-loader.js'));
 const catalog=loadApprovedCatalog(packageRoot,[{filename:'g241.json',sha256:HASH}],settings.loadOrder,mp,verifier);
 assert.equal(config.identitySpec.catalogHash,HASH);assert.equal(config.identitySpec.profileHash,config.profileHash);
 const {pluginFacts}=require(path.join(root,'runtime/modules/npc/catalog-loader.js'));const facts=pluginFacts(settings.loadOrder);
 assert.deepEqual(config.identitySpec.plugins.map(p=>[p.filename,p.sha256,p.serverIndex]),facts.map((p,index)=>[p.filename,p.sha256,index]));
 for(const id of ['guild-clerk','warrior']){const t=catalog.resolve(id),[local,plugin]=t.base.split(':');assert(config.identitySpec.bases.some(b=>b.plugin===plugin&&b.localId===parseInt(local,16)&&b.serverId===t.baseId));}
 const {createRuntime}=require(path.join(root,'runtime/runtime.js')),{LocalAdminAuthority}=require(path.join(root,'runtime/modules/admin/local-authority.js'));
 const authority=new LocalAdminAuthority(path.join(root,'admin'),['owner']);mp.on('connect',authority.connectionEvent);mp.on('disconnect',authority.connectionEvent);
 const runtime=createRuntime(mp,{npc:{storageRoot:path.join(root,'npc-registry'),templateOptions:{catalog,development:{isolationId:'g241-pair',templates:['guild-clerk','warrior'],verifyIsolated:()=>{isolated(root);return true;}}},developmentIdentity:{spec:config.identitySpec,verifyProfile:()=>{activeProfile(root);return true;}}},admin:{authorize:authority.authorize}});
 runtime.start().then(()=>{const health={status:'SAFE_WAITING',pid:process.pid,catalogHash:HASH,profileHash:config.profileHash,customAutoSpawns:0,waiting:'AUTHORIZED_RUNTIME_PROOF_AND_MAPPER_ARM'};fs.writeFileSync(path.join(root,'g241d-status.json'),JSON.stringify(health));fs.writeFileSync(path.join(root,'data/g241d-health.json'),JSON.stringify(health));console.log('[g241d] SAFE_WAITING: /npc identity after explicit local admin grant. No custom fixture auto-spawn.');}).catch(e=>{console.error(e);process.exit(1);});
 return runtime;
}
module.exports={activeProfile,start};
