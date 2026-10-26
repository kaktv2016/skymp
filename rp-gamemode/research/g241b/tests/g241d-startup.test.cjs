const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const scripts=path.resolve(__dirname,'../../../scripts');
test('temporary gamemode loader resolves the validated root, passes isolation and starts once without recursive imports',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'g241d-loader-'));
 try{
  const settings={g241DevelopmentOnly:true,g241d:true,listenHost:'127.0.0.1',uiListenHost:'127.0.0.1',offlineMode:true,port:17777,maxPlayers:1,databaseName:path.join(root,'world'),dataDir:path.join(root,'data'),gamemodePath:path.join(root,'g241-bootstrap.cjs')};
  fs.writeFileSync(path.join(root,'server-settings.json'),JSON.stringify(settings));
  fs.copyFileSync(path.join(scripts,'g241-bootstrap.cjs'),settings.gamemodePath);
  fs.writeFileSync(path.join(root,'g241d-runtime.cjs'),`exports.start=(root,mp,isolated)=>{require('node:assert/strict').equal(isolated(root).port,17777);require('node:fs').appendFileSync(require('node:path').join(root,'calls'),'1');};`);
  fs.mkdirSync(path.join(root,'temp'));fs.copyFileSync(settings.gamemodePath,path.join(root,'temp','gamemode.js'));
  const result=spawnSync(process.execPath,['-e',"global.mp={};require('./temp/gamemode.js')"],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(fs.readFileSync(path.join(root,'calls'),'utf8'),'1');
  settings.listenHost='0.0.0.0';fs.writeFileSync(path.join(root,'server-settings.json'),JSON.stringify(settings));
  const bad=spawnSync(process.execPath,['-e',"global.mp={};require('./temp/gamemode.js')"],{cwd:root,encoding:'utf8'});assert.notEqual(bad.status,0);assert.equal(fs.readFileSync(path.join(root,'calls'),'utf8'),'1');
 }finally{assert(path.basename(root).startsWith('g241d-loader-')&&path.dirname(root)===os.tmpdir());fs.rmSync(root,{recursive:true});}
});
test('engine supervision preserves stdout, stderr and nonzero exit independently of PowerShell',async()=>{
 const {captureEngine}=require('../../../scripts/g241d-dev.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'g241d-capture-'));
 try{fs.mkdirSync(path.join(root,'dist_back'));fs.writeFileSync(path.join(root,'dist_back/skymp5-server.js'),"console.log('[g241d-stage] RESOURCE_CATALOG CHECK');console.log('engine stdout');console.error('engine fatal stack');process.exitCode=7;");
  const r=await captureEngine(root,path.join(root,'logs'),false);assert.equal(r.code,7);assert.equal(fs.readFileSync(r.stdout,'utf8'),'[g241d-stage] RESOURCE_CATALOG CHECK\nengine stdout\n');assert.equal(fs.readFileSync(r.stderr,'utf8'),'engine fatal stack\n');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'logs/exit.json'))).lastStage,{stage:'RESOURCE_CATALOG',state:'CHECK'});
 }finally{assert(path.basename(root).startsWith('g241d-capture-')&&path.dirname(root)===os.tmpdir());fs.rmSync(root,{recursive:true});}
});
