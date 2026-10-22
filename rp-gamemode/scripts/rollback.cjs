const fs = require('node:fs');
const path = require('node:path');
const { rollbackDeployment } = require('./deployment.cjs');
const { assertServerStopped } = require('./server-stopped.cjs');
async function main() {
  const root = path.resolve(__dirname, '../..');
  const audit = fs.readFileSync(path.join(root, 'build/rp-audit/phase21/current-audit.txt'), 'utf8').trim();
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--label' || !/^[a-z][a-z0-9-]{0,40}$/.test(args[1]))) throw new Error('Usage: rollback.cjs [--label phase22]');
  const backupDir = args.length ? path.join(audit, 'deployments', args[1]) : path.join(audit, 'deployment');
  require('./deployment.cjs').contained(root, backupDir);
  const record = JSON.parse(fs.readFileSync(path.join(backupDir, 'deployment.json'), 'utf8'));
  if (record.root !== root || record.configFile !== path.join(root, 'build/dist/server/server-settings.json')) throw new Error('Unexpected rollback destination');
  await assertServerStopped(JSON.parse(fs.readFileSync(record.configFile, 'utf8')));
  console.log(JSON.stringify(rollbackDeployment(record), null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
