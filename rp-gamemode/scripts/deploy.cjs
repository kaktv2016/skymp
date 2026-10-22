const fs = require('node:fs');
const path = require('node:path');
const { deployBundle, contained } = require('./deployment.cjs');
const { assertServerStopped } = require('./server-stopped.cjs');
const { assertLauncherBaseline } = require('./verify-launcher-baseline.cjs');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const server = path.join(root, 'build/dist/server');
  const configFile = path.join(server, 'server-settings.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const launcherBefore = assertLauncherBaseline();
  await assertServerStopped(config);
  const project = path.resolve(__dirname, '..');
  const audit = fs.readFileSync(path.join(root, 'build/rp-audit/phase21/current-audit.txt'), 'utf8').trim();
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--label' || !/^[a-z][a-z0-9-]{0,40}$/.test(args[1]))) throw new Error('Usage: deploy.cjs [--label phase22]');
  const backupDir = args.length ? path.join(audit, 'deployments', args[1]) : path.join(audit, 'deployment');
  contained(root, backupDir);
  if (args.length && !fs.existsSync(path.join(backupDir, 'deployment.json'))) {
    // User runs only after server/game stop. Preserve current progress, not the
    // earlier Phase 2.1 snapshot; never restore/delete this world automatically.
    const world = path.resolve(server, config.databaseName);
    contained(root, world);
    const backupWorld = path.join(backupDir, 'world-before');
    if (fs.existsSync(backupWorld)) throw new Error('Incomplete backup exists; preserve it and select a new deployment label');
    fs.mkdirSync(backupDir, { recursive:true });
    fs.cpSync(world, backupWorld, { recursive:true, force:false, errorOnExist:true });
  }
  const result = deployBundle({ root, server, configFile, bundleFile: path.join(project, 'dist/rp-gamemode.cjs'), deploymentDir: path.join(project, 'deployed'), backupDir });
  const launcherAfter = assertLauncherBaseline();
  if (launcherBefore.status !== launcherAfter.status || launcherBefore.sha256 !== launcherAfter.sha256) throw new Error('Launcher/client baseline changed during server deployment; preserve backups and investigate');
  console.log(JSON.stringify({ deployedPath: result.deployedPath, bundleSHA256: result.bundleSHA256, rollbackRecord: path.join(backupDir, 'deployment.json'), worldChangedByDeployment: false }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
