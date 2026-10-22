const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deployBundle, rollbackDeployment } = require('../scripts/deployment.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-deploy-test-'));
  t.after(() => {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(root));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('rp-deploy-test-'));
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const server = path.join(root, 'server'), deploymentDir = path.join(root, 'deployed'), backupDir = path.join(root, 'audit');
  fs.mkdirSync(path.join(server, 'rp-world/changeForms'), { recursive: true });
  fs.writeFileSync(path.join(server, 'rp-world/changeForms/0.json'), '{"inv":{"entries":[{"baseId":15,"count":25}]}}');
  const configFile = path.join(server, 'server-settings.json');
  const config = { gamemodePath: 'gamemode.js', databaseName: 'rp-world', port: 7777, privateTest: 'retained' };
  fs.writeFileSync(configFile, JSON.stringify(config));
  fs.writeFileSync(path.join(server, 'gamemode.js'), '/* old gamemode */');
  const bundleFile = path.join(root, 'rp.cjs'); fs.writeFileSync(bundleFile, '/* new bundle */');
  return { root, server, configFile, config, bundleFile, deploymentDir, backupDir };
}
test('deployment changes only gamemodePath and preserves old config/gamemode/world', t => {
  const env = fixture(t); const result = deployBundle(env);
  const next = JSON.parse(fs.readFileSync(env.configFile, 'utf8'));
  assert.ok(path.isAbsolute(next.gamemodePath)); assert.equal(next.databaseName, 'rp-world');
  assert.deepEqual({ ...next, gamemodePath: 'gamemode.js' }, env.config);
  assert.equal(fs.readFileSync(path.join(env.server, 'gamemode.js'), 'utf8'), '/* old gamemode */');
  assert.equal(fs.readFileSync(path.join(env.server, 'rp-world/changeForms/0.json'), 'utf8'), '{"inv":{"entries":[{"baseId":15,"count":25}]}}');
  assert.equal(fs.readFileSync(result.configBackup, 'utf8'), JSON.stringify(env.config));
  assert.equal(fs.readFileSync(result.deployedPath, 'utf8'), '/* new bundle */');
});
test('rollback restores previous gamemode config while retaining newer player data', t => {
  const env = fixture(t); const result = deployBundle(env);
  const world = path.join(env.server, 'rp-world/changeForms/0.json'); fs.writeFileSync(world, 'new player progress');
  rollbackDeployment(result);
  assert.deepEqual(JSON.parse(fs.readFileSync(env.configFile, 'utf8')), env.config);
  assert.equal(fs.readFileSync(world, 'utf8'), 'new player progress');
});
test('rollback refuses to overwrite unrelated configuration edits', t => {
  const env = fixture(t); const result = deployBundle(env);
  const next = JSON.parse(fs.readFileSync(env.configFile, 'utf8')); next.maxPlayers = 10;
  fs.writeFileSync(env.configFile, JSON.stringify(next));
  assert.throws(() => rollbackDeployment(result));
  assert.equal(JSON.parse(fs.readFileSync(env.configFile, 'utf8')).maxPlayers, 10);
});
test('deployment rejects path escape and tampered immutable bundle without changing config', t => {
  const env = fixture(t);
  assert.throws(() => deployBundle({ ...env, configFile: path.join(env.root, '../outside.json') }));
  const result = deployBundle(env); fs.writeFileSync(result.deployedPath, 'tampered');
  const configBefore = fs.readFileSync(env.configFile, 'utf8');
  assert.throws(() => deployBundle({ ...env, backupDir: path.join(env.root, 'second-audit') }));
  assert.equal(fs.readFileSync(env.configFile, 'utf8'), configBefore);
});
test('repeating deployment is an idempotent no-op retaining original rollback record', t => {
  const env = fixture(t); const first = deployBundle(env); const second = deployBundle(env);
  assert.deepEqual(second, first);
  rollbackDeployment(second); assert.deepEqual(JSON.parse(fs.readFileSync(env.configFile, 'utf8')), env.config);
});
test('failure to write rollback record leaves the original configuration untouched', t => {
  const env = fixture(t); const original = fs.readFileSync(env.configFile, 'utf8');
  const write = fs.writeFileSync;
  fs.writeFileSync = (file, ...args) => {
    if (path.basename(file) === 'deployment.json') throw new Error('Injected record write failure');
    return write(file, ...args);
  };
  try { assert.throws(() => deployBundle(env), /Injected record write failure/); }
  finally { fs.writeFileSync = write; }
  assert.equal(fs.readFileSync(env.configFile, 'utf8'), original);
});
test('rollback is safe when config switch never happened or was already rolled back', t => {
  const env = fixture(t); const result = deployBundle(env);
  fs.copyFileSync(result.configBackup, env.configFile);
  rollbackDeployment(result);
  rollbackDeployment(result);
  assert.equal(fs.readFileSync(env.configFile, 'utf8'), JSON.stringify(env.config));
});
