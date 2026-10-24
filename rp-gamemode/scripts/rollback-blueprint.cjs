const fs = require('node:fs');
const path = require('node:path');
const { rollbackDeployment, contained, hash, verifyTree } = require('./deployment.cjs');
const { assertServerStopped } = require('./server-stopped.cjs');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--record') throw new Error('Usage: rollback-blueprint.cjs --record <G2.3 deployment.json>');
  const recordPath = path.resolve(root, args[1]);
  const auditRoot = path.join(root, 'build/rp-audit/g23');
  contained(root, recordPath);
  if (path.relative(auditRoot, recordPath).startsWith('..')) throw new Error('Rollback record must belong to the G2.3 audit directory');
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const expectedConfig = path.join(root, 'build/dist/server/server-settings.json');
  const deployedPath = path.resolve(record.deployedPath || '');
  contained(root, deployedPath);
  const editorAssetsPath = path.resolve(record.editorAssetsPath || '');
  contained(root, editorAssetsPath);
  if (record.root !== root || record.configFile !== expectedConfig ||
      path.dirname(deployedPath) !== path.join(root, 'rp-gamemode/deployed') ||
      editorAssetsPath !== deployedPath.replace(/\.cjs$/, '.assets') ||
      !/^[a-f0-9]{64}$/.test(record.bundleSHA256) || hash(deployedPath) !== record.bundleSHA256 ||
      !Array.isArray(record.editorAssets) || typeof record.editorAssetsPath !== 'string') {
    throw new Error('Unexpected G2.3 rollback record');
  }
  verifyTree(editorAssetsPath, { items: record.editorAssets, sha256: record.editorAssetsSHA256 });
  await assertServerStopped(JSON.parse(fs.readFileSync(record.configFile, 'utf8')));
  console.log(JSON.stringify(rollbackDeployment(record), null, 2));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
