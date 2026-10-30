const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const api=require('../scripts/g245-assets.cjs');
test('canonical candidate identity is order independent and rejects invalid values',()=>{
 a.equal(api.canonical({z:[2,1],a:'ไทย'}),api.canonical({a:'ไทย',z:[2,1]}));a.throws(()=>api.canonical({bad:NaN}));
});
test('source paths reject traversal, hardlinks, symlinks and executables',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-intake-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'ok.dds'),'DDS ');
 a.equal(api.readConfined(root,'ok.dds',128).length,4);for(const name of ['../bad.dds','C:/bad.dds','a:bad.dds','a//b.dds','x.exe','x.js','x.psc'])a.throws(()=>api.readConfined(root,name,128));
 fs.linkSync(path.join(root,'ok.dds'),path.join(root,'linked.dds'));a.throws(()=>api.readConfined(root,'linked.dds',128));
});
test('public package gate refuses unknown rights or missing production trust',()=>{
 for(const permission of ['UNKNOWN','FORBIDDEN','ALLOWED'])a.throws(()=>api.publicPackage({redistribution:permission}));
});
test('staging refuses nested Windows junctions before creating or writing descendants',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-intake-links-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const inside=path.join(root,'snapshot'),escape=path.join(root,'escape');fs.mkdirSync(inside);fs.mkdirSync(escape);fs.symlinkSync(escape,path.join(inside,'Data'),'junction');a.throws(()=>api.directory(inside,'Data/meshes'),/Symlink|reparse/);a.deepEqual(fs.readdirSync(escape),[]);
});
test('optional owner PNG previews are bounded, CRC-checked and never treated as render proof',()=>{
 const {crc32,deflateSync}=require('node:zlib'),chunk=(name,body)=>{const h=Buffer.alloc(8),c=Buffer.alloc(4);h.writeUInt32BE(body.length);h.write(name,4);c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name),body])));return Buffer.concat([h,body,c]);},header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
 const signature=Buffer.from([137,80,78,71,13,10,26,10]),png=Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,255,255,255,255]))),chunk('IEND',Buffer.alloc(0))]);a.equal(api.inspectPreview(png).purpose,'OWNER_SUPPLIED_PREVIEW_NOT_RENDER_PROOF');const bad=Buffer.from(png);bad[20]^=1;a.throws(()=>api.inspectPreview(bad),/CRC/);a.throws(()=>api.inspectPreview(Buffer.concat([png,Buffer.from('trailer')])));a.throws(()=>api.inspectPreview(Buffer.alloc(2*1024*1024+1)));
 a.throws(()=>api.inspectPreview(Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(0))),chunk('IEND',Buffer.alloc(0))])),/scanline/);a.throws(()=>api.inspectPreview(Buffer.concat([signature,chunk('IHDR',header),chunk('EVIL',Buffer.alloc(0)),chunk('IEND',Buffer.alloc(0))])),/critical/);
});

function library(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-intake-state-')),source=path.join(root,'source');fs.mkdirSync(path.join(source,'Data'),{recursive:true});const body=Buffer.from('generated non-playable staging fixture');fs.writeFileSync(path.join(source,'Data/Source.esp'),body);
 const manifest={schemaVersion:1,candidates:[{templateId:'first'},{templateId:'second'}],catalogDraft:{schemaVersion:1,templates:[]},files:[{path:'Data/Source.esp',sha256:api.sha(body),size:body.length,ownership:'SOURCE',included:true}],validation:[],provenance:{redistribution:'UNKNOWN'}};
 let current={id:api.sha(Buffer.from(api.canonical(manifest))),manifest};const journalModule=require('../.test-build/modules/economy/journal.js');
 const options={storageRoot:path.join(root,'intake'),sources:()=>[{id:'reviewed',root:source,plugin:'Source.esp'}],environment:()=>{throw Error('scanner substituted only in state-machine fixture');},journalModule};
 let service=new api.AssetLibrary(options);service.scan=()=>current;const principal={actor:4278190080,principal:'owner',identity:'verified-session'};
 const call=(op,input={})=>service.execute(op,input,principal),revision=()=>call('list').revision;
 t.after(()=>{service.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,options,principal,call,revision,get service(){return service;},manifest,get id(){return current.id;},change(){current={...current,id:'f'.repeat(64)};},restart(){service.close();service=new api.AssetLibrary(options);service.scan=()=>current;},scan(){return call('scan',{sourceId:'reviewed',revision:revision()});},stage(selectedTemplates=['first','second']){return call('stage',{id:current.id,revision:revision(),selectedTemplates});},review(){return call('review',{id:current.id,revision:revision(),acceptLocalRights:true,acceptRenderUncertainty:true});}};
}
test('intake selection, review, approval, replay rejection, rollback and restart never hot-load actors',t=>{
 const f=library(t);f.scan();f.stage(['second']);const review=f.review();const approved=f.call('approve',{token:review.token,revision:f.revision()});a.equal(approved.runtime,'NOT_HOT_LOADED');a.deepEqual(f.call('list').approvals[0].selectedTemplates,['second']);
 a.throws(()=>f.call('approve',{token:review.token,revision:f.revision()}));f.restart();a.equal(f.call('list').approvals[0].id,approved.id);a.equal(f.call('rollback',{approvalId:approved.id,revision:f.revision()}).runtime,'NOT_HOT_LOADED');
});
test('authorization, malformed input, foreign session and expired review are rejected',t=>{
 const f=library(t);a.throws(()=>f.service.execute('list',{},null));a.throws(()=>f.call('scan',{sourceId:'reviewed',revision:0,path:'C:/secret'}));f.scan();f.stage();const review=f.review();a.throws(()=>f.service.execute('approve',{token:review.token,revision:f.revision()},{...f.principal,identity:'spoofed-session'}));
 const expired=f.review();f.service.reviews.get(expired.token).expires=Date.now()-1;a.throws(()=>f.call('approve',{token:expired.token,revision:f.revision()}));a.equal(f.call('list').approvals.length,0);
});
test('revision conflicts and competing journal writers cannot overwrite an approval',t=>{
 const f=library(t);f.scan();const rev=f.revision();f.stage();a.throws(()=>f.call('reject',{id:f.id,revision:rev}),/conflict/);a.throws(()=>new api.AssetLibrary(f.options),/writer|locked|active/i);const review=f.review();f.call('reject',{id:f.id,revision:f.revision()});a.throws(()=>f.call('approve',{token:review.token,revision:f.revision()}));
});
test('changed source invalidates prior approval and immutable staged tampering is fatal',t=>{
 const f=library(t);f.scan();f.stage();const manifest=path.join(f.root,'intake/snapshots',f.id,'manifest.json');fs.writeFileSync(manifest,'{}');a.throws(()=>f.review(),/tampered/);f.change();a.throws(()=>f.call('stage',{id:f.call('list').candidates[0].id,revision:f.revision(),selectedTemplates:['first']}),/conflict/);a.equal(f.call('list').candidates[0].state,'INVALIDATED');
});
test('selection and rights gates fail closed, inspection is deterministic and does not append on unchanged scan',t=>{
 const f=library(t);f.scan();const rev=f.revision();f.scan();a.equal(f.revision(),rev);for(const selected of [[],['unknown'],['first','first']])a.throws(()=>f.stage(selected));f.stage();a.throws(()=>f.call('review',{id:f.id,revision:f.revision(),acceptLocalRights:false,acceptRenderUncertainty:true}));const a1=fs.readFileSync(path.join(f.root,'intake/snapshots',f.id,'manifest.json'));f.stage();a.deepEqual(a1,fs.readFileSync(path.join(f.root,'intake/snapshots',f.id,'manifest.json')));
});
test('rejected or invalidated revisions cannot be revived through approval rollback',t=>{
 const f=library(t);f.scan();f.stage();const review=f.review(),approval=f.call('approve',{token:review.token,revision:f.revision()});f.call('reject',{id:f.id,revision:f.revision()});a.equal(f.call('list').activeApproval,null);a.throws(()=>f.call('rollback',{approvalId:approval.id,revision:f.revision()}),/invalidated/);
});
test('provenance edits require authority/revision, invalidate approval and cannot change reviewed filesystem roots',t=>{
 const f=library(t);f.scan();f.stage();const review=f.review();f.call('approve',{token:review.token,revision:f.revision()});
 const data={sourceId:'reviewed',revision:f.revision(),author:'Owner',sourceLink:'https://example.test/source',version:'1',permission:'Local owner permission',redistribution:'UNKNOWN',attribution:'Owner'};
 a.throws(()=>f.call('provenance',{...data,root:'C:/secret'}));a.throws(()=>f.call('provenance',{...data,sourceLink:'C:/private/source'}));f.call('provenance',data);a.equal(f.call('list').activeApproval,null);a.equal(f.call('list').candidates[0].state,'INVALIDATED');a.equal(f.service.source('reviewed').provenance.author,'Owner');
 // Even an identical immutable revision must be explicitly revalidated rather
 // than remaining permanently invalidated or silently reactivating approval.
 f.scan();a.equal(f.call('list').candidates[0].state,'REVIEW_REQUIRED');a.equal(f.call('list').activeApproval,null);a.throws(()=>f.review());f.stage();a.ok(f.review().token);
});
test('authority is rechecked before persistence and private principal nonces never enter audit history',t=>{
 const f=library(t);f.scan();const rev=f.revision();let checks=0;const input={sourceId:'reviewed',revision:rev,author:'Owner',sourceLink:'Reviewed source',version:'1',permission:'Local only',redistribution:'UNKNOWN',attribution:'Owner'};
 a.throws(()=>f.service.execute('provenance',input,f.principal,()=>{if(++checks>1)throw Error('Asset authorization expired');}),/authorization expired/);a.equal(f.revision(),rev);a.equal(f.service.commitGuard,undefined);
 f.principal.principal='local-operator:owner#SENSITIVE-NONCE';f.stage();a.equal(JSON.stringify(f.call('list').history).includes('SENSITIVE-NONCE'),false);a.equal(JSON.stringify(f.call('list').history).includes('local-operator'),false);
});
test('local source registration serializes writers and releases only its own lock after failure',t=>{
 const {registrationLock}=require('../scripts/npc-assets.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-source-lock-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));registrationLock(root,()=>{a.throws(()=>registrationLock(root,()=>a.fail('second writer entered')),/registration/);});a.equal(fs.existsSync(path.join(root,'asset-sources.lock')),false);a.throws(()=>registrationLock(root,()=>{throw Error('Synthetic registration failure');}),/Synthetic/);a.equal(fs.existsSync(path.join(root,'asset-sources.lock')),false);
});
