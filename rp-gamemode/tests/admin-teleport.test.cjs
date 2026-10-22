const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminService, TELEPORT_WHITELIST } = require('../.test-build/modules/admin/admin-service.js');

function createFixture(initialPos = [1000, 2000, 3000], initialCell = '3c:Skyrim.esm') {
  let guid = 'guid-1';
  let profileId = 10;
  let allowed = true;
  let now = 10000;
  let principal = 'local-operator:owner#nonce-1';
  const logs = [];
  const systemMessages = [];
  let currentPos = [...initialPos];
  let currentRot = [0, 0, 0];
  let currentCell = initialCell;
  const teleportCalls = [];

  const adapter = {
    sessionForActor: (actor) => ({ actorId: actor, userId: 1, profileId, guid }),
    location: (actor) => ({ cell: currentCell, pos: [...currentPos] }),
    fullLocation: (actor) => ({ cell: currentCell, pos: [...currentPos], rot: [...currentRot] }),
    teleport: (actor, loc) => {
      teleportCalls.push({ actor, loc });
      // In SkyMP, adapter.teleport sends TeleportMessage; physical movement arrives via client sync later.
    }
  };

  const service = new AdminService(adapter, {
    authorize: (s) => (allowed && s.profileId === profileId ? principal : null),
    now: () => now,
    log: (text) => logs.push(text),
    sendSystemMessage: (actor, msg) => systemMessages.push({ actor, msg }),
    courierRoutes: [
      {
        id: 'sarethi-farm',
        displayName: 'จดหมายถึงฟาร์ม Sarethi',
        pickup: { label: 'Rift Watchtower', cell: '3c:Skyrim.esm', pos: [122694.9, -66909.7, 11639.1] },
        delivery: { label: 'Sarethi Farm — จุดลงแผนที่', cell: '3c:Skyrim.esm', pos: [113230.2, -70612.0, 11489.9] },
        radius: 200
      }
    ]
  });

  return {
    service,
    logs,
    systemMessages,
    teleportCalls,
    advance: (ms) => (now += ms),
    now: () => now,
    setPos: (pos, cell = currentCell) => {
      currentPos = [...pos];
      currentCell = cell;
    },
    setRot: (rot) => (currentRot = [...rot]),
    reconnect: () => (guid = 'guid-2'),
    revoke: () => (allowed = false)
  };
}

test('admin authorization check: unverified player cannot execute teleport or inspect location', () => {
  const f = createFixture();
  f.revoke();
  const resWhere = f.service.execute(1, ['where']);
  assert.equal(resWhere.ok, false);
  assert.equal(resWhere.code, 'ADMIN_DENIED');

  const resTp = f.service.execute(1, ['tp', 'pickup']);
  assert.equal(resTp.ok, false);
  assert.equal(resTp.code, 'ADMIN_DENIED');
  assert.equal(f.teleportCalls.length, 0);
});

test('/admin where returns formatted cell, coordinates, and angles', () => {
  const f = createFixture([123.456, -789.123, 45.678]);
  f.setRot([1.234, -5.678, 90.0]);
  const res = f.service.execute(1, ['where']);
  assert.equal(res.ok, true);
  assert.match(res.data.systemMessage, /World\/Cell=3c:Skyrim\.esm/);
  assert.match(res.data.systemMessage, /Pos=\[123\.46, -789\.12, 45\.68\]/);
  assert.match(res.data.systemMessage, /Rot=\[1\.23, -5\.68, 90\.00\]/);
});

test('/admin tp list shows all whitelisted points', () => {
  const f = createFixture();
  const res = f.service.execute(1, ['tp', 'list']);
  assert.equal(res.ok, true);
  assert.match(res.data.systemMessage, /pickup/);
  assert.match(res.data.systemMessage, /courier-route-1/);
  assert.match(res.data.systemMessage, /sarethi-farm/);
  assert.match(res.data.systemMessage, /heartwood-mill/);
  assert.match(res.data.systemMessage, /merryfair-farm/);
  assert.match(res.data.systemMessage, /shors-stone/);
  assert.match(res.data.systemMessage, /navtest/);
  assert.match(res.data.systemMessage, /delivery/);
  assert.match(res.data.systemMessage, /back/);
});

test('cooldown (3s) and single in-flight request protection', () => {
  const f = createFixture();
  const res1 = f.service.execute(1, ['tp', 'pickup']);
  assert.equal(res1.ok, true);
  assert.equal(f.teleportCalls.length, 1);

  // Immediate second teleport while in-flight -> rejected with ADMIN_COOLDOWN or ADMIN_PENDING
  const res2 = f.service.execute(1, ['tp', 'pickup']);
  assert.equal(res2.ok, false);
  assert.ok(res2.code === 'ADMIN_COOLDOWN' || res2.code === 'ADMIN_PENDING');
  assert.equal(f.teleportCalls.length, 1);

  // Advance 1 second (still in cooldown)
  f.advance(1000);
  const res3 = f.service.execute(1, ['tp', 'pickup']);
  assert.equal(res3.ok, false);
  assert.equal(res3.code, 'ADMIN_COOLDOWN');
});

test('dual confirmation protocol: requires BOTH Client ACK and post-request Movement Observation', () => {
  const f = createFixture([0, 0, 0]);
  const res = f.service.execute(1, ['tp', 'pickup']);
  assert.equal(res.ok, true);

  const pending = f.service.getPendingTeleport(1);
  assert.ok(pending);
  assert.equal(pending.clientAck, false);
  assert.equal(pending.movementObserved, false);

  const target = TELEPORT_WHITELIST.pickup;

  // 1. Client ACK alone arrives -> does NOT complete confirmation
  f.advance(500);
  f.service.receiveClientAck(1, pending.requestId, target.cell, target.pos);
  assert.equal(f.service.getPendingTeleport(1)?.clientAck, true);
  assert.equal(f.service.getPendingTeleport(1)?.movementObserved, false);
  assert.equal(f.systemMessages.length, 0); // No confirmed message yet!

  // 2. Movement observation arrives (position updated in game) -> triggers dual confirmation!
  f.setPos(target.pos, target.cell);
  f.service.tick();

  // Now both are satisfied!
  assert.equal(f.service.getPendingTeleport(1), null); // Cleared
  assert.equal(f.systemMessages.length, 1);
  assert.match(f.systemMessages[0].msg, /วาร์ปสำเร็จ.*ยืนยันสองทาง/);
  assert.ok(f.logs.some((l) => l.includes('teleport confirmed')));

  // Back location is committed to the starting position [0, 0, 0]
  const back = f.service.getBackLocation(1);
  assert.ok(back);
  assert.deepEqual(back.pos, [0, 0, 0]);
});

test('dual confirmation protocol: movement observation alone without Client ACK does NOT confirm', () => {
  const f = createFixture([0, 0, 0]);
  f.service.execute(1, ['tp', 'pickup']);

  const target = TELEPORT_WHITELIST.pickup;
  f.advance(200);
  f.setPos(target.pos, target.cell);
  f.service.tick();

  const pending = f.service.getPendingTeleport(1);
  assert.ok(pending);
  assert.equal(pending.movementObserved, true);
  assert.equal(pending.clientAck, false);
  assert.equal(f.systemMessages.length, 0); // Not completed yet!

  // Now Client ACK arrives
  f.service.receiveClientAck(1, pending.requestId, target.cell, target.pos);
  assert.equal(f.service.getPendingTeleport(1), null); // Completed
  assert.equal(f.systemMessages.length, 1);
  assert.match(f.systemMessages[0].msg, /วาร์ปสำเร็จ/);
});

test('teleport timeout (20s): unconfirmed teleport does NOT auto-retry or auto-revert', () => {
  const f = createFixture([0, 0, 0]);
  f.service.execute(1, ['tp', 'pickup']);

  // Advance time past 20 seconds without confirmations
  f.advance(20500);
  f.service.tick();

  assert.equal(f.service.getPendingTeleport(1), null); // Timed out and cleared
  assert.equal(f.systemMessages.length, 1);
  assert.match(f.systemMessages[0].msg, /การวาร์ปไม่สามารถยืนยันได้.*หมดเวลา 20s/);
  assert.ok(f.logs.some((l) => l.includes('teleport timeout')));

  // Back location must NOT have been updated
  assert.equal(f.service.getBackLocation(1), null);
  // Teleport must NOT have been called again (no auto-retry, no auto-revert)
  assert.equal(f.teleportCalls.length, 1);
});

test('/admin back swaps positions (Ping-Pong Swap) upon successful return', () => {
  const f = createFixture([100, 200, 300]);
  f.service.execute(1, ['tp', 'pickup']);
  const req1 = f.service.getPendingTeleport(1).requestId;
  const pickup = TELEPORT_WHITELIST.pickup;

  f.advance(500);
  f.setPos(pickup.pos, pickup.cell);
  f.service.receiveClientAck(1, req1, pickup.cell, pickup.pos);
  f.service.tick();

  // First jump confirmed. Back location should be [100, 200, 300]
  assert.deepEqual(f.service.getBackLocation(1).pos, [100, 200, 300]);

  // Advance cooldown
  f.advance(3500);

  // Now call /admin back!
  const resBack = f.service.execute(1, ['back']);
  assert.equal(resBack.ok, true);

  const req2 = f.service.getPendingTeleport(1).requestId;
  f.advance(500);
  f.setPos([100, 200, 300], '3c:Skyrim.esm');
  f.service.receiveClientAck(1, req2, '3c:Skyrim.esm', [100, 200, 300]);
  f.service.tick();

  // Back jump confirmed! Back location is now SWAPPED to pickup.pos!
  assert.deepEqual(f.service.getBackLocation(1).pos, pickup.pos);

  // Advance cooldown
  f.advance(3500);

  // Calling /admin back a second time jumps back to pickup!
  const resBack2 = f.service.execute(1, ['back']);
  assert.equal(resBack2.ok, true);
  assert.equal(f.teleportCalls[f.teleportCalls.length - 1].loc.cell, pickup.cell);
});

test('/admin tp delivery prefers mock job over real job', () => {
  const f = createFixture();
  // Start mock job
  f.service.execute(1, ['courier', 'test', 'sarethi-farm']);

  // Request tp delivery
  const res = f.service.execute(1, ['tp', 'delivery']);
  assert.equal(res.ok, true);
  assert.match(res.data.systemMessage, /Sarethi Farm/);
  const call = f.teleportCalls[f.teleportCalls.length - 1];
  assert.deepEqual(call.loc.pos, [113230.2, -70612.0, 11489.9]);
});

test('disconnect and character change purge in-memory back location and pending teleport', () => {
  const f = createFixture([50, 60, 70]);
  f.service.execute(1, ['tp', 'pickup']);
  const req = f.service.getPendingTeleport(1).requestId;
  const pickup = TELEPORT_WHITELIST.pickup;

  f.advance(500);
  f.setPos(pickup.pos, pickup.cell);
  f.service.receiveClientAck(1, req, pickup.cell, pickup.pos);
  f.service.tick();
  assert.ok(f.service.getBackLocation(1));

  // Reconnect with new GUID
  f.reconnect();
  assert.equal(f.service.getBackLocation(1), null);
  assert.equal(f.service.getPendingTeleport(1), null);
});
