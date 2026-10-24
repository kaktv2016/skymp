const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function contained(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Deployment path outside approved root');
  for (let current = path.resolve(target); current.length >= path.resolve(root).length; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Deployment refuses a redirected/symlink path');
    if (current === path.resolve(root)) break;
  }
}
function atomicWrite(file, contents) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, contents, { flag: 'wx' });
  fs.renameSync(temporary, file);
}
function treeManifest(directory) {
  const items=[];
  const walk=(folder,prefix='')=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(folder,entry.name),relative=path.posix.join(prefix,entry.name);if(entry.isSymbolicLink())throw new Error('Deployment refuses a redirected asset');if(entry.isDirectory())walk(file,relative);else if(entry.isFile())items.push({path:relative,sha256:hash(file),size:fs.statSync(file).size});else throw new Error('Unexpected editor asset type');}};
  walk(directory);if(!items.some(item=>item.path==='index.html')||!items.some(item=>item.path.startsWith('assets/')&&/\.js$/.test(item.path))||!items.some(item=>item.path.startsWith('assets/')&&/\.css$/.test(item.path)))throw new Error('Blueprint editor build is incomplete');
  const bytes=items.reduce((sum,item)=>sum+item.size,0);if(bytes>3*1024*1024)throw new Error('Blueprint editor assets exceed deployment limit');
  return {items,sha256:crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex')};
}
function verifyTree(directory, expected) {
  const current=treeManifest(directory);if(current.sha256!==expected.sha256||JSON.stringify(current.items)!==JSON.stringify(expected.items))throw new Error('Editor asset bundle hash mismatch');
}
function deployBundle({ root, server, configFile, bundleFile, deploymentDir, backupDir, editorAssetsDir }) {
  for (const value of [server, configFile, bundleFile, deploymentDir, backupDir,...(editorAssetsDir?[editorAssetsDir]:[])]) contained(root, value);
  if (path.resolve(configFile) !== path.resolve(server, 'server-settings.json')) throw new Error('Unexpected configuration destination');
  const bundleSHA256 = hash(bundleFile);
  const deployedPath = path.resolve(deploymentDir, `${bundleSHA256}.cjs`);
  contained(root, deployedPath);
  let editorAssetTarget,editorManifest;
  if(editorAssetsDir){editorManifest=treeManifest(editorAssetsDir);editorAssetTarget=deployedPath.replace(/\.cjs$/,'.assets');contained(root,editorAssetTarget);if(fs.existsSync(editorAssetTarget))verifyTree(editorAssetTarget,editorManifest);else{fs.cpSync(editorAssetsDir,editorAssetTarget,{recursive:true,errorOnExist:true,force:false});verifyTree(editorAssetTarget,editorManifest);}}
  if (fs.existsSync(deployedPath) && hash(deployedPath) !== bundleSHA256) throw new Error('Immutable deployed bundle was modified');
  const recordFile = path.join(backupDir, 'deployment.json');
  if (fs.existsSync(recordFile)) {
    const old = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
    if (old.bundleSHA256 !== bundleSHA256 || old.configFile !== configFile || hash(configFile) !== old.newConfigSHA256) {
      throw new Error('Deployment record exists with different configuration; use a new backup directory');
    }
    return old;
  }
  const original = fs.readFileSync(configFile, 'utf8');
  const config = JSON.parse(original);
  if (!config || typeof config !== 'object' || Array.isArray(config) || typeof config.gamemodePath !== 'string') throw new Error('Invalid existing server configuration');
  const originalConfigSHA256 = hash(configFile);
  const previousGamemode = path.resolve(server, config.gamemodePath);
  contained(root, previousGamemode);
  if (!fs.statSync(previousGamemode).isFile()) throw new Error('Previous gamemode is not a file');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(deploymentDir, { recursive: true });
  const configBackup = path.join(backupDir, 'server-settings-before.json');
  const gamemodeBackup = path.join(backupDir, 'gamemode-before.js');
  fs.writeFileSync(configBackup, original, { flag: 'wx' });
  fs.copyFileSync(previousGamemode, gamemodeBackup, fs.constants.COPYFILE_EXCL);
  if (!fs.existsSync(deployedPath)) fs.copyFileSync(bundleFile, deployedPath, fs.constants.COPYFILE_EXCL);
  if (hash(deployedPath) !== bundleSHA256) throw new Error('Deployed bundle failed hash verification');
  const next = JSON.stringify({ ...config, gamemodePath: deployedPath }, null, 2) + '\n';
  if (hash(configFile) !== originalConfigSHA256) throw new Error('Configuration changed during deployment');
  const nextSHA256 = crypto.createHash('sha256').update(next).digest('hex');
  const record = { root, server, configFile, configBackup, previousGamemode, gamemodeBackup, previousGamemodeSHA256: hash(gamemodeBackup), originalConfigSHA256, newConfigSHA256: nextSHA256, bundleSHA256, deployedPath,...(editorAssetTarget?{editorAssetsPath:editorAssetTarget,editorAssetsSHA256:editorManifest.sha256,editorAssets:editorManifest.items}:{}), createdAt: new Date().toISOString() };
  // Preserve a usable rollback record before touching the active configuration.
  fs.writeFileSync(recordFile, JSON.stringify(record, null, 2), { flag: 'wx' });
  if (hash(configFile) !== originalConfigSHA256) throw new Error('Configuration changed during deployment');
  atomicWrite(configFile, next);
  return record;
}
function rollbackDeployment(record) {
  for (const value of [record.configFile, record.configBackup, record.previousGamemode, record.gamemodeBackup]) contained(record.root, value);
  const current = hash(record.configFile);
  if (current !== record.newConfigSHA256 && current !== record.originalConfigSHA256) throw new Error('Configuration changed since deployment; review before rollback');
  if (hash(record.configBackup) !== record.originalConfigSHA256 || hash(record.gamemodeBackup) !== record.previousGamemodeSHA256) throw new Error('Rollback backup was modified');
  if (hash(record.previousGamemode) !== record.previousGamemodeSHA256) throw new Error('Previous gamemode changed; review its backup before rollback');
  if (current !== record.originalConfigSHA256) atomicWrite(record.configFile, fs.readFileSync(record.configBackup));
  return { restoredGamemode: record.previousGamemode, worldRestored: false };
}
module.exports = { deployBundle, rollbackDeployment, hash, contained, treeManifest, verifyTree };
