// Isolated startup check of the unchanged native server wrapper and its temp loader.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { assertServerStopped } = require('./server-stopped.cjs');
const { hash } = require('./deployment.cjs');
const project = path.resolve(__dirname, '..');
const repo = path.resolve(project, '..');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function worldHashes(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true }).filter(name => fs.statSync(path.join(directory, name)).isFile()).sort().map(name => [name, hash(path.join(directory, name))]));
}
async function main() {
  const audit = fs.readFileSync(path.join(repo, 'build/rp-audit/phase21/current-audit.txt'), 'utf8').trim();
  const rel = path.relative(path.join(repo, 'build/rp-audit/phase21'), audit);
  assert.ok(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
  const config = JSON.parse(fs.readFileSync(path.join(audit, 'before/server-settings.json'), 'utf8'));
  Object.assign(config, { port: 17777, listenHost: '127.0.0.1', uiListenHost: '127.0.0.1', logLevel: 'info' });
  await assertServerStopped(config);
  const fixture = fs.mkdtempSync(path.join(audit, 'wrapper-'));
  const builtServer = path.join(repo, 'build/dist/server');
  for (const folder of ['dist_back', 'data']) fs.cpSync(path.join(builtServer, folder), path.join(fixture, folder), { recursive: true, force: false, errorOnExist: true });
  fs.copyFileSync(path.join(builtServer, 'scam_native.node'), path.join(fixture, 'scam_native.node'));
  fs.cpSync(path.join(audit, 'before/rp-world'), path.join(fixture, 'world'), { recursive: true, force: false, errorOnExist: true });
  const before = worldHashes(path.join(fixture, 'world'));
  const bundle = path.join(fixture, 'rp.cjs');
  fs.copyFileSync(path.join(project, 'dist/rp-gamemode.cjs'), bundle);
  Object.assign(config, { databaseName: path.join(fixture, 'world'), gamemodePath: bundle });
  fs.writeFileSync(path.join(fixture, 'server-settings.json'), JSON.stringify(config, null, 2));
  let logs = '';
  const child = spawn(process.execPath, ['dist_back/skymp5-server.js'], { cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  let childError;
  child.once('error', error => { childError = error; });
  let metricsStatus;
  try {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !logs.includes('[rp] Phase 2.1 foundation ready')) {
      if (childError) throw childError;
      assert.equal(child.exitCode, null, 'Wrapper exited before RP boot');
      await delay(50);
    }
    assert.ok(logs.includes('[rp] Phase 2.1 foundation ready'), 'No RP boot marker');
    assert.ok(!logs.includes('[rp] foundation boot FAILED'));
    const authorization = 'Basic ' + Buffer.from(`${config.metricsAuth.user}:${config.metricsAuth.password}`).toString('base64');
    // UI starts asynchronously after gamemode boot; wait for its actual listener.
    let response;
    while (Date.now() < deadline && !response) {
      assert.equal(child.exitCode, null, 'Wrapper exited before HTTP readiness');
      try { response = await fetch('http://127.0.0.1:17778/metrics', { headers: { authorization }, signal: AbortSignal.timeout(2000) }); }
      catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; await delay(50); }
    }
    assert.ok(response, 'HTTP listener never became ready');
    metricsStatus = response.status;
    assert.equal(metricsStatus, 200);
    assert.ok((await response.text()).includes('skymp_'));
  } finally {
    // Only terminate the child this harness created; never the development server.
    if (child.pid && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
    fs.writeFileSync(path.join(fixture, 'startup.log'), logs);
  }
  assert.deepEqual(worldHashes(path.join(fixture, 'world')), before);
  const result = { fixture, actualServerWrapper: true, tempCommonJsLoader: 'PASSED', foundationBoot: 'PASSED', authenticatedMetrics: metricsStatus, unchangedCopiedWorld: true, gameClient: 'NOT TESTED' };
  fs.writeFileSync(path.join(audit, 'wrapper-smoke-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
