// Copied into a fresh disposable environment by g241-dev.cjs, never production.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function isolated(root){const real=fs.realpathSync(root),c=JSON.parse(fs.readFileSync(path.join(real,'server-settings.json'),'utf8'));assert.equal(c.g241DevelopmentOnly,true);assert.equal(c.listenHost,'127.0.0.1');assert.equal(c.uiListenHost,'127.0.0.1');assert.equal(c.offlineMode,true);assert.equal(c.port,17777);assert.equal(c.databaseName,path.join(real,'world'));assert.equal(c.dataDir,path.join(real,'data'));assert.equal(c.gamemodePath,path.join(real,'g241-bootstrap.cjs'));assert.equal(c.serverMasterKey,undefined);return c;}
module.exports={isolated};
if(global.mp&&JSON.parse(fs.readFileSync(path.join(process.cwd(),'server-settings.json'))).g241d===true){try{require('./g241d-runtime.cjs').start(process.cwd(),global.mp);}catch(error){console.error('[g241d] fatal isolated startup failure',error);process.exit(1);}}
else if(global.mp){
 const root=process.cwd(),config=isolated(root),options=JSON.parse(fs.readFileSync(path.join(root,'g241-approval.json'),'utf8'));
 if(options.schemaVersion!==1||options.enabled!==true||!Array.isArray(options.catalogs)||!options.catalogs.length)throw Error('G241 BLOCKED_MISSING_ASSETS: fixtures disabled; author, review and stage catalogs first');
 const {loadApprovedCatalog}=require(path.join(root,'runtime/modules/npc/catalog-loader.js')),{createRuntime}=require(path.join(root,'runtime/runtime.js')),{LocalAdminAuthority}=require(path.join(root,'runtime/modules/admin/local-authority.js'));
 const packageName=options.packageDirectory??'package';assert(/^(package|staging-[A-Za-z0-9]+)$/.test(packageName));const packageRoot=path.join(root,packageName);assert.equal(fs.realpathSync(packageRoot),packageRoot);
 let resourceVerifier;if(options.resourceVerification!==undefined){assert.equal(options.resourceVerification.kind,'g241b');const {pluginFacts}=require(path.join(root,'runtime/modules/npc/catalog-loader.js'));resourceVerifier=require(path.join(root,'g241b-closure.cjs')).createClosure({native:global.mp,pluginFacts:pluginFacts(config.loadOrder),dataRoot:options.resourceVerification.readOnlyDataRoot,packageRoot});}
 const catalog=loadApprovedCatalog(packageRoot,options.catalogs,config.loadOrder,global.mp,resourceVerifier);
 for(const id of ['guild-clerk','warrior'])catalog.resolve(id);
 const authority=new LocalAdminAuthority(path.join(root,'admin'),['owner']);global.mp.on('connect',authority.connectionEvent);global.mp.on('disconnect',authority.connectionEvent);
 const runtime=createRuntime(global.mp,{npc:{storageRoot:path.join(root,'npc-registry'),templateOptions:{catalog,development:{isolationId:'g241-pair',templates:['guild-clerk','warrior'],verifyIsolated:()=>{isolated(root);return true;}}}},admin:{authorize:authority.authorize}});
 runtime.start().then(()=>console.log('[g241] isolated NPC template runtime ready; fixture creation remains explicit')).catch(error=>{console.error('[g241] startup failed',error);process.exitCode=1;});
}
module.exports={isolated};
