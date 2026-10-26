'use strict';
// Practical read-only evidence collector; not the production resource callback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {structure}=require('./g241b-nif-structure.cjs');
const {shaderTexturePath,inspectFaceTintDds}=require('./g241b-resources.cjs');
const {compareFiles}=require('./g241c-facegen.cjs');
const {sourceManifest}=require('./g241b-integrate.cjs');
const {manifest}=require('./g241-dev.cjs');
const repo=path.resolve(__dirname,'../..'),audit=path.join(repo,'build/rp-audit/g241c');
const data='C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition/Data';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fileHash(file){const digest=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))digest.update(b);return digest.digest('hex');}
async function auditResources(){
 const started=performance.now(),before=sourceManifest(),protectedBefore=manifest();
 fs.mkdirSync(audit,{recursive:true});
 try{
  const baseline=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241b/native-path-availability.json')));
  const native=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241b/real-assets.json')));
  assert.equal(native.plugin.sha256??native.plugin.hash??before[0].sha256,before[0].sha256,'Native record audit no longer matches the source plugin');
  const paths=new Set(baseline.resources.map(r=>r.path));
  const faces=[];
  for(const id of ['00005901','00005906']){
   const nif=path.join(data,'meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp',id+'.nif');
   const texture=('textures/actors/character/FaceGenData/FaceTint/FrostveilNPCTest.esp/'+id+'.dds').toLowerCase();
   const parsed=structure(fs.readFileSync(nif));
   const shaderPaths=[...new Set(parsed.textureSets.flatMap(t=>t.textures.filter(s=>s.path).map(s=>shaderTexturePath(s.path))))];
   shaderPaths.forEach(p=>paths.add(p));paths.add(texture);
   const dds=inspectFaceTintDds(fs.readFileSync(path.join(data,texture)));
   const comparison=compareFiles(path.join(repo,'build/rp-audit/g241b/tools/vanilla-lydia.nif'),nif,'Data/'+texture);
   faces.push({id,nifSHA256:hash(fs.readFileSync(nif)),blockCount:parsed.blockCount,sceneGraph:parsed.sceneGraph??null,shaderPaths,dds,comparison});
  }
  assert(paths.size<256,'Bounded resource query exceeded');
  const members=new Map([...paths].sort().map(p=>[p,[]])),archives=[];
  const helper=path.join(repo,'build/rp-audit/g241b/tools/bsa-index-query.exe');
  for(const old of baseline.archives){
   const archive=path.join(data,old.filename),stat=fs.lstatSync(archive);
   assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'Redirected archive');
   const sha256=await fileHash(archive);
   const p=spawnSync(helper,[archive,...members.keys()],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:2*1024*1024});
   assert.equal(p.status,0,p.stderr||'BSA query failed');const result=JSON.parse(p.stdout);assert.equal(result.version,105);
   for(const q of result.queries){const name=(q.path??q.input??q.resource??'').replaceAll('\\','/').toLowerCase();assert(members.has(name),'Unexpected index result: '+JSON.stringify(q));if(q.found)members.get(name).push(old.filename);}
   assert.equal(fs.statSync(archive).size,stat.size,'Archive changed while indexing');
   archives.push({filename:old.filename,size:stat.size,sha256,indexer:'rsm-bsa-4.1.0',version:105});
  }
  const sourceByPath=new Map(before.map(a=>[a.path.replace(/^Data\//,'').toLowerCase(),a]));
  const resources=[...members].map(([name,archives])=>{
   const file=path.join(data,name);let loose=null;
   if(fs.existsSync(file)){
    const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=32*1024*1024);
    const digest=hash(fs.readFileSync(file));loose={sha256:digest,approvedOwnerAsset:sourceByPath.get(name)?.sha256===digest};
   }
   return {path:name,archives,loose,available:!!loose||!!archives.length};
  });
  const hardFailures=resources.flatMap(r=>!r.available?['MISSING_RESOURCE:'+r.path]:r.loose&&!r.loose.approvedOwnerAsset?['UNREVIEWED_LOOSE_OVERRIDE:'+r.path]:[]);
  const report={schemaVersion:1,levels:{STRUCTURAL_VALIDATION:'PARTIAL',RESOURCE_VALIDATION:hardFailures.length?'BLOCKED':'PARTIAL',RUNTIME_VISUAL_VALIDATION:'PENDING_GAME_RENDER'},faces,archives,resources,hardFailures,sourceSHA256:before[0].sha256,recordCandidates:native.dependencyGraph.records.length,elapsedMs:performance.now()-started,productionApproval:false,limitations:['Record graph includes sex/race alternatives; archive membership is availability evidence, not complete archived mesh/skin validation.','Detailed vertex weights, body-slot compatibility and archived material closure have not all been decoded.','Empty female tint link remains a visual uncertainty; no CK repair is demanded on this evidence alone.']};
  fs.writeFileSync(path.join(audit,'resources.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({report:path.join(audit,'resources.json'),resources:resources.length,hardFailures,elapsedMs:report.elapsedMs,levels:report.levels}));
  return report;
 }finally{
  assert.deepEqual(sourceManifest(),before,'Owner sources changed');assert.deepEqual(manifest(),protectedBefore,'Protected production data changed');
 }
}
if(require.main===module)auditResources().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={auditResources};
