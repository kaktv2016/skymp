// Research only. Not imported by the gamemode, NPC catalog, Launcher or server startup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),audit=path.join(repo,'build/rp-audit/g240');
const server=path.join(repo,'build/dist/server');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function inside(root,file){const r=path.relative(root,file);return !!r&&!r.startsWith('..')&&!path.isAbsolute(r);}
function fixtureOnly(fixture){const root=fs.realpathSync(audit),real=fs.realpathSync(fixture);assert(inside(root,real),'Research fixture must be below g240 audit root');return real;}
function manifest(){
 const rows=[];const walk=file=>{if(!fs.existsSync(file))return;const s=fs.lstatSync(file);assert(!s.isSymbolicLink(),'Unexpected protected symlink');if(s.isDirectory()){for(const n of fs.readdirSync(file).sort())walk(path.join(file,n));}else rows.push({path:path.relative(repo,file),sha256:sha(fs.readFileSync(file))});};
 for(const n of ['server-settings.json','rp-world','rp-economy','rp-npcs','rp-npcs-dialogues','rp-blueprints'])walk(path.join(server,n));
 return rows;
}
function field(record,type){const f=record.fields.find(f=>f.type===type);return f?Buffer.from(f.data):null;}
function identify(mp,id,loadOrder){const r=mp.lookupEspmRecordById(id).record;assert(r,'Unresolved form');return {form:((id&0xffffff)>>>0).toString(16)+':'+path.basename(loadOrder[id>>>24]),type:r.type,editorId:r.editorId};}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function child(phase,requested){
 const fixture=fixtureOnly(requested),config=JSON.parse(fs.readFileSync(path.join(fixture,'settings.json'),'utf8'));
 assert.equal(config.g240ResearchOnly,true);assert.equal(config.listenHost,'127.0.0.1');assert.equal(config.uiListenHost,'127.0.0.1');assert.equal(config.offlineMode,true);
 assert.equal(config.databaseName,path.join(fixture,'world'));assert.equal(config.dataDir,path.join(fixture,'data'));assert.equal(config.gamemodePath,path.join(fixture,'disabled.cjs'));assert.notEqual(config.port,7777);
 assert.deepEqual(config.loadOrder.map(p=>path.basename(p)),['Skyrim.esm','Update.esm','Dawnguard.esm','HearthFires.esm','Dragonborn.esm']);
 process.chdir(fixture);
 const {ScampServer}=require(path.join(server,'scam_native.node'));
 const {NpcService}=require(path.join(repo,'rp-gamemode/.test-build/modules/npc/npc-service.js'));
 const mp=new ScampServer(JSON.stringify(config));mp._setSelf(mp);mp.attachSaveStorage();
 const logs=[],admin=0xfffffff0;let pos=[122694.9453125,-66909.78125,11639.1201171875];
 const adapter={sessionForActor:id=>{assert.equal(id,admin);return {guid:'g240-disposable-authority'};},fullLocation:()=>({cell:'3c:Skyrim.esm',pos:[...pos],rot:[0,0,0]})};
 const registry=new NpcService(mp,adapter,path.join(fixture,'npc-registry'),id=>id===admin,s=>logs.push(s));registry.start();
 assert(logs.some(s=>s.includes('ready definitions=')),'Real G2.1 registry failed to start');
 const run=(...args)=>{const r=registry.execute(admin,args);assert(r.ok,r.message);return r;};
 const getDefinition=()=>JSON.parse(run('info').data.systemMessage);
 let definitions,expected;
 if(phase==='write'){
  run('create','clerk');run('rename','G240 PoC A');const a=getDefinition();
  pos[0]+=128;run('create','clerk');run('rename','G240 PoC B');const b=getDefinition();definitions=[a,b];
  assert.notEqual(a.id,b.id);assert.notEqual(a.formId,b.formId);
  const base=mp.lookupEspmRecordById(0x39f83);assert.equal(base.record.type,'NPC_');
  const acbs=field(base.record,'ACBS'),rnam=field(base.record,'RNAM');assert(acbs&&rnam);
  const race=base.toGlobalRecordId(rnam.readUInt32LE(0));assert.equal(mp.lookupEspmRecordById(race).record.type,'RACE');
  const initial=definitions.map(d=>({inventory:mp.get(d.formId,'inventory'),equipment:mp.get(d.formId,'equipment')}));
  const candidates=[...new Set(initial.flatMap(v=>v.inventory.entries.map(e=>e.baseId)))].filter(id=>['ARMO','WEAP'].includes(mp.lookupEspmRecordById(id).record?.type));
  assert(candidates.length>=2,'Need two verified outfit/weapon records; do not guess IDs');
  const profiles=definitions.map((d,i)=>({isFemale:!!(acbs.readUInt32LE(0)&1),raceId:race,weight:i?75:25,skinColor:i?0x00a08060:0x00c8a080,hairColor:i?0x00443322:0x00221100,headpartIds:[],headTextureSetId:0,options:Array(19).fill(0),presets:Array(4).fill(0),tints:[],name:d.name}));
  // Numeric capability markers only: not a validated visual preset or a playable fixture.
  for(let i=0;i<2;i++)mp.set(definitions[i].formId,'appearance',profiles[i]);
  assert.deepEqual(mp.get(a.formId,'appearance'),profiles[0]);assert.deepEqual(mp.get(b.formId,'appearance'),profiles[1]);
  const inventoryPlans=candidates.slice(0,2).map(baseId=>({entries:[{baseId,count:1,worn:true}]}));
  for(let i=0;i<2;i++)mp.set(definitions[i].formId,'inventory',inventoryPlans[i]);
  const equipmentSetter=[];
  for(let i=0;i<2;i++){try{mp.set(definitions[i].formId,'equipment',{...initial[i].equipment,inv:inventoryPlans[i]});equipmentSetter.push('accepted');}catch(e){equipmentSetter.push(String(e.message));}}
  assert(equipmentSetter.every(s=>s!=='accepted'),'Unexpected equipment setter: stop and investigate');
  for(let i=0;i<2;i++)assert.deepEqual(mp.get(definitions[i].formId,'equipment'),initial[i].equipment,'Inventory writes must not be mistaken for equipment writes');
  expected={definitions,profiles,inventory:definitions.map(d=>mp.get(d.formId,'inventory')),equipment:definitions.map(d=>mp.get(d.formId,'equipment')),base:identify(mp,0x39f83,config.loadOrder),baseUnique:!!(acbs.readUInt32LE(0)&0x20),race:identify(mp,race,config.loadOrder),itemRecords:candidates.slice(0,2).map(id=>identify(mp,id,config.loadOrder)),equipmentSetter};
  fs.writeFileSync('expected.json',JSON.stringify(expected,null,2));
 }else{expected=JSON.parse(fs.readFileSync('expected.json','utf8'));definitions=expected.definitions;}
 for(let i=0;i<2;i++){
  const d=definitions[i];assert.equal(mp.get(d.formId,'private.frostveil.npc'),d.id);assert.equal(mp.get(d.formId,'baseDesc'),'39f83:Skyrim.esm');
  assert.deepEqual(mp.get(d.formId,'appearance'),expected.profiles[i]);assert.deepEqual(mp.get(d.formId,'inventory'),expected.inventory[i]);assert.deepEqual(mp.get(d.formId,'equipment'),expected.equipment[i]);
 }
 assert.equal(registry.listRegistered().length,2);assert.equal(mp.getAllForms(255).length,2,'Duplicate dynamic native actor');
 if(phase==='write'){
  const deadline=Date.now()+20000;let saved=false;
  while(Date.now()<deadline){mp.tick();await delay(10);const folder=path.join(config.databaseName,'changeForms');if(!fs.existsSync(folder))continue;const values=fs.readdirSync(folder).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(folder,n),'utf8')));if(values.filter(v=>v.appearanceDump&&v.dynamicFields?.['private.frostveil.npc']).length===2){saved=true;break;}}
  assert(saved,'Appearance/tag persistence timed out');
 }
 registry.stop();fs.writeFileSync(phase+'-result.json',JSON.stringify({phase,realNativeAddon:true,registeredNpcIds:definitions.map(d=>d.id),nativeForms:definitions.map(d=>d.formId),sharedBase:expected.base,distinctAppearanceData:true,distinctInventoryData:true,equipmentSetterRejected:true,equipmentUnchanged:true,actorCount:2,gameRendering:'UNVERIFIED',realMultiplayer:'UNVERIFIED',promotionEligible:false},null,2));
 process.exit(0);
}
function main(){
 assert.deepEqual(process.argv.slice(2),['--isolated'],'Research only: explicitly pass --isolated; never use live storage');
 fs.mkdirSync(audit,{recursive:true});const fixture=fs.mkdtempSync(path.join(audit,'native-'));const before=manifest();
 fs.writeFileSync(path.join(fixture,'live-before.json'),JSON.stringify(before,null,2));fs.mkdirSync(path.join(fixture,'data','scripts'),{recursive:true});
 const current=JSON.parse(fs.readFileSync(path.join(server,'server-settings.json'),'utf8'));
 const config={g240ResearchOnly:true,dataDir:path.join(fixture,'data'),loadOrder:current.loadOrder.slice(0,5),databaseDriver:'file',databaseName:path.join(fixture,'world'),listenHost:'127.0.0.1',uiListenHost:'127.0.0.1',offlineMode:true,port:18842,maxPlayers:2,npcEnabled:false,npcSettings:{},logLevel:'error',gamemodePath:path.join(fixture,'disabled.cjs')};
 fs.writeFileSync(config.gamemodePath,'// Isolated capability probe; not a gameplay server.\n');fs.writeFileSync(path.join(fixture,'settings.json'),JSON.stringify(config,null,2));
 for(const phase of ['write','reload']){
  const result=spawnSync(process.execPath,[__filename,'--child',phase,fixture],{cwd:fixture,encoding:'utf8',timeout:45000,windowsHide:true,maxBuffer:4*1024*1024});fs.writeFileSync(path.join(fixture,phase+'.log'),(result.stdout??'')+(result.stderr??''));assert.equal(result.status,0,phase+' failed; inspect '+path.join(fixture,phase+'.log'));
 }
 const after=manifest();fs.writeFileSync(path.join(fixture,'live-after.json'),JSON.stringify(after,null,2));
 const unchanged=JSON.stringify(before)===JSON.stringify(after);const summary={fixture,liveDataUnchanged:unchanged,protectedBeforeSHA256:sha(JSON.stringify(before)),protectedAfterSHA256:sha(JSON.stringify(after)),nativeWrite:JSON.parse(fs.readFileSync(path.join(fixture,'write-result.json'),'utf8')),nativeReload:JSON.parse(fs.readFileSync(path.join(fixture,'reload-result.json'),'utf8')),status:'DATA PATH VERIFIED; VISUAL TARGET BLOCKED/UNVERIFIED; NO DEPLOYMENT'};
 fs.writeFileSync(path.join(audit,'poc-summary.json'),JSON.stringify(summary,null,2));assert(unchanged,'Live state changed during research; preserve snapshots and investigate concurrent owner activity');console.log(JSON.stringify({fixture,liveDataUnchanged:unchanged,registeredActors:2,separateRestartProcess:true,promotionEligible:false}));
}
if(require.main===module){if(process.argv[2]==='--child')child(process.argv[3],process.argv[4]).catch(e=>{console.error(e.stack);process.exitCode=1;});else main();}
module.exports={inside,fixtureOnly};
