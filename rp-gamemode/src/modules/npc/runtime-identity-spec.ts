import {createHash} from 'node:crypto';
import type {DevelopmentIdentitySpec} from './development-identity';
import type {ApprovedTemplate} from './catalog-model';

const hash=/^[a-f0-9]{64}$/;
const plugin=/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,90}\.(esm|esp)$/;
const canonical=(v:any):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export function runtimeIdentityHash(spec:DevelopmentIdentitySpec){const value={...spec};delete value.specHash;return createHash('sha256').update(canonical(value)).digest('hex');}
/** Validation is server-side. Client probes receive this exact sealed snapshot,
 * not a client-authored mapping table. Legacy v1 snapshots remain recognizable. */
export function validateRuntimeIdentitySpec(spec:DevelopmentIdentitySpec){
 if(!spec||![1,2].includes(spec.version)||![spec.catalogHash,spec.profileHash].every(s=>hash.test(s))||!Array.isArray(spec.plugins)||!spec.plugins.length||spec.plugins.length>16||!Array.isArray(spec.bases)||!spec.bases.length||spec.bases.length>32||Buffer.byteLength(JSON.stringify(spec))>16384)throw Error('Invalid development identity spec');
 const names=new Set<string>(),indices=new Set<number>();
 for(const p of spec.plugins){if(!plugin.test(p.filename)||p.filename.includes('..')||names.has(p.filename.toLowerCase())||!hash.test(p.sha256)||!Number.isInteger(p.serverIndex)||p.serverIndex<0||p.serverIndex>=254||indices.has(p.serverIndex)||!Number.isInteger(p.crc32)||!Number.isSafeInteger(p.size)||p.size<24||p.light===true)throw Error('Invalid development plugin');names.add(p.filename.toLowerCase());indices.add(p.serverIndex);}
 const bases=new Set<string>(),templates=new Set<string>();
 for(const b of spec.bases){const p=spec.plugins.find(p=>p.filename===b.plugin),key=b.plugin.toLowerCase()+':'+b.localId;if(!p||!Number.isInteger(b.localId)||b.localId<=0||b.localId>0xffffff||b.serverId!==p.serverIndex*0x1000000+b.localId||bases.has(key))throw Error('Server base identity differs');bases.add(key);
  if(spec.version===2&&b.templateId!==undefined){if(!/^[a-z][a-z0-9-]{0,47}$/.test(b.templateId)||templates.has(b.templateId)||!hash.test(b.catalogHash??'')||!hash.test(b.approvalId??'')||!spec.catalogs?.some(c=>c.catalogHash===b.catalogHash&&c.approvalId===b.approvalId&&(!c.templateIds||c.templateIds.includes(b.templateId!))))throw Error('Unapproved runtime template');templates.add(b.templateId);}
 }
 if(spec.version===2){if(!Number.isSafeInteger(spec.revision)||spec.revision!<1||!Array.isArray(spec.catalogs)||!spec.catalogs.length||spec.catalogs.length>8||new Set(spec.catalogs.map(c=>c.catalogHash+':'+c.approvalId)).size!==spec.catalogs.length||spec.catalogs.some(c=>![c.catalogHash,c.approvalId,c.manifestHash].every(h=>hash.test(h))||c.templateIds&&(!Array.isArray(c.templateIds)||!c.templateIds.length||c.templateIds.length>31||new Set(c.templateIds).size!==c.templateIds.length||c.templateIds.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(id))))||spec.specHash!==runtimeIdentityHash(spec))throw Error('Identity specification hash/revision mismatch');}
}

interface Plugin {filename:string;sha256:string;crc32:number;size:number;serverIndex:number;masters:string[];light:boolean;}
export interface RuntimeCatalogApproval {catalogHash:string;approvalId:string;manifestHash:string;templateIds?:string[];}
/** Derive identities from validated catalog entries; no per-template branches.
 * Callers must obtain approvals from immutable operator-reviewed storage. */
export function buildRuntimeIdentitySpec(input:{profileHash:string;catalogHash:string;revision:number;plugins:Plugin[];templates:Pick<ApprovedTemplate,'id'|'base'|'baseId'|'assignment'|'details'>[];approvals:RuntimeCatalogApproval[];probeBases?:{plugin:string;localId:number;serverId:number}[];record:(ref:string)=>{type:string}|undefined}):DevelopmentIdentitySpec{
 if(!input.templates.length||input.templates.length>32)throw Error('Runtime template bound');
 const ordered=input.plugins.slice().sort((a,b)=>a.serverIndex-b.serverIndex),seen=new Set<string>();
 for(const p of ordered){if(p.light||p.masters.some(m=>!seen.has(m.toLowerCase())))throw Error('Missing master or unsupported light plugin');seen.add(p.filename.toLowerCase());}
 const templates=input.templates.slice().sort((a,b)=>a.base<b.base?-1:a.base>b.base?1:0);
 const approvals=input.approvals.map(a=>({...a,...(a.templateIds?{templateIds:a.templateIds.slice().sort()}:{})})).sort((a,b)=>a.catalogHash===b.catalogHash?(a.approvalId<b.approvalId?-1:a.approvalId>b.approvalId?1:0):a.catalogHash<b.catalogHash?-1:1);
 const bases=templates.map(t=>{
  const q=/^([a-f0-9]{1,6}):(.+)$/.exec(t.base),p=q&&ordered.find(p=>p.filename===q[2]),approval=approvals.find(a=>a.catalogHash===t.assignment.catalogHash&&(!a.templateIds||a.templateIds.includes(t.id)));
  if(!q||!p||!p.filename.endsWith('.esp')||!approval||t.assignment.base!==t.base||t.details.requiredPlugin!==p.filename||t.details.requiredPluginSHA256!==p.sha256||input.record(t.base)?.type!=='NPC_')throw Error('Unapproved catalog/base/plugin/type');
  const localId=parseInt(q[1]!,16);if(t.baseId!==p.serverIndex*0x1000000+localId)throw Error('Catalog native base differs');
  return {plugin:p.filename,localId,serverId:t.baseId,templateId:t.id,catalogHash:t.assignment.catalogHash,approvalId:approval.approvalId};
 });
 const spec:DevelopmentIdentitySpec={version:2,revision:input.revision,profileHash:input.profileHash,catalogHash:input.catalogHash,plugins:ordered.map(p=>({...p,masters:p.masters.slice()})),bases:[...(input.probeBases??[]),...bases],catalogs:approvals};
 spec.specHash=runtimeIdentityHash(spec);validateRuntimeIdentitySpec(spec);return spec;
}
