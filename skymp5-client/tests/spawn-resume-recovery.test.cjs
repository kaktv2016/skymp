const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const esbuild = require('../../../skyrim-rp-launcher/node_modules/esbuild');

function harness() {
  let now = 0, currentCell = 0x3c, pos = [0, 0, 0], rot = [0, 0, 0], blocked = true;
  const events = new EventEmitter(), native = new EventEmitter(), moves = [], loads = [], notices = [], logs = [];
  let inUpdate = false;
  const emit = native.emit.bind(native);
  native.emit = (event, ...args) => {
    const before = inUpdate; inUpdate = event === 'update';
    try { return emit(event, ...args); } finally { inUpdate = before; }
  };
  const requireUpdate = () => assert.equal(inUpdate, true, 'Papyrus native calls require update, not networking tick/main menu');
  const player = {
    getWorldSpace: () => [0x3c, 0x12345].includes(currentCell) ? { getFormID: () => currentCell } : null,
    getParentCell: () => ({ getFormID: () => currentCell }),
    getPositionX: () => pos[0], getPositionY: () => pos[1], getPositionZ: () => pos[2],
    setAngle: (x, y, z) => { requireUpdate(); rot = [0, 0, z]; },
    getAngleX: () => rot[0], getAngleY: () => rot[1], getAngleZ: () => rot[2]
  };
  const controls = [true, true, true, true], changed = [];
  const sp = {
    Game: {
      setInChargen() {}, getPlayer: () => player,
      getFormEx: id => { requireUpdate(); return id === 0x999 ? null : { id }; },
      isMovementControlsEnabled: () => controls[0], isFightingControlsEnabled: () => controls[1],
      isLookingControlsEnabled: () => controls[2], isActivateControlsEnabled: () => controls[3],
      disablePlayerControls: (m, f, c, l, s, u, a) => { [m, f, l, a].forEach((v, i) => { if (v) controls[i] = false; }); },
      enablePlayerControls: (m, f, c, l, s, u, a) => { changed.push([m, f, l, a]); [m, f, l, a].forEach((v, i) => { if (v) controls[i] = true; }); }
    },
    Cell: { from: f => { requireUpdate(); return f && f.id === 0x13a8c ? f : null; } },
    WorldSpace: { from: f => { requireUpdate(); return f && [0x3c, 0x12345].includes(f.id) ? f : null; } },
    TESModPlatform: {
      moveRefrToPosition: (p, c, w, ...values) => {
        moves.push({ c, w, values });
        if (!blocked) {
          currentCell = (c || w).id;
          pos = values.slice(0, 3);
          rot = values.slice(3).map(radians => radians * 180 / Math.PI);
          rot[0] = 0; rot[1] = 0;
        }
      }
    },
    loadGame: (...args) => { loads.push(args); currentCell = args[2]; pos = args[0].slice(); rot = args[1].slice(); },
    Debug: { messageBox: msg => notices.push(msg), notification: msg => notices.push(msg) },
    printConsole: msg => notices.push(msg),
    writeLogs: (file, text) => logs.push({ file, text }),
    storage: {},
    mpClientPlugin: { destroyClient() {}, tick() {}, send() {}, sendRaw() {} }
  };

  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const js = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
    function req(name) {
      if (name === 'skyrimPlatform') return sp;
      if (name.endsWith('/logging')) return { logTrace() {}, logError() {} };
      if (name === './remoteServer') return { RemoteServer: class RemoteServer {} };
      return load(path.resolve(path.dirname(file), name + '.ts'));
    }
    const MockDate = class {
      constructor(val) { this._d = new Date(val !== undefined ? val : now); }
      toISOString() { return this._d.toISOString(); }
      static now() { return now; }
    };
    vm.runInNewContext('(function(require,module,exports){' + js + '\n})', { Date: MockDate, console, Number, Math, JSON })(req, mod, mod.exports);
    return mod.exports;
  }

  const root = path.resolve(__dirname, '../src/services/services');
  let bundled;
  if (process.env.FROSTVEIL_TEST_BUNDLE) {
    const bytes = fs.readFileSync(process.env.FROSTVEIL_TEST_BUNDLE, 'utf8');
    const boundary = bytes.lastIndexOf('var __webpack_exports__ = {};');
    assert.ok(boundary > 0);
    const context = { require: name => { if(name === 'skyrimPlatform') return sp; throw Error(name); },
      Date: class extends Date { static now(){ return now; } }, console, Number, Math, JSON };
    vm.runInNewContext(bytes.slice(0,boundary)+'globalThis.bundleRequire=__webpack_require__;})();',context);
    bundled = name => context.bundleRequire('./src/services/services/'+name+'.ts');
  }
  const gate = bundled ? bundled('spawnResume') : load(path.join(root, 'spawnResume.ts'));
  const { LoadGameService } = bundled ? bundled('loadGameService') : load(path.join(root, 'loadGameService.ts'));
  const controller = { on: (n, f) => native.on(n, f), once: (n, f) => native.once(n, f), emitter: events };
  const svc = new LoadGameService(sp, controller);
  events.emit('connectionAccepted', {});

  const update = (ms = 250) => { now += ms; native.emit('update', {}); };
  return {
    svc, gate, events, native, sp, moves, loads, notices, logs, controls, changed, update,
    cold() { native.emit('tick'); native.emit('tick'); },
    unblock() { blocked = false; },
    observe(c, p, r = [0, 0, 90]) { currentCell = c; pos = p.slice(); rot = r.slice(); },
    time(ms) { now += ms; native.emit('tick'); }
  };
}

test('Heartwood Mill regression: Z delta 32.52 units settles on terrain without black screen loop', () => {
  const h = harness();
  let ready = 0;
  const destination = {
    worldOrCell: 0x3c,
    pos: [132715.3125, -94707.3203125, 10846.70703125],
    rot: [0, 0, 291.0367736816406]
  };
  const observedTerrain = {
    worldOrCell: 0x3c,
    pos: [132715.3125, -94707.3203125, 10814.1904296875],
    rot: [0, 0, 291.0367431640625]
  };

  // Direct predicate verification
  assert.equal(h.gate.matchesSpawnPosition(observedTerrain, destination), true, 'Position matches within vertical tolerance 64');
  assert.equal(h.gate.matchesSpawnDestination(observedTerrain, destination), true, 'Destination matches within rotation tolerance 2');

  // Full service lifecycle verification
  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold();
  assert.equal(h.loads.length, 1, 'Initial cold-load staging executed');
  h.native.emit('loadGame');

  // Player lands on terrain at Heartwood Mill
  h.observe(observedTerrain.worldOrCell, observedTerrain.pos, observedTerrain.rot);
  h.update();

  assert.equal(ready, 1, 'Spawn readiness callback fired on first update');
  assert.equal(h.gate.isSpawnResumeHeld(), false, 'Spawn resume hold released');
  assert.equal(h.controls[0], true, 'Movement controls enabled');
  assert.equal(h.controls[1], true, 'Fighting controls enabled');
  assert.equal(h.controls[2], true, 'Looking controls enabled');
  assert.equal(h.controls[3], true, 'Activate controls enabled');
  assert.equal(h.moves.length, 0, 'No redundant moveRefrToPosition calls; black screen avoided');
  assert.ok(h.logs.some(l => l.text.includes('restored')), 'Logged successful restored event');
});

test('Cross-cell load rejection: different worldOrCell strictly holds controls and packet gate', () => {
  const h = harness();
  let ready = 0;
  const destination = { worldOrCell: 0x13a8c, pos: [100, 200, 300], rot: [0, 0, 90] };
  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold();
  h.native.emit('loadGame');

  // Player is in exterior staging 0x3c, not destination interior 0x13a8c
  h.observe(0x3c, [100, 200, 300], [0, 0, 90]);
  h.update();

  assert.equal(ready, 0, 'Must not fire ready callback across cells');
  assert.equal(h.gate.isSpawnResumeHeld(), true, 'Guard remains held');
  assert.equal(h.controls[0], false, 'Movement controls remain locked');
  assert.equal(h.gate.matchesSpawnPosition({ worldOrCell: 0x3c, pos: [100, 200, 300], rot: [0, 0, 90] }, destination), false);
  assert.equal(h.gate.isVerifiedSafeSpawn({ worldOrCell: 0x3c, pos: [100, 200, 300], rot: [0, 0, 90] }, destination), false);
});

test('Reconnect during spawn resume invalidates stale session generation', () => {
  const h = harness();
  let readyOld = 0, readyNew = 0;
  const dest1 = { worldOrCell: 0x3c, pos: [1000, 2000, 3000], rot: [0, 0, 0] };
  const dest2 = { worldOrCell: 0x3c, pos: [5000, 6000, 7000], rot: [0, 0, 180] };

  h.svc.spawnPlayer(dest1, undefined, [], undefined, () => readyOld++);
  h.cold();

  // Network disconnect/reconnect occurs mid-flight
  h.events.emit('connectionDisconnect', {});
  h.events.emit('connectionAccepted', {});

  // New spawn session starts
  h.svc.spawnPlayer(dest2, undefined, [], undefined, () => readyNew++);
  h.cold();
  h.native.emit('loadGame');

  // Arrive at dest2
  h.observe(dest2.worldOrCell, dest2.pos, dest2.rot);
  h.update();

  assert.equal(readyOld, 0, 'Old session callback must not fire');
  assert.equal(readyNew, 1, 'New session callback fires');
  assert.equal(h.gate.isSpawnResumeHeld(), false, 'Guard released for new session');
});

test('Timeout with unverified unsafe position stops relocation and maintains safety locks', () => {
  const h = harness();
  let ready = 0;
  const destination = { worldOrCell: 0x13a8c, pos: [100, 200, 300], rot: [0, 0, 90] };
  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold();
  h.native.emit('loadGame');

  // Destination never reached; advance past deadline (120s)
  h.time(125000);
  h.update();

  assert.equal(ready, 0, 'Unverified position must never trigger ready callback');
  assert.equal(h.gate.isSpawnResumeHeld(), true, 'Guard must remain held on timeout');
  assert.ok(h.notices.some(n => n.includes('Timed out waiting for the saved cell')), 'Timeout diagnostic posted');

  // Verify moveRefrToPosition loop is permanently halted
  const moveCount = h.moves.length;
  for (let i = 0; i < 10; i++) h.update();
  assert.equal(h.moves.length, moveCount, 'No further relocation attempts after failure');
});

test('Timeout with verified safe position (standing within safe recovery bounds) performs safe recovery', () => {
  const h = harness();
  let ready = 0;
  const destination = { worldOrCell: 0x3c, pos: [100, 200, 300], rot: [0, 0, 90] };
  // Observed position has horizontal offset 20 (> 16) and vertical offset 70 (> 64),
  // but strictly within recovery bounds (20 <= 32, 70 <= 96) in the same worldspace
  const observedNearby = { worldOrCell: 0x3c, pos: [120, 200, 370], rot: [0, 0, 90] };

  assert.equal(h.gate.matchesSpawnPosition(observedNearby, destination), false, 'Normal tolerance rejects');
  assert.equal(h.gate.isVerifiedSafeSpawn(observedNearby, destination), true, 'Recovery tolerance accepts');

  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold();
  h.native.emit('loadGame');

  h.observe(observedNearby.worldOrCell, observedNearby.pos, observedNearby.rot);
  h.update(); // Update observes the current nearby position into pending.lastObserved

  // Advance past deadline to trigger recovery
  h.time(125000);
  h.update();

  assert.equal(ready, 1, 'Safe recovery fired completion callback');
  assert.equal(h.gate.isSpawnResumeHeld(), false, 'Guard released on safe recovery');
  assert.equal(h.controls[0], true, 'Controls safely enabled');
  assert.ok(h.logs.some(l => l.text.includes('recovered')), 'Logged recovered diagnostic');
});

test('Wrong / far-away coordinates are strictly rejected by both normal and recovery predicates', () => {
  const h = harness();
  const target = { worldOrCell: 0x3c, pos: [100, 100, 100], rot: [0, 0, 0] };

  // Horizontal too far (> 32)
  const farHorizontal = { worldOrCell: 0x3c, pos: [150, 100, 100], rot: [0, 0, 0] };
  assert.equal(h.gate.matchesSpawnPosition(farHorizontal, target), false);
  assert.equal(h.gate.isVerifiedSafeSpawn(farHorizontal, target), false);

  // Vertical too far (> 96)
  const farVertical = { worldOrCell: 0x3c, pos: [100, 100, 250], rot: [0, 0, 0] };
  assert.equal(h.gate.matchesSpawnPosition(farVertical, target), false);
  assert.equal(h.gate.isVerifiedSafeSpawn(farVertical, target), false);

  // Both far away
  const farBoth = { worldOrCell: 0x3c, pos: [1000, 1000, 1000], rot: [0, 0, 0] };
  assert.equal(h.gate.matchesSpawnPosition(farBoth, target), false);
  assert.equal(h.gate.isVerifiedSafeSpawn(farBoth, target), false);

  // Different cell even if coordinates are identical
  const wrongCell = { worldOrCell: 0x13a8c, pos: [100, 100, 100], rot: [0, 0, 0] };
  assert.equal(h.gate.matchesSpawnPosition(wrongCell, target), false);
  assert.equal(h.gate.isVerifiedSafeSpawn(wrongCell, target), false);
});

test('Maximum relocation attempts cap prevents continuous engine thrashing', () => {
  const h = harness();
  const destination = { worldOrCell: 0x13a8c, pos: [100, 200, 300], rot: [0, 0, 90] };
  h.svc.spawnPlayer(destination);
  h.cold();
  h.native.emit('loadGame');

  // Engine is blocked and fails to reach destination
  for (let i = 0; i < 60; i++) h.update();

  assert.ok(h.moves.length <= h.gate.MAX_SPAWN_RELOCATION_ATTEMPTS, 'Relocation attempts capped at MAX_SPAWN_RELOCATION_ATTEMPTS');
  assert.ok(h.notices.some(n => n.includes('Exceeded maximum relocation attempts') || n.includes('restore stopped')), 'Diagnostic notice posted');
});

test('Facing differences never hold a player already standing at the destination', () => {
  const h = harness(); let ready = 0;
  const destination = { worldOrCell: 0x3c, pos: [100, 200, 300], rot: [0, 0, 90] };
  h.controls[1] = false; // Owned by another system before spawn.
  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold(); h.native.emit('loadGame');
  h.observe(0x3c, [100, 200, 268], [0, 0, 180]); h.update(); h.update();
  assert.equal(ready, 1); assert.equal(h.gate.isSpawnResumeHeld(), false);
  assert.equal(h.controls[0], true); assert.equal(h.controls[1], false);
  assert.equal(h.changed.length, 1); assert.equal(h.moves.length, 0);
  const completed = h.logs.find(l => l.text.includes('restored'));
  assert.ok(completed && completed.text.includes('elapsedMs') && completed.text.includes('moveAttempts'));
});

test('Networking deadline cannot finish restoration or restore controls outside update', () => {
  const h = harness(); let ready = 0;
  const destination = { worldOrCell: 0x3c, pos: [100, 200, 300], rot: [0, 0, 90] };
  h.svc.spawnPlayer(destination, undefined, [], undefined, () => ready++);
  h.cold(); h.native.emit('loadGame');
  h.observe(0x3c, [120, 200, 370]); h.update();
  h.time(125000);
  assert.equal(ready, 0); assert.equal(h.gate.isSpawnResumeHeld(), true);
  // A stale safe observation must not be accepted after the player changed cell.
  h.observe(0x13a8c, [120, 200, 370]); h.update();
  assert.equal(ready, 0); assert.equal(h.gate.isSpawnResumeHeld(), true);
});
