'use strict';
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const {canonical,sha,noLinks,readConfined}=require('./g245-assets.cjs');
/** Pure plan application: preserve baseline indices, add only approved staged
 * plugins, and refuse a rollback that would orphan any registry assignment. */
function activationConfiguration({library,planId,config,settings,definitions,verifyPlugin}){
 a.equal(library.state.runtime?.requested,planId,'No authorized runtime request');const row=library.state.runtime.plans.find(p=>p.id===planId);a.ok(row?.authorized&&!row.revoked,'Runtime plan unapproved/revoked');const plan=library.onboarding.fresh(planId),p=plan.preparation,chain=[...p.parentPlans,planId];a.ok(chain.length<=8&&new Set(chain).size===chain.length,'Activation ancestry bound');
 const sourceFiles=settings.loadOrder.filter(file=>config.identitySpec.plugins.some(p=>p.filename===path.basename(file)));a.equal(sourceFiles.length,config.identitySpec.plugins.length,'Baseline load order missing');a.deepEqual(sourceFiles.map(f=>path.basename(f)),config.identitySpec.plugins.map(p=>p.filename),'Baseline indices changed');
 const accounted=new Set(config.identitySpec.plugins.map(p=>p.filename));for(const id of config.runtimePlans??[]){const existing=library.onboarding.plan(id);for(const name of existing.preparation.plugins)accounted.add(name);}a.ok(settings.loadOrder.every(file=>accounted.has(path.basename(file))),'Unaccounted/unrelated server plugin; refuse to discard it');
 const eligible=new Map(p.previousTemplates.map(t=>[t.id,t.assignment]));for(const id of p.addedTemplates)eligible.set(id,null);
 for(const d of definitions){if(d.template==='clerk')continue;a.ok(eligible.has(d.template),'Catalog rollback would remove a referenced/assigned template: '+d.template);const expected=eligible.get(d.template);if(expected)a.equal(canonical(expected),canonical(d.templateAssignment),'Existing saved assignment differs');}
 const loadOrder=sourceFiles.slice();
 for(const id of chain){const q=library.onboarding.plan(id).preparation;for(const name of q.plugins){if(loadOrder.some(f=>path.basename(f)===name))continue;a.equal(name,q.source.plugin,'Unknown plugin outside approved plan');a.ok(/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,90}\.esp$/.test(name)&&!name.includes('..'),'Invalid approved plugin');const relative='snapshots/'+q.manifestId+'/Data/'+name;const file=path.join(library.storageRoot,...relative.split('/'));if(verifyPlugin)a.equal(verifyPlugin(file,q.source),true);else{const bytes=readConfined(library.storageRoot,relative,16*1024*1024);a.equal(sha(bytes),q.source.sha256);a.equal(bytes.length,q.source.size);}loadOrder.push(file);}}
 a.deepEqual(p.profilePolicy.runtime,config.policy.runtime,'Pinned client runtime changed');a.ok(loadOrder.length<=16,'Full plugin bound');
 return {planId,config:{...structuredClone(config),baselinePolicy:config.baselinePolicy??config.policy,policy:p.profilePolicy,profileHash:p.profileHash,runtimePlans:chain},settings:{...structuredClone(settings),loadOrder},catalogHash:p.catalogHash};
}
function durable(file,bytes){noLinks(path.dirname(file));const temp=file+'.pending-'+process.pid+'-'+require('node:crypto').randomBytes(4).toString('hex'),fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);}
function rollbackConfiguration(receipt){
 noLinks(receipt.directory);for(const f of receipt.files){noLinks(f.file);noLinks(f.backup);a.ok([f.before,f.after].includes(sha(fs.readFileSync(f.file))),'Configuration changed; rollback conflict retained');a.equal(sha(fs.readFileSync(f.backup)),f.before,'Backup changed');}
 for(const f of receipt.files.slice().reverse())if(sha(fs.readFileSync(f.file))!==f.before)durable(f.file,fs.readFileSync(f.backup));
 receipt.phase=typeof receipt.profileBeforeActive==='boolean'?'profile-recovery-required':'rolled-back';durable(path.join(receipt.directory,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)));
}
function prepareConfiguration(backupRoot,changes,context={}){
 noLinks(backupRoot);a.ok(changes.length===3&&new Set(changes.map(c=>path.resolve(c.file))).size===3,'Exact configuration triple required');for(const c of changes){noLinks(c.file);const s=fs.lstatSync(c.file);a.ok(s.isFile()&&s.nlink===1&&s.size<1024*1024&&Buffer.isBuffer(c.bytes)&&c.bytes.length<1024*1024,'Invalid configuration target');}
 a.ok(Object.keys(context).every(k=>['profileBeforeActive','profileHash','catalogHash'].includes(k)),'Invalid transaction context');
 const directory=fs.mkdtempSync(path.join(backupRoot,'runtime-activation-')),receipt={schemaVersion:1,directory,createdAt:new Date().toISOString(),...context,phase:'prepared',files:changes.map((c,i)=>{const bytes=fs.readFileSync(c.file),backup=path.join(directory,i+'.json'),staged=path.join(directory,'after-'+i+'.json');durable(backup,bytes);durable(staged,c.bytes);return {file:path.resolve(c.file),backup,staged,before:sha(bytes),after:sha(c.bytes)};})};writeReceipt(receipt);return receipt;
}
function writeReceipt(receipt){durable(path.join(receipt.directory,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)));}
function applyPreparedConfiguration(receipt,verify){
 for(const f of receipt.files){noLinks(f.file);noLinks(f.staged);a.equal(sha(fs.readFileSync(f.file)),f.before,'Concurrent configuration edit');a.equal(sha(fs.readFileSync(f.staged)),f.after,'Staged configuration changed');}
 try{receipt.phase='applying';writeReceipt(receipt);for(const f of receipt.files){a.equal(sha(fs.readFileSync(f.file)),f.before,'Concurrent configuration edit');durable(f.file,fs.readFileSync(f.staged));}verify(receipt);receipt.phase='verified';writeReceipt(receipt);return receipt;}
 catch(error){try{rollbackConfiguration(receipt);}catch(recovery){throw new AggregateError([error,recovery],'Runtime activation failed; configuration recovery required: '+receipt.directory);}throw error;}
}
function applyConfiguration(backupRoot,changes,verify){return applyPreparedConfiguration(prepareConfiguration(backupRoot,changes),verify);}
function validateRecoveryReceipt(receipt,{audit,root,handoff}){
 a.ok(receipt&&['prepared','applying','verified','profile-recovery-required'].includes(receipt.phase),'No interrupted configuration transaction');a.equal(path.dirname(receipt.directory),audit);a.match(path.basename(receipt.directory),/^runtime-activation-[A-Za-z0-9]+$/);const expected=[path.join(root,'server-settings.json'),path.join(root,'g241d-config.json'),handoff];a.equal(receipt.files.length,3);for(let i=0;i<3;i++){const f=receipt.files[i];a.equal(path.resolve(f.file),expected[i],'Recovery target is not an isolated config file');a.equal(f.backup,path.join(receipt.directory,i+'.json'),'Backup outside recovery directory');a.match(f.before,/^[a-f0-9]{64}$/);a.match(f.after,/^[a-f0-9]{64}$/);}
}
function assertRecoveryCatalog(root,config){
 const {EconomyJournal}=require(path.join(root,'runtime/modules/economy/journal.js')),journal=new EconomyJournal(path.join(root,'npc-registry'));let definitions;try{definitions=journal.peek('7'.repeat(64))??[];}finally{journal.close();}
 a.match(config.packageDirectory,/^staging-[A-Za-z0-9]+$/);const baseline=JSON.parse(readConfined(root,config.packageDirectory+'/g241.json',128*1024)),available=new Map();
 const include=(c,ids)=>{for(const t of c.templates.filter(t=>!ids||ids.includes(t.id)))available.set(t.id,{catalogId:c.catalogId,catalogVersion:c.catalogVersion,catalogHash:c.catalogHash,base:t.pluginQualifiedBaseId,assetManifestRevision:c.assetManifestRevision});};include(baseline);
 for(const id of config.runtimePlans??[]){a.match(id,/^[a-f0-9]{64}$/);const bytes=readConfined(root,'npc-asset-library/runtime-plans/'+id+'.json',128*1024);a.equal(sha(bytes),id);const p=JSON.parse(bytes).preparation;if(p.catalog)include(p.catalog,p.addedTemplates);}
 for(const d of definitions){if(d.template==='clerk')continue;a.ok(available.has(d.template),'Recovery would orphan an assigned NPC template');a.equal(canonical(d.templateAssignment),canonical(available.get(d.template)),'Recovery would change an existing NPC assignment');}
}
module.exports={activationConfiguration,applyConfiguration,prepareConfiguration,applyPreparedConfiguration,writeReceipt,rollbackConfiguration,validateRecoveryReceipt,assertRecoveryCatalog};
