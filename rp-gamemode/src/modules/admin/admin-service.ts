import { randomUUID } from 'node:crypto';
import type { SkyMpAdapter, ActorSession, TransformLocation } from '../../engine/adapter';
import type { ActorId, FormDesc } from '../../engine/ids';
import { formDesc } from '../../engine/ids';
import type { CommandResult } from '../../core/command-registry';
import { cellKey, inZone, type CourierPoint, type CourierRoute } from '../courier/contracts';
import type { CourierWaypoint, QuestDetails } from '../chat/contracts';
import { questDetails } from '../courier/quest-details';

export interface AdminTeleportRequest {
  requestId: string;
  generation: number;
  targetCell: string;
  targetPos: readonly [number, number, number];
}

export interface AdminMovement {
  revision: number;
  fly: boolean;
  speed: number;
  testNavigation: boolean;
  explicitDoors: boolean;
  teleportRequest?: AdminTeleportRequest | null;
}

export interface AdminOptions {
  authorize?: (session: ActorSession) => string | null;
  now?: () => number;
  log?: (text: string) => void;
  sendSystemMessage?: (actor: ActorId, text: string) => void;
  courierRoutes?: readonly CourierRoute[];
  getActiveCourierJob?: (actor: ActorId) => { route: CourierRoute } | null;
}

export interface TeleportTarget {
  id: string;
  label: string;
  cell: FormDesc;
  pos: readonly [number, number, number];
  rot: readonly [number, number, number];
  radius: number;
}

export interface MockCourierJob {
  id: string;
  routeId: string;
  displayName: string;
  delivery: CourierPoint;
  radius: number;
  targetKey: string;
  startedAt: number;
}

interface Entry {
  guid: string;
  principal: string;
  profile: number;
  user: number;
  value: AdminMovement;
}

interface PendingTeleport {
  requestId: string;
  generation: number;
  target: TeleportTarget;
  startedAt: number;
  candidateBackLocation: TransformLocation;
  clientAck: boolean;
  clientAckAt?: number;
  movementObserved: boolean;
  movementObservedAt?: number;
  initialLocation: TransformLocation;
  actor: ActorId;
  sessionGuid: string;
  isBack: boolean;
}

export const TELEPORT_WHITELIST: Record<string, TeleportTarget> = {
  pickup: {
    id: 'pickup',
    label: 'จุดรับจดหมาย Rift Watchtower',
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [122694.9453125, -66909.78125, 11639.1201171875],
    rot: [0, 0, 0],
    radius: 200
  },
  'courier-route-1': {
    id: 'courier-route-1',
    label: 'จุดส่งจดหมายเดิม (Route 1)',
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [123342.421875, -65940.078125, 11686.185546875],
    rot: [0, 0, 0],
    radius: 200
  },
  'sarethi-farm': {
    id: 'sarethi-farm',
    label: 'Sarethi Farm — จุดลงแผนที่',
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [113230.2109375, -70612.046875, 11489.9326171875],
    rot: [0, 0, 0],
    radius: 200
  },
  'heartwood-mill': {
    id: 'heartwood-mill',
    label: 'Heartwood Mill — จุดลงแผนที่',
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [133492.171875, -95859.5546875, 10712.95703125],
    rot: [0, 0, 0],
    radius: 200
  },
  'merryfair-farm': {
    id: 'merryfair-farm',
    label: 'Merryfair Farm — จุดลงแผนที่',
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [166696.125, -88590.9765625, 11069.578125],
    rot: [0, 0, 0],
    radius: 200
  },
  'shors-stone': {
    id: 'shors-stone',
    label: "Shor's Stone — จุดลงแผนที่",
    cell: '3c:Skyrim.esm' as FormDesc,
    pos: [163113.09375, -62752.30078125, 7487.85791015625],
    rot: [0, 0, 0],
    radius: 200
  },
  navtest: {
    id: 'navtest',
    label: 'The Bee and Barb, Riften (test only)',
    cell: '16bdf:Skyrim.esm' as FormDesc,
    pos: [-195.9238739013672, -545.3919677734375, 64],
    rot: [0, 0, 0],
    radius: 200
  }
};

export const adminHints = [
  'help',
  'where',
  'tp list',
  'tp pickup',
  'tp delivery',
  'tp navtest',
  'tp courier-route-1',
  'tp sarethi-farm',
  'tp heartwood-mill',
  'tp merryfair-farm',
  'tp shors-stone',
  'back',
  'courier test navtest',
  'courier test courier-route-1',
  'courier test sarethi-farm',
  'courier test heartwood-mill',
  'courier test merryfair-farm',
  'courier test shors-stone',
  'courier status',
  'courier complete',
  'courier clear',
  'fly on',
  'fly off',
  'speed 1',
  'speed 2',
  'speed 3',
  'speed 4',
  'speed 5',
  'speed reset',
  'reset',
  'status',
  'navtest on',
  'navtest off',
  'navtest doors',
  'navtest native'
] as const;

export class AdminService {
  private entries = new Map<ActorId, Entry>();
  private revision = 0;
  private teleportGeneration = 0;
  private pendingTeleports = new Map<ActorId, PendingTeleport>();
  private backLocations = new Map<ActorId, TransformLocation>();
  private lastTeleportAt = new Map<ActorId, number>();
  private mockJobs = new Map<ActorId, MockCourierJob>();

  constructor(private readonly adapter: SkyMpAdapter, private readonly options: AdminOptions = {}) {}

  private entry(actor: ActorId): Entry | null {
    try {
      const s = this.adapter.sessionForActor(actor);
      const principal = this.options.authorize?.(s);
      if (typeof principal !== 'string' || !principal || principal.length > 128) {
        this.entries.delete(actor);
        this.pendingTeleports.delete(actor);
        this.backLocations.delete(actor);
        this.mockJobs.delete(actor);
        this.lastTeleportAt.delete(actor);
        return null;
      }
      let e = this.entries.get(actor);
      if (!e || e.guid !== s.guid || e.user !== s.userId || e.profile !== s.profileId || e.principal !== principal) {
        this.pendingTeleports.delete(actor);
        this.backLocations.delete(actor);
        this.mockJobs.delete(actor);
        this.lastTeleportAt.delete(actor);
        e = {
          guid: s.guid,
          user: s.userId,
          profile: s.profileId,
          principal,
          value: {
            revision: ++this.revision,
            fly: false,
            speed: 1,
            testNavigation: false,
            explicitDoors: false,
            teleportRequest: null
          }
        };
        this.entries.set(actor, e);
      }
      return e;
    } catch {
      this.entries.delete(actor);
      this.pendingTeleports.delete(actor);
      this.backLocations.delete(actor);
      this.mockJobs.delete(actor);
      this.lastTeleportAt.delete(actor);
      return null;
    }
  }

  state(actor: ActorId): AdminMovement | null {
    const e = this.entry(actor);
    return e ? { ...e.value } : null;
  }

  isMockActive(actor: ActorId): boolean {
    return this.entry(actor) !== null && this.mockJobs.has(actor);
  }

  mockNavigation(actor: ActorId): CourierWaypoint | null {
    if (!this.entry(actor)) return null;
    const job = this.mockJobs.get(actor);
    if (!job) return null;
    return {
      id: job.id,
      cell: job.delivery.cell,
      pos: job.delivery.pos,
      label: job.delivery.label,
      style: 'amber'
    };
  }

  mockQuest(actor: ActorId): QuestDetails | null {
    if (!this.entry(actor)) return null;
    const job = this.mockJobs.get(actor);
    if (!job) return null;
    if (job.routeId === 'navtest') {
      return {
        id: job.id,
        targetKey: job.targetKey,
        title: job.displayName,
        destination: job.delivery.label,
        reward: null,
        xpReward: null,
        explicitDoors: true
      };
    }
    const waypoint = this.mockNavigation(actor);
    return questDetails(waypoint, null, null);
  }

  getBackLocation(actor: ActorId): TransformLocation | null {
    if (!this.entry(actor)) return null;
    const loc = this.backLocations.get(actor);
    return loc ? { cell: loc.cell, pos: [...loc.pos], rot: [...loc.rot] } : null;
  }

  getPendingTeleport(actor: ActorId): { requestId: string; targetId: string; clientAck: boolean; movementObserved: boolean } | null {
    if (!this.entry(actor)) return null;
    const p = this.pendingTeleports.get(actor);
    return p ? { requestId: p.requestId, targetId: p.target.id, clientAck: p.clientAck, movementObserved: p.movementObserved } : null;
  }

  receiveClientAck(actor: ActorId, id: string, cell: unknown, pos: unknown): void {
    const pending = this.pendingTeleports.get(actor);
    if (!pending || pending.requestId !== id) return;
    const now = this.options.now ? this.options.now() : Date.now();
    if (now - pending.startedAt > 20000) return;
    try {
      if (typeof cell === 'string' && Array.isArray(pos) && pos.length === 3 && pos.every(v => typeof v === 'number' && Number.isFinite(v))) {
        const targetCellKey = cellKey(pending.target.cell);
        const targetHex = targetCellKey.split(':')[0]!;
        const cleanCell = cell.replace(/^0x/i, '').toLowerCase();
        const cellMatches = cleanCell === targetHex || cleanCell === targetCellKey || cleanCell.includes(targetHex);
        const distance = Math.hypot(
          pos[0] - pending.target.pos[0],
          pos[1] - pending.target.pos[1],
          pos[2] - pending.target.pos[2]
        );
        if (cellMatches && distance <= 256) {
          pending.clientAck = true;
          pending.clientAckAt = now;
          this.checkDualConfirmation(actor, pending, now);
        }
      }
    } catch {}
  }

  private checkDualConfirmation(actor: ActorId, pending: PendingTeleport, now: number): boolean {
    if (!pending.clientAck || !pending.movementObserved) return false;
    const elapsed = now - pending.startedAt;
    const e = this.entries.get(actor);

    // Commit back location
    this.backLocations.set(actor, pending.candidateBackLocation);

    // Clear teleportRequest
    if (e && e.value.teleportRequest?.requestId === pending.requestId) {
      e.value = { ...e.value, revision: ++this.revision, teleportRequest: null };
    }

    this.pendingTeleports.delete(actor);

    const principal = e ? e.principal.split('#')[0] : 'unknown';
    this.options.log?.(`[rp-admin] account=${principal} actor=${actor.toString(16)} teleport confirmed target=${pending.target.id} duration=${elapsed}ms`);
    this.options.sendSystemMessage?.(
      actor,
      `[ADMIN] วาร์ปสำเร็จ: ${pending.target.label} (ยืนยันสองทางใน ${elapsed}ms) / Teleport confirmed (${elapsed}ms)`
    );
    return true;
  }

  tick(): void {
    const now = this.options.now ? this.options.now() : Date.now();
    for (const [actor, pending] of this.pendingTeleports.entries()) {
      // 1. Timeout check (20s)
      if (now - pending.startedAt > 20000) {
        const e = this.entries.get(actor);
        if (e && e.value.teleportRequest?.requestId === pending.requestId) {
          e.value = { ...e.value, revision: ++this.revision, teleportRequest: null };
        }
        this.pendingTeleports.delete(actor);
        const principal = e ? e.principal.split('#')[0] : 'unknown';
        this.options.log?.(`[rp-admin] account=${principal} actor=${actor.toString(16)} teleport timeout target=${pending.target.id} duration=20000ms`);
        this.options.sendSystemMessage?.(
          actor,
          `[ADMIN] การวาร์ปไม่สามารถยืนยันได้ (หมดเวลา 20s) ตำแหน่งไม่ได้รับการรับรอง / Teleport unconfirmed (timeout after 20s)`
        );
        continue;
      }

      // 2. Post-request Movement Observation check
      if (!pending.movementObserved) {
        try {
          const current = this.adapter.fullLocation(actor);
          const matchesCell = cellKey(current.cell) === cellKey(pending.target.cell);
          const distance = Math.hypot(
            current.pos[0] - pending.target.pos[0],
            current.pos[1] - pending.target.pos[1],
            current.pos[2] - pending.target.pos[2]
          );
          if (matchesCell && distance <= 256) {
            if (now >= pending.startedAt + 50) {
              pending.movementObserved = true;
              pending.movementObservedAt = now;
              this.checkDualConfirmation(actor, pending, now);
            }
          }
        } catch {}
      }
    }
  }

  private initiateTeleport(actor: ActorId, e: Entry, target: TeleportTarget, isBack = false): CommandResult {
    const now = this.options.now ? this.options.now() : Date.now();
    const lastAt = this.lastTeleportAt.get(actor) ?? 0;
    if (now - lastAt < 3000) {
      const remainSec = Math.ceil((3000 - (now - lastAt)) / 1000);
      return { ok: false, code: 'ADMIN_COOLDOWN', message: `[ADMIN] กรุณารอ Cooldown อีก ${remainSec} วินาที / teleport cooldown active` };
    }
    if (this.pendingTeleports.has(actor)) {
      return { ok: false, code: 'ADMIN_PENDING', message: `[ADMIN] มีการวาร์ปค้างอยู่ รอการยืนยันหรือ timeout / teleport request already pending` };
    }

    let currentLoc: TransformLocation;
    try {
      currentLoc = this.adapter.fullLocation(actor);
    } catch {
      return { ok: false, code: 'LOCATION_UNAVAILABLE', message: `[ADMIN] ไม่สามารถอ่านตำแหน่งปัจจุบันของตัวละครได้ / current location unavailable` };
    }

    const requestId = randomUUID();
    const generation = ++this.teleportGeneration;

    const pending: PendingTeleport = {
      requestId,
      generation,
      target,
      startedAt: now,
      candidateBackLocation: currentLoc,
      clientAck: false,
      movementObserved: false,
      initialLocation: currentLoc,
      actor,
      sessionGuid: e.guid,
      isBack
    };

    this.pendingTeleports.set(actor, pending);
    this.lastTeleportAt.set(actor, now);

    e.value = {
      ...e.value,
      revision: ++this.revision,
      teleportRequest: {
        requestId,
        generation,
        targetCell: formDesc(target.cell),
        targetPos: target.pos
      }
    };

    try {
      this.adapter.teleport(actor, {
        cell: target.cell,
        pos: target.pos,
        rot: target.rot
      });
    } catch (error) {
      this.pendingTeleports.delete(actor);
      e.value = { ...e.value, revision: ++this.revision, teleportRequest: null };
      return { ok: false, code: 'TELEPORT_FAILED', message: `[ADMIN] วาร์ปไม่สำเร็จ: ${error instanceof Error ? error.message : 'native failure'}` };
    }

    this.options.log?.(`[rp-admin] account=${e.principal.split('#')[0]} actor=${actor.toString(16)} teleport initiated target=${target.id} requestId=${requestId}`);
    return {
      ok: true,
      data: {
        systemMessage: `[ADMIN] กำลังวาร์ปไป ${target.label}... รอการยืนยันสองทาง (timeout 20s) / Teleporting to ${target.label}... awaiting dual confirmation`
      }
    };
  }

  execute(actor: ActorId, args: readonly string[]): CommandResult {
    const e = this.entry(actor);
    if (!e) return { ok: false, code: 'ADMIN_DENIED', message: '[ADMIN] ไม่มีสิทธิ์ที่เซิร์ฟเวอร์ยืนยัน / verified administrator required' };

    const a = args.map(x => x.toLowerCase());
    const now = this.options.now ? this.options.now() : Date.now();

    // 1. /admin help
    if (a.length === 1 && a[0] === 'help') {
      return {
        ok: true,
        data: {
          systemMessage:
            '[ADMIN] คำสั่งแอดมินทั้งหมด:\n' +
            '- /admin where : ดูตำแหน่ง Cell, XYZ, มุมหมุน Rot\n' +
            '- /admin tp list : ดูรายชื่อจุดวาร์ป Whitelist ทั้งหมด\n' +
            '- /admin tp pickup : วาร์ปไปจุดรับงาน Rift Watchtower\n' +
            '- /admin tp delivery : วาร์ปไปปลายทางงาน Courier ปัจจุบัน (งานจำลองก่อน)\n' +
            '- /admin tp <routeId> : วาร์ปไปปลายทางของเส้นทาง (courier-route-1, sarethi-farm, heartwood-mill, merryfair-farm, shors-stone)\n' +
            '- /admin tp navtest : วาร์ปไปจุดทดสอบ The Bee and Barb (Riften Interior)\n' +
            '- /admin back : กลับตำแหน่งก่อนวาร์ปสำเร็จครั้งล่าสุด (สลับตำแหน่งเมื่อสำเร็จ)\n' +
            '- /admin courier test <routeId> : เปิดงานจำลอง Courier (แสดง Amber Beacon + Map/Compass)\n' +
            '- /admin courier test navtest : เปิดงานจำลองทดสอบประตูเมืองและอาคาร\n' +
            '- /admin courier status : แสดงสถานะงานจำลองและระยะทาง\n' +
            '- /admin courier complete : ตรวจสอบตำแหน่งและจบเฉพาะงานจำลอง (ไม่ให้เงิน/XP)\n' +
            '- /admin courier clear : ล้างงานจำลองและคืนหมุดงานจริง\n' +
            '- /admin fly on|off · speed 1..5|reset · reset · status · navtest on|off|doors|native'
        }
      };
    }

    // 2. /admin where
    if (a.length === 1 && a[0] === 'where') {
      try {
        const loc = this.adapter.fullLocation(actor);
        return {
          ok: true,
          data: {
            systemMessage: `[ADMIN] ตำแหน่งปัจจุบัน: World/Cell=${loc.cell} | Pos=[${loc.pos.map(v => v.toFixed(2)).join(', ')}] | Rot=[${loc.rot.map(v => v.toFixed(2)).join(', ')}]`
          }
        };
      } catch {
        return { ok: false, code: 'LOCATION_UNAVAILABLE', message: '[ADMIN] ไม่สามารถอ่านตำแหน่งปัจจุบันของตัวละครได้' };
      }
    }

    // 3. /admin tp list
    if (a.length === 2 && a[0] === 'tp' && a[1] === 'list') {
      const list = Object.entries(TELEPORT_WHITELIST)
        .map(([id, t]) => `- ${id}: ${t.label} (${t.cell})`)
        .join('\n');
      return {
        ok: true,
        data: {
          systemMessage: `[ADMIN] จุดวาร์ปที่เปิดใช้:\n${list}\n- delivery: ปลายทางงาน Courier ปัจจุบัน\n- back: กลับตำแหน่งก่อนวาร์ปสำเร็จครั้งล่าสุด`
        }
      };
    }

    // 4. /admin tp delivery
    if (a.length === 2 && a[0] === 'tp' && a[1] === 'delivery') {
      const mock = this.mockJobs.get(actor);
      if (mock) {
        const target: TeleportTarget = {
          id: 'mock-delivery',
          label: `ปลายทางงานจำลอง: ${mock.delivery.label}`,
          cell: mock.delivery.cell,
          pos: mock.delivery.pos,
          rot: [0, 0, 0],
          radius: mock.radius
        };
        return this.initiateTeleport(actor, e, target);
      }
      const realJob = this.options.getActiveCourierJob?.(actor);
      if (realJob) {
        const target: TeleportTarget = {
          id: realJob.route.id,
          label: `ปลายทางงานจริง: ${realJob.route.delivery.label}`,
          cell: realJob.route.delivery.cell,
          pos: realJob.route.delivery.pos,
          rot: [0, 0, 0],
          radius: realJob.route.radius
        };
        return this.initiateTeleport(actor, e, target);
      }
      return { ok: false, code: 'NO_ACTIVE_DELIVERY', message: '[ADMIN] ไม่มีงาน Courier หรือการทดสอบที่กำลังดำเนินการอยู่ / no active Courier job or mock test' };
    }

    // 5. /admin tp <target>
    if (a.length === 2 && a[0] === 'tp') {
      const targetId = a[1]!;
      const target = TELEPORT_WHITELIST[targetId];
      if (!target) {
        return { ok: false, code: 'UNKNOWN_TARGET', message: `[ADMIN] ไม่พบจุดวาร์ป '${targetId}' (ใช้ /admin tp list เพื่อดูรายการที่เปิดใช้)` };
      }
      return this.initiateTeleport(actor, e, target);
    }

    // 6. /admin back
    if (a.length === 1 && a[0] === 'back') {
      const previous = this.backLocations.get(actor);
      if (!previous) {
        return { ok: false, code: 'NO_BACK_LOCATION', message: '[ADMIN] ยังไม่มีตำแหน่งก่อนหน้าที่บันทึกไว้ / no previous teleport position recorded' };
      }
      const target: TeleportTarget = {
        id: 'back',
        label: `ตำแหน่งก่อนหน้า (${previous.cell})`,
        cell: previous.cell,
        pos: previous.pos,
        rot: previous.rot,
        radius: 200
      };
      return this.initiateTeleport(actor, e, target, true);
    }

    // 7. /admin courier ...
    if (a[0] === 'courier') {
      if (a.length >= 2 && a[1] === 'test') {
        const routeArg = a[2];
        if (!routeArg) return { ok: false, code: 'ADMIN_ARGUMENTS', message: '[ADMIN] ใช้ /admin courier test <routeId> | navtest' };
        if (this.mockJobs.has(actor)) {
          return { ok: false, code: 'MOCK_ALREADY_ACTIVE', message: '[ADMIN] มีงานจำลอง Courier อยู่แล้ว ใช้ /admin courier clear เพื่อล้างงานก่อน' };
        }
        if (routeArg === 'navtest') {
          const mock: MockCourierJob = {
            id: 'admin-courier-test-navtest',
            routeId: 'navtest',
            displayName: 'Frostveil: Navigation Test',
            delivery: {
              label: 'The Bee and Barb, Riften (test only)',
              cell: '16bdf:Skyrim.esm' as FormDesc,
              pos: [-195.9238739013672, -545.3919677734375, 64]
            },
            radius: 200,
            targetKey: 'riften-interior-test-v1',
            startedAt: now
          };
          this.mockJobs.set(actor, mock);
          e.value = { ...e.value, revision: ++this.revision };
          return {
            ok: true,
            data: { systemMessage: `[ADMIN] เปิดงานจำลอง Courier: ${mock.displayName} ส่งที่ ${mock.delivery.label} (ทดสอบนำทางประตูเมือง/อาคาร; ไม่ให้เงิน/XP)` }
          };
        }
        const routes = this.options.courierRoutes ?? [];
        const wl = TELEPORT_WHITELIST[routeArg];
        const r = routes.find(x => x.id.toLowerCase() === routeArg) ?? (wl
          ? {
              id: routeArg,
              displayName: wl.label,
              delivery: {
                label: wl.label,
                cell: wl.cell,
                pos: wl.pos
              },
              radius: wl.radius
            }
          : null);
        if (!r) {
          return {
            ok: false,
            code: 'UNKNOWN_ROUTE',
            message: `[ADMIN] ไม่พบเส้นทาง '${routeArg}' (เส้นทางที่ใช้ได้: courier-route-1, sarethi-farm, heartwood-mill, merryfair-farm, shors-stone, navtest)`
          };
        }
        const mock: MockCourierJob = {
          id: 'admin-courier-test-' + r.id,
          routeId: r.id,
          displayName: r.displayName,
          delivery: r.delivery,
          radius: r.radius,
          targetKey: r.id + '-v1',
          startedAt: now
        };
        this.mockJobs.set(actor, mock);
        e.value = { ...e.value, revision: ++this.revision };
        return {
          ok: true,
          data: { systemMessage: `[ADMIN] เปิดงานจำลอง Courier: ${mock.displayName} ส่งที่ ${mock.delivery.label} (ทดสอบเท่านั้น ไม่ให้เงิน/XP)` }
        };
      }

      if (a.length === 2 && a[1] === 'status') {
        const mock = this.mockJobs.get(actor);
        if (!mock) return { ok: true, data: { systemMessage: '[ADMIN] ไม่มีงานจำลอง Courier ที่กำลังดำเนินการ / no active mock Courier job' } };
        let distStr = 'unknown';
        try {
          const loc = this.adapter.location(actor);
          if (cellKey(loc.cell) === cellKey(mock.delivery.cell)) {
            distStr = Math.hypot(
              loc.pos[0] - mock.delivery.pos[0],
              loc.pos[1] - mock.delivery.pos[1],
              loc.pos[2] - mock.delivery.pos[2]
            ).toFixed(1) + ' units';
          } else {
            distStr = `ต่าง Cell (${loc.cell} != ${mock.delivery.cell})`;
          }
        } catch {}
        return {
          ok: true,
          data: {
            systemMessage: `[ADMIN] งานจำลอง: ${mock.displayName} | ปลายทาง: ${mock.delivery.label} (${mock.delivery.cell}) | ระยะทาง: ${distStr} (รัศมี ${mock.radius}) | นำทาง: Amber Beacon + Quest Map/Compass`
          }
        };
      }

      if (a.length === 2 && a[1] === 'complete') {
        const mock = this.mockJobs.get(actor);
        if (!mock) return { ok: false, code: 'NO_MOCK_JOB', message: '[ADMIN] ไม่มีงานจำลอง Courier ที่กำลังดำเนินการ / no active mock job' };
        let inDeliveryZone = false;
        try {
          inDeliveryZone = inZone(this.adapter.location(actor), mock.delivery, mock.radius);
        } catch {}
        if (!inDeliveryZone) {
          return { ok: false, code: 'NOT_IN_ZONE', message: `[ADMIN] คุณยังไปไม่ถึงจุดส่ง: ${mock.delivery.label} (รัศมี ${mock.radius}) / must reach delivery destination` };
        }
        this.mockJobs.delete(actor);
        e.value = { ...e.value, revision: ++this.revision };
        return { ok: true, data: { systemMessage: `[ADMIN] ส่งงานจำลองสำเร็จ! (ทดสอบเท่านั้น: +0 RP, +0 XP, ไม่เปลี่ยนแปลงสถิติหรือ Journal จริง)` } };
      }

      if (a.length === 2 && a[1] === 'clear') {
        const hadMock = this.mockJobs.delete(actor);
        e.value = { ...e.value, revision: ++this.revision };
        return { ok: true, data: { systemMessage: hadMock ? '[ADMIN] ล้างงานจำลอง Courier เรียบร้อย คืนหมุดงานจริง (ถ้ามี)' : '[ADMIN] ไม่มีงานจำลอง Courier ที่ต้องล้าง' } };
      }

      return { ok: false, code: 'ADMIN_ARGUMENTS', message: '[ADMIN] ใช้ /admin courier test <routeId> | test navtest | status | complete | clear' };
    }

    // 8. Existing Movement commands: fly, speed, navtest, reset, status
    const next = { ...e.value };
    let valid = false;
    if (a.length === 2 && a[0] === 'fly' && ['on', 'off'].includes(a[1]!)) {
      next.fly = a[1] === 'on';
      valid = true;
    }
    if (a.length === 2 && a[0] === 'speed' && (a[1] === 'reset' || (/^[1-5](?:\.\d{1,2})?$/.test(a[1]!) && Number(a[1]) <= 5))) {
      next.speed = a[1] === 'reset' ? 1 : Number(a[1]);
      valid = true;
    }
    if (a.length === 2 && a[0] === 'navtest' && ['on', 'off', 'doors', 'native'].includes(a[1]!)) {
      if (a[1] === 'on' || a[1] === 'off') next.testNavigation = a[1] === 'on';
      else next.explicitDoors = a[1] === 'doors';
      valid = true;
    }
    if (a.length === 1 && a[0] === 'reset') {
      next.fly = false;
      next.speed = 1;
      next.testNavigation = false;
      next.explicitDoors = false;
      next.teleportRequest = null;
      this.mockJobs.delete(actor);
      this.pendingTeleports.delete(actor);
      valid = true;
    }
    if (a.length === 1 && a[0] === 'status') valid = true;

    if (!valid) {
      return {
        ok: false,
        code: 'ADMIN_ARGUMENTS',
        message: '[ADMIN] ดูคำสั่งทั้งหมดได้ที่ /admin help (เช่น /admin where, tp list, tp pickup, courier test, fly on|off, speed 1..5, reset)'
      };
    }

    if (JSON.stringify(next) !== JSON.stringify(e.value)) {
      next.revision = ++this.revision;
      e.value = next;
    }

    this.options.log?.(`[rp-admin] account=${e.principal.split('#')[0]} actor=${actor.toString(16)} command=${a.join(' ')} fly=${e.value.fly} speed=${e.value.speed}`);
    return {
      ok: true,
      data: {
        systemMessage: `[ADMIN] Fly: ${e.value.fly ? 'ON' : 'OFF'} | Speed: ${e.value.speed}x | Navigation test: ${e.value.testNavigation ? 'ON' : 'OFF'} | Mock Courier: ${this.mockJobs.has(actor) ? 'ACTIVE' : 'NONE'}`
      }
    };
  }

  prune(actors: readonly ActorId[]): void {
    for (const actor of this.entries.keys()) {
      if (!actors.includes(actor)) {
        this.entries.delete(actor);
        this.pendingTeleports.delete(actor);
        this.backLocations.delete(actor);
        this.mockJobs.delete(actor);
        this.lastTeleportAt.delete(actor);
      }
    }
  }

  connectionEvent(user: unknown): void {
    for (const [actor, e] of this.entries) {
      if (e.user === user) {
        this.entries.delete(actor);
        this.pendingTeleports.delete(actor);
        this.backLocations.delete(actor);
        this.mockJobs.delete(actor);
        this.lastTeleportAt.delete(actor);
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.pendingTeleports.clear();
    this.backLocations.clear();
    this.mockJobs.clear();
    this.lastTeleportAt.clear();
  }
}
