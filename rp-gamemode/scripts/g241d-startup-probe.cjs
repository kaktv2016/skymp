'use strict';
// Server-only diagnostic. No client/profile activation, no admin, no custom spawn.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {guard,manifest}=require('./g241-dev.cjs'),{rootConfig,captureEngine}=require('./g241d-dev.cjs');
const repo=path.resolve(__dirname,'../..'),audit=path.join(repo,'build/rp-audit/g241d'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function diagnosticRuntime(root,source,mp){
 const settings=JSON.parse(fs.readFileSync(path.join(source,'server-settings.json'))),probe=JSON.parse(fs.readFileSync(path.join(root,'server-settings.json')));
 const validateProbe=()=>{assert.equal(path.dirname(fs.realpathSync(root)),path.join(repo,'build/rp-audit/g241'));assert.equal(probe.g241DevelopmentOnly,true);assert.equal(probe.maxPlayers,1);assert.equal(probe.offlineMode,true);assert.equal(probe.listenHost,'127.0.0.1');assert.equal(probe.uiListenHost,'127.0.0.1');assert.equal(probe.port,17777);assert.equal(probe.databaseName,path.join(root,'world'));assert.equal(probe.dataDir,path.join(root,'data'));assert.equal(probe.gamemodePath,path.join(root,'g241-bootstrap.cjs'));return true;};
 validateProbe();assert.deepEqual(probe.loadOrder,settings.loadOrder);
 const c=JSON.parse(fs.readFileSync(path.join(source,'g241d-config.json'))),{createDevelopmentVerifier}=require('./g241d-resources.cjs');
 const {loadApprovedCatalog}=require(path.join(source,'runtime/modules/npc/catalog-loader.js'));
 const catalog=loadApprovedCatalog(path.join(source,c.packageDirectory),[{filename:'g241.json',sha256:c.policy.catalogHash}],settings.loadOrder,mp,createDevelopmentVerifier({root:source,packageRoot:path.join(source,c.packageDirectory),dataRoot:path.join(c.game,'Data'),evidence:c.resourceEvidence,policy:c.policy,verifyIsolation:validateProbe}));
 const {createRuntime}=require(path.join(source,'runtime/runtime.js'));
 const runtime=createRuntime(mp,{npc:{storageRoot:path.join(root,'npc-registry'),templateOptions:{catalog,development:{isolationId:'g241-pair',templates:['guild-clerk','warrior'],verifyIsolated:validateProbe}},developmentIdentity:{spec:c.identitySpec,verifyProfile:()=>false}},admin:{authorize:()=>null}});
 await runtime.start();assert.equal(mp.getAllForms(255).length,0);
 const denied=await runtime.commands.dispatch('/npc fixture create',{actorId:0xff000000});assert.equal(denied.ok,false);assert.equal(mp.getAllForms(255).length,0);
 fs.writeFileSync(path.join(root,'data/g241d-health.json'),JSON.stringify({status:'DIAGNOSTIC_ONLY_PROFILE_INACTIVE',startupId:process.env.FROSTVEIL_G241D_STARTUP_ID,pid:process.pid,catalogHash:c.policy.catalogHash,profileHash:c.profileHash,customAutoSpawns:0}));
 console.log('[g241d-probe] diagnostic-only runtime booted; no owner profile, no admin, no fixtures');
}
async function run(source){
 source=rootConfig(source).root;const before=manifest(),handoff=JSON.parse(fs.readFileSync(path.join(audit,'owner-handoff.json')));
 for(const a of handoff.artifacts)assert.equal(sha(fs.readFileSync(path.join(source,a.path))),a.sha256,'Source runtime seal changed');
 const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const query="[bool]((Get-NetUDPEndpoint -LocalPort 17777 -ErrorAction SilentlyContinue) -or (Get-NetTCPConnection -LocalPort 17778 -State Listen -ErrorAction SilentlyContinue)) | ConvertTo-Json -Compress";
 const idle=()=>assert.equal(execFileSync(shell,['-NoProfile','-NonInteractive','-Command',query],{encoding:'utf8',windowsHide:true}).trim(),'false','Diagnostic ports are occupied; no process touched');idle();
 const root=fs.mkdtempSync(path.join(path.dirname(source),'dev-')),settings={...JSON.parse(fs.readFileSync(path.join(source,'server-settings.json'))),databaseName:path.join(root,'world'),dataDir:path.join(root,'data'),gamemodePath:path.join(root,'g241-bootstrap.cjs')};
 fs.mkdirSync(path.join(settings.dataDir,'scripts'),{recursive:true});fs.mkdirSync(path.join(root,'dist_back'));
 for(const f of ['scam_native.node','dist_back/skymp5-server.js','dist_back/skymp5-server.js.map'])fs.copyFileSync(path.join(source,f),path.join(root,f));
 fs.writeFileSync(path.join(root,'server-settings.json'),JSON.stringify(settings,null,2));
 fs.writeFileSync(settings.gamemodePath,`require(${JSON.stringify(__filename)}).diagnosticRuntime(process.cwd(),${JSON.stringify(source)},global.mp).catch(e=>{console.error(e);process.exit(1);});`);
 const startup=path.join(root,'start-diagnostic.ps1');fs.writeFileSync(startup,`$ErrorActionPreference='Stop'\n& '${process.execPath.replaceAll("'","''")}' '${__filename.replaceAll("'","''")}' supervise '${root.replaceAll("'","''")}'\nexit $LASTEXITCODE\n`);
 const startupId=crypto.randomUUID();const child=spawn(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',startup],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,FROSTVEIL_G241D_STARTUP_ID:startupId}});
 let result;
 try{
  const {inspectProcess,evaluateStartup}=await import(pathToFileURL(path.resolve(repo,'../skyrim-rp-launcher/scripts/npc-startup.mjs')).href);
  const deadline=Date.now()+20000;let health;
  while(Date.now()<deadline){try{const response=await fetch('http://127.0.0.1:17778/g241d-health.json',{signal:AbortSignal.timeout(1000)});if(response.ok){health=await response.json();break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.equal(health?.status,'DIAGNOSTIC_ONLY_PROFILE_INACTIVE','Diagnostic engine did not boot; inspect '+path.join(root,'logs'));
  const expected={childPid:child.pid,startupId,profileHash:handoff.profileHash,catalogHash:handoff.catalogHash};
  const snapshot=await inspectProcess({pid:health.pid,expected,root,startScript:startup,serveScript:__filename});
  assert.equal(evaluateStartup({health,httpStatus:200,snapshot,expected}).stage,'HEALTH_CONTRACT','Diagnostic health must NEVER authorize real Play');
  // Structural ownership check only: not a claim that an active owner profile exists.
  const ownership=evaluateStartup({health:{...health,status:'SAFE_WAITING'},httpStatus:200,snapshot,expected});assert.equal(ownership.ok,true,JSON.stringify(ownership));
  result={root,source,health,snapshot,nativeEngine:'PASS',catalogAndRuntimeBoot:'PASS',processAndPortOwnership:'PASS',diagnosticRejectedByPlay:true,customActorsCreated:0,actualOwnerActivation:'NOT_EXERCISED'};
 }finally{
  if(child.pid)execFileSync(shell,['-NoProfile','-NonInteractive','-Command',"$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$env:FV_DIAG_PID); if($p){if($p.Name -ne 'powershell.exe' -or !$p.CommandLine.Contains($env:FV_DIAG_SCRIPT)){throw 'Diagnostic process identity changed'}; & taskkill.exe /PID $p.ProcessId /T /F | Out-Null; if($LASTEXITCODE -ne 0){throw 'Diagnostic cleanup failed'}}"],{env:{...process.env,FV_DIAG_PID:String(child.pid),FV_DIAG_SCRIPT:startup},windowsHide:true});
  await new Promise(r=>setTimeout(r,300));idle();assert.deepEqual(manifest(),before);
 }
 result.shutdown='PASS; both diagnostic ports released';result.productionUnchanged=true;fs.writeFileSync(path.join(audit,'hotfix-server-probe.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
if(require.main===module){const[command,root]=process.argv.slice(2);if(command==='supervise')captureEngine(guard(root).root,path.join(root,'logs')).then(r=>{process.exitCode=r.code;}).catch(e=>{console.error(e);process.exitCode=1;});else if(command==='run')run(root).catch(e=>{console.error(e);process.exitCode=1;});else throw Error('Usage: g241d-startup-probe.cjs run <existing isolated root>');}
module.exports={diagnosticRuntime,run};
