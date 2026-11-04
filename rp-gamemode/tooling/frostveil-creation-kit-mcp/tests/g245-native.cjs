// Exact existing G245 read-only scanner + actual native lookups in fresh storage.
// No actor APIs, ticks, source registration, approval, activation or listen().
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),work=path.resolve(process.argv[2]);
const {noLinks,readConfined,scanSource,sha}=require(path.join(repo,'rp-gamemode/scripts/g245-assets.cjs'));
noLinks(work);a.ok(path.relative(path.join(repo,'build/rp-audit/creation-kit-mcp'),work)&&!path.relative(path.join(repo,'build/rp-audit/creation-kit-mcp'),work).startsWith('..'));
const proof=JSON.parse(readConfined(work,'protocol-proof.json')),created=proof.created;
const h=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241d/owner-handoff.json'))),root=h.isolatedRoot;
const config=JSON.parse(fs.readFileSync(path.join(root,'g241d-config.json'))),settings=JSON.parse(fs.readFileSync(path.join(root,'server-settings.json')));
require(path.join(repo,'rp-gamemode/scripts/g241-dev.cjs')).guard(root);
const loader=require(path.join(repo,'rp-gamemode/.test-build/modules/npc/catalog-loader.js'));
const policy=require(path.join(repo,'rp-gamemode/scripts/g241d-resources.cjs'));
const protectedFiles=config.policy.assets.map(row=>({file:path.join(config.game,row.path),hash:sha(fs.readFileSync(path.join(config.game,row.path)))}));
const inspect=path.join(work,'native-inspection');fs.mkdirSync(path.join(inspect,'data/scripts'),{recursive:true});
const {ScampServer}=require(path.join(root,'scam_native.node'));
const native=new ScampServer(JSON.stringify({...settings,port:17881,dataDir:path.join(inspect,'data'),databaseName:path.join(inspect,'unused-world')}));native._setSelf(native);
const verifier=policy.createDevelopmentVerifier({root,packageRoot:path.join(root,config.packageDirectory),dataRoot:path.join(config.game,'Data'),evidence:config.resourceEvidence,policy:config.policy,verifyIsolation:()=>true});
const catalog=loader.loadApprovedCatalog(path.join(root,config.packageDirectory),[{filename:'g241.json',sha256:policy.HASH}],settings.loadOrder,native,verifier);
const pluginFacts=loader.pluginFacts(settings.loadOrder),plugins=config.identitySpec.plugins.map(p=>{const actual=pluginFacts.find(f=>f.filename===p.filename);a.equal(actual.sha256,p.sha256);return actual;});
const env={loader,native,catalog,plugins,evidence:config.resourceEvidence,parseCache:new Map()};
const result=scanSource({id:'mcp-mage-test',root:created.sourceRoot,plugin:created.plugin},env);
a.ok(result.manifest.validation.some(row=>row.severity==='HARD_FAIL'&&row.code==='NPC_VALIDATION'&&/ENOENT/.test(row.message)),JSON.stringify(result.manifest.validation));
a.equal(result.manifest.candidates.length,0);a.equal(native.getAllForms(255).length,0);a.equal(catalog.list().length,2);
for(const row of protectedFiles)a.equal(sha(fs.readFileSync(row.file)),row.hash);
fs.writeFileSync(path.join(work,'g245-proof.json'),JSON.stringify({backend:'FROSTVEIL_VALIDATOR',realNativeReferences:true,missingRealFacegenBlocked:true,validation:result.manifest.validation,actors:0,catalogTemplates:2,protectedFiles,unchanged:true},null,2));
console.log(JSON.stringify({g245:'PASS',missingFacegenBlocked:true,protectedFiles:protectedFiles.length,actors:0}));process.exit(0);
