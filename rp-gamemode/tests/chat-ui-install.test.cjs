// Written, NOT EXECUTED by agent. Only isolated test folders are mutated.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {installUi}=require('../scripts/install-ui.cjs');
test('isolated UI installation preserves upstream page and refuses different existing chat UI',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rp-ui-test-'));
  t.after(()=>{const rel=path.relative(path.resolve(os.tmpdir()),root);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel)&&path.basename(root).startsWith('rp-ui-test-'));assert.equal(fs.lstatSync(root).isSymbolicLink(),false);fs.rmSync(root,{recursive:true,force:true});});
  const source=path.join(root,'source.html'),game=path.join(root,'game');
  fs.mkdirSync(path.join(game,'Data/Platform/UI'),{recursive:true});fs.writeFileSync(path.join(game,'SkyrimSE.exe'),'fixture');
  fs.writeFileSync(source,'<!doctype html><body>chat</body>');const original=path.join(game,'Data/Platform/UI/index.html');fs.writeFileSync(original,'original frontend');
  const result=installUi(source,game);assert.equal(result.action,'ADD');assert.equal(fs.readFileSync(original,'utf8'),'original frontend');
  assert.equal(installUi(source,game).action,'KEEP_IDENTICAL');fs.writeFileSync(result.destination,'user UI');
  assert.throws(()=>installUi(source,game),/Different chat UI/);assert.equal(fs.readFileSync(result.destination,'utf8'),'user UI');
  assert.throws(()=>installUi(source,path.join(root,'not-a-game')));
});
