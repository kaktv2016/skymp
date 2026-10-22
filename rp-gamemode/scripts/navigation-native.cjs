// Real pinned server addon, disposable empty databases and fixture ports only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const project=path.resolve(__dirname,'..'),repo=path.dirname(project),asset=require('../../../mod-work/frostveil-courier-navigation/build.cjs');
const pluginPath=path.resolve(repo,'../mod-work/frostveil-courier-navigation/payload/Data',asset.plugin);
if(process.argv[2]==='--child'){
 const fixture=fs.realpathSync(process.argv[3]),settings=JSON.parse(fs.readFileSync(path.join(fixture,'settings.json')));assert.equal(path.dirname(settings.databaseName),fixture);process.chdir(fixture);
 const {ScampServer}=require(path.join(repo,'build/dist/server/scam_native.node')),mp=new ScampServer(JSON.stringify(settings));mp._setSelf(mp);mp.attachSaveStorage();
 const index=settings.loadOrder.length-1,results=[];
 for(const c of asset.catalogue){const q=mp.lookupEspmRecordById(index*0x1000000+c.quest),r=mp.lookupEspmRecordById(index*0x1000000+c.reference);assert.equal(q.record.type,'QUST');assert.equal(r.record.type,'REFR');assert.equal(q.fileIndex,index);const field=(rec,type)=>Buffer.from(rec.fields.find(f=>f.type===type).data);
  assert.equal(q.toGlobalRecordId(field(q.record,'ALFR').readUInt32LE(0)),index*0x1000000+c.reference);assert.equal(r.toGlobalRecordId(field(r.record,'NAME').readUInt32LE(0)),0x3b);
  const d=field(r.record,'DATA'),pos=[0,4,8].map(at=>d.readFloatLE(at));assert.deepEqual(pos,c.pos);
  // SkyMP intentionally skips STAT bases in WorldState::AttachEspmRecord.
  // Navigation markers must remain native client records, not replicated server objects.
  const neighbors=mp.getNeighborsByPosition(c.cell.replace('skyrim.esm','Skyrim.esm'),c.pos);assert.ok(!neighbors.includes(index*0x1000000+c.reference),'Invisible navigation marker unexpectedly replicated');
  results.push({key:c.key,globalQuest:(index*0x1000000+c.quest).toString(16),globalReference:(index*0x1000000+c.reference).toString(16),position:pos,notServerReplicated:true});
 }
 fs.writeFileSync('result.json',JSON.stringify({status:'PASS',nativeAddon:true,loadIndex:index,results,nativeClientQuestUI:'OWNER GAMEPLAY TEST PENDING'},null,2));process.exit(0);
}else{
 fs.mkdirSync(path.join(project,'.local/navigation-admin'),{recursive:true});const bytes=asset.buildPlugin();fs.mkdirSync(path.dirname(pluginPath),{recursive:true});fs.writeFileSync(pluginPath,bytes);
 const settings=JSON.parse(fs.readFileSync(path.join(repo,'build/dist/server/server-settings.json'))),root=fs.mkdtempSync(path.join(project,'.local/navigation-admin/native-'));
 for(const count of [1,5]){const fixture=path.join(root,'load-'+count);fs.mkdirSync(fixture);fs.cpSync(path.join(repo,'build/dist/server/data'),path.join(fixture,'data'),{recursive:true});
  const config={...settings,loadOrder:[...settings.loadOrder.slice(0,count),pluginPath],databaseDriver:'file',databaseName:path.join(fixture,'world'),port:17891+count,listenHost:'127.0.0.1',uiListenHost:'127.0.0.1',logLevel:'error',gamemodePath:path.join(fixture,'empty.js')};fs.writeFileSync(config.gamemodePath,'');fs.writeFileSync(path.join(fixture,'settings.json'),JSON.stringify(config));
  const run=spawnSync(process.execPath,[__filename,'--child',fixture],{cwd:fixture,timeout:45000,encoding:'utf8',windowsHide:true});fs.writeFileSync(path.join(fixture,'native.log'),(run.stdout??'')+(run.stderr??''));if(run.status!==0){console.error((run.stderr??'').slice(-3000));throw Error('Native ESP fixture failed; inspect '+fixture);}
 }
 console.log(JSON.stringify({status:'PASS',root,loadIndices:[1,5],nativeRecordMapping:true,invisibleMarkersNotReplicated:true,nativeClientUI:'MANUAL PENDING'}));
}
