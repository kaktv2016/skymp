'use strict';
// Restart-time composition only. Immutable saved template assignments remain
// unchanged; validation never provisions/replaces actors or edits their journal.
const path=require('node:path'),fs=require('node:fs'),a=require('node:assert/strict');
const {canonical,sha,readConfined}=require('./g245-assets.cjs');
function assertPlanApproved(library,id){const row=library.state.runtime?.plans.find(p=>p.id===id);a.ok(row?.authorized===true&&!row.revoked,'Runtime catalog is unapproved or revoked');const plan=library.onboarding.plan(id);library.onboarding.approval(plan.approvalId);return plan;}
function mergeCatalogGroup(groups,selected){
 a.ok(selected.length,'Empty runtime selection');const first=selected[0].assignment,existing=groups.find(g=>g[0].assignment.catalogId===first.catalogId),ids=new Set((existing??[]).map(t=>t.id));
 for(const t of selected){a.ok(t.assignment.catalogId===first.catalogId&&t.assignment.catalogHash===first.catalogHash&&!ids.has(t.id),'Conflicting runtime catalog selection');ids.add(t.id);}if(existing)a.ok(existing.every(t=>t.assignment.catalogHash===first.catalogHash&&t.assignment.catalogVersion===first.catalogVersion&&t.assignment.assetManifestRevision===first.assetManifestRevision),'Existing immutable catalog revision conflict');
 if(existing)existing.push(...selected);else groups.push(selected);
}
function loadRuntimeCatalog({root,baseline,library,config,settings,moduleRoot=path.join(root,'runtime')}){
 const loader=require(path.join(moduleRoot,'modules/npc/catalog-loader.js')),{NpcTemplateCatalog}=require(path.join(moduleRoot,'modules/npc/template-catalog.js'));
 const ids=config.runtimePlans??[];a.ok(Array.isArray(ids)&&ids.length<=8&&new Set(ids).size===ids.length,'Runtime activation chain bound');
 const groups=[baseline.list().map(t=>baseline.resolve(t.id))];let catalog=baseline;
 for(let i=0;i<ids.length;i++){
  const id=ids[i],plan=assertPlanApproved(library,id),p=plan.preparation;a.deepEqual(p.parentPlans,ids.slice(0,i),'Runtime plan ancestry differs');a.equal(p.baselineCatalogHash,(config.baselinePolicy??config.policy).catalogHash);a.equal(p.profileHash,sha(Buffer.from(canonical(p.profilePolicy))),'Prepared profile digest differs');
  const previous=catalog.list().map(t=>({id:t.id,assignment:t.assignment})).sort((a,b)=>a.id<b.id?-1:1);a.deepEqual(previous,p.previousTemplates,'Saved catalog assignments changed');
  const manifest=library.manifest(plan.manifestId),snapshot=path.join(library.storageRoot,'snapshots',plan.manifestId);
  // Existing scanner revalidates the immutable source and reviewed dependency
  // envelope. Native catalog validation independently checks the loaded plugin.
  const candidate=library.state.candidates.find(c=>c.id===plan.manifestId);library.fresh(candidate);library.stage(candidate);
  if(p.catalog){const approved=loader.loadApprovedCatalog(snapshot,[{filename:'runtime.json',sha256:p.catalog.catalogHash,document:p.catalog}],settings.loadOrder,library.environment().native,raw=>{
    a.equal(canonical(raw),canonical(p.catalog));a.ok(!manifest.validation.some(v=>v.severity==='HARD_FAIL'));for(const file of manifest.files){const body=readConfined(snapshot,file.path);a.equal(sha(body),file.sha256);a.equal(body.length,file.size);}
   });const selected=p.addedTemplates.map(id=>approved.resolve(id));mergeCatalogGroup(groups,selected);catalog=new NpcTemplateCatalog(groups);}
 }
 if(ids.length){const p=library.onboarding.plan(ids.at(-1)).preparation;a.equal(config.profileHash,p.profileHash);a.equal(config.policy.catalogHash,p.catalogHash);a.equal(canonical(config.policy),canonical(p.profilePolicy));}
 return catalog;
}
function generateRuntimeSpec({root,catalog,config,settings,library,moduleRoot=path.join(root,'runtime')}){
 const loader=require(path.join(moduleRoot,'modules/npc/catalog-loader.js')),{buildRuntimeIdentitySpec}=require(path.join(moduleRoot,'modules/npc/runtime-identity-spec.js')),{crc32}=require('node:zlib');
 const plugins=loader.pluginFacts(settings.loadOrder).map((p,i)=>{const b=fs.readFileSync(settings.loadOrder[i]);return {...p,serverIndex:i,size:b.length,crc32:crc32(b)|0};});
 const baselineHash=(config.baselinePolicy??config.policy).catalogHash,approvals=[{catalogHash:baselineHash,approvalId:baselineHash,manifestHash:baselineHash,templateIds:catalog.list().filter(t=>t.assignment.catalogHash===baselineHash).map(t=>t.id)}];
 for(const id of config.runtimePlans??[]){const plan=assertPlanApproved(library,id);if(plan.preparation.catalog)approvals.push({catalogHash:plan.preparation.catalog.catalogHash,approvalId:plan.approvalId,manifestHash:plan.manifestId,templateIds:plan.preparation.addedTemplates});}
 return buildRuntimeIdentitySpec({profileHash:config.profileHash,catalogHash:config.policy.catalogHash,revision:1+(config.runtimePlans?.length??0),plugins,templates:catalog.list().map(t=>catalog.resolve(t.id)),approvals,probeBases:config.identitySpec.bases.filter(b=>b.plugin.endsWith('.esm')),record:loader.nativeRecordReader(library.environment().native,plugins)});
}
module.exports={assertPlanApproved,loadRuntimeCatalog,generateRuntimeSpec,mergeCatalogGroup};
