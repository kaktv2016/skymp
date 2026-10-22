const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('../.test-build/runtime.js');

function fixture() {
  const fields = new Map([['profileId', 1]]);
  const logs = [], errors = [], timers = new Set();
  let online = [0xff000000];
  const mp = {
    get(_actor, key) { return key === 'onlinePlayers' ? online : fields.get(key) ?? null; },
    set(_actor, key, value) { assert.equal(key, 'private.rp.v1.identity'); fields.set(key, structuredClone(value)); },
    getActorName() { return 'Baseline Name'; }, getDescFromId() { return '0'; },
    getUserByActor() { return 0; }, getUserActor() { return 0xff000000; },
    getUserGuid() { return 'native-session-1'; }, isConnected() { return true; },
  };
  const scheduler = { every(ms, fn) { assert.equal(ms, 1000); timers.add(fn); return () => timers.delete(fn); } };
  const runtime = createRuntime(mp, { chat:false, scheduler, logger: { info: (...args) => logs.push(args), error: (...args) => errors.push(args) } });
  return { mp, fields, logs, errors, timers, runtime, setOnline: (value) => { online = value; } };
}
test('runtime owns one identity observer and command, then releases both on shutdown', async () => {
  const env = fixture(); await env.runtime.start();
  assert.equal(env.timers.size, 1); assert.deepEqual(env.runtime.commands.list(), ['whoami']);
  assert.equal(env.fields.get('private.rp.v1.identity').displayName, 'Baseline Name');
  await env.runtime.stop(); assert.equal(env.timers.size, 0); assert.deepEqual(env.runtime.commands.list(), []);
  await env.runtime.stop();
});
test('whoami reports current native actor/profile metadata without any writes', async () => {
  const env = fixture(); await env.runtime.start();
  const before = structuredClone([...env.fields]);
  const result = await env.runtime.commands.dispatch('/whoami', { actorId: 0xff000000 });
  assert.equal(result.ok, true); assert.equal(result.data.profileId, 1);
  assert.equal(result.data.metadata.displayName, 'Baseline Name');
  assert.deepEqual([...env.fields], before); await env.runtime.stop();
});
test('whoami rejects arguments and stale native sessions', async () => {
  const env = fixture(); await env.runtime.start();
  assert.equal((await env.runtime.commands.dispatch('/whoami extra', { actorId: 0xff000000 })).code, 'INVALID_ARGUMENTS');
  env.mp.isConnected = () => false;
  assert.equal((await env.runtime.commands.dispatch('/whoami', { actorId: 0xff000000 })).ok, false);
  await env.runtime.stop();
});
test('whoami on an uninitialized actor returns missing metadata rather than creating it', async () => {
  const env = fixture(); env.setOnline([]); await env.runtime.start();
  const result = await env.runtime.commands.dispatch('/whoami', { actorId: 0xff000000 });
  assert.equal(result.code, 'IDENTITY_NOT_READY'); assert.equal(env.fields.has('private.rp.v1.identity'), false);
  await env.runtime.stop();
});
test('new online actors get metadata once without duplicate initialization on later polls', async () => {
  const env = fixture(); env.setOnline([]); await env.runtime.start();
  const tick = [...env.timers][0]; env.setOnline([0xff000000]); tick();
  env.mp.set = () => { throw new Error('Repeated metadata write'); }; tick();
  assert.equal(env.errors.length, 0); await env.runtime.stop();
});
test('initial observation failure rolls back command and leaves no timer', async () => {
  const env = fixture(); env.mp.get = () => 'malformed';
  await assert.rejects(env.runtime.start());
  assert.equal(env.timers.size, 0); assert.deepEqual(env.runtime.commands.list(), []);
});
test('later poll failures are visible once and do not overwrite corrupt metadata', async () => {
  const env = fixture(); await env.runtime.start();
  env.fields.set('private.rp.v1.identity', { schemaVersion: 99, displayName: 'Future' });
  const tick = [...env.timers][0]; tick(); tick();
  assert.equal(env.errors.length, 1);
  assert.equal(env.fields.get('private.rp.v1.identity').schemaVersion, 99);
  await env.runtime.stop();
});
test('runtime boot is one-shot and no native event handlers or actor creation are introduced', async () => {
  const env = fixture(); const keys = Object.keys(env.mp); await env.runtime.start();
  await assert.rejects(env.runtime.start()); assert.deepEqual(Object.keys(env.mp), keys);
  await env.runtime.stop();
});
test('one corrupt actor cannot starve healthy actors during periodic observation', async () => {
  const env = fixture(); env.setOnline([]);
  const bad = 0xff000000, healthy = 0xff000001;
  const records = new Map([[bad, { schemaVersion: 99, displayName: 'Preserved' }]]);
  env.mp.get = (actor, key) => key === 'onlinePlayers' ? [bad, healthy] : key === 'profileId' ? (actor === bad ? 1 : 2) : records.get(actor) ?? null;
  // Start without actors; only the later polling path isolates per-actor errors.
  let connected = false;
  const get = env.mp.get; env.mp.get = (actor, key) => key === 'onlinePlayers' && !connected ? [] : get(actor, key);
  env.mp.getUserByActor = actor => actor === bad ? 0 : 1;
  env.mp.getUserActor = user => user === 0 ? bad : healthy;
  env.mp.set = (actor, key, value) => { assert.equal(key, 'private.rp.v1.identity'); assert.equal(actor, healthy); records.set(actor, value); };
  await env.runtime.start(); connected = true;
  const tick = [...env.timers][0]; tick(); tick();
  assert.equal(records.get(healthy)?.schemaVersion, 1);
  assert.equal(records.get(bad).schemaVersion, 99);
  assert.equal(env.errors.length, 1);
  assert.ok(env.errors[0][0].includes('ff000000'));
  await env.runtime.stop();
});
