const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminService, TELEPORT_WHITELIST } = require('../.test-build/modules/admin/admin-service.js');
const { CourierService } = require('../.test-build/modules/courier/courier-service.js');
const { courierSettings } = require('../.test-build/modules/courier/contracts.js');
const { courierConfig } = require('../.test-build/config/courier.js');

function createFixture(initialPos = [122694.9453125, -66909.78125, 11639.1201171875]) {
  let guid = 'guid-mock-1';
  let profileId = 42;
  let allowed = true;
  let now = 50000;
  const principal = 'local-operator:owner#nonce-mock';
  const logs = [];
  const systemMessages = [];
  let currentPos = [...initialPos];
  let currentCell = '3c:Skyrim.esm';
  let courierState = {
    lifecycle: 'idle',
    activeContractId: null,
    completedDeliveries: 5,
    reputation: 25
  };
  let courierWriteCount = 0;

  const adapter = {
    sessionForActor: (actor) => ({ actorId: actor, userId: 1, profileId, guid }),
    location: (actor) => ({ cell: currentCell, pos: [...currentPos] }),
    fullLocation: (actor) => ({ cell: currentCell, pos: [...currentPos], rot: [0, 0, 0] }),
    readCourier: (actor) => JSON.parse(JSON.stringify(courierState)),
    writeCourier: (actor, next) => {
      courierWriteCount++;
      courierState = JSON.parse(JSON.stringify(next));
    },
    teleport: () => {}
  };

  const settings = courierSettings(courierConfig);
  let adminService;
  const courierService = new CourierService(adapter, settings, (actor) => adminService.isMockActive(actor));

  adminService = new AdminService(adapter, {
    authorize: (s) => (allowed && s.profileId === profileId ? principal : null),
    now: () => now,
    log: (text) => logs.push(text),
    sendSystemMessage: (actor, msg) => systemMessages.push({ actor, msg }),
    courierRoutes: courierService.routes(),
    getActiveCourierJob: (actor) => {
      const state = adapter.readCourier(actor);
      if (!state || state.lifecycle !== 'active' || !state.activeContractId) return null;
      const r = courierService.route(state.activeContractId);
      return r ? { route: r } : null;
    }
  });

  return {
    admin: adminService,
    courier: courierService,
    adapter,
    getCourierWrites: () => courierWriteCount,
    getCourierState: () => JSON.parse(JSON.stringify(courierState)),
    setPos: (pos, cell = currentCell) => {
      currentPos = [...pos];
      currentCell = cell;
    },
    advance: (ms) => (now += ms)
  };
}

test('mock courier test starts in memory, sets amber beacon and quest details with null rewards', () => {
  const f = createFixture();
  const res = f.admin.execute(1, ['courier', 'test', 'sarethi-farm']);
  assert.equal(res.ok, true);
  assert.match(res.data.systemMessage, /เปิดงานจำลอง Courier: จดหมายถึงฟาร์ม Sarethi/);
  assert.equal(f.admin.isMockActive(1), true);

  // Check amber waypoint (navigation)
  const nav = f.admin.mockNavigation(1);
  assert.ok(nav);
  assert.equal(nav.style, 'amber');
  assert.equal(nav.cell.toLowerCase(), '3c:skyrim.esm');
  assert.deepEqual(nav.pos, [113230.2109375, -70612.046875, 11489.9326171875]);

  // Check quest details (journal / map / compass)
  const quest = f.admin.mockQuest(1);
  assert.ok(quest);
  assert.equal(quest.targetKey, 'sarethi-farm-v1');
  assert.equal(quest.reward, null);
  assert.equal(quest.xpReward, null);
});

test('mock courier job blocks /job accept and /job deliver with clear prompt', () => {
  const f = createFixture();
  f.admin.execute(1, ['courier', 'test', 'sarethi-farm']);

  // Trying to accept real job while mock is active -> blocked!
  const resAccept = f.courier.execute(1, ['accept', 'courier-route-1']);
  assert.equal(resAccept.ok, false);
  assert.match(resAccept.message, /มีงานจำลอง Courier ค้างอยู่ กรุณาใช้ \/admin courier clear/);

  // Trying to deliver real job while mock is active -> blocked!
  const resDeliver = f.courier.execute(1, ['deliver']);
  assert.equal(resDeliver.ok, false);
  assert.match(resDeliver.message, /มีงานจำลอง Courier ค้างอยู่ กรุณาใช้ \/admin courier clear/);

  // Courier state in adapter must NOT have been written to
  assert.equal(f.getCourierWrites(), 0);
});

test('strict memory isolation: complete mock job does NOT award gold, XP, reputation, or touch journal', () => {
  const f = createFixture();
  const initialCourierState = f.getCourierState();

  f.admin.execute(1, ['courier', 'test', 'sarethi-farm']);

  // Check status while outside zone
  const resStatus = f.admin.execute(1, ['courier', 'status']);
  assert.equal(resStatus.ok, true);
  assert.match(resStatus.data.systemMessage, /Sarethi Farm/);

  // Attempt complete while outside delivery radius
  const resEarlyComplete = f.admin.execute(1, ['courier', 'complete']);
  assert.equal(resEarlyComplete.ok, false);
  assert.equal(resEarlyComplete.code, 'NOT_IN_ZONE');

  // Move player into delivery zone
  f.setPos([113230.2109375, -70612.046875, 11489.9326171875]);
  const resComplete = f.admin.execute(1, ['courier', 'complete']);
  assert.equal(resComplete.ok, true);
  assert.match(resComplete.data.systemMessage, /ส่งงานจำลองสำเร็จ.*ไม่เปลี่ยนแปลงสถิติหรือ Journal จริง/);

  // Mock job is now ended
  assert.equal(f.admin.isMockActive(1), false);
  assert.equal(f.admin.mockNavigation(1), null);
  assert.equal(f.admin.mockQuest(1), null);

  // ABSOLUTE ISOLATION VERIFICATION:
  // 1. Adapter writeCourier was NEVER called
  assert.equal(f.getCourierWrites(), 0);
  // 2. Real courier state remains exactly the same
  assert.deepEqual(f.getCourierState(), initialCourierState);
});

test('/admin courier clear restores real courier job markers and unblocks /job', () => {
  const f = createFixture();
  // First accept real job
  f.courier.execute(1, ['accept', 'courier-route-1']);
  assert.equal(f.getCourierWrites(), 1);
  assert.equal(f.getCourierState().lifecycle, 'active');
  const realWaypoint = f.courier.waypoint(1);
  assert.ok(realWaypoint);
  assert.equal(realWaypoint.label, 'จุดส่งจดหมายเดิม');

  // Start mock job
  f.admin.execute(1, ['courier', 'test', 'sarethi-farm']);
  // Navigation now reflects mock job
  assert.equal(f.admin.mockNavigation(1).label, 'Sarethi Farm — จุดลงแผนที่');

  // Clear mock job
  const resClear = f.admin.execute(1, ['courier', 'clear']);
  assert.equal(resClear.ok, true);
  assert.equal(f.admin.isMockActive(1), false);
  assert.equal(f.admin.mockNavigation(1), null);

  // Real job navigation is still intact!
  const restoredWaypoint = f.courier.waypoint(1);
  assert.ok(restoredWaypoint);
  assert.equal(restoredWaypoint.label, 'จุดส่งจดหมายเดิม');
});

test('/admin reset clears mock job, fly, speed and navtest without teleporting', () => {
  const f = createFixture();
  f.admin.execute(1, ['fly', 'on']);
  f.admin.execute(1, ['speed', '3']);
  f.admin.execute(1, ['courier', 'test', 'navtest']);

  assert.equal(f.admin.isMockActive(1), true);
  assert.equal(f.admin.state(1).fly, true);
  assert.equal(f.admin.state(1).speed, 3);

  const resReset = f.admin.execute(1, ['reset']);
  assert.equal(resReset.ok, true);

  assert.equal(f.admin.state(1).fly, false);
  assert.equal(f.admin.state(1).speed, 1);
  assert.equal(f.admin.state(1).testNavigation, false);
  assert.equal(f.admin.isMockActive(1), false);
});
