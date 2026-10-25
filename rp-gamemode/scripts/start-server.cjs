const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawnSync}=require('node:child_process');
const {contained,hash,treeManifest}=require('./deployment.cjs');
const {assertServerStopped}=require('./server-stopped.cjs');

function prepareStartup(root){
 root=path.resolve(root);
 const server=path.join(root,'build/dist/server'),settings=path.join(server,'server-settings.json'),entry=path.join(server,'dist_back/skymp5-server.js');
 for(const file of [settings,entry])contained(root,file);
 if(!fs.existsSync(entry)||!fs.statSync(entry).isFile())throw Error('Server entry is missing; build or restore the server first');
 const config=JSON.parse(fs.readFileSync(settings,'utf8'));
 if(config.listenHost!=='127.0.0.1'||config.uiListenHost!=='127.0.0.1'||config.offlineMode!==true||config.enableConsoleCommandsForAll!==false||config.port!==7777)throw Error('This command supports the verified Frostveil local test server only');
 if(typeof config.gamemodePath!=='string')throw Error('Missing selected deployment');
 const gamemode=path.resolve(server,config.gamemodePath),name=path.basename(gamemode),directory=path.join(root,'rp-gamemode/deployed');
 if(path.relative(directory,path.dirname(gamemode))!==''||!/^[a-f0-9]{64}\.cjs$/.test(name))throw Error('Unexpected selected deployment path');
 contained(root,gamemode);
 if(hash(gamemode)!==name.slice(0,64))throw Error('Deployed bundle hash mismatch');
 const assets=gamemode.replace(/\.cjs$/,'.assets'),expected=/^\/\/ Frostveil editor assets SHA256: ([a-f0-9]{64})\r?\n/.exec(fs.readFileSync(gamemode,'utf8'))?.[1];
 contained(root,assets);
 if(!expected||treeManifest(assets).sha256!==expected)throw Error('Editor asset bundle hash mismatch');
 const log=path.join(root,'build/rp-audit/server/server-console.log');contained(root,log);
 return {root,server,entry,config,gamemode,log};
}
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function powershellCommand(plan,node=process.execPath){return `$ErrorActionPreference='Stop'
Set-Location -LiteralPath ${quote(plan.server)}
$env:FROSTVEIL_BEACON_PREVIEW='1'
$env:FROSTVEIL_ADMIN_LOCAL='1'
$env:FROSTVEIL_BLUEPRINT_EDITOR='1'
$global:LASTEXITCODE=1
$ErrorActionPreference='Continue'
& ${quote(node)} ${quote(plan.entry)} 2>&1 | Tee-Object -FilePath ${quote(plan.log)} -Append
exit $LASTEXITCODE
`;}
async function assertAvailable(config){
 await assertServerStopped(config);
 await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',error=>reject(Error('Editor port 3210 is occupied: '+error.code)));server.listen(3210,'127.0.0.1',()=>server.close(resolve));});
}
async function startServer(root,{guard=assertAvailable,launch=spawnSync}={}){
 const plan=prepareStartup(root);await guard(plan.config);
 fs.mkdirSync(path.dirname(plan.log),{recursive:true});
 console.log('Frostveil local server · Ctrl+C to stop\nSelected bundle: '+path.basename(plan.gamemode)+'\nConsole log: '+plan.log);
 const result=launch('powershell.exe',['-NoProfile','-Command',powershellCommand(plan)],{cwd:plan.server,stdio:'inherit',windowsHide:false});
 if(result.error)throw result.error;
 return result.status??1;
}
if(require.main===module)(async()=>{
 const args=process.argv.slice(2),root=path.resolve(__dirname,'../..');
 if(args.length&&(args.length!==1||args[0]!=='--check'))throw Error('Usage: server [--check]');
 if(args[0]==='--check'){const plan=prepareStartup(root);console.log(JSON.stringify({verifiedFiles:true,server:plan.server,gamemode:plan.gamemode,log:plan.log},null,2));return;}
 process.exitCode=await startServer(root);
})().catch(error=>{console.error('Frostveil: '+error.message);process.exitCode=1;});
module.exports={prepareStartup,powershellCommand,startServer};
