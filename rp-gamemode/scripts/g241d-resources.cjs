'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {structure}=require('./g241b-nif-structure.cjs');
const {inspectFaceTintDds,shaderTexturePath}=require('./g241b-resources.cjs');
const HASH='1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
/** Explicit G241D local-only policy. Not a replacement for production closure.
 * Exact reviewed five-file revision; missing/changed resources remain fatal.
 * Only renderer/vertex-weight semantics of these known exports are deferred. */
function createDevelopmentVerifier({root,packageRoot,dataRoot,evidence,policy,verifyIsolation}){
 assert.equal(policy.catalogHash,HASH);assert.equal(policy.version,1);assert.equal(policy.assets.length,5);
 return catalog=>{
  assert.equal(verifyIsolation(),true,'Isolated development only');
  assert.equal(catalog.catalogHash,HASH,'Catalog revision changed');
  assert.equal(evidence.hardFailures.length,0,'Hard resource failure');assert.equal(evidence.faces.length,2);
  const report=JSON.parse(fs.readFileSync(path.join(root,'g241d-resource-proof.json')));
  assert.equal(report.catalogHash,HASH);assert.equal(report.policyHash,sha(Buffer.from(JSON.stringify(policy))));
  for(const f of policy.assets){
   const relative=f.path.replace(/^Data\//,''),staged=path.join(packageRoot,f.path),source=path.join(dataRoot,relative);
   for(const file of [staged,source]){let p=file;while(true){assert(!fs.lstatSync(p).isSymbolicLink(),'Redirected resource');const next=path.dirname(p);if(next===p)break;p=next;}const s=fs.lstatSync(file);assert(s.isFile()&&s.nlink===1&&s.size===f.size);assert.equal(sha(fs.readFileSync(file)),f.sha256,'Approved asset changed');}
   if(relative.endsWith('.nif')){const parsed=structure(fs.readFileSync(staged));assert(parsed.sceneGraph.shapes.length>0&&parsed.sceneGraph.skinInstances.length>0);for(const item of parsed.textureSets.flatMap(s=>s.textures).filter(t=>t.path)){const key=shaderTexturePath(item.path);assert(evidence.resources.some(r=>r.path===key&&r.available),'Required shader dependency missing: '+key);}}
   if(relative.endsWith('.dds'))inspectFaceTintDds(fs.readFileSync(staged));
  }
  for(const resource of evidence.resources){
   assert.equal(resource.available,true,'Hard dependency unavailable: '+resource.path);
   const file=path.join(dataRoot,resource.path),present=fs.existsSync(file);
   if(present){const owned=policy.assets.find(a=>a.path.slice(5).toLowerCase()===resource.path);assert(owned,'Unapproved loose override: '+resource.path);assert.equal(sha(fs.readFileSync(file)),owned.sha256);}
   else assert(resource.archives.length>0,'Required dependency absent: '+resource.path);
  }
  for(const archive of report.archives){const file=path.join(dataRoot,archive.filename),s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size===archive.size&&s.mtimeMs===archive.mtimeMs&&s.ctimeMs===archive.ctimeMs,'Verified base archive changed; rerun prepare');}
  assert.equal(report.nativeDependencyCount,85);assert.equal(report.nativeDependencyErrors,0);
  console.log('[g241d] DEVELOPMENT ONLY: FaceTint fallback and unparsed vertex-weight renderer behavior require owner visual acceptance');
 };
}
module.exports={createDevelopmentVerifier,HASH};
