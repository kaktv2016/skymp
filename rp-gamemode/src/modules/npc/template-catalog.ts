import {createHash} from 'node:crypto';

import type {TemplateAssignment,TemplateMetadata,ApprovedTemplate} from './catalog-model';
export type {TemplateAssignment,TemplateMetadata,ApprovedTemplate} from './catalog-model';
export interface PluginFact {filename:string;sha256:string;masters:string[];light:boolean;}
export interface ReviewedTombstone {form:string;type:'NPC_';flags:32;payloadSize:0;}
export interface RecordFact {type:string;editorId?:string;unique?:boolean;sex?:string;race?:string;headParts?:string[];outfit?:string;inventory?:{form:string;count:number}[];inherits?:boolean;unsafe?:boolean;items?:string[];slots?:number;}
export interface CatalogEnvironment {plugins:PluginFact[];record(ref:string):RecordFact|undefined;verifyAsset(asset:{path:string;sha256:string;size:number}):void;verifyResourceClosure?(catalog:unknown):void;}
const HASH=/^[a-f0-9]{64}$/,ID=/^[a-z][a-z0-9-]{0,47}$/,PLUGIN=/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,90}\.(esm|esp)$/;
const identifier=(v:unknown):v is string=>typeof v==='string'&&ID.test(v);
function object(v:any,keys:string){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.split(',').sort().join(','))throw Error('Catalog schema fields invalid');}
function text(v:any,max=256){if(typeof v!=='string'||!v.trim()||[...v].length>max||/[\x00-\x1f\x7f-\x9f]/.test(v))throw Error('Invalid catalog text');}
function list(v:any,max:number){if(!Array.isArray(v)||v.length>max)throw Error('Catalog list bound exceeded');}
function canonical(v:any):string{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function catalogHash(value:unknown){const v={...(value as any)};delete v.catalogHash;return createHash('sha256').update(canonical(v)).digest('hex');}
export function qualified(value:any):{local:number;plugin:string}{if(typeof value!=='string')throw Error('Invalid qualified form');const m=/^([a-f0-9]{1,6}):(.+)$/i.exec(value);if(!m||!PLUGIN.test(m[2]!)||m[2]!.includes('..')||!parseInt(m[1]!,16)||parseInt(m[1]!,16).toString(16)!==m[1])throw Error('Invalid qualified form; light/transient forms unsupported');return {local:parseInt(m[1]!,16),plugin:m[2]!};}
function same(a:unknown,b:unknown){return canonical(a)===canonical(b);}
function recordLabel(record:RecordFact,fallback:string){return record.editorId?.replace(/^(Clothes|Armor)/,'').replace(/Race$/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ')||fallback;}
/** Pure validation consumes file/native facts produced by the confined loader.
 * No appearance setters, equipment writes, network events or registry writes. */
export function validateCatalog(raw:unknown,approvedHash:string,env:CatalogEnvironment):ApprovedTemplate[]{
 if(Buffer.byteLength(JSON.stringify(raw))>128*1024)throw Error('Catalog size exceeded');const c:any=structuredClone(raw);
 object(c,'schemaVersion,catalogId,catalogVersion,catalogHash,assetManifestRevision,plugins,assets,templates'+(Object.hasOwn(c,'reviewedTombstones')?',reviewedTombstones':''));
 if(c.schemaVersion!==1||!identifier(c.catalogId)||!Number.isSafeInteger(c.catalogVersion)||c.catalogVersion<1||!identifier(c.assetManifestRevision)||!HASH.test(approvedHash)||c.catalogHash!==approvedHash||catalogHash(c)!==approvedHash)throw Error('Catalog approval/hash/version invalid');
 list(c.plugins,16);list(c.assets,128);list(c.templates,16);if(!c.templates.length||!c.plugins.length)throw Error('Empty catalog');
 const plugins=new Map<string,PluginFact>();let previous=-1;
 for(const p of c.plugins){object(p,'filename,sha256,masters,light');if(!PLUGIN.test(p.filename)||p.filename.includes('..')||!HASH.test(p.sha256)||p.light!==false)throw Error('Invalid or light plugin');list(p.masters,16);const key=p.filename.toLowerCase();if(plugins.has(key))throw Error('Duplicate plugin');const index=env.plugins.findIndex(e=>e.filename.toLowerCase()===key),actual=env.plugins[index];if(!actual||index<=previous||index>=254||actual.light||actual.sha256!==p.sha256||!same(actual.masters,p.masters))throw Error('Plugin hash/order/master mismatch');for(const master of p.masters)if(!plugins.has(master.toLowerCase()))throw Error('Missing/incorrectly ordered master');previous=index;plugins.set(key,p);}
 const deleted=new Set<string>();if(c.reviewedTombstones!==undefined){list(c.reviewedTombstones,8);for(const t of c.reviewedTombstones){object(t,'form,type,flags,payloadSize');const q=qualified(t.form);if(!plugins.has(q.plugin.toLowerCase())||!q.plugin.endsWith('.esp')||t.type!=='NPC_'||t.flags!==32||t.payloadSize!==0||deleted.has(t.form))throw Error('Invalid reviewed tombstone');deleted.add(t.form);}}
 const assetPaths=new Set<string>();for(const a of c.assets){object(a,'path,sha256,size');if(typeof a.path!=='string'||!/^Data\/(meshes|textures)\/[A-Za-z0-9_ .\/-]+\.(nif|dds)$/i.test(a.path)||a.path.split('/').some((p:string)=>!p||p==='.'||p==='..')||!HASH.test(a.sha256)||!Number.isSafeInteger(a.size)||a.size<80||a.size>32*1024*1024||assetPaths.has(a.path.toLowerCase()))throw Error('Invalid/duplicate asset');assetPaths.add(a.path.toLowerCase());env.verifyAsset(a);}
 const get=(ref:string,type:string)=>{const q=qualified(ref);if(!plugins.has(q.plugin.toLowerCase()))throw Error('Unapproved form dependency');const r=env.record(ref);if(!r||r.type!==type)throw Error('Wrong/missing record type '+ref+' expected '+type);return r;};
 const ids=new Set<string>(),bases=new Set<string>(),result:ApprovedTemplate[]=[];
 for(const t of c.templates){object(t,'id,displayName,description,pluginQualifiedBaseId,requiredPlugin,appearance,fixedOutfit,weapon,compatibilityStatus,authoring');if(!identifier(t.id)||t.id==='clerk'||ids.has(t.id))throw Error('Duplicate/reserved template ID');ids.add(t.id);text(t.displayName,64);text(t.description);object(t.authoring,'author,source,rights');text(t.authoring.author,64);text(t.authoring.source);if(!['owned','local-reviewed'].includes(t.authoring.rights)||t.compatibilityStatus!=='g241-local-test')throw Error('Unapproved provenance/compatibility');
  const q=qualified(t.pluginQualifiedBaseId);if(q.plugin!==t.requiredPlugin||!q.plugin.endsWith('.esp')||!plugins.has(q.plugin.toLowerCase())||bases.has(t.pluginQualifiedBaseId.toLowerCase()))throw Error('Distinct owned ESP base required');bases.add(t.pluginQualifiedBaseId.toLowerCase());
  if(deleted.has(t.pluginQualifiedBaseId)||deleted.has(t.fixedOutfit.form))throw Error('Active template references reviewed deletion');const b=get(t.pluginQualifiedBaseId,'NPC_');object(t.appearance,'race,sex,headParts');object(t.fixedOutfit,'form,items');list(t.appearance.headParts,32);list(t.fixedOutfit.items,16);
  if(!['female','male'].includes(t.appearance.sex)||!b.unique||b.inherits||b.unsafe||b.sex!==t.appearance.sex||b.race!==t.appearance.race||!t.appearance.headParts.length||!same(b.headParts,t.appearance.headParts)||b.outfit!==t.fixedOutfit.form||!same(b.inventory,t.weapon?[t.weapon]:[]))throw Error('NPC traits/inheritance/inventory mismatch');get(t.appearance.race,'RACE');for(const h of t.appearance.headParts)get(h,'HDPT');
  const outfit=get(t.fixedOutfit.form,'OTFT');if(!t.fixedOutfit.items.length||!same(outfit.items,t.fixedOutfit.items)||new Set(t.fixedOutfit.items).size!==t.fixedOutfit.items.length)throw Error('Fixed outfit mismatch');let slots=0;for(const item of t.fixedOutfit.items){const r=get(item,'ARMO');if(!Number.isInteger(r.slots)||!r.slots||((slots&r.slots)!==0))throw Error('Invalid/conflicting armor slots');slots|=r.slots;}
  if(t.weapon!==null){object(t.weapon,'form,count');if(t.weapon.count!==1)throw Error('Invalid weapon count');get(t.weapon.form,'WEAP');}
  const hex=q.local.toString(16).padStart(8,'0');for(const file of [`Data/meshes/actors/character/FaceGenData/FaceGeom/${q.plugin}/${hex}.nif`,`Data/textures/actors/character/FaceGenData/FaceTint/${q.plugin}/${hex}.dds`])if(!assetPaths.has(file.toLowerCase()))throw Error('Missing matching FaceGen '+file);
  const index=env.plugins.findIndex(p=>p.filename.toLowerCase()===q.plugin.toLowerCase());
  const metadata:TemplateMetadata={appearancePreset:t.id,raceLabel:recordLabel(get(t.appearance.race,'RACE'),t.appearance.race),sex:t.appearance.sex,category:'Authored fixed configuration',outfitLabel:t.fixedOutfit.items.map((form:string)=>recordLabel(get(form,'ARMO'),form)).join(' + '),
   outfitItems:t.fixedOutfit.items.map((form:string)=>({form,label:recordLabel(get(form,'ARMO'),form),slots:get(form,'ARMO').slots!})),
   faceGen:c.assets.filter((a:{path:string})=>a.path.toLowerCase().includes('/'+q.plugin.toLowerCase()+'/'+hex+'.')),
   dependencies:c.plugins.map((p:PluginFact)=>({filename:p.filename,sha256:p.sha256})),approval:'DEVELOPMENT_ONLY',renderProof:'PENDING_RENDER_PROOF'};
  result.push({id:t.id,displayName:t.displayName,base:t.pluginQualifiedBaseId,baseId:index*0x1000000+q.local,assignment:{catalogId:c.catalogId,catalogVersion:c.catalogVersion,catalogHash:c.catalogHash,base:t.pluginQualifiedBaseId,assetManifestRevision:c.assetManifestRevision},details:{description:t.description,appearance:t.appearance,fixedOutfit:t.fixedOutfit,weapon:t.weapon,requiredPlugin:t.requiredPlugin,requiredPluginSHA256:plugins.get(q.plugin.toLowerCase())!.sha256,metadata}});
 }
 // File pairs and record types alone cannot prove all NIF/headpart/ARMA/texture
 // dependencies. An independently verified authoring validator must supply this
 // gate. It is never optional for an approved spawning catalog.
 if(typeof env.verifyResourceClosure!=='function')throw Error('Resource closure verifier unavailable; fixture spawning disabled');env.verifyResourceClosure(c);
 return result;
}
/** Immutable snapshots; callers receive copies, no mutable profile polling. */
export class NpcTemplateCatalog {
 private readonly templates=new Map<string,ApprovedTemplate>();
 constructor(catalogs:ApprovedTemplate[][]){const revisions=new Set<string>();if(catalogs.length>8)throw Error('Catalog capacity');for(const group of catalogs){if(!group.length)throw Error('Empty approved catalog');const key=group[0]!.assignment.catalogId;if(revisions.has(key))throw Error('Duplicate catalog ID');revisions.add(key);for(const t of group){if(this.templates.has(t.id))throw Error('Duplicate template ID');this.templates.set(t.id,structuredClone(t));}}}
 list(){return [...this.templates.values()].map(t=>({id:t.id,displayName:t.displayName,assignment:structuredClone(t.assignment),details:structuredClone(t.details)}));}
 resolve(id:string,expected?:TemplateAssignment){const t=this.templates.get(id);if(!t)throw Error('Unknown/unavailable approved template: '+id);if(expected&&!same(expected,t.assignment))throw Error('Template revision/base mismatch; previous assignment preserved');return structuredClone(t);}
}
