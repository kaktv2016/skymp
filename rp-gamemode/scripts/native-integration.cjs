// Test harness only: uses existing addon and a copied world, never the live world.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const repo = path.resolve(project, '..');
const bundlePath = path.join(project, 'dist/rp-gamemode.cjs');
const addonPath = path.join(repo, 'build/dist/server/scam_native.node');
const key = 'private.rp.v1.identity';

function inside(root, destination) {
  const relative = path.relative(root, destination);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
function playerFile(world) {
  const found = fs.readdirSync(path.join(world, 'changeForms')).filter(name => name.endsWith('.json')).map(name => path.join(world, 'changeForms', name))
    .filter(file => JSON.parse(fs.readFileSync(file, 'utf8')).profileId === 1);
  assert.equal(found.length, 1, 'Fixture must have exactly one existing profile-1 actor');
  return found[0];
}
function physicalFromFile(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(['formDesc', 'profileId', 'position', 'angle', 'worldOrCellDesc', 'inv', 'equipmentDump', 'appearanceDump'].map(field => [field, value[field]]));
}
function nativePhysical(mp, actor) {
  return Object.fromEntries(['profileId', 'locationalData', 'inventory', 'equipment', 'appearance'].map(field => [field, mp.get(actor, field)]));
}
async function child(phase, fixture) {
  assert.ok(inside(path.join(repo, 'build/rp-audit/phase21'), fixture), 'Fixture outside audit root');
  process.chdir(fixture);
  const config = JSON.parse(fs.readFileSync(path.join(fixture, 'settings.json'), 'utf8'));
  assert.equal(config.databaseName, path.join(fixture, 'world'));
  const { ScampServer } = require(addonPath);
  const mp = new ScampServer(JSON.stringify(config));
  mp._setSelf(mp);
  mp.attachSaveStorage();
  const foundation = require(bundlePath);
  const actors = mp.getActorsByProfileId(1);
  assert.equal(actors.length, 1);
  const actor = actors[0];
  const rawBefore = nativePhysical(mp, actor);
  const adapter = new foundation.SkyMpAdapter(mp);
  assert.deepEqual(adapter.onlineActors(), []);
  assert.equal(adapter.profileForActor(foundation.actorId(actor)), 1);
  const service = new foundation.IdentityService(adapter);
  if (phase === 'write') {
    assert.equal(service.lookup(foundation.actorId(actor)), null);
    fs.writeFileSync('native-before.json', JSON.stringify(rawBefore, null, 2));
    const value = service.ensure(foundation.actorId(actor));
    fs.writeFileSync('identity-expected.json', JSON.stringify(value, null, 2));
    assert.deepEqual(nativePhysical(mp, actor), rawBefore);
    const deadline = Date.now() + 20000;
    let saved = false;
    while (Date.now() < deadline) {
      mp.tick();
      await new Promise(resolve => setTimeout(resolve, 10));
      const disk = JSON.parse(fs.readFileSync(playerFile(config.databaseName), 'utf8'));
      if (disk.dynamicFields?.[key]?.schemaVersion === 1) { saved = true; break; }
    }
    assert.equal(saved, true, 'Native metadata not persisted within test deadline');
    assert.deepEqual(nativePhysical(mp, actor), rawBefore);
  } else {
    const expected = JSON.parse(fs.readFileSync('identity-expected.json', 'utf8'));
    const nativeBefore = JSON.parse(fs.readFileSync('native-before.json', 'utf8'));
    assert.deepEqual(service.lookup(foundation.actorId(actor)), expected);
    assert.deepEqual(nativePhysical(mp, actor), nativeBefore);
    assert.deepEqual(service.ensure(foundation.actorId(actor)), expected);
  }
  const runtime = foundation.createRuntime(mp, { chat:false });
  await runtime.start();
  assert.deepEqual(runtime.commands.list(), ['whoami']);
  await runtime.stop();
  assert.deepEqual(runtime.commands.list(), []);
  fs.writeFileSync(`${phase}-result.json`, JSON.stringify({ phase, actorId: actor, profileId: 1, actors: actors.length, nativePhysicalUnchanged: true, identity: service.lookup(foundation.actorId(actor)), runtimeBootShutdown: 'PASSED' }, null, 2));
  process.exit(0);
}

function main() {
  const audit = fs.readFileSync(path.join(repo, 'build/rp-audit/phase21/current-audit.txt'), 'utf8').trim();
  assert.ok(inside(path.join(repo, 'build/rp-audit/phase21'), audit));
  const fixture = fs.mkdtempSync(path.join(audit, 'native-'));
  fs.cpSync(path.join(repo, 'build/dist/server/data'), path.join(fixture, 'data'), { recursive: true, errorOnExist: true, force: false });
  const original = path.join(audit, 'before/rp-world');
  fs.cpSync(original, path.join(fixture, 'world'), { recursive: true, errorOnExist: true, force: false });
  const before = physicalFromFile(playerFile(path.join(fixture, 'world')));
  const config = JSON.parse(fs.readFileSync(path.join(audit, 'before/server-settings.json'), 'utf8'));
  Object.assign(config, { databaseDriver: 'file', databaseName: path.join(fixture, 'world'), port: 17777, listenHost: '127.0.0.1', uiListenHost: '127.0.0.1', logLevel: 'error' });
  fs.writeFileSync(path.join(fixture, 'settings.json'), JSON.stringify(config, null, 2));
  for (const phase of ['write', 'reload']) {
    const run = spawnSync(process.execPath, [__filename, '--child', phase, fixture], { cwd: fixture, encoding: 'utf8', timeout: 35000 });
    fs.writeFileSync(path.join(fixture, `${phase}.log`), (run.stdout ?? '') + (run.stderr ?? ''));
    assert.equal(run.status, 0, `${phase} child failed; inspect ${path.join(fixture, phase + '.log')}`);
  }
  assert.deepEqual(physicalFromFile(playerFile(path.join(fixture, 'world'))), before);
  const result = { fixture, realNativeAddon: true, separateWriteReloadProcesses: true, persistedMetadata: 'PASSED', physicalFileStateUnchanged: true, sameExistingActor: true, runtimeBootShutdown: 'PASSED', gameClient: 'NOT TESTED' };
  fs.writeFileSync(path.join(fixture, 'summary.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(audit, 'native-integration-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[2] === '--child') child(process.argv[3], process.argv[4]).catch(error => { console.error(error); process.exit(1); });
else main();
