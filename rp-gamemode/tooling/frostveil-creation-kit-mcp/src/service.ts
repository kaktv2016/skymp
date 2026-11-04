import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import a from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {schemas,type ToolName,type NpcSpec} from './schemas.js';

const require=createRequire(import.meta.url);
export const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const repo=path.resolve(pkg,'../../..');
const shared=require(path.join(repo,'rp-gamemode/scripts/g245-assets.cjs'));
const {sha,canonical,noLinks,readConfined,directory}=shared;
const loader=require(path.join(pkg,'dist/catalog-loader.cjs'));
const game='C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition';
const audit=path.join(repo,'build/rp-audit/creation-kit-mcp');
const sdk=path.join(repo,'.local/tools/dotnet-sdk-10/dotnet.exe');
const adapter=path.join(pkg,'adapter/bin/Release/net10.0/Adapter.dll');
type Plan={spec:NpcSpec;masterHash:string;refs:any;plugin:string;policy:string};
class Fault extends Error {constructor(public code:string,message:string){super(message);}}
function ensure(condition:unknown,code:string,message:string):asserts condition {if(!condition)throw new Fault(code,message);}
function safeRead(file:string,max=16*1024*1024):Buffer{return readConfined(path.dirname(file),path.basename(file),max);}
function exclusive(file:string,body:Buffer|string){noLinks(path.dirname(file));const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,body);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}noLinks(file);}
function commitJson(file:string,value:unknown){const temp=file+'.pending.json';exclusive(temp,canonical(value));fs.linkSync(temp,file);fs.unlinkSync(temp);}
function decode(bytes:Buffer,size:number){const r=inflateSync(bytes,{maxOutputLength:size,info:true}) as unknown as {engine:{bytesWritten:number};buffer:Buffer};a.equal(r.engine.bytesWritten,bytes.length);return r.buffer;}

export class Service {
 readonly root:string;
 private active=0;
 constructor(root=process.env.FROSTVEIL_CK_WORK??path.join(audit,'work')){
  const relative=path.relative(audit,path.resolve(root));
  ensure(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'PATH','Work root must be a child of project audit root');
  directory(repo,'build/rp-audit/creation-kit-mcp');this.root=directory(audit,relative.split(path.sep).join('/'));
  for(const name of ['plans','operations','snapshots'])directory(this.root,name);
 }
 async adapter(request:Record<string,unknown>):Promise<any>{
  noLinks(sdk);noLinks(adapter);
  return new Promise((resolve,reject)=>{
   const child=spawn(sdk,[adapter],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,DOTNET_ROOT:path.dirname(sdk)}});
   let output='',errors='',settled=false;const timer=setTimeout(()=>{child.kill();done(new Fault('TIMEOUT','Mutagen operation exceeded 45 seconds'));},45000);
   const done=(error?:Error,value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
   child.stdout.on('data',b=>{output+=b;if(output.length>2*1024*1024){child.kill();done(new Fault('BOUND','Adapter response too large'));}});
   child.stderr.on('data',b=>{if(errors.length<16384)errors+=b;});child.on('error',done);
   child.on('close',code=>{if(code!==0)return done(new Fault('ADAPTER',errors.slice(0,2000)||'Mutagen failed'));try{done(undefined,JSON.parse(output));}catch{done(new Fault('ADAPTER','Invalid adapter response'));}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request)+'\n');
  });
 }
 snapshot(file:string){
  const b=safeRead(file,512*1024*1024),hash=sha(b),dir=directory(this.root,'snapshots/'+hash),target=path.join(dir,path.basename(file));
  if(!fs.existsSync(target))exclusive(target,b);
  ensure(sha(safeRead(target,512*1024*1024))===hash,'TAMPER','Snapshot changed');
  return {file:target,hash};
 }
 operation(id:string){return path.join(this.root,'operations',id);}
 receipt(id:string){const file=path.join(this.operation(id),'receipt.json');return JSON.parse(safeRead(file,65536).toString());}
 readPlan(id:string):Plan{ensure(/^[a-f0-9]{64}$/.test(id),'TAMPER','Invalid stored plan ID');const b=safeRead(path.join(this.root,'plans',id+'.json'),65536);ensure(sha(b)===id,'TAMPER','Stored plan changed');return JSON.parse(b.toString());}
 artifacts(){
  noLinks(path.join(this.root,'operations'));const names=fs.readdirSync(path.join(this.root,'operations'));ensure(names.length<=512,'BOUND','Operation capacity reached');
  return names.flatMap(id=>{const dir=this.operation(id);noLinks(dir);if(!fs.existsSync(path.join(dir,'receipt.json')))return [];const r=this.receipt(id);return [{...r,id}];});
 }
 source(plugin:string){
  if(plugin==='FrostveilNPCTest.esp')return path.join(game,'Data',plugin);
  const found=this.artifacts().filter(r=>r.plugin===plugin&&r.status==='VERIFIED_STAGED');
  ensure(found.length>0,'NOT_FOUND','No verified artifact for plugin');
  const r=found[0],file=path.join(this.operation(r.id),'Data',plugin);
  ensure(sha(safeRead(file))===r.sha256,'TAMPER','Staged artifact hash changed');return file;
 }
 async inspect(plugin:string){const s=this.snapshot(this.source(plugin));const result=await this.adapter({op:'inspect',path:s.file});ensure(sha(safeRead(s.file))===s.hash,'CONFLICT','Snapshot changed during inspection');return {backend:'MUTAGEN_HEADLESS',sha256:s.hash,...result};}
 async plan(spec:NpcSpec){
  const master=this.snapshot(path.join(game,'Data/Skyrim.esm'));
  ensure(this.approvedCatalog().plugins.some((p:any)=>p.filename==='Skyrim.esm'&&p.sha256===master.hash),'TAMPER','Installed master differs from approved Frostveil baseline');
  const refs=await this.adapter({op:'resolve',master:master.file});
  // Use the same reviewed vanilla dependency envelope; headparts are inspected
  // by type/sex/race in the adapter and identities are bound to the master hash.
  const seed=sha(canonical({spec,masterHash:master.hash,refs}));
  const p:Plan={spec,masterHash:master.hash,refs,plugin:'FrostveilMCP_'+seed.slice(0,12)+'.esp',policy:'OWNED_FULL_ESP_FEMALE_NORD_VANILLA_WARLOCK_V1'};
  const planId=sha(canonical(p)),file=path.join(this.root,'plans',planId+'.json');
  if(!fs.existsSync(file))exclusive(file,canonical(p));else ensure(sha(safeRead(file))===planId,'TAMPER','Plan changed');
  return {backend:'MUTAGEN_HEADLESS',status:'REVIEW_REQUIRED',planId,reviewHash:sha('SCRATCH_ONLY:'+planId),...p,localIds:{npc:0x800,outfit:0x801},spawnable:false,facegen:'MANUAL_REQUIRED',notice:'Review resolved references; authorize only this immutable scratch plan by passing reviewHash to ck_create_npc. No promotion, installation or runtime activation.'};
 }
 async create(input:any,signal?:AbortSignal){
  const file=path.join(this.root,'plans',input.planId+'.json'),b=safeRead(file,65536);
  ensure(sha(b)===input.planId,'TAMPER','Plan hash mismatch');const p:Plan=JSON.parse(b.toString());
  ensure(input.reviewHash===sha('SCRATCH_ONLY:'+input.planId),'REVIEW_REQUIRED','Reviewed plan hash required');
  const requestHash=sha(canonical({planId:input.planId,reviewHash:input.reviewHash}));
  const dir=this.operation(input.operationId);
  if(fs.existsSync(dir)){
   noLinks(dir);ensure(fs.existsSync(path.join(dir,'receipt.json')),'INTERRUPTED','Operation active/interrupted; retained evidence must be inspected. Use a new operationId after review.');
   const receipt=this.receipt(input.operationId);ensure(receipt.requestHash===requestHash,'CONFLICT','OperationId already used for another request');
   ensure(sha(safeRead(path.join(dir,'Data',receipt.plugin)))===receipt.sha256,'TAMPER','Completed output changed');return receipt;
  }
  const master=this.snapshot(path.join(game,'Data/Skyrim.esm'));ensure(master.hash===p.masterHash,'CONFLICT','Master changed since planning');
  const resolved=await this.adapter({op:'resolve',master:master.file});
  const spec=schemas.ck_plan_npc_creation.parse(p.spec),seed=sha(canonical({spec,masterHash:master.hash,refs:resolved}));
  ensure(canonical(p.refs)===canonical(resolved)&&p.plugin==='FrostveilMCP_'+seed.slice(0,12)+'.esp'&&p.policy==='OWNED_FULL_ESP_FEMALE_NORD_VANILLA_WARLOCK_V1','TAMPER','Plan references or identity differ from approved preset');
  signal?.throwIfAborted();
  if(input.dryRun)return {backend:'MUTAGEN_HEADLESS',status:'DRY_RUN',planId:input.planId,plugin:p.plugin};
  noLinks(path.dirname(dir));fs.mkdirSync(dir);noLinks(dir); // cross-process exclusive operation lock
  exclusive(path.join(dir,'request.json'),canonical({requestHash,planId:input.planId,started:new Date().toISOString(),pid:process.pid}));
  try{
   const pending=directory(dir,'pending'),data=directory(dir,'Data'),out=path.join(pending,p.plugin);
   await this.adapter({op:'create',output:out,spec:p.spec,refs:p.refs});
   const checked=await this.validate(out,p.plugin,p);
   ensure(this.snapshot(path.join(game,'Data/Skyrim.esm')).hash===p.masterHash,'CONFLICT','Master changed during write');
   const bytes=safeRead(out),hash=sha(bytes),destination=path.join(data,p.plugin);
   ensure(hash===checked.sha256,'CONFLICT','Output changed after validation');
   signal?.throwIfAborted();
   // Promote a *verified staging artifact* with create-new semantics. Never
   // rename over an existing/source file. Completion receipt is the commit point.
   exclusive(destination,bytes);
   const receipt={backend:'MUTAGEN_HEADLESS',status:'VERIFIED_STAGED',operationId:input.operationId,requestHash,planId:input.planId,plugin:p.plugin,sha256:hash,sourceRoot:dir,spawnable:false,facegen:'MANUAL_REQUIRED',validation:checked};
   ensure(sha(safeRead(destination))===hash,'CONFLICT','Staged output changed before commit');
   commitJson(path.join(dir,'receipt.json'),receipt);return receipt;
  }catch(e){exclusive(path.join(dir,'failure.json'),canonical({status:'FAILED',message:String(e),retained:true}));throw e;}
 }
 async validate(file:string,plugin:string,p?:Plan){
  const bytes=safeRead(file),header=loader.pluginHeader(bytes);
  const records=loader.authoredPluginRecords(bytes,[],plugin,decode);
  ensure(header.masters.length===1&&header.masters[0]==='Skyrim.esm'&&!header.light,'INTEGRITY','Expected Skyrim.esm only, full ESP');
  ensure(records.length===2&&records.some((r:any)=>r.type==='NPC_'&&(r.id&0xffffff)===0x800)&&records.some((r:any)=>r.type==='OTFT'&&(r.id&0xffffff)===0x801),'INTEGRITY','Exactly one owned NPC and outfit required');
  const plugins=[{filename:'Skyrim.esm',light:false},{filename:plugin,light:false}],map=new Map(records.map((r:any)=>[r.id,r]));
  const read=loader.nativeRecordReader({lookupEspmRecordById(id:number){return {record:map.get(id),fileIndex:1,toGlobalRecordId:(n:number)=>n};}},plugins);
  const npc=read('800:'+plugin),outfit=read('801:'+plugin);
  ensure(npc.unique&&npc.sex==='female'&&!npc.inherits&&!npc.unsafe&&npc.outfit==='801:'+plugin,'INTEGRITY','Unsafe NPC state');
  const forms=records.flatMap((r:any)=>r.fields.filter((f:any)=>['RNAM','PNAM','DOFT','INAM'].includes(f.type)).flatMap((f:any)=>{const b=Buffer.from(f.data);a.equal(b.length%4,0);return Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));}));
  ensure(forms.every((id:number)=>id>>>24===0||map.has(id)),'INTEGRITY','Unresolved owned FormID');
  const reopened=await this.adapter({op:'inspect',path:this.snapshot(file).file});
  ensure(reopened.npcs.length===1&&reopened.outfits.length===1,'INTEGRITY','Mutagen roundtrip mismatch');
  if(p){const n=reopened.npcs[0];ensure(n.editorId===p.spec.editorId&&n.name===p.spec.displayName&&Math.abs(n.height-p.spec.height)<0.00001,'INTEGRITY','Authored values mismatch');
   ensure(canonical(n.headParts)===canonical(p.refs.headParts.map((h:any)=>h.formKey))&&n.race===p.refs.race.formKey,'INTEGRITY','Appearance references mismatch');
   ensure(canonical(reopened.outfits[0].items)===canonical(p.refs.armor.map((h:any)=>h.formKey)),'INTEGRITY','Outfit mismatch');}
  return {backend:'FROSTVEIL_VALIDATOR',valid:true,sha256:sha(bytes),...reopened,facts:{npc,outfit},independentParser:'existing catalog-loader authoredPluginRecords/nativeRecordReader',rendering:'PENDING_OWNER'};
 }
 async facegen(plugin:string,localId:number){
  const source=this.source(plugin),root=path.dirname(path.dirname(source)),local=localId.toString(16).padStart(8,'0');
  const nif=`Data/meshes/actors/character/FaceGenData/FaceGeom/${plugin}/${local}.nif`,dds=`Data/textures/actors/character/FaceGenData/FaceTint/${plugin}/${local}.dds`;
  const npc=(await this.inspect(plugin)).npcs.find((n:any)=>n.localId===localId&&!n.deleted);ensure(npc,'NOT_FOUND','Active NPC not found');
  if(!fs.existsSync(path.join(root,nif))||!fs.existsSync(path.join(root,dds)))return {backend:'FROSTVEIL_VALIDATOR',status:'MANUAL_REQUIRED',valid:false,expected:{nif,dds},reason:'Real CK export required; no placeholder assets generated'};
  const nb=readConfined(root,nif),db=readConfined(root,dds);
  const structure=require(path.join(repo,'rp-gamemode/scripts/g241b-nif-structure.cjs')).structure(nb);
  const tint=require(path.join(repo,'rp-gamemode/scripts/g241b-resources.cjs')).inspectFaceTintDds(db);
  const texturePath=require(path.join(repo,'rp-gamemode/scripts/g241b-resources.cjs')).shaderTexturePath;
  ensure(structure.sceneGraph.shapes.length&&structure.sceneGraph.skinInstances.length,'FACEGEN','Geometry/skin missing');
  const expected=dds.slice(5).toLowerCase();const matches=structure.textureSets.flatMap((t:any)=>t.textures).some((t:any)=>t.path&&texturePath(t.path)===expected);
  const evidence=require(path.join(repo,'rp-gamemode/research/g241b/g241c-evidence.json'));
  const known=plugin==='FrostveilNPCTest.esp'&&[ [nif,sha(nb)],[dds,sha(db)] ].every(([file,hash])=>evidence.assets.some((r:any)=>r.path===file&&r.sha256===hash));
  ensure(matches||known,'FACEGEN','FaceTint identity path mismatch; only exact previously reviewed bytes qualify for the existing fallback exception');
  return {backend:'FROSTVEIL_VALIDATOR',status:'PARTIAL',valid:true,expected:{nif,dds},sha256:{nif:sha(nb),dds:sha(db)},tint,tintIdentity:matches?'EXPLICIT_PATH_MATCH':'EXACT_KNOWN_EXISTING_FALLBACK_UNPROVEN',rendering:'PENDING_OWNER',limitations:'Existing bounded structural validator; no export provenance or Skyrim render proof'};
 }
 async invoke(name:ToolName,input:unknown,signal?:AbortSignal):Promise<any>{
  signal?.throwIfAborted();
  const args:any=schemas[name].parse(input);
  switch(name){
   case 'ck_capabilities':return {backend:'MUTAGEN_HEADLESS',headless:'HEADLESS_SUPPORTED',preset:'unique female Nord; vanilla headparts; Warlock Robes and Boots',native:'UNSUPPORTED',nativeBridgeInstalled:false,facegen:'MANUAL_REQUIRED',update:'HEADLESS_SUPPORTED_IMMUTABLE_REPLACEMENT_PLAN',promotion:'MANUAL_REQUIRED',screenControl:false};
   case 'ck_inspect_installation':return {backend:'MUTAGEN_HEADLESS',...await this.adapter({op:'installation',game}),editorControl:false};
   case 'ck_list_plugins':return {backend:'MUTAGEN_HEADLESS',plugins:['FrostveilNPCTest.esp',...new Set(this.artifacts().map(r=>r.plugin))]};
   case 'ck_list_npcs':return this.inspect(args.plugin);
   case 'ck_get_npc':{const r=await this.inspect(args.plugin);const npc=r.npcs.find((n:any)=>n.localId===args.localId);ensure(npc,'NOT_FOUND','NPC not found');return {backend:r.backend,sha256:r.sha256,npc};}
   case 'ck_list_outfits':{const r=await this.inspect(args.plugin);return {backend:r.backend,outfits:r.outfits};}
   case 'ck_plan_npc_creation':return this.plan(args);
   case 'ck_create_npc':return this.create(args,signal);
   case 'ck_update_npc':{
    ensure(args.plugin!=='FrostveilNPCTest.esp','PROTECTED','Existing approved source bases cannot be updated');
    const file=this.source(args.plugin);ensure(sha(safeRead(file))===args.expectedSha256,'CONFLICT','Revision hash mismatch');
    const receipt=this.artifacts().find(r=>r.plugin===args.plugin)!;const p=this.readPlan(receipt.planId);
    await this.validate(file,args.plugin,p);
    return {...await this.plan({...p.spec,displayName:args.displayName,height:args.height??p.spec.height}),replaces:{plugin:args.plugin,sha256:args.expectedSha256},notice:'Immutable replacement plan with NEW qualified identity. Call ck_create_npc after review. Does not alter the original artifact, approval, registry or running actors.'};
   }
   case 'ck_validate_plugin':{
    if(args.plugin==='FrostveilNPCTest.esp')return this.validateOriginal();
    const receipt=this.artifacts().find(r=>r.plugin===args.plugin);ensure(receipt,'NOT_FOUND','No artifact');return this.validate(this.source(args.plugin),args.plugin,this.readPlan(receipt.planId));
   }
   case 'ck_validate_facegen':return this.facegen(args.plugin,args.localId);
   case 'ck_export_facegen':return {backend:'MANUAL_REQUIRED',status:'MANUAL_REQUIRED',reason:'No safe callable native API proven for CK 1.7.99.0; CKPE Facegen uses private relocations and ListView selection. Owner must export NPC FaceGen in CK.',plugin:args.plugin,localId:args.localId};
   case 'ck_prepare_frostveil_import':{
    await this.invoke('ck_validate_plugin',{plugin:args.plugin},signal);
    const source=this.source(args.plugin),r=await this.inspect(args.plugin),faces=await Promise.all(r.npcs.filter((n:any)=>!n.deleted).map((n:any)=>this.facegen(args.plugin,n.localId)));
    return {backend:'FROSTVEIL_VALIDATOR',status:faces.every(f=>f.valid)?'PENDING_OWNER':'MANUAL_REQUIRED',sourceRoot:path.dirname(path.dirname(source)),plugin:args.plugin,sha256:r.sha256,facegen:faces,spawnable:false,registered:false,approved:false,steps:['Owner: export genuine FaceGen into source Data using defining plugin/local identity','Run existing scripts/npc-assets.cjs register <sourceRoot> <plugin> --review-local-source','Use existing G245 scan/stage/review/approve; unknown dependencies must fail closed','G246 runtime/owner identity gates unchanged; no automatic activation']};
   }
   case 'ck_get_operation_status':{const dir=this.operation(args.operationId);if(!fs.existsSync(dir))return {backend:'MUTAGEN_HEADLESS',status:'NOT_FOUND'};noLinks(dir);return fs.existsSync(path.join(dir,'receipt.json'))?this.receipt(args.operationId):{backend:'MUTAGEN_HEADLESS',status:fs.existsSync(path.join(dir,'failure.json'))?'FAILED':'INTERRUPTED_OR_RUNNING',evidencePreserved:true};}
  }
 }
 approvedCatalog(){
  const h=JSON.parse(safeRead(path.join(repo,'build/rp-audit/g241d/owner-handoff.json'),65536).toString());
  require(path.join(repo,'rp-gamemode/scripts/g241-dev.cjs')).guard(h.isolatedRoot);
  const config=JSON.parse(safeRead(path.join(h.isolatedRoot,'g241d-config.json'),1024*1024).toString());
  const catalog=readConfined(path.join(h.isolatedRoot,config.packageDirectory),'g241.json',128*1024);
  const expected=require(path.join(repo,'rp-gamemode/scripts/g241d-resources.cjs')).HASH;
  const c=JSON.parse(catalog.toString());
  ensure(require(path.join(pkg,'dist/template-catalog.cjs')).catalogHash(c)===expected&&c.catalogHash===expected,'TAMPER','Existing catalog approval hash mismatch');
  return c;
 }
 async validateOriginal(){
  const c=this.approvedCatalog(),file=this.source('FrostveilNPCTest.esp'),bytes=safeRead(file);
  ensure(c.plugins.some((p:any)=>p.filename==='FrostveilNPCTest.esp'&&p.sha256===sha(bytes)),'TAMPER','Original plugin differs from approved catalog');
  const records=loader.authoredPluginRecords(bytes,c.reviewedTombstones??[],'FrostveilNPCTest.esp',decode);
  return {...await this.inspect('FrostveilNPCTest.esp'),backend:'FROSTVEIL_VALIDATOR',valid:true,scope:'Existing owned record structure and explicitly approved tombstones; full resource closure remains G245',recordCount:records.length};
 }
 async call(name:ToolName,input:unknown,signal?:AbortSignal){
  ensure(this.active<2,'BUSY','At most two concurrent tool operations');this.active++;
  const operationId=randomUUID();const started=Date.now();let result:any;
  let failure:any;
  try {result=await this.invoke(name,input,signal);return {auditId:operationId,operationId,...result};}
  catch(e:any){failure={code:e.code??'VALIDATION',message:String(e.message).slice(0,2000)};throw e;}
  finally {
   this.active--;
   const dir=directory(this.root,'audit');
   exclusive(path.join(dir,operationId+'.json'),canonical({operationId,tool:name,requestHash:sha(JSON.stringify(input??null)),elapsedMs:Date.now()-started,status:result?.status??(result?'PASS':'FAILED'),failure:failure??null,time:new Date().toISOString()}));
  }
 }
}
