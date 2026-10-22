const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {LocalAdminAuthority}=require('../.test-build/modules/admin/local-authority.js');
test('local operator grant requires explicit allowlisted account and current boot/session nonce, expires and revokes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-admin-'));let now=1000;const s={actorId:0xff000000,userId:0,profileId:1,guid:'g1'};
 try{const a=new LocalAdminAuthority(dir,['owner'],()=>now);assert.equal(a.authorize(s),null);let request=JSON.parse(fs.readFileSync(path.join(dir,'sessions.json')));
 const grant={account:'owner',...request.sessions[0],expiresAt:now+10000};fs.writeFileSync(path.join(dir,'approvals.json'),JSON.stringify({boot:request.boot,grants:[grant]}));assert.ok(a.authorize(s).startsWith('local-operator:owner#'));
 assert.equal(a.authorize({...s,profileId:2}),null);assert.equal(a.authorize({...s,guid:'g2'}),null);
 fs.writeFileSync(path.join(dir,'approvals.json'),JSON.stringify({boot:request.boot,grants:[{...grant,account:'attacker'}]}));assert.equal(a.authorize(s),null);
 fs.writeFileSync(path.join(dir,'approvals.json'),JSON.stringify({boot:request.boot,grants:[grant]}));now+=10001;assert.equal(a.authorize(s),null);now=1000;
 const b=new LocalAdminAuthority(dir,['owner'],()=>now);assert.equal(b.authorize(s),null);b.close();a.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('empty account allowlist and malformed or linked grant files never grant privilege',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-admin-'));
 try{const a=new LocalAdminAuthority(dir,[]);assert.equal(a.authorize({actorId:1,userId:0,profileId:1,guid:'x'}),null);fs.writeFileSync(path.join(dir,'approvals.json'),'bad');assert.equal(a.authorize({actorId:1,userId:0,profileId:1,guid:'x'}),null);a.close();}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('same RakNet peer GUID reconnect cannot replay an operator grant and stale inventory is invalidated',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-admin-'));let now=1000;const session={actorId:1,userId:0,profileId:4,guid:'same-peer'};
 try{const a=new LocalAdminAuthority(dir,['owner'],()=>now);a.authorize(session);let state=JSON.parse(fs.readFileSync(path.join(dir,'sessions.json')));const grant={...state.sessions[0],account:'owner',expiresAt:now+1800000};fs.writeFileSync(path.join(dir,'approvals.json'),JSON.stringify({boot:state.boot,grants:[grant]}));assert.ok(a.authorize(session));
 a.connectionEvent(0);assert.equal(a.authorize(session),null);state=JSON.parse(fs.readFileSync(path.join(dir,'sessions.json')));assert.notEqual(state.sessions[0].nonce,grant.nonce);
 fs.writeFileSync(path.join(dir,'approvals.json'),JSON.stringify({boot:state.boot,grants:[{...state.sessions[0],account:'owner',expiresAt:now+1800000}]}));assert.ok(a.authorize(session));now+=120000;assert.equal(a.authorize(session),null);a.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('private inventory write failure during disconnect cannot abort native login listeners or retain privilege',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-admin-'));try{const a=new LocalAdminAuthority(dir,['owner']),s={actorId:1,userId:0,profileId:4,guid:'g'};a.authorize(s);const inventory=path.join(dir,'sessions.json');fs.unlinkSync(inventory);fs.mkdirSync(inventory);assert.doesNotThrow(()=>a.connectionEvent(0));assert.equal(a.authorize(s),null);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
