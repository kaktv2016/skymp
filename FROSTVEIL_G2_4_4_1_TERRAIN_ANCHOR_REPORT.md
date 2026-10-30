# G2.4.4.1 — Terrain-aware NPC anchor stabilization

2026-10-30, Asia/Bangkok. Focused implementation, automated verification and isolated deployment complete. Real Skyrim visual acceptance pending.

สรุป: log จริงพบว่าตัวละครอยู่ตรงจุดและหันถูกทิศแล้ว แต่ถูกดึงกลับเพราะมุมเอียงจาก native เพียงอย่างเดียว ตัวแก้แยกพิกัด/yaw ของเซิร์ฟเวอร์ออกจาก pitch/roll ที่เกมใช้แสดงผล โดยคงกรอบตำแหน่งเดิมและไม่เพิ่ม tolerance การหมุนอย่างเดียวรักษาตำแหน่งที่ลงพื้นแล้ว ส่วนการออกนอกกรอบจริงยังยกเลิก translation และดึงกลับ anchor เดิม ไม่มีการเปลี่ยน UUID หรือ registry

ทดสอบอัตโนมัติและ deploy เซิร์ฟเวอร์ทดสอบเดิมผ่านแล้ว แต่ยังไม่รับรองว่ายืนบนเนินหายกระตุกจนกว่าเจ้าของจะทดสอบใน Skyrim จริง ไม่มีการอัปเดต Launcher หรือแก้ไฟล์เกมผู้เล่น และยังไม่ถือว่าแก้ native crash เดิมสำเร็จ

## Evidence and implementation plan

Preserve the existing isolated G2.4.4 runtime, development branch, all three persistent NPC UUIDs and registry definitions. No new server, assets, Launcher release, ground-height/raycast dependency or production change.

1. Inspect the retained real pose log and pinned movement/native source. Reproduce the **actual trigger**, not a speculative physics model: Warrior at horizontal0.0078125, vertical0, yaw0, pitch10.994688 was corrected repeatedly. The current OR predicate makes pitch alone sufficient to teleport. Exact native cause of the tilt is not independently proved.
2. Add failing regressions around the actual neighbor property source and stock movement: grounded pitch/roll must not trigger anchor correction; existing2-horizontal/64-vertical/1-yaw bounds remain. A yaw-only adjustment must preserve native grounded XYZ and pitch/roll. A true position violation must still cancel translation and return to the persistent anchor. No terrain-derived coordinate is written to persistence.
3. Make the smallest pose-controller change: authoritative position/yaw remain separate from native presentation pitch/roll. Preserve the pre-render identity/projection and ownership gates. Extend bounded read-only diagnostics with timestamp, reason and observed convergence; do not guess terrain normals or clamp graph floats.
4. Run affected RP/client/asset/native tests, review diff and protected paths. Back up and deploy only after owner closes Skyrim; verify seals, exact process/ports/health, registry/player/production hashes and code-only rollback. Commit/push only to authorized Frostveil development branch.
5. Owner tests the same NPCs on uneven and flat ground, Move/Rotate, passive/E, streaming, reconnect and isolated restart. Automated results never establish real Skyrim visual proof. Native0xC0000005 remains unresolved; multiplayer deferred.

The native bounded pose allowance is the existing2-unit XY /64-unit Z envelope, always relative to the authored anchor, never an incrementally rebased anchor. No tolerance increase, permanent terrain re-anchoring, per-frame animation setter, graph reset or broad AI shutdown is planned. If position-only correction persists on actual slopes, keep that case open rather than guess a larger allowed radius.

## Root cause and pinned runtime contracts

Private retained owner evidence: `build/rp-audit/g244/terrain-followup-owner-pose.txt`. Repeated samples for local Warrior ref4278193433 show XY0.0078125, Z0, yaw0, pitch10.994688, corrections6/35/65/94. Thus **pitch alone triggers the old corrective branch**, independently of actual world displacement. After the owner moved it to a flat anchor, correction count stopped increasing and speed reached0. Other recorded episodes contain genuine XY/Z/yaw differences and must not all be called harmless settling. HomHom's previous late-translation symptom is owner-confirmed resolved; that cancellation is retained.

The underlying native producer of the pitch is not proven: terrain collision, controller motion and animation may interact. No surface normal/contact/ground-height measurement was captured. The repair removes the demonstrated wrong trigger; it does not claim a newly discovered Skyrim physics mechanism. Visual stepping without displacement is still a distinct possibility and requires owner observation.

Pinned `skymp5-client/src/sync/movementApply.ts` checks Standing translation using XY distance>8, yaw difference>80, jump/run/sit state, not pitch/roll or small Z settlement. Its self-offset is zero for Standing. `FormView.applyAll` retains stock host/counter/time gates and runs before neighbor updates; the verified owner-before-view projection remains unchanged. `movementGet.ts` samples graph SpeedSampled; a Standing network value alone is not visual proof.

Installed package declarations contain the reused getPosition/getAngle, stopTranslation, SetDontMove and TESModPlatform.moveRefrToPosition APIs. Native `PapyrusTESModPlatform.cpp:130` passes position plus rotation directly to MoveTo_Impl and validates reference/cell/world; the existing call contract uses radians for rotation. The project uses the pinned custom Skyrim Platform2.9.0 runtime (package declarations2.8.0), Skyrim1.6.1170 and the unchanged custom addon. This phase introduces **no new native API**, raycast, ground-height query, console command, physics patch or DLL.

## Chosen strategy and changed files

- `rp-gamemode/src/modules/npc/npc-service.ts`: remove native pitch/roll from the authoritative movement-violation predicate. Preserve original2XY/64Z/1yaw limits. Actual positional violations still stop translation and move to authored XYZ; yaw-only violations stop translation and preserve current in-envelope XYZ. Both retain native signed pitch/roll while setting authoritative yaw. Nonfinite native observations never reach relocation calls. The server definition/pose payload is not mutated.
- Same file: bounded localhost17777-only read-only diagnostics retain the20-sample/500ms cap per reference/anchor and add epoch `atMs`, elapsed time, POSITION/YAW/POSITION_AND_YAW/IN_BOUNDS reason and observed SETTLING_IN_BOUNDS/STABLE_IN_BOUNDS/CORRECTING outcome. Stable means sampled XYZ stayed within0.25 for1s **and** inside the unchanged anchor envelope; it is not a ground-contact guarantee or a controller input. Diagnostic state contains only scalar data/plain coordinate arrays, never retained native wrappers, and never redefines the anchor.
- `rp-gamemode/tests/npc-terrain-anchor.test.cjs`: regression of the real pitch-only input, flat/sloped presentation, bounded settlement, precision, late motion, admin changes, lifecycle guards and diagnostic bounds.
- `rp-gamemode/tests/npc-stock-movement.test.cjs`: execute actual pinned stock movement with native tilt/grounded Z and prove no translateTo is induced by tilt alone. Existing actual FormView counter/host tests retained.
- This report. No ESP, Base Form, FaceGen, outfit, catalog, UI, Blueprint, installed player or Launcher production code changed.

This is an envelope-preserving acceptance of native presentation, not progressively increasing tolerances or accepting an unbounded drift. It does not move native terrain-adjusted coordinates into persistent storage. It cannot certify every terrain shape or prevent all future motion sources; true out-of-envelope motion still invokes the established repair. If the owner observes repeated POSITION corrections on a slope, that case remains open for measurement rather than expanding the envelope or masking graph speed.

## Automated verification

New tests were run against the old implementation first: **6 failed/1 passed**, including the pitch-only loop and yaw-only ground-height reset (`terrain-red.log`, full failure diagnostics retained). After implementation:

| Gate | Result | Evidence under build/rp-audit/g244 |
|---|---|---|
| RP build/typecheck + full regressions | PASS429/429, no skipped | terrain-rp-regressions.log |
| Client recovery/retirement + selected resource/asset regressions | PASS64/64, no skipped | terrain-client-assets.log; resource cases overlap RP suite |
| Full unchanged native suite | PASS256/256,476901 assertions | terrain-native-regressions.log; seed2353133241, fresh contained scratch cwd |
| Actual native addon create/rename/reload + approved resources | PASS | terrain-native-probe.log, native-probe-2yB6ac/{write,reload}-result.json |
| Focused terrain/protection/stock/NPC lifecycle | PASS24/24 | terrain-focused.log (before added stock tilt assertion; later full RP includes it) |

Native test data was generated in fresh private fixture directories, never the owner's world. Installed ESM/assets were read only. The native fixture uses a simulated owner, proves addon/catalog/storage behavior and does not execute Skyrim terrain, E-interaction or actual multiplayer. No native/C++/installed-client rebuild was needed for this gamemode-only change.

Coverage: flat and observed slope pitch;10000 stable updates without MoveTo/graph setters/AI resets; bounded XY/Z settlement without anchor mutation; unauthorized XY, falling and sinking beyond64; late translation stop-before-move; explicit Move/Rotate; preserved idle data; unloaded/deleted/wrong-world/nonfinite guards; new reference/reconnect protection; existing restart/UUID/policy, passive-hit veto, dialogue/session isolation and economy regressions. Real terrain collision and visual animation remain owner acceptance.

## Owner acceptance and statuses

Use the existing development `play` -> `grant` -> `/npc identity` flow; do not recreate any NPC. Original UUIDs must remain:

- Clerk: c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421
- Warrior: c780497d-41e1-451c-82f7-a96093c13988
- HomHom: dd84d54e-5231-42f1-9162-3ed4f623d28c

ทดสอบ Clerk และ Warrior ทีละตัวบนเนิน สังเกตอย่างน้อย10วินาทีก่อนย้าย เปรียบเทียบพื้นเรียบ และดู HomHom ที่จุดปัจจุบันอีก10วินาที ลอง Move/Rotate, โจมตีเพื่อเช็ก passive protection และ E-interaction จากนั้นเดินออกระยะแล้วกลับ, reconnect และเมื่อปิดเกมแล้วจึงรีสตาร์ทเซิร์ฟเวอร์ทดสอบเดิม ตรวจ UUID/ตำแหน่ง/นโยบายเดิม รายงานผลแยกแต่ละตัว หากยังกระตุกให้เปิดเกมไว้เพื่ออ่าน timestamp/reason/correction/outcome ใน rpNpcPose-logs.txt ห้ามสร้างตัวแทนหรือ reset โลก

| Status | Result | Scope |
|---|---|---|
| TERRAIN_STATIONARY | PENDING_OWNER | demonstrated predicate fixed; visual slope proof pending |
| FLAT_STATIONARY | PENDING_OWNER | prior owner baseline passed; new runtime retest pending |
| HOMHOM_REGRESSION | PENDING_OWNER | prior hotfix owner-confirmed; new build pending |
| ANCHOR_PRECISION | PARTIAL | automated original envelope and no rebase pass |
| MOVE_ROTATE | PENDING_OWNER | automated pass; previous owner baseline retained |
| COMBAT_PROTECTION | PENDING_OWNER | unchanged, native/RP tests pass, prior baseline retained |
| DIALOGUE | PENDING_OWNER | unchanged, RP/dialogue tests pass |
| STREAMING | PENDING_OWNER | simulated lifecycle passes, real return pending |
| RECONNECT | PENDING_OWNER | simulated/session regression passes, real retest pending |
| PERSISTENCE | PARTIAL | native fresh fixture preserves UUID/state; real same-NPC retest pending |
| NATIVE_CRASH | BLOCKED | historic0xC0000005 cause unresolved; diagnostics retained |
| SINGLE_CLIENT_ACCEPTANCE | PENDING_OWNER | owner must verify terrain/visual outcome |
| MULTIPLAYER_ACCEPTANCE | DEFERRED | no real two-client result |

No G2.4.5 or production promotion.

## Isolated deployment, integrity and rollback

Before restart, no Skyrim process and zero active sessions were observed. Boot cd1ca241-ecc7-498c-82d6-86227c0d4f72, engine26756 -> supervisor5140 -> visible PowerShell22168 were verified by executable/absolute command line/ancestry. UDP17777 and TCP17778/13210 were loopback-owned by that engine. Only this verified tree was stopped; production7777 was inspected read-only and not controlled. Receipt: `build/rp-audit/g244/terrain-pre-stop.json`.

Code/config backup **build/rp-audit/g244/deploy-afrGST** contains82 files and seven protected-file hashes; all earlier backups retained. Previous delivery pointers/receipts retained as `delivery-before-terrain-*`. Existing seal workflow installed30 authenticated runtime/UI artifacts; protected-state comparison passed before restart. New visible PowerShell **20560**, engine **26048**, startup **9123f2cb-98c2-4d65-ba44-546a227e5cac** passed process ancestry, UDP17777/TCP17778 ownership and health readiness. NPC UI TCP13210 belongs to the same loopback engine. Health SAFE_WAITING, customAutoSpawns0; UI200, anonymous snapshot401, cross-origin mutation403. No game was launched by automation.

Post-start verification proved production config/data, isolated player data and registry/dialogue journals unchanged. All three expected registry UUIDs were checked explicitly. Native startup changed only the first two managed NPC ChangeForms to their parked state awaiting authorized mapper proof; HomHom's file was unchanged. This is not a claim that every world file stayed byte-identical. No definition recreated or data copied/reset. Native crash/minidump diagnostics remain enabled through the unchanged startup workflow.

| Artifact | SHA-256 |
|---|---|
| Deployed runtime/modules/npc/npc-service.js | 8b9b6aa0671bd0a40447f445dbaec879409247e98f3888a0bb0ff22dd682870a |
| Unchanged deployed identity mapper | 5fb65657bc8bb15b18236631c855874f7baca7cf4020278e93ab8080c7dd0efd |
| Built RP bundle (not the isolated startup entry) | d8ed373d743d0a3ad2238c871e8cfbea943c730faddfbeea04f7b569872127b9 |
| Unchanged native addon | e7a9da57df5f5ea32d94cdfd37a0dd15e1980117ca0b0ddc22f013904bef8855 |
| Unchanged installed client JS (read-only verification) | 67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6 |

Profile634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de and catalog1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77 unchanged. Evidence: `build/rp-audit/g244/{terrain-build-hashes,startup-verification,deployed-verification}.json` and `build/rp-audit/g241d/readiness-1793365001839-20560.json`.

Rollback preflight **PASS**, actual live rollback not exercised. Owner closes Skyrim first; verify no active session and the then-current exact isolated process/boot/ports before stopping only its owned tree. From the repository run `node rp-gamemode/research/g244/deployment.cjs rollback-check`, then `node rp-gamemode/research/g244/deployment.cjs rollback`. The helper validates the paired backup/hashes, refuses unknown later changes and restores code/config only, never world/player/economy/registry data. Then use `node rp-gamemode/research/g244/start-verified.mjs`. Forward source remains recoverable in Git; do not reseal a rollback with mismatched forward build output. No recursive cleanup/deletion is part of rollback.

## Delivery and owner's next commands

Implementation commit **8257719f551b2eb9722e4641d2edea041d9296f5**, branch **dev/npc-activation-g241d**, authorized remote **frostveil** (`kaktv2016/skymp`). Source-only review found no actionable correctness/security issue; reviewer explicitly notes that simulated MoveTo argument preservation does not establish real native tilt rendering. Report and deployment receipt follow in a documentation commit. No upstream/force push.

เปิดผ่าน development CLI เดิม ไม่ใช้ public Launcher Play ที่เลือกพอร์ต7777:

```powershell
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" play
```

เมื่อเข้าเกมแล้ว ใช้อีกครั้งเพื่อขอสิทธิ์ของ session ที่กำลังเชื่อมต่อ ตรวจสอบแล้วพิมพ์ GRANT ตามขั้นตอนเดิม:

```powershell
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" grant
```

ในเกมใช้ `/npc identity` แล้วทำ owner acceptance ด้านบน ไม่ต้องสร้าง fixture หรือ NPC ใหม่ หากอาการยังอยู่ให้รายงานชื่อตัว, เนิน/พื้นเรียบ, ก่อน/หลัง Move/Rotate และเปิดเกมไว้ชั่วครู่เพื่ออ่าน log โดยไม่แก้ไฟล์ติดตั้ง
