const test = require('node:test');
const assert = require('node:assert/strict');
const { actorId, userId, profileId, formDesc } = require('../.test-build/engine/ids.js');
const { SkyMpAdapter, IDENTITY_PROPERTY } = require('../.test-build/engine/adapter.js');
const { IdentityService } = require('../.test-build/modules/identity/identity-service.js');

function fakeEngine() {
  const actor = 0xff000000;
  const fields = new Map([
    ['profileId', 300001], ['inventory', { entries: [{ baseId: 15, count: 29, extra: { tag: 'keep' } }] }],
    ['equipment', { inv: { entries: [{ baseId: 123, count: 1, worn: true }] } }],
    ['pos', [1, 2, 3]], ['appearance', { name: 'ทดสอบ', raceId: 1 }],
  ]);
  const writes = [];
  const raw = {
    get(id, key) { if (key === 'onlinePlayers') { assert.equal(id, 0); return [actor]; }
      assert.equal(id, actor); return fields.get(key) ?? null; },
    set(id, key, value) { assert.equal(id, actor); writes.push(key); fields.set(key, structuredClone(value)); },
    getActorName(id) { assert.equal(id, actor); return 'ทดสอบ'; },
    getDescFromId(id) { assert.equal(id, actor); return '0'; },
    getUserByActor(id) { assert.equal(id, actor); return 0; },
    getUserActor(id) { assert.equal(id, 0); return actor; },
    isConnected(id) { return id === 0; },
    getUserGuid(id) { assert.equal(id, 0); return 'not-a-number-guid'; },
  };
  return { actor: actorId(actor), raw, fields, writes, adapter: new SkyMpAdapter(raw) };
}

test('IDs validate actual numeric domains including user slot zero and high profiles', () => {
  assert.equal(actorId(0xff000000), 0xff000000);
  assert.equal(userId(0), 0);
  assert.equal(profileId(300001), 300001);
  for (const value of [-1, 0, 1.2, NaN, Infinity, '1', 0x100000000]) assert.throws(() => actorId(value));
  for (const value of [-1, 65535, 1.2, '0']) assert.throws(() => userId(value));
  for (const value of [-1, 0x80000000, 1.2, '1']) assert.throws(() => profileId(value));
  assert.equal(formDesc('0'), '0');
  assert.equal(formDesc('3c:Skyrim.esm'), '3c:Skyrim.esm');
  for (const value of ['', 'wrong', '0:../escape.esm', null]) assert.throws(() => formDesc(value));
});
test('adapter rejects absent native methods at startup', () => assert.throws(() => new SkyMpAdapter({})));
test('adapter uses native online actor list, profile, stable descriptor and user0 mapping', () => {
  const env = fakeEngine();
  assert.deepEqual(env.adapter.onlineActors(), [env.actor]);
  assert.equal(env.adapter.profileForActor(env.actor), 300001);
  assert.equal(env.adapter.describe(env.actor), '0');
  assert.deepEqual(env.adapter.sessionForActor(env.actor), { actorId: env.actor, userId: 0, profileId: 300001, guid: 'not-a-number-guid' });
});
test('adapter fails closed on stale/recycled connection mapping', () => {
  const env = fakeEngine(); env.raw.getUserActor = () => 0xff000001;
  assert.throws(() => env.adapter.sessionForActor(env.actor));
  env.raw.getUserActor = () => env.actor; env.raw.isConnected = () => false;
  assert.throws(() => env.adapter.sessionForActor(env.actor));
});
test('adapter rejects malformed native values instead of coercing them', () => {
  const env = fakeEngine(); env.raw.get = () => ['4294967296'];
  assert.throws(() => env.adapter.onlineActors());
  assert.throws(() => env.adapter.profileForActor(env.actor));
  env.raw.get = () => [env.actor, env.actor];
  assert.throws(() => env.adapter.onlineActors());
});
test('identity writes use the fixed private property and facade has no generic native setter', () => {
  const env = fakeEngine();
  assert.equal(IDENTITY_PROPERTY, 'private.rp.v1.identity');
  assert.equal(env.adapter.set, undefined);
  assert.equal(env.adapter.createActor, undefined);
  env.adapter.writeIdentity(env.actor, { schemaVersion: 1, displayName: 'Name' });
  assert.deepEqual(env.writes, [IDENTITY_PROPERTY]);
});
test('identity creation attaches to existing actor and preserves all native state', () => {
  const env = fakeEngine(); const before = structuredClone([...env.fields]);
  const svc = new IdentityService(env.adapter);
  const identity = svc.ensure(env.actor);
  assert.deepEqual(identity, { actorId: env.actor, profileId: 300001, formDesc: '0', metadata: { schemaVersion: 1, displayName: 'ทดสอบ' } });
  assert.deepEqual([...env.fields].filter(([key]) => key !== IDENTITY_PROPERTY), before);
  assert.deepEqual(env.writes, [IDENTITY_PROPERTY]);
});
test('lookup and whoami domain data do not create identity metadata', () => {
  const env = fakeEngine(); const svc = new IdentityService(env.adapter);
  assert.equal(svc.lookup(env.actor), null); assert.deepEqual(env.writes, []);
});
test('existing metadata survives reconnect and a newly constructed service', () => {
  const env = fakeEngine(); new IdentityService(env.adapter).ensure(env.actor);
  const reconnected = new IdentityService(new SkyMpAdapter(env.raw));
  assert.equal(reconnected.lookup(env.actor).metadata.displayName, 'ทดสอบ');
  reconnected.ensure(env.actor); assert.equal(env.writes.length, 1);
});
test('valid existing names and short biography are never overwritten', () => {
  const env = fakeEngine(); env.fields.set(IDENTITY_PROPERTY, { schemaVersion: 1, displayName: 'RP Name', biography: 'สั้น ๆ' });
  const svc = new IdentityService(env.adapter);
  assert.equal(svc.ensure(env.actor).metadata.biography, 'สั้น ๆ'); assert.equal(env.writes.length, 0);
});
test('unknown schema, corrupt metadata and oversized bio fail without destructive overwrite', () => {
  const env = fakeEngine(); const svc = new IdentityService(env.adapter);
  for (const value of [{ schemaVersion: 2, displayName: 'Future' }, { schemaVersion: 1, displayName: '' }, { schemaVersion: 1, displayName: 'A', biography: 'x'.repeat(513) }, 'not-json', []]) {
    env.fields.set(IDENTITY_PROPERTY, value); assert.throws(() => svc.ensure(env.actor));
  }
  assert.equal(env.writes.length, 0);
});
test('metadata native write must roundtrip; silent ignored write is a failure', () => {
  const env = fakeEngine(); env.raw.set = () => {};
  assert.throws(() => new IdentityService(env.adapter).ensure(env.actor));
});

module.exports.fakeEngine = fakeEngine;
