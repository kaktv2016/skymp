// Disposable native actor/world only. No connections, production writes or game launch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const project=path.resolve(__dirname,'..'),repo=path.dirname(project),addon=path.join(repo,'build/dist/server/scam_native.node'),bundle=path.join(project,'dist/rp-gamemode.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function copiedPlayer(world){const files=fs.readdirSync(path.join(world,'changeForms')).filter(n=>n.endsWith('.json')).map(n=>path.join(world,'changeForms',n)).filter(f=>JSON.parse(fs.readFileSync(f)).profileId===1);assert.equal(files.length,1);return files[0];}
async function child(phase,fixture){
 assert.ok(path.relative(path.join(repo,'build/rp-audit/g13'),fixture)&&!path.relative(path.join(repo,'build/rp-audit/g13'),fixture).startsWith('..'));
 process.chdir(fixture);const config=JSON.parse(fs.readFileSync('settings.json'));assert.equal(config.databaseName,path.join(fixture,'world'));
 const {ScampServer}=require(addon),mp=new ScampServer(JSON.stringify(config));mp._setSelf(mp);mp.attachSaveStorage();
 const f=require(bundle),actors=mp.getActorsByProfileId(1);assert.equal(actors.length,1);const actor=actors[0],initialLocation=mp.get(actor,'locationalData');
 const physical=()=>Object.fromEntries(['profileId','inventory','equipment','appearance'].map(k=>[k,mp.get(actor,k)]));
 if(phase==='write')fs.writeFileSync('physical-before.json',JSON.stringify(physical()));else assert.deepEqual(physical(),JSON.parse(fs.readFileSync('physical-before.json')));
 const route={id:'fixture-courier',displayName:'native test',pickup:{label:'pickup',cell:initialLocation.cellOrWorldDesc,pos:initialLocation.pos},delivery:{label:'delivery',cell:initialLocation.cellOrWorldDesc,pos:[initialLocation.pos[0]+1000,initialLocation.pos[1],initialLocation.pos[2]]},radius:10,reputationReward:1};
 let now=Date.now(),guid='fixture-session';
 // Native persistence/location/actor reads, with explicitly synthetic connection
 // bindings for command dispatch. This is not a real network/client login test.
 const facade={get:(id,k)=>k==='onlinePlayers'?[actor]:mp.get(id,k),set:mp.set.bind(mp),getActorName:mp.getActorName.bind(mp),getDescFromId:mp.getDescFromId.bind(mp),getUserByActor:id=>id===actor?0:65535,getUserActor:()=>actor,getUserGuid:()=>guid,isConnected:()=>true,makeProperty:mp.makeProperty.bind(mp),makeEventSource:mp.makeEventSource.bind(mp)};
 const runtime=f.createRuntime(facade,{courier:{route},economy:{storageRoot:path.join(fixture,'economy'),now:()=>now},scheduler:{every:()=>()=>{}},logger:{info(){},error(){}}});await runtime.start();
 const send=async text=>{now+=1000;return runtime.commands.dispatch(text,{actorId:actor});};
 const move=point=>mp.set(actor,'locationalData',{...initialLocation,cellOrWorldDesc:point.cell,pos:point.pos});
 const earn=async()=>{move(route.pickup);assert.equal((await send('/job accept')).ok,true);move(route.delivery);assert.equal((await send('/job deliver')).ok,true);};
 if(phase==='write'){
  // Existing progress, not free money: only disposable actor metadata is seeded.
  mp.set(actor,'private.rp.v1.courier',{schemaVersion:1,lifecycle:'idle',activeContractId:null,completedDeliveries:7,reputation:7});
  assert.equal(runtime.economy.inspect(actor).balance,0);
  for(let i=0;i<8;i++)await earn();assert.equal(runtime.economy.inspect(actor).balance,200);
  assert.equal((await send('/job upgrade satchel')).ok,true);assert.equal(runtime.economy.inspect(actor).balance,100);assert.equal((await send('/job guild buy regional')).ok,true);assert.equal(runtime.economy.inspect(actor).balance,0);await earn();
  guid='fixture-reconnected';assert.match((await send('/wallet')).data.systemMessage,/30 RP/);
  const state=runtime.economy.inspect(actor);assert.equal(state.satchelLevel,1);assert.equal(state.balance,30);assert.equal(state.progression.xp,90);assert.deepEqual(state.progression.permits,['regional']);assert.equal(state.courier.completedDeliveries,16);fs.writeFileSync('expected-economy.json',JSON.stringify(state));move(route.pickup);
  const deadline=Date.now()+20000;let saved=false;while(Date.now()<deadline){mp.tick();await delay(10);const value=JSON.parse(fs.readFileSync(copiedPlayer(config.databaseName)));if(value.dynamicFields?.['private.rp.v1.courier']?.completedDeliveries===16){saved=true;break;}}assert.ok(saved,'Native Courier mirror did not persist');
 }else{
  assert.equal(mp.get(actor,'private.rp.v1.courier').completedDeliveries,phase==='reload'?7:16,'Fixture reload must observe the intended native save version');
  assert.deepEqual(runtime.economy.inspect(actor),JSON.parse(fs.readFileSync('expected-economy.json')));move(route.delivery);assert.equal((await send('/job deliver')).ok,false);assert.equal(runtime.economy.inspect(actor).balance,30);assert.equal((await send('/job upgrade satchel')).ok,false);move(route.pickup);
 }
 const persistedDeadline=Date.now()+20000;let confirmed=false;while(Date.now()<persistedDeadline){mp.tick();await delay(10);if(JSON.parse(fs.readFileSync(copiedPlayer(config.databaseName))).dynamicFields?.['private.rp.v1.courier']?.completedDeliveries===16){confirmed=true;break;}}assert.ok(confirmed,'Reconciled native mirror did not persist');
 assert.deepEqual(physical(),JSON.parse(fs.readFileSync('physical-before.json')));await runtime.stop();fs.writeFileSync(phase+'-result.json',JSON.stringify({phase,nativeAddon:true,realNativeLocation:true,journalBalance:30,satchel:1,completed:16,courierXP:90,permits:['regional'],networkAuthentication:'SYNTHETIC FIXTURE ONLY',physicalInventoryEquipmentAppearance:'UNCHANGED'}));process.exit(0);
}
function main(){
 const root=path.join(repo,'build/rp-audit/g13');fs.mkdirSync(root,{recursive:true});const fixture=fs.mkdtempSync(path.join(root,'native-'));
 const prior=fs.readFileSync(path.join(repo,'build/rp-audit/phase21/current-audit.txt'),'utf8').trim();const rel=path.relative(path.join(repo,'build/rp-audit/phase21'),prior);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));
 fs.cpSync(path.join(prior,'before/rp-world'),path.join(fixture,'world'),{recursive:true,force:false,errorOnExist:true});fs.cpSync(path.join(repo,'build/dist/server/data'),path.join(fixture,'data'),{recursive:true,force:false,errorOnExist:true});
 const config=JSON.parse(fs.readFileSync(path.join(prior,'before/server-settings.json')));Object.assign(config,{databaseDriver:'file',databaseName:path.join(fixture,'world'),port:17779,listenHost:'127.0.0.1',uiListenHost:'127.0.0.1',logLevel:'error'});fs.writeFileSync(path.join(fixture,'settings.json'),JSON.stringify(config));
 for(const phase of ['write','reload','reload-again']){
  if(phase==='reload'){const file=copiedPlayer(config.databaseName),state=JSON.parse(fs.readFileSync(file));state.dynamicFields['private.rp.v1.courier']={schemaVersion:1,lifecycle:'idle',activeContractId:null,completedDeliveries:7,reputation:7};fs.writeFileSync(file,JSON.stringify(state));}
  const run=spawnSync(process.execPath,[__filename,'--child',phase,fixture],{cwd:fixture,encoding:'utf8',timeout:40000,windowsHide:true});fs.writeFileSync(path.join(fixture,phase+'.log'),(run.stdout??'')+(run.stderr??''));assert.equal(run.status,0,phase+' failed: '+fixture);
 }
 const report={status:'PASS',fixture,actualNativeServerProcesses:3,separateSaveReload:true,realNativeLocation:true,courierMigration:true,paidOnce:true,balance:30,satchelLevel:1,courierXP:90,permits:['regional'],completedDeliveries:16,restartReplayRejected:true,rolledBackNativeMirrorReconciled:true,inventoryEquipmentAppearancePreserved:true,realClient:'MANUAL ACCEPTANCE PENDING',realWorldWrites:false};fs.writeFileSync(path.join(fixture,'summary.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(root,'native-latest.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
if(process.argv[2]==='--child')child(process.argv[3],path.resolve(process.argv[4])).catch(e=>{console.error(e);process.exit(1);});else main();
