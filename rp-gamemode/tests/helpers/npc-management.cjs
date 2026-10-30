const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),a=require('node:assert/strict');
const {NpcService}=require('../../.test-build/modules/npc/npc-service.js');
const {NpcTemplateCatalog}=require('../../.test-build/modules/npc/template-catalog.js');
const {NpcManagementService}=require('../../.test-build/modules/npc/management-service.js');
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-g244-'));let allowed=true,proof=true,isolated=true,integrity=true,guid='session-one',cell='3c:Skyrim.esm',pos=[10,20,30],count=0,now=1000;
 const forms=new Map(),writes=[];
 const approved=['guild-clerk','warrior'].map((id,i)=>({id,displayName:id,base:`${i?'5906':'5901'}:FrostveilNPCTest.esp`,baseId:0x6005901+i*5,assignment:{catalogId:'g241',catalogVersion:1,catalogHash:'a'.repeat(64),base:`${i?'5906':'5901'}:FrostveilNPCTest.esp`,assetManifestRevision:'assets-1'},details:{description:'Owned fixed variant',appearance:{race:i?'13744:Skyrim.esm':'13746:Skyrim.esm',sex:i?'male':'female',headParts:[]},fixedOutfit:{form:`${i?'5905':'5902'}:FrostveilNPCTest.esp`,items:[i?'13ed9:Skyrim.esm':'c5d11:Skyrim.esm']},weapon:null,requiredPlugin:'FrostveilNPCTest.esp',requiredPluginSHA256:'b'.repeat(64)}}));
 const catalog=new NpcTemplateCatalog([approved]);
 const native={makeProperty(){},lookupEspmRecordById:()=>({record:{type:'NPC_'}}),place(base){const id=0xff000001+count++;forms.set(id,{baseDesc:approved.find(t=>t.baseId===base)?.base??'39f83:Skyrim.esm'});return id;},setEnabled(id,v){forms.get(id).enabled=v;},get(id,k){return forms.get(id)?.[k];},set(id,k,v){a.ok(!['baseDesc','inventory','equipment','appearance'].includes(k));writes.push(k);forms.get(id)[k]=structuredClone(v);}};
 const adapter={sessionForActor:actor=>({guid:guid+actor,userId:actor,profileId:actor}),fullLocation:()=>({cell,pos:[...pos],rot:[15,0,80]})};
 const options={catalog,development:{isolationId:'g241-pair',templates:['guild-clerk','warrior'],qualifiedIdentity:true,verifyIsolated:()=>isolated,verifySession:()=>proof,canStream:()=>proof}};
 let npc,service;const start=()=>{npc=new NpcService(native,adapter,root,()=>allowed,()=>{},options);npc.start();service=new NpcManagementService(npc,adapter,()=>{if(!integrity)throw Error('Asset hash mismatch');},()=>({id:'courier-clerk',version:1}),()=>now);};start();
 t.after(()=>{npc.stop();fs.rmSync(root,{recursive:true,force:true});});
 const p={actor:1,principal:'owner',identity:'verified-session'},run=(op,input={},who=p)=>service.execute(op,input,who);
 const input=(operation='create',id='guild-clerk')=>{const s=run('snapshot'),n=s.npcs[0],t=s.templates.find(t=>t.id===id);return {operation,templateId:id,configurationId:id+':fixed',catalogHash:t.assignment.catalogHash,catalogVersion:1,name:'เจ้าหน้าที่กิลด์',npcId:operation==='create'?null:n.id,revisionToken:operation==='create'?null:n.revisionToken};};
 return {run,input,npc:()=>npc,native,forms,writes,root,count:()=>count,approved,adapter,advance:ms=>now+=ms,proof:v=>proof=v,allowed:v=>allowed=v,isolated:v=>isolated=v,integrity:v=>integrity=v,guid:v=>guid=v,cell:v=>cell=v,pos:v=>pos=v,restart:()=>{service.clear();npc.stop();start();}};
}
module.exports={setup};
