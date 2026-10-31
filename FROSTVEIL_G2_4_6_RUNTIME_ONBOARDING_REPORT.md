# Frostveil G2.4.6 — NPC Runtime Onboarding

Implementation and isolated deployment: 2026-10-31. Specification: owner attachment b5717a1d-f9d0-45db-bcda-a334cad960f2/pasted-text-1.txt. Baseline SkyMP commit 3b1da91e9e1254bdf8015e3294abc194bc68fef6. New-template runtime/render proof is PENDING_OWNER_ASSET; actual Skyrim v2 acceptance is PENDING_OWNER. No production promotion.

## 1. Audit and implementation strategy

G245 approval intentionally did not activate plugins or update the playable catalog. Independent blockers were a three-base probe containing two explicitly named custom bases, one-plugin mapper filter, one pinned catalog/two-template runtime list, and a Launcher policy restricted to five files/one custom plugin. Native CreateActor transport can lose owning-plugin qualification; client/server indices differ. A global index offset or intake-only approval cannot fix that safely.

Implemented sequence: immutable approved selection → runtime/profile plan → operator review/request → deliberate owner activation → verified isolated restart → server-authorized identity proof and mapper acknowledgement → existing NPC creation. No hot loading, second registry, automatic spawn or arbitrary FormID endpoint.

## 2. Identity specification and migration

New runtime-identity-spec.ts generates/validates v2: canonical revision/specHash, profile/catalog hashes, manifest/approval/catalog scopes, optional template selection scopes, exact plugin SHA256/CRC/size/masters/full namespace/serverIndex, and qualified NPC local base/type/template/assignment identities. Immutable manifests/catalogs retain resource/FaceGen/outfit closure, validated before generation. No paths or credentials enter the client spec.

The mapper has no5901/5906 or owning-plugin-name special case. Those values remain approved baseline data; v1 remains recognized. Exact server-base→client-base maps and per-model WeakMap memo prevent equal-local-ID/swapped-index alias oscillation. Player isMyClone and dynamic FF reference identities are excluded. No global offset or unsafe native wrapper retention.

## 3. Client/server verification

Server supplies approved spec; client resolves loaded plugin/file/ActorBase/type/local-ID consistency in update context. Nonce/session/principal/profile/catalog/spec-bound proof plus mandatory armed acknowledgement gate visibility and creation. Failure parks fixtures; stale faults cannot revoke newer proofs. Authority withdrawal/revocation invalidates readiness.

Installed APIs inspected in skyrim-platform/src/platform_se/codegen/convert-files/skyrimPlatform.ts: getFileInfo (~1594), getFormEx2634, getFormFromFile2635, getModByName2647, getModName2651, ActorBase.from and Form type/ID, plus FileInfoApi implementation and pinned client. Actual serialized gamemode sources were tested with simulated SP APIs; this is not Skyrim execution proof. No new native DLL/API assumed.

## 4. Profile preparation

g246-preflight.cjs verifies immutable approvals, source/staged plugin hashes, masters/order, native records, FaceGen/closure, original assignments/runtime pins and zero actors in fresh private native storage. Additional client owned files must already exist and match approved hashes. No file copy into Skyrim. Unknown configured plugins cannot be silently dropped. Unsupported light namespaces/dependencies fail with diagnostics.

Launcher v2 development reference policy extends explicit plugin/file pins while retaining five baseline assets and nine runtime pins. Existing authenticated profile APIs and explicit local CONFIRM remain mandatory; closed game/idle isolated server required. No public Launcher version, R2 release or normal-profile replacement. Browser requests are not permission to install.

## 5. Promotion and same-plugin selections

g246-onboarding.cjs extends the existing intake journal with immutable runtime-plan references, revisions and single-use60s reviews. g246-runtime-catalog.cjs composes authorized nonrevoked selections only at restart using existing native/resource validators. catalog-loader.ts accepts pinned immutable documents under the same hash/schema/native/closure gates without snapshot rewriting.

Multiple templates in one unchanged plugin and successive separately approved selections merge without replacing earlier assignments. Approval digests bind immutable selected templates, not later draft state. Rejected/invalidated sources suspend eligibility. Changed active plugin binaries/conflicting immutable revisions remain blocked, never reused under old approval. No actor creation occurs during promotion.

## 6. Activation, recovery and rollback

g246-activation.cjs fsyncs recovery intent/backups BEFORE first profile/config change. An exclusive process lease spans the asynchronous operation. Only the exact server-settings/config/handoff triple is recoverable. Prepared/applying/verified/profile-recovery-required/startup-verified/rolled-back phases distinguish partial activation. Independently persisted matching READY evidence prevents mistaking a completed startup for failure if the operator dies before its final receipt write.

Failure stops only its fresh timestamp/script/PID-verified isolated tree, never Skyrim/unrelated processes. Exact prior config and authenticated profile are recovered; later edits fail closed. runtime-recover requires RECOVER, dead prior operator, confined/hash-verified receipts and registry compatibility. Registry checks use read-only EconomyJournal.peek, preserving the live writer lease. Rollback refuses removal of any assigned template, including soft-deleted entries. No world/player/economy/registry data rollback; all old backups retained.

## 7. UI and security

Existing Asset Library gains npc-runtime.tsx with Thai readiness, actual current server catalog, identity status, dependency/profile diagnostics, explicit review/request and restart/suspended/revoked/render-pending labels. Links reuse NPC Management. Mutations refresh the parent revision. No raw IDs/paths, shell/installer endpoint or second spawn UI.

Existing EditorAuthority/admin/session/CSRF/Host/Origin/rate limits/replay validation remain. Authority is rechecked before writes; review tokens expire/consume once. Applied revocation remains REVOKED_RESTART_REQUIRED even after request-pointer removal; withdrawn intake is SUSPENDED rather than an impossible proof request.

## 8. Creation and compatibility

Original durable reservation/native creation/registry/streaming lifecycle consumes the composed approved catalog. Proof gates creation/visibility. Default STATIONARY/PASSIVE_PROTECTED, anchor/Ghost/hit veto, location/rotation, dialogue and duplicate prevention are preserved. No dynamic existing-NPC Base/outfit/weapon switching or automatic recreation.

Registry/dialogue journals remained byte-identical. Protected UUIDs unchanged:
- Clerk c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421
- Warrior c780497d-41e1-451c-82f7-a96093c13988
- HomHom dd84d54e-5231-42f1-9162-3ed4f623d28c

No assignment/name/outfit/FaceGen/anchor/policy/dialogue migration was performed. G245 owner acceptance is not reused as proof of the new G246 handshake.

## 9. Tests and actual native evidence

Private evidence under build/rp-audit:

| Gate | Result | Log |
|---|---|---|
| Final RP/client suite | PASS469/469, no skips,38322.6931ms | g246-rp-regressions.log |
| UI build/typecheck/full suite | PASS90/90,16 files | g246-ui-build.log; g246-ui-regressions.log |
| Launcher affected profile/seal/startup/helper | PASS26/26; typecheck PASS | g246-launcher-regressions.log; g246-launcher-typecheck.log |
| Unchanged native full suite | PASS256/256;476273 assertions | g246-native-regressions.log; seed2353133241 |
| Final read-only recovery/deploy fixtures | PASS12/12; included in RP | g246-readonly-recovery-green.log |
| Real source/addon integration | PASS existing2; zero actors | g246/native-integration-result.json; g246-native-integration.log |

Identity tests cover1/2/multiple bases/plugins, same-plugin selections, equal local IDs/swapped indices, ordering, missing plugin/master, unsupported light/full namespace, changed hashes, wrong type/ownership, duplicate/ambiguous identities, unauthorized expansion, stale/replayed/wrong-session proof, arm/hash mismatch and old callbacks. Promotion/recovery tests cover stale/concurrent/expired authority, altered snapshots, source withdrawal, interrupted profile/config operations, failed startup, prior authenticated-profile recovery and referenced-template preservation. Existing gameplay/economy/navigation/dialogue/persistence tests remain.

Real integration used actual ESP/four NIF/DDS exports, native addon and approved catalog; both original assignments are byte-equivalent. Fresh private native-integration-rDYEfm exercised successive selections/merged catalog, restart/revocation, unchanged source/live registry/config and zero actors. Proposed no-op revision2 specHash f888597fe27da203273dac94e40af0e7a436aee3e784d05dc22913eaca6525a3; split approvals57bbb0bd6240fb86dd5020d10ee5330d4133498e2b777a64fdc31b6d7e6d321a. Cold spec preparation1166ms includes file verification, not per-frame work. Actual client proof PENDING_OWNER; third asset/render PENDING_OWNER_ASSET.

Actual browser QA used separate synthetic authority13211 and compiled UI: login→scan/stage/review/approve→prepare/review/request ended RESTART_REQUIRED/RENDER_PENDING, no activation. Screenshots g246/runtime-onboarding-desktop.png and runtime-onboarding-mobile.png were inspected;390px viewport/scrollWidth390, only favicon404. Fixtures/session stopped. Not owner gameplay evidence.

Review regressions reproduced/fixed unaccounted plugin dropping, late recovery intent, startup-receipt ambiguity, inaccurate applied revocation, mapper alias/stale fault and same-plugin approval scoping. Final read-only test reproduced active writer conflict before peek fix; actual rollback-check now passes while the real server owns that lease. Complete failure logs retained; no skips, signature bypass or timeout increases.

## 10. Bounds/performance

Spec1–32 bases, runtime plans max31 custom templates retaining official probe;16 plugins,8 approval scopes,16KiB spec;128KiB documents/plans and seven chained plans. Immutable lookup maps/revision-session invalidation bound update work; resource/native scans occur at preparation/bootstrap. No per-frame full catalog scan. These limits/cold timing do not certify50–100 players.

## 11. Deployment evidence

Reused build/rp-audit/g241/dev-7FNiLN after closed-game/zero-session/process ancestry/port/seal checks; stopped only verified isolated tree. Backup build/rp-audit/g244/deploy-e0lrVB retains84 code/config files/protected hashes and prior rollback. No production7777 or unrelated process control.

Visible console11104→supervisor26984→engine26460, startup0ccf8210-8e10-4a29-b12a-62d6e78b755b. All gates READY in10543ms. Loopback UDP17777/TCP17778; authenticated management13210 belongs to engine. Runtime seal v2 covers31 artifacts. Health SAFE_WAITING/customAutoSpawns0/specHash83ec4cb9804471141e4bc994d9e90771d038b0ca2d5644defd92e0f80f55e8aa. Live revision1 differs intentionally from private proposed revision2.

Final receipts: g246/deployment.json, startup-verification.json, deployed-verification.json, final-integrity.json. All sealed and actually served UI bytes match; /npc-assets200, anonymous snapshot401, cross-origin mutation403. Five installed assets/two config files and ten intake/authenticated-profile files match captured hashes. Profile634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de and catalog1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77 unchanged. Addon e7a9da57df5f5ea32d94cdfd37a0dd15e1980117ca0b0ddc22f013904bef8855 and installed client JS67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6 unchanged. No Skyrim launch/profile activation/installed copy/public release.

Production config/data and registry/dialogue journals unchanged. Startup normally parked Clerk/Warrior pending proof: world1.json/2.json changed isDisabled:true; HomHom unchanged. Full-world byte equality is NOT claimed. No definition/assignment/anchor/outfit/dialogue changes.

Code/UI rollback-check passed before/after startup. Live rollback not executed. After closed game and verified isolated shutdown, from rp-gamemode run node research/g244/deployment.cjs rollback-check, then rollback, then node research/g244/start-verified.mjs. Refuses later edits/orphaned assignments; preserves displaced UI/backups and never restores persistence. Late owner preflight/recovery-helper changes are not loaded by sealed runtime, so need no further restart.

## 12. Owner acceptance — ขั้นตอนภาษาไทย

ทดสอบสอง template เดิมได้ก่อนโดยไม่ต้องสร้างแอสเซ็ตใหม่:

1. เปิดเกมด้วย node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" play แล้วใช้คำสั่งเดิมเปลี่ยนท้ายเป็น grant ยืนยันตามหน้าจอเมื่อเชื่อมต่อแล้ว
2. /npc identity → /npc manage → http://127.0.0.1:13210/npc-assets ล็อกอินด้วยรหัสใหม่ ตรวจ current catalog Clerk/Warrior และ identity พร้อม
3. ตรวจ Clerk/Warrior/HomHom เดิมไม่ซ้ำ ชื่อ/ชุด/ตำแหน่ง, E dialogue/passive protection, Rename/Move/Rotate และ reconnect ตรวจว่าข้อมูลยังอยู่ ใช้พื้นราบ ปัญหาพื้นเอียงยังแยกติดตาม
4. รายการอนุมัติ → เตรียมใช้งานในเกม → ตรวจความพร้อม → review/request ต้องบอก restart/owner action ตามจริง ไม่สร้าง NPC/เปิด plugin ทันที ใช้ NPC Management เดิมหลัง proof ผ่าน

เมื่อมี NPC ใหม่จริง: CK/FaceGen export ของเจ้าของ→G245 register/scan/stage/approve→runtime prepare/review/request. รองรับหลาย NPC ใน plugin เดียวโดยไม่เพิ่มโค้ดรายตัว ไฟล์ owned development ต้องมีและตรงhashก่อน ไม่ให้เว็บลงไฟล์เกมเอง Dependency ไม่พร้อมจะหยุดพร้อมเหตุผล

ปิด Skyrim และหยุดเฉพาะ isolated console ของตนก่อน:

```powershell
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" runtime-activate
```

ตรวจแผนแล้วพิมพ์ CONFIRM เอง จากนั้น play→grant→/npc identity→NPC Management→เลือก template→สร้างหนึ่งตัว ตรวจหน้าตา/ชุด/anchor/E/streaming/reconnect/restart/ไม่ซ้ำ หาก interrupted ให้ปิดเกม/ตัว operator เดิม ใช้คำสั่งเดิมท้าย runtime-recover แล้วยืนยัน RECOVER ตาม diagnostics ห้ามลบ lock/receipt เพื่อข้าม guard

Actual new v2 owner acceptance remains pending. No new third NPC or multiplayer acceptance invented.

## 13. Status/remaining limitations

| Area | Status | Evidence/remaining gate |
|---|---|---|
| RUNTIME_IDENTITY_SPEC | PASS | canonical bounded v2 tests |
| DYNAMIC_APPROVED_BASE_MAPPING | PASS | generic tests/real2 identities; Skyrim pending |
| CLIENT_PLUGIN_VERIFICATION | PARTIAL | pinned API/file/simulated protocol; owner handshake pending |
| SERVER_PLUGIN_VERIFICATION | PASS | actual2 forms/resources and invalid fixtures |
| DEVELOPMENT_PROFILE_PREPARATION | PASS | plans/private fixtures; new installed activation owner-only |
| CATALOG_RUNTIME_PROMOTION | PASS | journal/restart/scoped merges/recovery |
| ADMIN_UI_RUNTIME_WORKFLOW | PASS | automated/browser fixture; owner pending |
| NEW_NPC_TEMPLATE_CREATION | PENDING_OWNER_ASSET | original lifecycle reused; no fake actor |
| EXISTING_NPC_COMPATIBILITY | PARTIAL | assignments/journals/tests pass; current Skyrim pending |
| NPC_UUID_PRESERVATION | PASS | all3 unchanged |
| ANCHOR_AND_COMBAT | PARTIAL | original tests; slope issue DEFERRED |
| DIALOGUE_COMPATIBILITY | PARTIAL | tests/journal preserved; current owner check pending |
| STREAMING_RECONNECT | PARTIAL | automated session/lifecycle; new real flow pending |
| ISOLATED_DEPLOYMENT | PASS | actual process/ports/health/auth/seals/UI |
| NEW_TEMPLATE_RUNTIME_PROOF | PENDING_OWNER_ASSET | genuine asset absent |
| NEW_TEMPLATE_RENDER_PROOF | PENDING_OWNER_ASSET | structural validation is not rendering |
| NATIVE_CRASH | BLOCKED | original0xC0000005 unresolved |
| SINGLE_CLIENT_ACCEPTANCE | PENDING_OWNER | checklist above |
| MULTIPLAYER_ACCEPTANCE | DEFERRED | no2-client/capacity claim |

Supported full ESP/approved NPC/owned fixed OTFT and existing reviewed race/head/body/outfit resource envelope only. ESL/light/unknown closure/changed active plugin revisions conflicting with immutable assignments fail closed. No arbitrary installed-mod support, dynamic Base/equipment switching, terrain/crash fix, production distribution or G2.4.3 multiplayer.

## 14. Changed files and Git delivery

Server: src/modules/npc/{runtime-identity-spec,development-identity,catalog-loader,template-catalog}.ts; src/client/development-identity.ts; src/runtime.ts. Tooling: scripts/g246-{onboarding,runtime-catalog,activation,preflight}.cjs; existing g241d-{dev,runtime}.cjs/g245-assets.cjs and research/g244 deployment/start helpers. Paths are under rp-gamemode. UI: blueprint-editor/src/npc-runtime.{tsx,test.tsx}, npc-assets.tsx. Focused tests and native/browser research fixtures included.

Separate Launcher: src/main/management/npc-development.ts; scripts/npc-development.mjs, npc-runtime-{seal,onboarding}.mjs and corresponding tests. No release version/binary changes.

Branches: SkyMP dev/npc-activation-g241d→frostveil (kaktv2016/skymp), Launcher dev/npc-local-activation-g241d→origin (kaktv2016/frostveil-launcher). Never push SkyMP upstream origin. Source commit IDs/push verification recorded below after committing. Private assets/journals/snapshots/credentials/receipts/logs/binaries are excluded.

### Verified source delivery

- SkyMP server/tooling/tests: c9a8e375ef8980302c9f77f3ca2de6d988574bca.
- SkyMP Asset Library UI/browser fixture: b6af20d0c6c252b543ed35aa716f528e95623e89.
- Launcher local owner activation/recovery: 22233220d85ae0de55f4554a3905edb90a2350b4.
- Both authorized pushes succeeded; git ls-remote matched those branch tips. This report is delivered as a subsequent documentation commit. No upstream push/force push or unrelated WIP changes.

### Rejoin diagnostics hotfix —2026-10-31

Owner play failed using old console11104/startup0ccf8210. Live inventory confirmed no Skyrim, isolated node/console, UDP17777/TCP17778/UI13210 listeners. The old log ended READY PASS, with no terminal exit record; cause of the process stopping is unproven (no crash/reboot/manual-close attribution). play reads a persisted successful receipt and then checks actual liveness; it correctly refused launch, but misleadingly labelled the dead old console PROCESS_CREATION.

Launcher local helper now marks rejoin-only missing-process failures SERVER_NOT_RUNNING, while fresh starts retain PROCESS_CREATION. All native-failure precedence, process ancestry, profile/catalog hashes and loopback port/health gates remain mandatory. No auto-restart, installed-profile changes or Skyrim launch added. RED regression reproduced the mislabel;17 focused startup/seal/recovery tests and typecheck pass. Backups/failure/green logs retained under build/rp-audit/g246/rejoin-hotfix. Launcher commit c6899ea pushed to authorized owner branch.

Verified the same isolated target idle and preserved protected hashes; restarted through existing start-verified.mjs. New console22236→supervisor9352→engine3148, startup5dd612e4-c2f8-4b67-acf8-9d1fb0feb060. Real rejoin all gates READY, UDP/TCP loopback ownership verified. Protected world/registry/dialogue/production hashes are identical across this restart. Owner can rerun the exact absolute play command; Skyrim not launched by agent. Do not close the server console while using it.

### Owner reconnect acceptance —2026-10-31

Owner reports: "ลองออกเข้าใหม่แล้ว npc อยู่เหมือนเดิม" (NPCs remained after leaving and reconnecting). Screenshot codex-clipboard-a014c16f-3a58-4d1e-8541-cb502dc89132.png shows Identity verified · mapper armed, three managed NPCs (Clerk, Warrior, HomHom), two appearance configurations and the original Clerk UUID c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421/template/outfit/policies/dialogue. This provides actual owner evidence for successful client identity/mapper acknowledgement and existing NPC presence after reconnect. It is not proof of a new third base, complete FaceGen rendering, a fresh server-restart persistence test, two-client replication or all Rename/Move/Rotate/E/protection tests. Those unreported acceptance items remain pending; prior status rows must be read with this dated update.

The owner separately confirmed restarting the computer before the later SERVER_NOT_RUNNING failure for console22236. That explains that stopped-server instance; no native crash is inferred. The isolated server was restarted and verified READY with console19840/startup022292d1-2687-492f-8cde-698f0ccb6bb0. No game/profile/data changes were made to record acceptance.
