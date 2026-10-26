const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createDevelopmentVerifier}=require('../../../scripts/g241d-resources.cjs');
const root=path.resolve(__dirname,'../../../../build/rp-audit/g241/dev-7FNiLN');
const config=JSON.parse(fs.readFileSync(path.join(root,'g241d-config.json'))),packageRoot=path.join(root,config.packageDirectory),catalog=JSON.parse(fs.readFileSync(path.join(packageRoot,'g241.json')));
const setup=(extra={})=>createDevelopmentVerifier({root,packageRoot,dataRoot:path.join(config.game,'Data'),evidence:config.resourceEvidence,policy:config.policy,verifyIsolation:()=>true,...extra});
test('reviewed exact five-file resource candidate passes explicit isolated visual-uncertainty policy without enabling fixtures',()=>{assert.doesNotThrow(()=>setup()(catalog));assert.equal(JSON.parse(fs.readFileSync(path.join(root,'g241-approval.json'))).enabled,false);});
test('development policy rejects missing armor/headpart, changed assets/catalog and non-isolated use',()=>{
 for(const error of ['MISSING_HEADPART','MISSING_ARMOR','MISSING_FACEGEN']){const evidence=structuredClone(config.resourceEvidence);evidence.hardFailures.push(error);assert.throws(()=>setup({evidence})(catalog));}
 const evidence=structuredClone(config.resourceEvidence);evidence.resources[0].available=false;assert.throws(()=>setup({evidence})(catalog));
 const policy=structuredClone(config.policy);policy.assets[0].sha256='f'.repeat(64);assert.throws(()=>setup({policy})(catalog));
 assert.throws(()=>setup()({...catalog,catalogHash:'f'.repeat(64)}));assert.throws(()=>setup({verifyIsolation:()=>false})(catalog));
});
