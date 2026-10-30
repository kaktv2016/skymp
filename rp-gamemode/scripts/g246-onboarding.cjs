'use strict';
// Runtime plans share the asset-intake journal. This module cannot install
// plugins, restart processes, modify registry definitions or create actors.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),a=require('node:assert/strict');
const {canonical,sha,readConfined,directory}=require('./g245-assets.cjs');
const HASH=/^[a-f0-9]{64}$/;
class RuntimeOnboarding {
 constructor(library,environment){this.library=library;this.environment=environment;this.reviews=new Map();}
 close(){this.reviews.clear();}
 state(){return this.library.state.runtime??{plans:[]};}
 plan(id){a.ok(HASH.test(id),'Invalid runtime plan');const body=readConfined(this.library.storageRoot,'runtime-plans/'+id+'.json',128*1024);a.equal(sha(body),id,'Runtime plan tampered');return JSON.parse(body);}
 approval(id){const l=this.library,approval=l.state.approvals.find(p=>p.id===id),candidate=approval&&l.state.candidates.find(c=>c.id===approval.manifestId);a.ok(approval&&candidate&&!['INVALIDATED','REJECTED','BLOCKED_DEPENDENCY','BLOCKED_IDENTITY'].includes(candidate.state),'Intake approval is absent, rejected or stale');a.equal(sha(Buffer.from(canonical({manifestId:approval.manifestId,selectedTemplates:approval.selectedTemplates}))),approval.id,'Immutable intake selection changed');const manifest=l.manifest(candidate.id);a.ok(Array.isArray(approval.selectedTemplates)&&approval.selectedTemplates.length>0&&approval.selectedTemplates.every(id=>manifest.candidates.some(c=>c.templateId===id)),'Unapproved selected template');l.fresh(candidate);l.stage(candidate);return {approval,manifest};}
 fresh(id){const p=this.plan(id),{approval,manifest}=this.approval(p.approvalId);a.equal(approval.manifestId,p.manifestId,'Runtime approval revision differs');if(this.environment.validate)this.environment.validate(p,approval,manifest);else{const current=this.environment.prepare(approval,manifest);a.equal(canonical(current),canonical(p.preparation),'Profile/source/runtime preparation changed; prepare a new plan');}return p;}
 save(next,event,principal,guard){guard();this.library.save(next,event,principal);}
 execute(op,input,principal,guard=()=>{}){
  guard();a.ok(principal&&Number.isInteger(principal.actor)&&principal.principal&&principal.identity,'Runtime operator authorization required');a.ok(input&&typeof input==='object'&&!Array.isArray(input)&&Buffer.byteLength(JSON.stringify(input))<16384,'Invalid runtime request');
  const keys={status:[],prepare:['approvalId','revision'],review:['planId','revision'],promote:['token','revision'],revoke:['planId','revision'],rollback:['planId','revision']}[op];a.ok(keys&&input&&Object.keys(input).sort().join(',')===keys.slice().sort().join(','),'Invalid runtime onboarding fields');
  const l=this.library,current=this.state();
  if(op==='status'){const active=this.environment.active(),applied=this.environment.applied?.()??(active?[active]:[]),verified=this.environment.identityReady(principal.actor);return {revision:l.state.revision,currentTemplates:this.environment.currentTemplates?.()??[],requested:current.requested??null,active:active??null,identityReady:verified,plans:current.plans.map(row=>{const p=this.plan(row.id),revoked=row.revoked===true,isApplied=applied.includes(row.id),approval=l.state.approvals.find(a=>a.id===p.approvalId),candidate=approval&&l.state.candidates.find(c=>c.id===approval.manifestId),suspended=!candidate||['INVALIDATED','REJECTED','BLOCKED_DEPENDENCY','BLOCKED_IDENTITY'].includes(candidate.state);return {...row,restartRequired:(revoked||suspended)&&isApplied,applied:isApplied,templates:p.preparation.templates,diagnostics:[...p.preparation.diagnostics,...(suspended?[{code:'ASSET_APPROVAL_WITHDRAWN'}]:[])],status:revoked?(isApplied?'REVOKED_RESTART_REQUIRED':'REVOKED'):suspended?'SUSPENDED':isApplied?(verified?'PLAYABLE_DEV':'IDENTITY_PROOF_REQUIRED'):current.requested===row.id?'RESTART_REQUIRED':p.preparation.profileReady?'PROFILE_READY':'PROFILE_PREPARATION_REQUIRED',render:'RENDER_PENDING',production:false};})};}
  a.equal(input.revision,l.state.revision,'Runtime catalog revision conflict');const next=structuredClone(l.state);next.runtime??={plans:[]};
  if(op==='prepare'){
   const {approval,manifest}=this.approval(input.approvalId),preparation=this.environment.prepare(approval,manifest);guard();
   const plan={schemaVersion:1,approvalId:approval.id,manifestId:approval.manifestId,selectedTemplates:approval.selectedTemplates,preparation},bytes=Buffer.from(canonical(plan)),id=sha(bytes);a.ok(bytes.length<=128*1024,'Runtime plan bound');
   const folder=directory(l.storageRoot,'runtime-plans'),file=path.join(folder,id+'.json');if(fs.existsSync(file))a.equal(readConfined(l.storageRoot,'runtime-plans/'+id+'.json').toString(),bytes.toString());else{guard();const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
   if(!next.runtime.plans.some(p=>p.id===id)){a.ok(next.runtime.plans.length<16,'Runtime plan history bound');next.runtime.plans.push({id,approvalId:approval.id});this.save(next,'RUNTIME_PLAN_PREPARED',principal,guard);}
   return {id,status:preparation.profileReady?'RESTART_REQUIRED':'PROFILE_PREPARATION_REQUIRED',diagnostics:preparation.diagnostics,notice:'Preparation only; no profile activation, actor creation or hot loading'};
  }
  if(op==='promote'){
   const review=this.reviews.get(input.token);this.reviews.delete(input.token);a.ok(review&&review.expires>Date.now()&&review.revision===l.state.revision&&review.who===canonical(principal),'Expired, replayed or foreign runtime review');const row=next.runtime.plans.find(p=>p.id===review.planId);a.ok(row&&!row.revoked,'Runtime plan revoked');this.fresh(row.id);row.authorized=true;next.runtime.requested=row.id;this.save(next,'RUNTIME_PROMOTION_REQUESTED_RESTART_REQUIRED',principal,guard);return {status:'RESTART_REQUIRED',planId:row.id,notice:'Owner local activation and server/client proof remain mandatory'};
  }
  a.ok(HASH.test(input.planId),'Invalid runtime plan');const row=next.runtime.plans.find(p=>p.id===input.planId);a.ok(row,'Unknown runtime plan');
  if(op==='revoke'){row.revoked=true;if(next.runtime.requested===row.id)delete next.runtime.requested;this.save(next,'RUNTIME_PLAN_REVOKED',principal,guard);this.environment.invalidate?.();return {status:'REVOKED',restartRequired:(this.environment.applied?.()??[this.environment.active()]).includes(row.id)};}
  a.ok(!row.revoked,'Runtime plan revoked');this.fresh(row.id);
  if(op==='rollback'){a.ok(row.authorized===true,'Catalog revision was never runtime-authorized');next.runtime.requested=row.id;this.save(next,'RUNTIME_CATALOG_ROLLBACK_REQUESTED',principal,guard);return {status:'RESTART_REQUIRED',planId:row.id};}
  for(const [k,v]of this.reviews)if(v.expires<=Date.now())this.reviews.delete(k);a.ok(this.reviews.size<32,'Runtime review bound');const token=crypto.randomBytes(32).toString('hex'),expires=Date.now()+60000;this.reviews.set(token,{planId:row.id,revision:l.state.revision,who:canonical(principal),expires});return {token,expires,planId:row.id,notice:'Authorize development catalog preparation at a safe restart. Does not authorize installed-profile changes or render certification.'};
 }
}
/** Portable preparation uses only the selected approved snapshot and existing
 * catalog. Missing installed files are diagnostics, never an installation. */
function prepareRuntimePackage({library,approval,manifest,catalog,config}){
 a.equal(manifest.source.namespace,'FULL','Unsupported runtime namespace');a.ok(!manifest.validation.some(v=>v.severity==='HARD_FAIL'),'Resource validation failed');
 const previous=catalog.list().map(t=>catalog.resolve(t.id)),selected=manifest.candidates.filter(c=>approval.selectedTemplates.includes(c.templateId));a.equal(selected.length,approval.selectedTemplates.length,'Selected candidate missing');
 const added=selected.filter(c=>!previous.some(t=>t.id===c.templateId));for(const c of selected){const old=previous.find(t=>t.id===c.templateId||t.base===c.form);if(old)a.ok(old.id===c.templateId&&old.base===c.form&&old.details.requiredPluginSHA256===manifest.source.sha256,'Existing immutable template conflict');}
 a.ok(previous.length+added.length<=31&&(config.runtimePlans?.length??0)<7,'Development identity/catalog capacity reached; preserve existing assignments');
 const baselinePolicy=config.baselinePolicy??config.policy,policies=config.policy.assets.slice();
 for(const f of manifest.files.filter(f=>/^Data\/.+\.(esp|nif|dds)$/i.test(f.path))){const old=policies.find(p=>p.path.toLowerCase()===f.path.toLowerCase());if(old)a.ok(old.path===f.path&&old.sha256===f.sha256&&old.size===f.size,'Existing profile asset conflict');else policies.push({path:f.path,size:f.size,sha256:f.sha256});}
 const draft=structuredClone(manifest.catalogDraft);draft.catalogId='runtime-'+approval.manifestId.slice(0,16);draft.catalogVersion=1;draft.assetManifestRevision='rev-'+approval.manifestId.slice(0,16);
 draft.templates=draft.templates.map(t=>({...t,compatibilityStatus:'g241-local-test',authoring:{author:manifest.provenance.author.slice(0,64),source:manifest.provenance.source.slice(0,256),rights:'local-reviewed'}}));delete draft.catalogHash;draft.catalogHash=sha(Buffer.from(canonical(draft)));
 const previousTemplates=previous.map(t=>({id:t.id,assignment:t.assignment})).sort((a,b)=>a.id<b.id?-1:1),catalogHash=added.length?sha(Buffer.from(canonical({previousTemplates,added:added.map(c=>c.templateId).sort(),catalogHash:draft.catalogHash}))):config.policy.catalogHash;
 const plugins=[...new Set(policies.filter(f=>/^Data\/[^/]+\.esp$/i.test(f.path)).map(f=>f.path.slice(5)))];a.ok(plugins.length<=8&&policies.length<=128,'Profile capacity');
 const profilePolicy=added.length?{version:2,catalogHash,assets:policies.sort((a,b)=>a.path<b.path?-1:1),runtime:baselinePolicy.runtime,plugins}:config.policy;
 const profileHash=sha(Buffer.from(canonical(profilePolicy))),diagnostics=[];
 for(const f of profilePolicy.assets){try{const bytes=readConfined(config.game,f.path);if(bytes.length!==f.size||sha(bytes)!==f.sha256)diagnostics.push({code:'CLIENT_ASSET_MISMATCH',file:f.path});}catch{diagnostics.push({code:'MISSING_CLIENT_ASSET',file:f.path});}}
 if(added.length)diagnostics.push({code:'OWNER_PROFILE_CONFIRMATION_REQUIRED',message:'Owned files must already exist; local Launcher activation requires deliberate terminal confirmation. No browser installation.'});
 return {schemaVersion:1,approvalId:approval.id,manifestId:approval.manifestId,parentPlans:config.runtimePlans??[],baselineCatalogHash:baselinePolicy.catalogHash,profileHash,catalogHash,profilePolicy,previousTemplates,templates:selected.map(c=>c.templateId).sort(),addedTemplates:added.map(c=>c.templateId).sort(),catalog:added.length?draft:null,plugins,source:manifest.source,files:manifest.files.filter(f=>/^Data\//.test(f.path)),diagnostics,profileReady:diagnostics.length===0,render:'RENDER_PENDING'};
}
module.exports={RuntimeOnboarding,prepareRuntimePackage};
