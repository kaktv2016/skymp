const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');const {createClosure}=require('../../../scripts/g241b-closure.cjs');
test('material uncertainty does not demand reauthoring but strict resource proof still blocks approval',()=>{
 const game='C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition';
 const asset='Data/meshes/actors/character/FaceGenData/FaceGeom/FrostveilNPCTest.esp/00005901.nif';
 const file=path.join(game,asset),digest=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const before=digest(),out=fs.mkdtempSync(path.join(os.tmpdir(),'fv-closure-'));let report;
 try{
  const callback=createClosure({native:{lookupEspmRecordById(){throw Error('Must not approve native records without resource proof');}},pluginFacts:[],dataRoot:path.join(game,'Data'),packageRoot:game,reportDirectory:out,onReport:r=>report=r});
  assert.throws(()=>callback({assets:[{path:asset,size:fs.statSync(file).size,sha256:before}],templates:[{pluginQualifiedBaseId:'5901:FrostveilNPCTest.esp'},{pluginQualifiedBaseId:'5906:FrostveilNPCTest.esp'}]}),/RESOURCE_CLOSURE_BLOCKED/);
  assert.equal(report.code,'NIF_SEMANTIC_VERIFIER_UNAVAILABLE');
  assert(fs.existsSync(path.join(out,'nif-material-diagnostics.json')));assert.equal(digest(),before);
 }finally{
  const relative=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(out));assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));fs.rmSync(out,{recursive:true});
 }
});
