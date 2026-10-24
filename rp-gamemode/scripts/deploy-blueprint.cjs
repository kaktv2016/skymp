const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { deployBundle, contained, hash } = require('./deployment.cjs');
const { assertServerStopped } = require('./server-stopped.cjs');

function dataManifest(root, locations) {
  const files=[];
  const walk=(target,relative)=>{
    const stat=fs.lstatSync(target);if(stat.isSymbolicLink())throw Error('Protected data path contains a symlink');
    if(stat.isFile()){files.push({path:relative,sha256:hash(target),size:stat.size});return;}
    if(!stat.isDirectory())throw Error('Unexpected protected data file type');
    for(const entry of fs.readdirSync(target).sort())walk(path.join(target,entry),path.posix.join(relative,entry));
  };
  for(const location of locations){contained(root,location);if(fs.existsSync(location))walk(location,path.relative(root,location).split(path.sep).join('/'));}
  files.sort((a,b)=>a.path.localeCompare(b.path));
  return {files,sha256:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')};
}

async function main(){
  const root=path.resolve(__dirname,'../..'),server=path.join(root,'build/dist/server'),configFile=path.join(server,'server-settings.json');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(config.listenHost!=='127.0.0.1'||config.uiListenHost!=='127.0.0.1'||config.offlineMode!==true||config.enableConsoleCommandsForAll!==false)throw Error('Unexpected local test server configuration');
  // This deployment changes only the local server bundle and editor assets; no client or Launcher files are touched.
  await assertServerStopped(config);
  const source=path.resolve(__dirname,'..'),audit=path.join(root,'build/rp-audit/g23/deploy-'+Date.now());contained(root,audit);fs.mkdirSync(audit,{recursive:true});
  const protectedPaths=['rp-world','rp-economy','rp-npcs','rp-npcs-dialogues'];
  const locations=protectedPaths.map(name=>path.join(server,name)).filter(fs.existsSync);
  // Preserve earlier editor authoring data too; a first deployment may create this isolated root.
  const editorData=path.join(server,'rp-blueprints');if(fs.existsSync(editorData))locations.push(editorData);
  const before=dataManifest(root,locations);fs.writeFileSync(path.join(audit,'protected-data-before.json'),JSON.stringify({createdAt:new Date().toISOString(),locations:locations.map(p=>path.relative(root,p)),...before},null,2),{flag:'wx'});
  const result=deployBundle({root,server,configFile,bundleFile:path.join(source,'dist/rp-gamemode.cjs'),deploymentDir:path.join(source,'deployed'),backupDir:audit,editorAssetsDir:path.join(root,'blueprint-editor/dist')});
  const after=dataManifest(root,locations);if(before.sha256!==after.sha256)throw Error('Protected world/economy/NPC/dialogue data changed during code deployment');
  fs.writeFileSync(path.join(audit,'protected-data-after.json'),JSON.stringify({createdAt:new Date().toISOString(),...after},null,2),{flag:'wx'});
  const script=path.join(audit,'start-visible.ps1'),log=path.join(audit,'server-console.log');
  const escaped=(value)=>value.replaceAll("'","''");
  const powershell=`$ErrorActionPreference='Continue'\n$Host.UI.RawUI.WindowTitle='Frostveil G2.3 Blueprint Studio'\nSet-Location -LiteralPath '${escaped(server)}'\n$env:FROSTVEIL_BEACON_PREVIEW='1'\n$env:FROSTVEIL_ADMIN_LOCAL='1'\n$env:FROSTVEIL_BLUEPRINT_EDITOR='1'\n& 'C:\\Program Files\\nodejs\\node.exe' 'dist_back/skymp5-server.js' 2>&1 | Tee-Object -FilePath '${escaped(log)}'\nWrite-Host 'Server stopped.'\n`;
  fs.writeFileSync(script,powershell,{flag:'wx'});
  const record={deployedAt:new Date().toISOString(),clientFilesChanged:false,bundleSHA256:result.bundleSHA256,deployedPath:result.deployedPath,editorAssetsPath:result.editorAssetsPath,editorAssetsSHA256:result.editorAssetsSHA256,rollbackRecord:path.join(audit,'deployment.json'),startScript:script,serverLog:log,protectedManifestBefore:path.join(audit,'protected-data-before.json'),protectedManifestAfter:path.join(audit,'protected-data-after.json')};
  fs.writeFileSync(path.join(audit,'active-deployment.json'),JSON.stringify(record,null,2),{flag:'wx'});
  console.log(JSON.stringify(record,null,2));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
