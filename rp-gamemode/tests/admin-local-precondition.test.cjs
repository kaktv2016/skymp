const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
test('local operator grants can bind to the exact reviewed boot/session nonce without changing older command syntax',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-grant-precondition-'));
 try{const session={actorId:0xff000000,profileId:1,nonce:'reviewed-session'},inventory={boot:'boot-1',accounts:['owner'],sessions:[session]};fs.writeFileSync(path.join(root,'sessions.json'),JSON.stringify(inventory));
  const run=digest=>spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/admin-local.cjs'),root,'grant','ff000000','owner',digest],{encoding:'utf8',windowsHide:true});
  assert.notEqual(run('f'.repeat(64)).status,0);assert.equal(fs.existsSync(path.join(root,'approvals.json')),false);
  const digest=crypto.createHash('sha256').update(JSON.stringify({boot:inventory.boot,...session})).digest('hex');assert.equal(run(digest).status,0);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'approvals.json'))).grants[0].nonce,session.nonce);
 }finally{const rel=path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(root));assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));fs.rmSync(root,{recursive:true});}
});
