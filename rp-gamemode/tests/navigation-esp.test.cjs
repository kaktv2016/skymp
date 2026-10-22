const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {buildPlugin,inspectPlugin,catalogue}=require('../../../mod-work/frostveil-courier-navigation/build.cjs');
test('deterministic regular ESP contains only owned quests/markers and minimal hierarchy overrides',()=>{
 const bytes=buildPlugin(),other=buildPlugin();assert.deepEqual(bytes,other);
 const data=inspectPlugin(bytes);assert.equal(data.light,false);assert.deepEqual(data.masters,['Skyrim.esm']);
 assert.deepEqual(catalogue,require('../.test-build/config/navigation-catalogue.js').navigationCatalogue,'Server and ESP catalogue must match exactly');
 assert.equal(data.quests.length,6);assert.equal(data.markers.length,6);
 assert.ok(data.quests.every(q=>q.objective===10&&q.alias===0&&q.flags===8&&q.questType===8&&q.target===0&&q.hasAliasEnd&&!q.hasScript));
 assert.ok(data.markers.every(r=>r.base===0x3b&&r.persistent&&!r.disabled&&!r.hasScript));
 assert.equal(new Set([...data.quests,...data.markers].map(r=>r.id)).size,12);
 for(const entry of catalogue){const q=data.quests.find(q=>q.id===(0x1000000+entry.quest));assert.ok(q,entry.key);assert.equal(q.reference,0x1000000+entry.reference);}
 assert.ok(data.records.every(r=>['TES4','QUST','REFR','WRLD','CELL'].includes(r.type)));
});
test('ESP validation refuses truncation, malformed objective targets and ESL flag',()=>{
 const bytes=buildPlugin();assert.throws(()=>inspectPlugin(bytes.subarray(0,-1)));
 const light=Buffer.from(bytes);light.writeUInt32LE(0x200,8);assert.throws(()=>inspectPlugin(light));
 const broken=Buffer.from(bytes),at=broken.indexOf(Buffer.from('QSTA'));broken.writeInt32LE(9,at+6);assert.throws(()=>inspectPlugin(broken));
});

// Parse alias fields independently of the builder's inspector: an empty target
// must not prevent a quest from starting before the client binds the destination.
test('native aliases permit deferred binding and include vanilla voice terminator',()=>{
 const bytes=buildPlugin();let aliases=0;
 for(let p=0;p<bytes.length-6;p++)if(bytes.toString('ascii',p,p+4)==='ALST'&&bytes.readUInt16LE(p+4)===4){
  let flags,voice;for(let at=p;at+6<=bytes.length;){const name=bytes.toString('ascii',at,at+4),size=bytes.readUInt16LE(at+4),data=bytes.subarray(at+6,at+6+size);if(name==='FNAM')flags=data.readUInt32LE(0);if(name==='VTCK')voice=data;if(name==='ALED')break;at+=6+size;}
  assert.ok(flags&2,'Optional alias required for post-start forceRefTo');assert.ok(voice&&voice.length===4&&voice.readUInt32LE(0)===0,'Native reference alias VTCK=NULL');aliases++;
 }assert.equal(aliases,6);
});
