// Existing G245 scanner + real native reads from an explicit frozen master.
// This does NOT re-certify the current game or the old full runtime profile.
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
const sourcePackage=path.join(root,config.packageDirectory);
const protectedFiles=config.policy.assets.map(row=>{const file=path.join(sourcePackage,row.path),hash=sha(fs.readFileSync(file));a.equal(hash,row.sha256);return {file,hash};});
const master=created.masterSource;noLinks(master);a.ok(path.relative(path.join(repo,'build/rp-audit/creation-kit-mcp'),master)&&!path.relative(path.join(repo,'build/rp-audit/creation-kit-mcp'),master).startsWith('..'));
const masterHash=sha(fs.readFileSync(master));a.equal(masterHash,config.identitySpec.plugins.find(p=>p.filename==='Skyrim.esm').sha256);
const loadOrder=[master];
const inspect=path.join(work,'native-inspection');fs.mkdirSync(path.join(inspect,'data/scripts'),{recursive:true});
const {ScampServer}=require(path.join(root,'scam_native.node'));
const native=new ScampServer(JSON.stringify({...settings,loadOrder,port:17881,npcEnabled:false,dataDir:path.join(inspect,'data'),databaseName:path.join(inspect,'unused-world')}));native._setSelf(native);
const {NpcTemplateCatalog}=require(path.join(__dirname,'../dist/template-catalog.cjs'));
const catalog=new NpcTemplateCatalog([]),plugins=loader.pluginFacts(loadOrder);
const env={loader,native,catalog,plugins,evidence:config.resourceEvidence,parseCache:new Map()};
const result=scanSource({id:'mcp-mage-test',root:created.sourceRoot,plugin:created.plugin},env);
a.ok(result.manifest.validation.some(row=>row.severity==='HARD_FAIL'&&row.code==='NPC_VALIDATION'&&/ENOENT/.test(row.message)),JSON.stringify(result.manifest.validation));
a.equal(result.manifest.candidates.length,0);a.equal(native.getAllForms(255).length,0);a.equal(catalog.list().length,0);
for(const row of protectedFiles)a.equal(sha(fs.readFileSync(row.file)),row.hash);
fs.writeFileSync(path.join(work,'g245-proof.json'),JSON.stringify({backend:'FROSTVEIL_VALIDATOR',scope:'ARCHIVED_APPROVED_MASTER_RECORDS_ONLY',runtimeCompatibility:'NOT_CERTIFIED',masterHash,realNativeReferences:true,missingRealFacegenBlocked:true,validation:result.manifest.validation,actors:0,isolatedCatalogTemplates:0,protectedFiles,unchanged:true},null,2));
console.log(JSON.stringify({g245:'PASS',missingFacegenBlocked:true,protectedFiles:protectedFiles.length,actors:0}));process.exit(0);
