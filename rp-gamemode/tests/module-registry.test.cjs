const assert = require('node:assert/strict');
const test = require('node:test');
const { ModuleRegistry } = require('../.test-build/core/module-registry.js');

function gate() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
}

test('registration rejects malformed definitions and unknown state queries', () => {
  const registry = new ModuleRegistry();
  for (const definition of [null, {}, { id: '', initialize() {} },
    { id: '  ', initialize() {} }, { id: ' padded ', initialize() {} },
    { id: 42, initialize() {} }, { id: 'a', initialize: null },
    { id: 'a', dependencies: 'b', initialize() {} },
    { id: 'a', dependencies: [''], initialize() {} }]) {
    assert.throws(() => registry.register(definition));
  }
  assert.throws(() => registry.state('unknown'), /unknown/i);
  registry.register({ id: 'valid', initialize() {} });
  assert.equal(registry.state('valid'), 'registered');
  assert.throws(() => registry.register({ id: 'valid', initialize() {} }), /duplicate/i);
});

test('boot starts dependencies first and shutdown reverses module and cleanup order', async () => {
  const registry = new ModuleRegistry();
  const events = [];
  registry.register({ id: 'feature', dependencies: ['base'], initialize(scope) {
    events.push('feature:start');
    scope.defer(() => events.push('feature:first'));
    scope.defer(async () => events.push('feature:last'));
  } });
  registry.register({ id: 'base', initialize(scope) {
    events.push('base:start');
    scope.defer(() => events.push('base:stop'));
  } });
  assert.deepEqual(registry.activeIds(), []);
  await registry.boot();
  assert.deepEqual(events, ['base:start', 'feature:start']);
  assert.deepEqual(registry.activeIds(), ['base', 'feature']);
  assert.equal(registry.state('feature'), 'running');
  await registry.shutdown();
  assert.deepEqual(events, ['base:start', 'feature:start', 'feature:last', 'feature:first', 'base:stop']);
  assert.deepEqual(registry.activeIds(), []);
  assert.equal(registry.state('base'), 'stopped');
  assert.equal(registry.state('feature'), 'stopped');
});

test('missing dependencies are validated across all modules before any initialization', async () => {
  const registry = new ModuleRegistry();
  const events = [];
  registry.register({ id: 'safe', initialize() { events.push('safe'); } });
  registry.register({ id: 'broken', dependencies: ['absent'], initialize() { events.push('broken'); } });
  await assert.rejects(registry.boot(), /missing.*absent/i);
  assert.deepEqual(events, []);
  assert.equal(registry.state('safe'), 'registered');
  assert.equal(registry.state('broken'), 'registered');
  assert.deepEqual(registry.activeIds(), []);
});

test('cycles are detected before initialization including disconnected cycles', async () => {
  const registry = new ModuleRegistry();
  let starts = 0;
  for (const [id, dependencies] of [['safe', []], ['a', ['b']], ['b', ['a']]]) {
    registry.register({ id, dependencies, initialize() { starts += 1; } });
  }
  await assert.rejects(registry.boot(), /cycle/i);
  assert.equal(starts, 0);
  assert.deepEqual(registry.activeIds(), []);
});

test('self dependencies are cycles', async () => {
  const registry = new ModuleRegistry();
  registry.register({ id: 'self', dependencies: ['self'], initialize() { assert.fail('must not initialize'); } });
  await assert.rejects(registry.boot(), /cycle/i);
});

test('initialization failure releases partial commands hooks and timers then predecessors', async () => {
  const registry = new ModuleRegistry();
  const commands = new Set();
  const hooks = new Set();
  const timers = new Set();
  const releases = [];
  const failure = new Error('initialization failed');
  function own(scope, set, id) {
    set.add(id);
    scope.defer(() => { set.delete(id); releases.push(id); });
  }
  registry.register({ id: 'base', initialize(scope) { own(scope, commands, 'base-command'); } });
  registry.register({ id: 'broken', dependencies: ['base'], initialize(scope) {
    own(scope, commands, 'partial-command');
    own(scope, hooks, 'partial-hook');
    own(scope, timers, 'partial-timer');
    throw failure;
  } });
  registry.register({ id: 'later', initialize() { assert.fail('must not start after failure'); } });
  await assert.rejects(registry.boot(), (error) => error === failure);
  assert.deepEqual([...commands], []);
  assert.deepEqual([...hooks], []);
  assert.deepEqual([...timers], []);
  assert.deepEqual(releases, ['partial-timer', 'partial-hook', 'partial-command', 'base-command']);
  assert.equal(registry.state('broken'), 'failed');
  assert.equal(registry.state('base'), 'stopped');
  assert.equal(registry.state('later'), 'registered');
  assert.deepEqual(registry.activeIds(), []);
  await registry.shutdown();
  assert.equal(releases.length, 4);
});

test('shutdown attempts every cleanup and aggregates failures without leaving active modules', async () => {
  const registry = new ModuleRegistry();
  const events = [];
  const first = new Error('first cleanup');
  const second = new Error('second cleanup');
  registry.register({ id: 'base', initialize(scope) {
    scope.defer(() => { events.push('base'); throw first; });
  } });
  registry.register({ id: 'feature', initialize(scope) {
    scope.defer(() => events.push('feature:first'));
    scope.defer(async () => { events.push('feature:last'); throw second; });
  } });
  await registry.boot();
  await assert.rejects(registry.shutdown(), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [second, first]);
    return true;
  });
  assert.deepEqual(events, ['feature:last', 'feature:first', 'base']);
  assert.deepEqual(registry.activeIds(), []);
  assert.equal(registry.state('base'), 'stopped');
  assert.equal(registry.state('feature'), 'stopped');
  await assert.rejects(registry.shutdown(), AggregateError);
  assert.equal(events.length, 3);
});

test('failed initialization preserves its error and collects every rollback failure', async () => {
  const registry = new ModuleRegistry();
  const events = [];
  const initializeError = new Error('initialize');
  const baseError = new Error('base cleanup');
  const partialError = new Error('partial cleanup');
  registry.register({ id: 'base', initialize(scope) {
    scope.defer(() => { events.push('base'); throw baseError; });
  } });
  registry.register({ id: 'broken', initialize(scope) {
    scope.defer(() => events.push('partial:first'));
    scope.defer(() => { events.push('partial:last'); throw partialError; });
    throw initializeError;
  } });
  await assert.rejects(registry.boot(), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [initializeError, partialError, baseError]);
    return true;
  });
  assert.deepEqual(events, ['partial:last', 'partial:first', 'base']);
  assert.deepEqual(registry.activeIds(), []);
  assert.equal(registry.state('broken'), 'failed');
  assert.equal(registry.state('base'), 'stopped');
});

test('invalid deferred cleanup fails initialization and still releases earlier resources', async () => {
  const registry = new ModuleRegistry();
  let releases = 0;
  registry.register({ id: 'bad', initialize(scope) {
    scope.defer(() => { releases += 1; });
    scope.defer(null);
  } });
  await assert.rejects(registry.boot(), /cleanup/i);
  assert.equal(releases, 1);
  assert.equal(registry.state('bad'), 'failed');
});

test('a scope rejects defers after initialization to prevent unowned late resources', async () => {
  const registry = new ModuleRegistry();
  let savedScope;
  registry.register({ id: 'a', initialize(scope) { savedScope = scope; } });
  await registry.boot();
  assert.throws(() => savedScope.defer(() => {}), /scope|initializ/i);
  await registry.shutdown();
  assert.throws(() => savedScope.defer(() => {}), /scope|initializ/i);
});

test('registration captures definitions so later caller mutations cannot change dependency validation', async () => {
  const registry = new ModuleRegistry();
  const events = [];
  const definition = { id: 'feature', dependencies: ['base'], initialize() { events.push('feature'); } };
  registry.register(definition);
  definition.id = 'changed';
  definition.dependencies[0] = 'missing';
  definition.initialize = () => { assert.fail('mutated initializer'); };
  registry.register({ id: 'base', initialize() { events.push('base'); } });
  await registry.boot();
  assert.deepEqual(events, ['base', 'feature']);
  assert.equal(registry.state('feature'), 'running');
  await registry.shutdown();
});

test('boot cannot repeat and registration closes as soon as boot is requested', async () => {
  const registry = new ModuleRegistry();
  const started = gate();
  const finish = gate();
  registry.register({ id: 'a', async initialize() { started.release(); await finish.promise; } });
  const boot = registry.boot();
  assert.throws(() => registry.register({ id: 'late', initialize() {} }), /register|boot/i);
  await assert.rejects(registry.boot(), /boot/i);
  await started.promise;
  assert.equal(registry.state('a'), 'initializing');
  finish.release();
  await boot;
  await assert.rejects(registry.boot(), /boot/i);
  assert.throws(() => registry.register({ id: 'late', initialize() {} }), /register|boot/i);
  await registry.shutdown();
  await assert.rejects(registry.boot(), /boot/i);
});

test('shutdown is idempotent and concurrent calls await the same completed cleanup', async () => {
  const registry = new ModuleRegistry();
  const enteredCleanup = gate();
  const finishCleanup = gate();
  let releases = 0;
  registry.register({ id: 'a', initialize(scope) {
    scope.defer(async () => { enteredCleanup.release(); await finishCleanup.promise; releases += 1; });
  } });
  await registry.boot();
  const shutdownA = registry.shutdown();
  const shutdownB = registry.shutdown();
  await enteredCleanup.promise;
  assert.equal(releases, 0);
  finishCleanup.release();
  await Promise.all([shutdownA, shutdownB]);
  await registry.shutdown();
  assert.equal(releases, 1);
  assert.deepEqual(registry.activeIds(), []);
});

test('shutdown during async boot waits for ownership registration and then drains every module', async () => {
  const registry = new ModuleRegistry();
  const started = gate();
  const finish = gate();
  const resources = new Set();
  const events = [];
  registry.register({ id: 'a', async initialize(scope) {
    resources.add('early');
    scope.defer(() => { resources.delete('early'); events.push('early:stop'); });
    started.release();
    await finish.promise;
    resources.add('late');
    scope.defer(() => { resources.delete('late'); events.push('late:stop'); });
  } });
  registry.register({ id: 'b', dependencies: ['a'], initialize(scope) {
    resources.add('b');
    scope.defer(() => { resources.delete('b'); events.push('b:stop'); });
  } });
  const boot = registry.boot();
  await started.promise;
  let stopped = false;
  const shutdown = registry.shutdown().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  assert.deepEqual([...resources], ['early']);
  finish.release();
  await Promise.all([boot, shutdown]);
  assert.deepEqual([...resources], []);
  assert.deepEqual(events, ['b:stop', 'late:stop', 'early:stop']);
  assert.equal(registry.state('a'), 'stopped');
  assert.equal(registry.state('b'), 'stopped');
  assert.deepEqual(registry.activeIds(), []);
});

test('shutdown overlapping rejected async initialization awaits rollback without duplicate cleanup', async () => {
  const registry = new ModuleRegistry();
  const started = gate();
  const finish = gate();
  let releases = 0;
  const failure = new Error('async failed');
  registry.register({ id: 'a', async initialize(scope) {
    scope.defer(() => { releases += 1; });
    started.release();
    await finish.promise;
    throw failure;
  } });
  const boot = registry.boot();
  const rejectedBoot = assert.rejects(boot, (error) => error === failure);
  await started.promise;
  const shutdown = registry.shutdown();
  finish.release();
  await Promise.all([rejectedBoot, shutdown]);
  assert.equal(releases, 1);
  assert.equal(registry.state('a'), 'failed');
  assert.deepEqual(registry.activeIds(), []);
});

test('an empty registry can boot and shut down once without special resources', async () => {
  const registry = new ModuleRegistry();
  await registry.boot();
  await registry.shutdown();
  await registry.shutdown();
  assert.deepEqual(registry.activeIds(), []);
  await assert.rejects(registry.boot(), /boot/i);
});
