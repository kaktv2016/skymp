const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const modulePath=process.env.G11_JOURNAL_TEST_MODULE??path.resolve(__dirname,'../.test-build/modules/economy/journal.js');
test('writer identity rejects active/unknown owners and recovers PID reuse without losing state',()=>{
 const {EconomyJournal}=require(modulePath),{randomUUID}=require('node:crypto'),key='f'.repeat(64);
 for(const mode of ['active','unknown','reused','legacy-reused']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-lease-id-')),initial=new EconomyJournal(root);initial.append(key,{balance:17});initial.close();
  const file=path.join(root,'writer.lock'),old={pid:12345,token:randomUUID(),...(mode==='legacy-reused'?{}:{processIdentity:'windows:100'})};fs.writeFileSync(file,JSON.stringify(old));
  const probe=pid=>pid===process.pid?{alive:true,identity:'windows:300'}:mode==='unknown'?{alive:true}:mode==='legacy-reused'?{alive:true,identity:'windows:200',startedAtMs:fs.statSync(file).mtimeMs+5000}:{alive:true,identity:mode==='active'?'windows:100':'windows:200'};
  const journal=new EconomyJournal(root,undefined,probe);
  try{if(['active','unknown'].includes(mode)){assert.throws(()=>journal.read(key),/already active/);assert.deepEqual(JSON.parse(fs.readFileSync(file)),old);}else{assert.deepEqual(journal.read(key),{balance:17});assert.equal(JSON.parse(fs.readFileSync(file)).processIdentity,'windows:300');journal.close();}}
  finally{fs.rmSync(root,{recursive:true,force:true});}
 }
});
test('economy journal commits/reopens, refuses a second writer and repairs only a torn final append',()=>{
 const {EconomyJournal}=require(modulePath),root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-test-'));
 const key='a'.repeat(64),store=new EconomyJournal(root);let reopened;
 try{assert.equal(store.read(key),null);const state={test:'first'};store.append(key,state);assert.deepEqual(store.read(key),state);assert.throws(()=>new EconomyJournal(root).read(key),/writer/i);
  store.close();reopened=new EconomyJournal(root);assert.deepEqual(reopened.read(key),state);fs.appendFileSync(path.join(root,key,'journal.jsonl'),'{"torn":');assert.deepEqual(reopened.read(key),state);reopened.append(key,{test:'next'});assert.deepEqual(reopened.read(key),{test:'next'});
 }finally{reopened?.close();store.close();}
});
test('complete corruption and missing initialized log do not reset to a new balance',()=>{
 const {EconomyJournal}=require(modulePath);for(const mode of ['corrupt','missing']){const root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-test-')),s=new EconomyJournal(root),k='b'.repeat(64);try{s.append(k,{balance:25});const file=path.join(root,k,'journal.jsonl');if(mode==='missing')fs.unlinkSync(file);else fs.appendFileSync(file,'{"forged":true}\n');assert.throws(()=>s.read(k));assert.throws(()=>s.append(k,{balance:0}));}finally{s.close();}}
});
test('ambiguous commit failure retains the new state and partial failure retains only the old coherent state',()=>{
 const {EconomyJournal}=require(modulePath);for(const point of ['before-write','partial-write','after-sync']){const root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-test-')),k='c'.repeat(64);let inject=false;const s=new EconomyJournal(root,p=>{if(inject&&p===point)throw Error('injected');});try{s.append(k,{balance:0,active:true});inject=true;assert.throws(()=>s.append(k,{balance:25,active:false}),/injected/);inject=false;assert.deepEqual(s.read(k),point==='after-sync'?{balance:25,active:false}:{balance:0,active:true});}finally{s.close();}}
});
test('actual fsync failure after a complete record cannot be acknowledged until recovery flush succeeds',()=>{
 const {EconomyJournal}=require(modulePath),root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-test-')),key='d'.repeat(64),original=fs.fsyncSync;let armed=false;
 const s=new EconomyJournal(root,p=>{if(armed&&p==='before-write')fs.fsyncSync=()=>{throw Error('disk flush failed');};});
 try{s.append(key,{balance:0,active:true});armed=true;assert.throws(()=>s.append(key,{balance:25,active:false}),/disk flush failed/);assert.throws(()=>s.read(key),/disk flush failed/);fs.fsyncSync=original;assert.deepEqual(s.read(key),{balance:25,active:false});}finally{fs.fsyncSync=original;s.close();}
});
test('two real processes recovering the same stale lease cannot both become financial writers',{timeout:15000},async()=>{
 const {spawn,spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');const root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-race-')),dead=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(dead.status,0);const token=randomUUID();fs.writeFileSync(path.join(root,'writer.lock'),JSON.stringify({pid:dead.pid,token}));
 const children=['a','b'].map(label=>spawn(process.execPath,[path.join(__dirname,'economy-worker.cjs'),'race',modulePath,root,label,token],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true}));
 const result=children.map(c=>new Promise((resolve,reject)=>{let outcome,error='';c.stderr.on('data',d=>error+=d);c.on('message',m=>{if(m.type==='outcome')outcome=m;});c.on('error',reject);c.on('exit',code=>outcome?resolve(outcome):reject(Error('worker exit '+code+': '+error)));}));
 try{children.forEach(c=>c.send('start'));const deadline=Date.now()+5000;while(!['a','b'].every(n=>fs.existsSync(path.join(root,n+'.ready')))){if(Date.now()>deadline)throw Error('race barrier missing');await new Promise(r=>setTimeout(r,10));}fs.writeFileSync(path.join(root,'release'),'go');const outcomes=await Promise.all(result);assert.equal(outcomes.filter(x=>x.ok).length,1,JSON.stringify(outcomes));}finally{for(const child of children)if(child.exitCode===null)child.kill();}
});
test('process termination during append recovers a coherent prefix without creating money',{timeout:15000},()=>{
 const {spawnSync}=require('node:child_process'),{EconomyJournal}=require(modulePath);for(const point of ['partial-write','after-sync']){const root=fs.mkdtempSync(path.join(os.tmpdir(),'frostveil-economy-crash-')),key='e'.repeat(64),s=new EconomyJournal(root);s.append(key,{balance:0,active:true});s.close();const run=spawnSync(process.execPath,[path.join(__dirname,'economy-worker.cjs'),'crash',modulePath,root,point],{windowsHide:true,encoding:'utf8',timeout:5000});assert.equal(run.status,71,run.stderr);const recovered=new EconomyJournal(root);try{assert.deepEqual(recovered.read(key),point==='after-sync'?{balance:25,active:false}:{balance:0,active:true});}finally{recovered.close();}}
});
