# Frostveil G2.4.2.1 — NPC stability and combat protection

2026-10-28, Asia/Bangkok. Implemented and deployed to the existing isolated development server. Automated verification is complete; actual Skyrim combat, activation, collision and appearance acceptance remains **PENDING_OWNER**. The earlier native crash is **not claimed resolved**.

## Status

| Status | Result | Evidence / limitation |
|---|---|---|
| NPC_ANCHOR | PASS automated; previous owner baseline retained | Existing anchor code/thresholds, rotation and idle retained; repeated updates do not introduce periodic teleportation |
| DEFAULT_STATIONARY | PASS automated | Legacy records default to stationary; both passive and explicitly combat-enabled policies retain the same anchor |
| COMBAT_PROTECTION | PARTIAL / PENDING_OWNER | Actual native hit veto and registry authorization pass; client ghost lifecycle passes simulation; real Skyrim attacks/reactions/XP require owner |
| DIALOGUE_COMPATIBILITY | PASS regression / PENDING_OWNER | Existing dialogue tests pass; no activation block added; real E-interaction after attacks still requires owner |
| STREAMING | PENDING_OWNER | Reference-scoped protection and unchanged mapper/streaming guards; no new real walk-away/return observation |
| RECONNECT | PENDING_OWNER | Session/identity generations preserved; must repeat grant and identity handshake |
| PERSISTENCE | PASS automated and existing owner baseline | Registry UUIDs/journal bytes unchanged across deployment/start; explicit overrides persist; current writer has OS creation identity |
| NATIVE_CRASH | PARTIAL | Two prior 0xC0000005 exits confirmed; root cause unknown. Real minidump fixture works; diagnostics installed for recurrence |
| WRITER_LEASE | PASS | PID reuse, active/unknown writer, legacy lease, real competing writers and unexpected termination tested; actual active registry rejects a second writer |
| SINGLE_CLIENT_ACCEPTANCE | PENDING_OWNER | New protection behavior has not been certified from mocks |
| MULTIPLAYER_ACCEPTANCE | DEFERRED | No real two-client success claimed |

## Proven combat gap and selected mechanism

The existing pose updater intentionally enables AI for idle animation, calls `SetDontMove(true)`, clears keep-offset and maintains the configured anchor/model movement. It did not suppress hit detection or combat acquisition. This matches the owner's observation: the NPC reacts, becomes hostile and tries to chase while its correct anchor prevents translation. The anchor was not the defect and was not removed, replaced or weakened.

Two separate policies now exist in the same registry: optional version-1 `policy` with `movement: STATIONARY` and `combat: PASSIVE_PROTECTED | COMBAT_ENABLED`. Missing policy means **STATIONARY + PASSIVE_PROTECTED**. Existing records are neither migrated nor rewritten on read. An authorized selected-NPC override is journaled through the existing fsynced storage. No client-supplied policy grants authority. Unsupported movement modes are rejected; no follow/patrol/navigation implementation was added.

### Client reference protection

The existing signed neighbor pose property now carries the effective policy. On a new loaded reference or a combat-policy transition it applies `Actor.SetGhost(true)` and performs one `StopCombat` / `StopCombatAlarm` cleanup of pre-existing aggro. It retains `SetDontMove`, AI idle and the existing position/rotation code. It never repeats combat resets every frame. A failed native attempt is also bounded per transition and prints a local diagnostic instead of throwing/resetting indefinitely.

Only scalar reference/policy identity and the original ghost flag are retained, never native wrappers across updates. Explicit combat enable restores the ghost flag this controller observed before its change; it does not clear unrelated protection and does not remove the stationary anchor. Reference deletion/3D/world guards and the existing relocation thresholds remain. No ActorBase invulnerability, global faction/aggression change, shared vanilla base mutation, new AI package, outfit change or FaceGen edit was used.

### Authoritative native damage gate

Pinned source inspection found no JS veto before damage in the original addon. `ActionListener::OnHit` selected weapon/spell handling, then emitted Papyrus hit events and changed authoritative health. Cancelling a Papyrus event alone would not cancel the following damage; client Ghost alone would not reject forged hit packets.

The focused server change adds synchronous `onHitAttempt(aggressorId,targetId,sourceId)` through the existing `CustomEvent`/`GameModeEvent::Fire` cancellation contract. It runs after native sender/host and target resolution and before weapon/spell damage, Papyrus hit reactions and hit bookkeeping. The registry denies hits involving a protected managed NPC as either aggressor or target. Unrelated player/vanilla combat proceeds through the existing checks and formulas. Existing network health-change messages affect the sender's own player actor, not arbitrary hosted NPC targets; this path was inspected too.

`EventRouter.registerVeto` is explicit and synchronous, preserves a prior handler's rejection and accepts only `true` as permission. Ordinary asynchronous RP hooks keep their old contract. The native addon exposes read-only `combatVetoVersion=1`; NPC module boot requires that capability, so deploying this JS against an old addon cannot silently advertise authoritative protection. No generic console/script execution or new combat framework was added.

Rejected hits never reach the existing native Papyrus/damage/hit bookkeeping path. Frostveil currently has no separate NPC hit-reward service introduced here; Courier wallet/XP transactions remain unchanged. Real Skyrim local skill-XP and pain/attack reaction behavior must still be checked with Ghost in the owner test.

## API compatibility and research

Actual installed project package declarations are `@skyrim-platform/skyrim-platform` **2.8.0**, used with the existing pinned Custom 2.9.0 runtime. Both those declarations and repository generated Platform API expose `isGhost`, `setGhost`, `setDontMove`, `stopCombat`, `stopCombatAlarm` and ActorBase `setInvulnerable`. The first five are actor-reference APIs; `setInvulnerable` was deliberately not applied to a shared base. The known-working anchor already uses `setDontMove`. Installed client JS, DLL, AE 1.6.1170 and SKSE 2.2.6 pins remain unchanged. Declaration/source availability is not misrepresented as actual successful invocation of every protection API in Skyrim; that is owner acceptance.

External Skyrim CK documentation requests for SetGhost/SetDontMove returned HTTP 403 during research; Fallout/GECK behavior was not substituted as Skyrim proof. The new server gate uses this repository's actual native event implementation. Windows crash capture follows [Microsoft MiniDumpWriteDump documentation](https://learn.microsoft.com/en-us/windows/win32/api/minidumpapiset/nf-minidumpapiset-minidumpwritedump), including captured exception context and a dedicated worker rather than running DbgHelp on the faulting stack.

## Writer lease reliability

The confirmed old failure used PID-only `process.kill(pid,0)`. Isolated NPC/dialogue leases from October 27 pointed to engine PID 12484; on October 28 that PID belonged to a later Edge process. A live reused PID was mistaken for the original journal writer. The prior exact stale lease backups are preserved under `build/rp-audit/g241d/stale-writer-locks-1793174289690`; no journal records were deleted.

New leases include OS process creation identity: Windows process StartTime UTC ticks, or Linux boot ID plus `/proc/<pid>/stat` start ticks. The current process identity is cached because it is immutable, avoiding repeated PowerShell launches for every journal instance. Windows queries use a fixed hidden command, validated numeric PID, bounded output and a five-second timeout; no new dependency was installed. Inspection failure is conservatively treated as a live writer.

Takeover is allowed only for a dead process or a demonstrably different creation identity. Legacy leases are conservative, with recovery possible when the OS process was created later than the immutable lease timestamp plus a one-second rounding margin. Existing exclusive stale-token claims, inode/ctime/token rechecks, exclusive creation and fsync remain. Unknown/live ownership never authorizes deletion. Filesystem redirection, journal chains and existing ambiguity recovery checks remain intact. No live lock, registry record or journal was manually removed in this milestone.

The actual running isolated registry now has a `windows:<creation ticks>` lease. A separate process attempted to acquire it and was rejected before writes. Both registry and dialogue journal SHA-256 values remained identical across deployment/start. Evidence: `build/rp-audit/g2421/post-start-integrity.json`.

## Native crash investigation and diagnostics

Prior engine PIDs **19524** and **20468** both exited with unsigned **3221225477 = 0xC0000005**, after READY and identity/mapper arm. Their retained stdout/stderr/exit metadata provide no native stack proving combat, FaceGen, mapping or anchoring caused the crash. The source was not patched on such an assumption. These are confirmed abnormal exits, not ordinary server shutdowns.

Opt-in native diagnostics are now installed only by the isolated supervisor's child environment, `FROSTVEIL_ISOLATED_NATIVE_DUMPS`. The native addon installs a chained unhandled-exception filter only when that directory is supplied. A dedicated pre-created worker writes `MiniDumpNormal | MiniDumpWithThreadInfo` from copied exception/context data. The faulting handler waits at most 10 seconds, then preserves the previous filter/OS failure path. At most three new dumps are retained in the private audit directory; existing evidence is not overwritten/deleted. No global WER registry settings, new debugger dependency or player installation change is required. Node fatal-error reports also go to the private startup log directory.

Actual native fixture verification deliberately crashed separate tiny test processes: three valid MDMP files contained exception stream `0xC0000005`; a fourth crash respected the three-dump budget; opt-out produced no additional dump. This tests the capture mechanism, not the original NPC crash or its resolution. Dump capture remains best effort (OS/filter/loader failure can prevent it). Release binaries do not provide full private PDB symbols; preserve the matching binary and exception/module/stack addresses for further investigation. Dumps may contain private process memory and must not be published as web assets or committed to Git.

Real recurrence location: `build/rp-audit/g241d/native-dumps`; full stdout/stderr and `exit.json`: `build/rp-audit/g241d/startup-*/`. Fixture evidence: `build/rp-audit/g2421/dump-test-7r3T47` and `native-dump-test2.log`. No original crash is claimed fixed until a real recurrence is diagnosed or appropriate owner stability evidence is gathered.

The local readiness helper also rechecks retained terminal records after observing a missing outer process: an engine failure can be written while the CIM query is in flight. A deterministic interleaving regression reproduces the old misleading `PROCESS_CREATION` diagnosis and now retains `PLUGIN_IDENTITY`/the actual native stage. Healthy process/port/profile gates are unchanged. This directly addresses the previously observed misleading startup error without treating a dead process as healthy.

## Verification

| Check | Result |
|---|---|
| RP build/typecheck/full G1/G2 server regression | **399/399 PASS** |
| Client lifecycle, Spawn Recovery, identity + real asset/startup tests | **73/73 PASS** |
| Blueprint Studio regression, unchanged implementation | **80/80 PASS** |
| Launcher readiness/process/trust regressions + CLI syntax | **9/9 PASS** |
| Native full unit suite, seed 1292818940 | **256/256 PASS**, 476,310 assertions |
| Focused actual native hit veto | **PASS**, 10 assertions; rejected damage/bookkeeping then normal allowed hit |
| Real native addon ABI / read-only capability | **PASS**, separate fresh storage and port 17877, no owner UI |
| Actual Windows minidump fixture | **PASS**, exception stream, count budget, opt-in |
| Actual target startup/ancestry/loopback ports/HTTP health | **PASS** |
| Fifteen runtime seals, production manifest, registry journal hashes | **PASS** |
| Independent read-only review | No actionable critical/important findings; reviewer did not operate processes |

Complete logs are retained in `build/rp-audit/g2421`. The first full native run hit the already-known `Activate torch` timing failure at `PartOne_ActivateTest.cpp:587`. The unchanged focused torch case and complete same-seed suite passed on recheck; no timeout/test was changed or skipped. Both logs remain. An initial diagnostic-fixture build command failed Windows shell quoting; the harness now uses a fixed private `.cmd`, and complete failure/success logs are retained. A synthetic 568-byte `world.zip` created by native SaveStorage unit tests was preserved as `native-unit-world-fixture.zip` in the audit directory, not committed or mistaken for live world data.

The client test suite is simulation/source evidence. It does not certify pain voices, collision, real E-interaction, local XP or multiplayer rendering. The two approved NPC assets and outfits were not recreated. Tests cover legacy defaults, explicit overrides/authorization, unrelated combat, persisted identity, stationary anchors, 10,000 unchanged pose updates without AI/combat reset or teleport spam, per-reference transitions, writer races and crash recovery.

## Deployment and rollback

Only existing isolated root `build/rp-audit/g241/dev-7FNiLN` was updated. The rebuilt server addon is pinned to **e7a9da57df5f5ea32d94cdfd37a0dd15e1980117ca0b0ddc22f013904bef8855**. The prior addon **a9e77780133b3c064a8abc9aa6f6971b1c73ff3c1b2d1539af404b3cbe389157** is retained in the code backup. Build used explicit MSBuild compile/link stages and an audit OutDir with production post-build events disabled; production manifest was verified unchanged afterwards. Do not deploy updated RP JS alone against the old production addon: capability v1 is required as a paired server change.

Seals now include 15 unique artifacts, adding the event router and journal/process-identity dependencies. The local owner CLI verifies the expanded seal; it does not change installed Launcher versions, updater signatures, game assets or client pins. No public release/distribution was made. The existing signed gamemode property transport delivers the protection updater, with the original plugin mapping and mapper-arm gates preserved.

Verified server-only start: visible PowerShell **25420**, engine **7052**, startup UUID `c520ef87-02a5-440c-8119-6052ece4e8f8`, UDP **127.0.0.1:17777** and TCP **127.0.0.1:17778**, HTTP `SAFE_WAITING`, restored definitions=2. The agent did not launch or control Skyrim. The already-open owner client automatically reconnected at 16:19:03; ordinary native runtime saves then changed isolated world ChangeForms (including the player). These were not manually copied/reset/rolled back. Profile 1 still has 21 inventory entries; both NPC registry/dialogue journal bytes and UUIDs remain unchanged. Do not claim byte-identical world snapshots while a client is active.

Code/config backup: `build/rp-audit/g2421/code-before-1793178976658` (64 files plus original supervisor/CLI/startup-helper source). `rollback.ps1 -ValidateOnly` verifies 67 restore targets and backup/deployed hashes without changing them. Actual rollback has not been run against the working server. To roll back, close Skyrim and stop only the isolated console, then run `build/rp-audit/g2421/rollback.ps1`. It rejects active processes/ports, later edits and data paths before restoring code/config. It never overwrites world, character, economy or registry records. The backup manifest and forward artifacts remain private/recoverable. Newly generated helper files can remain unused after rollback; no broad deletion is performed.

Original UUIDs remain `c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421` (Clerk) and `c780497d-41e1-451c-82f7-a96093c13988` (Warrior). Production Clerk and all vanilla records were not modified. Production 7777 was never started. Existing production protected-file manifest and both registry journal hashes were checked after deployment; only isolated native runtime activity is allowed to save its own world.

## Changed files and commits

- Registry/pose/policy: `rp-gamemode/src/modules/npc/npc-service.ts`, `src/runtime.ts`, `src/core/event-router.ts`.
- Lease reliability: `src/modules/economy/journal.ts`, new `writer-process.ts`; the build's built-in allowlist now explicitly includes the fixed internal `node:child_process` usage.
- Native gate/capability: `skymp5-server/cpp/server_guest_lib/ActionListener.cpp`, `cpp/addon/property_bindings/PropertyBindingFactory.cpp`.
- Bounded diagnostics: new `cpp/addon/IsolatedCrashDump.h`, `ScampServer.cpp`, isolated supervisor `rp-gamemode/scripts/g241d-dev.cjs`.
- Tests: `unit/HitTest.cpp`, RP economy/NPC/protection tests, and `rp-gamemode/research/g2421/{dump-fixture.cpp,native-dump-test.cjs}`.
- Local CLI: Launcher `scripts/npc-development.mjs` checks 15 seals instead of 12; `scripts/npc-startup.mjs` and its test retain the actual native failure stage across the process-exit race. No installed client profile change was performed.

SkyMP implementation commit **5e22ff17851892ed734b1ccd8638ef4aa7d52121**, branch `dev/npc-activation-g241d`, remote `frostveil` (`kaktv2016/skymp`). Launcher source commits **9fe8292d7b7d154f83c4d7b314597717964afc4e** (expanded seals) and **3d88c56f333e7c459daa4106b213de45caa097e4** (native failure diagnostics), branch `dev/npc-local-activation-g241d`, owner `origin` (`kaktv2016/frostveil-launcher`). This report follows in a documentation commit. No force push or upstream push.

## ทดสอบใน Skyrim โดย owner

1. เซิร์ฟเวอร์ทดสอบเปิดอยู่แล้ว หากต้องเข้าใหม่ ให้ปิด Skyrim แล้วรันคำสั่งเต็มนี้ (ไม่ใช้ Play ปกติของ Launcher สำหรับโปรไฟล์ทดสอบ):
   `node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" play`
2. ขอสิทธิ์ session ปัจจุบันด้วย:
   `node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" grant`
   ตรวจ session แล้วพิมพ์ `GRANT` จากนั้นในเกมใช้ `/npc identity` → `/npc identity status` → `/npc fixture list` ต้องเห็น UUID เดิมทั้งสอง ไม่ต้องสร้างซ้ำ
3. ใกล้ NPC แต่ละตัว ใช้ `/npc select` → `/npc info` ตรวจ `movement: STATIONARY`, `combat: PASSIVE_PROTECTED` แล้วลองตีมือเปล่า อาวุธ ธนู และเวทหลายครั้ง ตรวจว่าเลือดไม่ลด ไม่มีเสียงเจ็บ/ท่าโดนตี/โกรธ/ไล่/หมุนตามเป้าต่อเนื่อง และไม่มี XP/reward จากการตี ตรวจทั้งสองแยกกัน
4. กด E เปิดบทสนทนาหลังลองโจมตี ตรวจ idle ใบหน้า/ชุดและการชนทางกายภาพด้วย หาก Clerk ทดสอบไม่มี graph ที่ assign อยู่ อย่านับว่า protection ทำ dialogue พัง; ใช้ Clerk ที่มีบทสนทนาเดิมเพื่อตรวจ E โดยไม่แก้กราฟ
5. ใช้ `/npc move here` และ `/npc rotate 90` ต้องได้ anchor ใหม่และหันถูก จากนั้นลองโจมตี/คุยอีกครั้ง ต้องไม่กลับไปจุดสร้างหรือไล่ตาม
6. ทดสอบ override เฉพาะเมื่อพร้อมให้ NPC รับ combat: `/npc combat enabled` → `/npc info` ต้องยัง STATIONARY ห้ามตามผู้เล่นเอง จากนั้นคืน `/npc combat passive` และ `/npc movement stationary` ก่อนจบ ไม่จำเป็นต้องเปิด combat เพื่อทดสอบ service NPC ปกติ
7. เดินออกนอกระยะโหลดแล้วกลับมา → ออกเข้าเกมใหม่และ grant/identity ใหม่ → รีสตาร์ทเฉพาะเซิร์ฟเวอร์ทดสอบเมื่อปิดเกม แล้ว grant/identity ใหม่ ตรวจ UUID/ตำแหน่ง/มุม/ชุด/idle/protection ไม่มีตัวซ้ำและไม่มีการ append registry เพียงเพราะ reconnect
8. ถ้าเซิร์ฟเวอร์ปิดเอง ให้บอกเวลาพร้อมคำสั่ง/การโจมตีล่าสุด เก็บ `native-dumps` และ `startup-*` ไว้ ไม่ลบ lock/journal เพื่อซ่อนอาการ การมี dump ใหม่ยังไม่แปลว่าทราบสาเหตุแล้ว

ผลที่ต้องแจ้งแยก: Clerk, Warrior, ตี/เวท, E-dialogue, move/rotate, streaming, reconnect, restart และมี crash หรือไม่ การยืนยันภาพ/คอมแบตจริงยังรอ owner; multiplayer คง DEFERRED.
