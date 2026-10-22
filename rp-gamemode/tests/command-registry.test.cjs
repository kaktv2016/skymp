const test = require('node:test');
const assert = require('node:assert/strict');
const { CommandRegistry } = require('../.test-build/core/command-registry.js');

const context = { actorId: 42 };

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
}

test('normalizes registration and dispatch names while preserving argument case', async () => {
  const registry = new CommandRegistry();
  registry.register('/EcHo', (ctx, args) => ({ ok: true, data: { actorId: ctx.actorId, args } }), 'chat');
  assert.deepEqual(await registry.dispatch('  /ECHO   Hello   World  ', context), {
    ok: true, data: { actorId: 42, args: ['Hello', 'World'] },
  });
});

test('passes the supplied context through unchanged', async () => {
  const registry = new CommandRegistry();
  registry.register('context', (ctx) => ({ ok: true, data: ctx }), 'core');
  assert.equal((await registry.dispatch('/context', context)).data, context);
});

test('duplicates collide across case and optional slash aliases', () => {
  const registry = new CommandRegistry();
  registry.register('Echo', () => ({ ok: true, data: 1 }), 'one');
  assert.throws(() => registry.register('/ECHO', () => ({ ok: true, data: 2 }), 'two'));
  assert.deepEqual(registry.list(), ['echo']);
});

test('list returns a snapshot that cannot mutate registrations', async () => {
  const registry = new CommandRegistry();
  registry.register('echo', () => ({ ok: true, data: 'alive' }), 'one');
  const names = registry.list();
  names.length = 0;
  assert.deepEqual(registry.list(), ['echo']);
  assert.deepEqual(await registry.dispatch('/echo', context), { ok: true, data: 'alive' });
});

test('disposal removes only its registration and leaves other owners intact', async () => {
  const registry = new CommandRegistry();
  const dispose = registry.register('first', () => ({ ok: true, data: 1 }), 'one');
  registry.register('second', () => ({ ok: true, data: 2 }), 'two');
  dispose();
  dispose();
  assert.deepEqual(registry.list(), ['second']);
  assertFailure(await registry.dispatch('/first', context), 'NOT_FOUND');
  assert.deepEqual(await registry.dispatch('/second', context), { ok: true, data: 2 });
});

test('stale disposer cannot remove a later registration with the same owner', async () => {
  const registry = new CommandRegistry();
  const oldDispose = registry.register('echo', () => ({ ok: true, data: 'old' }), 'same');
  oldDispose();
  const newDispose = registry.register('/ECHO', () => ({ ok: true, data: 'new' }), 'same');
  oldDispose();
  assert.deepEqual(await registry.dispatch('/echo', context), { ok: true, data: 'new' });
  newDispose();
  assertFailure(await registry.dispatch('/echo', context), 'NOT_FOUND');
});

test('unknown commands have an explicit NOT_FOUND result', async () => {
  assertFailure(await new CommandRegistry().dispatch('/missing argument', context), 'NOT_FOUND');
});

test('a found command can return a business failure without becoming NOT_FOUND', async () => {
  const registry = new CommandRegistry();
  registry.register('buy', () => ({ ok: false, code: 'NO_GOLD', message: 'Not enough gold' }), 'shop');
  assert.deepEqual(await registry.dispatch('/buy', context), {
    ok: false, code: 'NO_GOLD', message: 'Not enough gold',
  });
});

test('awaits an asynchronous command result', async () => {
  const registry = new CommandRegistry();
  registry.register('async', async () => ({ ok: true, data: ['finished'] }), 'core');
  assert.deepEqual(await registry.dispatch('/async', context), { ok: true, data: ['finished'] });
});

test('synchronous handler exceptions become HANDLER_ERROR', async () => {
  const registry = new CommandRegistry();
  registry.register('throw', () => { throw new Error('broken'); }, 'core');
  assertFailure(await registry.dispatch('/throw', context), 'HANDLER_ERROR');
});

test('asynchronous rejection becomes HANDLER_ERROR even for non-Error values', async () => {
  const registry = new CommandRegistry();
  registry.register('reject', async () => { throw 'broken'; }, 'core');
  assertFailure(await registry.dispatch('/reject', context), 'HANDLER_ERROR');
});

test('empty, non-command and malformed command input is INVALID_INPUT', async () => {
  const registry = new CommandRegistry();
  for (const input of ['', '   ', 'echo', 'echo hello', '/', ' / ', '/ echo', '//echo', null, 123]) {
    assertFailure(await registry.dispatch(input, context), 'INVALID_INPUT');
  }
});

test('rejects control characters before any handler can run', async () => {
  const registry = new CommandRegistry();
  let calls = 0;
  registry.register('echo', () => { calls++; return { ok: true, data: null }; }, 'core');
  for (const input of ['/echo\n', '/echo\targ', '\r/echo', '/echo\0arg', '/echo\x7f', '/echo\x85']) {
    assertFailure(await registry.dispatch(input, context), 'INVALID_INPUT');
  }
  assert.equal(calls, 0);
});

test('accepts the 1024 character boundary and rejects 1025 characters', async () => {
  const registry = new CommandRegistry();
  registry.register('echo', (_ctx, args) => ({ ok: true, data: args[0].length }), 'core');
  assert.deepEqual(await registry.dispatch('/echo ' + 'x'.repeat(1018), context), { ok: true, data: 1018 });
  assertFailure(await registry.dispatch('/echo ' + 'x'.repeat(1019), context), 'INVALID_INPUT');
  assertFailure(await registry.dispatch(' '.repeat(1020) + '/echo', context), 'INVALID_INPUT');
});

test('treats quote and expression characters as literal argument text', async () => {
  const registry = new CommandRegistry();
  registry.register('echo', (_ctx, args) => ({ ok: true, data: args }), 'core');
  assert.deepEqual(await registry.dispatch('/echo "two words" ${1+1}', context), {
    ok: true, data: ['"two', 'words"', '${1+1}'],
  });
});

test('rejects malformed handler results instead of treating them as success', async () => {
  for (const result of [undefined, null, true, 'ok', {}, { ok: true }, { ok: 1, data: null },
    { ok: false, code: 1, message: 'bad' }, { ok: false, code: 'BAD' },
    { ok: false, code: 'BAD', message: null }]) {
    const registry = new CommandRegistry();
    registry.register('malformed', () => result, 'core');
    assertFailure(await registry.dispatch('/malformed', context), 'HANDLER_ERROR');
  }
});

test('a successful command may explicitly return undefined data', async () => {
  const registry = new CommandRegistry();
  registry.register('empty', () => ({ ok: true, data: undefined }), 'core');
  assert.deepEqual(await registry.dispatch('/empty', context), { ok: true, data: undefined });
});

test('invalid registration names cannot occupy uncallable aliases', () => {
  const registry = new CommandRegistry();
  for (const name of ['', ' ', '/', '//echo', 'two words', 'bad\nname']) {
    assert.throws(() => registry.register(name, () => ({ ok: true, data: null }), 'core'));
  }
  assert.deepEqual(registry.list(), []);
});
