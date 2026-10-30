const {test}=require('node:test'),a=require('node:assert/strict');
const {NpcService}=require('../.test-build/modules/npc/npc-service.js');
const {setup}=require('./helpers/npc-management.cjs');
test('managed catalog administration is available without mutating actor base or equipment',()=>{
 a.equal(typeof NpcService.prototype.managementSnapshot,'function','missing authorized registry snapshot');
 a.equal(typeof NpcService.prototype.managementCreate,'function','missing catalog-backed creation');
 a.equal(typeof NpcService.prototype.managementRename,'function','missing revision-checked safe edit');
});
test('catalog-backed create uses fixed authored assignment, stationary/passive default and durable UUID',t=>{
 const f=setup(t),r=f.run('review',f.input()),out=f.run('apply',{token:r.token});a.equal(f.count(),1);a.equal(out.status,'APPLIED_PENDING_RENDER_PROOF');
 const n=f.run('snapshot').npcs[0];a.equal(n.name,'เจ้าหน้าที่กิลด์');a.equal(n.templateAssignment.base,'5901:FrostveilNPCTest.esp');a.equal(n.policy.movement,'STATIONARY');a.equal(n.policy.combat,'PASSIVE_PROTECTED');a.deepEqual(n.location.rot,[0,0,80]);a.equal(n.dialogue.id,'courier-clerk');
 const file=require('node:path').join(f.root,'7'.repeat(64),'journal.jsonl'),bytes=require('node:fs').readFileSync(file);f.restart();a.equal(f.run('snapshot').npcs[0].id,n.id);a.equal(f.count(),1);a.deepEqual(require('node:fs').readFileSync(file),bytes);
});
test('rename preserves UUID, dialogue, pose, combat overrides, assignment and native actor without equipment writes',t=>{
 const f=setup(t);a.ok(f.npc().execute(1,['create','guild-clerk']).ok);a.ok(f.npc().execute(1,['combat','enabled']).ok);const before=f.run('snapshot').npcs[0];const c=f.input('rename');f.writes.length=0;f.run('apply',{token:f.run('review',c).token});const after=f.run('snapshot').npcs[0];
 for(const key of ['id','formId','templateAssignment','location','policy','dialogue'])a.deepEqual(after[key],before[key]);a.equal(after.name,c.name);a.equal(after.revision,before.revision+1);a.deepEqual(f.writes,['frostveilNpcName']);a.equal(f.count(),1);
});
test('same review cannot create or rename twice and another browser character cannot consume it',t=>{
 const f=setup(t),r=f.run('review',f.input());a.throws(()=>f.run('apply',{token:r.token},{actor:2,principal:'owner',identity:'other'}),/another session/);f.run('apply',{token:r.token});a.throws(()=>f.run('apply',{token:r.token}),/already used/);a.equal(f.count(),1);
});
test('concurrent edits conflict without changing original UUID/anchor or mutating a second actor',t=>{
 const f=setup(t);f.run('apply',{token:f.run('review',f.input()).token});const r=f.run('review',f.input('rename'));a.ok(f.npc().execute(1,['select']).ok);a.ok(f.npc().execute(1,['rename','another admin']).ok);a.throws(()=>f.run('apply',{token:r.token}),/revision conflict/);a.equal(f.run('snapshot').npcs[0].name,'another admin');
});
test('unverified, revoked, nonisolated, changed cell, moved player and reconnect reviews fail closed',t=>{
 for(const change of [f=>f.proof(false),f=>f.allowed(false),f=>f.isolated(false),f=>f.guid('reconnected'),f=>f.cell('161fe:Skyrim.esm'),f=>f.pos([100,20,30])]){const f=setup(t),r=f.run('review',f.input());change(f);a.throws(()=>f.run('apply',{token:r.token}));a.equal(f.count(),0);}
});
test('asset tampering after review consumes request without journal/native writes; a new review is required',t=>{
 const f=setup(t),r=f.run('review',f.input());f.integrity(false);a.throws(()=>f.run('apply',{token:r.token}),/hash validation failed/);a.equal(f.run('snapshot').templates[0].availability,'INCOMPATIBLE');f.integrity(true);a.throws(()=>f.run('apply',{token:r.token}),/already used/);a.equal(f.count(),0);
});
test('expired or restarted review cannot mutate registry or provision actors',t=>{
 const f=setup(t),r=f.run('review',f.input());f.advance(60001);a.throws(()=>f.run('apply',{token:r.token}),/expired/);const next=f.run('review',f.input());f.restart();a.throws(()=>f.run('apply',{token:next.token}),/expired/);a.equal(f.count(),0);
});
test('interrupted native provisioning preserves its reservation and fails closed on restart without creating duplicates',t=>{
 const f=setup(t),r=f.run('review',f.input());f.native.place=()=>{throw Error('Interrupted native provisioning');};a.throws(()=>f.run('apply',{token:r.token}),/Interrupted/);a.equal(f.count(),0);a.equal(f.npc().isReady,false);a.throws(()=>f.run('apply',{token:r.token}),/already used/);f.restart();a.equal(f.npc().isReady,false);a.equal(f.count(),0);
});
test('forged base, equipment, configuration, catalog version and unknown IDs reject before provisioning',t=>{
 const f=setup(t);for(const change of [{baseId:0x12345},{templateId:'evil'},{configurationId:'warrior:fixed'},{catalogVersion:2},{catalogHash:'b'.repeat(64)},{operation:'setOutfit'},{name:'x\0'}])a.throws(()=>f.run('review',{...f.input(),...change}));a.equal(f.count(),0);
});
test('existing visual replacement is explicitly unsupported; legacy Clerk stays protected read-only',t=>{
 const f=setup(t);f.run('apply',{token:f.run('review',f.input()).token});a.throws(()=>f.run('review',f.input('rename','warrior')),/reassignment is unavailable/);a.equal(f.run('snapshot').reassignment.supported,false);
 a.ok(f.npc().execute(1,['create','clerk']).ok);const n=f.run('snapshot').npcs.find(n=>n.template==='clerk');a.throws(()=>f.npc().managementRename(1,n.id,n.revisionToken,'changed'),/read-only/);a.equal(n.name,'Courier Guild Clerk');
});
test('read-only catalog exposes identity gating without claiming public availability or arbitrary loadout',t=>{
 const f=setup(t);f.proof(false);const s=f.run('snapshot');a.equal(s.identityReady,false);a.equal(s.templates.length,2);a.ok(s.templates.every(t=>t.availability==='IDENTITY_UNVERIFIED'));a.equal(s.weaponLoadout.editable,false);a.throws(()=>f.run('review',f.input()),/identity unverified/);
});
test('unknown operations, unsupported custom cells, invalid names and deleted edits are rejected',t=>{
 const f=setup(t);a.throws(()=>f.run('setBase',{}));f.cell('800:Unknown.esp');a.throws(()=>f.run('review',f.input()),/world/);f.cell('3c:Skyrim.esm');
 f.run('apply',{token:f.run('review',f.input()).token});a.ok(f.npc().execute(1,['select']).ok);a.ok(f.npc().execute(1,['delete']).ok);a.throws(()=>f.run('review',f.input('rename')),/read-only/);
});
