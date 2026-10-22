# Phase 2.1 — RP foundation build and deployment report

2026-10-13, Asia/Bangkok. **Implementation, automated verification, local deployment and pre-restart one-client regression/reconnect PASSED. Actual development server restarted; post-restart game confirmation PENDING. Phase 2.1 is not declared complete and Phase 2.2 is not started.**

## Latest checkpoint — real-world metadata restart

The user reported “ผ่านแล้ว ออกเกมแล้ว” after the prescribed character/items/equipment/appearance/position and reconnect checks. SkyrimSE was absent before stopping the server. The real development save contained validated schema-1 `private.rp.v1.identity` on the sole profile-1 actor. Server log shows native actor `ff000000` loading at 19:25:25 and 19:29:08, RP association at 19:25:25, and both connections disconnected before the restart. This confirms actor reuse; connection IDs 1/2 are not two players. No `[error]`, RP failure or NUMBER_OUT_OF_RANGE lines were found in this server log; fresh client log review was not performed.

Backed up the latest world/config/log to ignored `build/rp-audit/phase21/20261013-131609/restart-20261013-193146/before/`. There are now 13 world files/ChangeForms after gameplay, with exactly one player/profile-1 record. Stopped PID27544 with Ctrl+C; process and listeners exited; all 13 world files remained byte-identical through shutdown. Started the same unchanged configuration, world and immutable RP bundle as **PID20076 / tool session86951** at 19:32:45 (Asia/Bangkok). Native startup loaded 13 ChangeForms including one player, the RP ready marker appeared, UDP127.0.0.1:7777 / HTTP127.0.0.1:3000 were verified, and metrics returned unauth401/auth200.

After idle startup, all 13 world hashes and the saved RP metadata matched the pre-restart snapshot; config was unchanged and there was still only one profile-1 actor. This proves retained on-disk metadata/current world across the actual restart. **The post-restart client's native in-memory identity observation and game-visible state remain NOT TESTED until the user logs in.** No live property read is claimed from disk equality alone. Current log: `build/dist/server/logs/phase21-restart.log`; evidence: `before/snapshot.json`, `shutdown-result.json`, `restart-result.json`, `after-startup.log` in that restart directory. Prior startup/deployment sections below retain their historical PID/counts.

Next: enter through the same SKSE loader/profile1, compare the same character/items/counts/equipment/appearance and last position, stay connected at least 15 seconds, then exit and report results. Inspect the new native/RP actor association and compare saved metadata to the captured snapshot before final acceptance. `/whoami` remains not exposed in-game. No new code, dependency, configuration change, commit or Phase 2.2 work was performed in this restart step.

## Baseline and preserved state

Branch `develop`, HEAD `5397cd3bf4666c942f78193107881d8cf0ac2748`; unchanged engine parent `2849e676fe008925384b26f34476e382a30bd877`. No commits, donor source copies, dependency downloads or lockfile changes. Existing Phase 2.0 audit documents remain available. The user's Phase 2.1 request confirms solo inventory, equipment, position and real restart persistence passed; older pending statements in Phase 1 reports are historical checkpoints, not current contradictions.

Backups/evidence: `build/rp-audit/phase21/20261013-131609/` (ignored, private). Initial `before/` preserves all 10 world files, config, old empty gamemode and generated settings files. Relevant native/server/client artifacts were copied and SHA256 checked. `before-stop/` and `before-deployment/` refresh world/config around the controlled stop. `before-deployment/world-hashes.json` records the latest world hashes. No world backup was restored over current progress.

Original server PID 17280 / session 3057 was stopped with Ctrl+C after confirming Skyrim was not running. World files remained byte-identical through stop, deployment and idle startup. The following five artifacts remain unchanged: `scam_native.node`, `dist_back/skymp5-server.js`, built SkyrimPlatform.dll, MpClientPlugin.dll and SkyrimPlatformImpl.dll. No C++ engine, existing login/spawn systems, installed game assets/DLLs, native inventory/equipment/appearance/location or account mapping were modified.

## Implemented architecture

Original `rp-gamemode/` project compiles separately to a self-contained CommonJS bundle. Strict TypeScript and branded ActorId/UserId/ProfileId/FormDesc enforce identity separation; external native values are validated at runtime. A module graph validates dependencies/cycles before initialization, owns resources, rolls back partial failures and shuts down in reverse order. Command parsing/dispatch is independent of transport.

One `rp-identity` module observes native online actors once per second and verifies actor/user/profile/GUID mappings before associating metadata with the same existing actor. It does not enumerate a fixed profile range or create native actors. Periodic per-actor errors are isolated; unsupported/corrupt metadata remains untouched. Initial observation failure aborts RP boot and cleans owned commands/timers. One-shot boot and immutable deployment avoid unsupported hot reload.

Metadata: `private.rp.v1.identity = {schemaVersion:1, displayName:string, biography?:string}`. Name uses the existing native actor name; optional biography is schema support only, with no editing UI. No SQL store, second inventory authority, new login/spawn hook or client-side property registration is added.

`/whoami` is registered as a read-only domain handler and tests verify it cannot create metadata or alter physical state. **In-game transport NOT EXPOSED / NOT TESTED**: no compatible command input/output path was verified, so no fake chat/console interface or speculative native networking changes were made.

## Exact engine contract

| Used API / contract | Source in pinned checkout | Verification |
| --- | --- | --- |
| `get`, `set`, `getActorName`, `getDescFromId`, `getUserByActor`, `getUserActor`, `isConnected`, `getUserGuid` | `skymp5-server/cpp/addon/ScampServer.cpp` | Export/signature inspection, source assertions, guarded facade tests; actual addon used for get/set/name/descriptor/profile persistence |
| `get(0, 'onlinePlayers')` | `skymp5-server/cpp/addon/property_bindings/OnlinePlayersBinding.cpp` | Ignored form argument; native actor list including user slot 0; actual addon returns empty without clients |
| `get(actor, 'profileId')`, actor/profile association | `property_bindings/ProfileIdBinding.cpp`, ScampServer bindings, native Spawn/Login | Actual existing profile-1 actor used in fixture; live association waits for login |
| Private property read/write and replication | `property_bindings/CustomPropertyBinding.cpp`, `cpp/server_guest_lib/MpObjectReference.h` | `private.` accepted without makeProperty; SetPropertyValueDump false/false visibility; no client replication |
| Custom metadata persistence | `cpp/server_guest_lib/MpChangeForms.cpp`, native save storage | dynamicFields serialized with native state; actual copied-world write and new-process reload |
| CommonJS temporary loader | `skymp5-server/ts/index.ts` | Copies entry to OS temp, sets globalThis.mp; actual unchanged server wrapper boot/metrics passed |
| Generated empty gamemode | `skymp5-functions-lib/CMakeLists.txt` | BUILD_GAMEMODE=OFF regenerates empty gamemode.js; separate absolute deployment selected |

Paths abbreviated as `property_bindings/` are under `skymp5-server/cpp/addon/`; `cpp/server_guest_lib/` paths are under `skymp5-server/`.

## Automated results and evidence

| Check | Status | Scope / evidence |
| --- | --- | --- |
| Independent build + strict TS/type-negative contracts | PASSED | Node 24.11.1, TS 5.4.5, esbuild 0.28.1, @types/node 22.10.2 already installed; no runtime imports in dist/build-manifest.json |
| Node test suite | PASSED 67/67; failed 0, skipped 0 | 18 command, 16 lifecycle, 12 adapter/identity, 9 runtime, 5 static native contracts, 7 deployment/rollback; audit automated-tests.log |
| Actual native metadata write/save | PASSED | `native-2u787R/`: existing profile 1, actor ff000000, copied world; ticks until field observed on disk |
| Actual native reload in separate process | PASSED | Same fixture: metadata matches; same existing actor; native inventory/equipment/appearance/profile/location unchanged; physical serialized state unchanged |
| Actual unchanged server wrapper/temp loader | PASSED | `wrapper-60qIP3/`: real addon, copied world, UDP 17777 / HTTP 17778, ready marker and authenticated metrics 200; copied world unchanged |
| Controlled deployment / latest world preservation | PASSED | deployment-verification.json; config only gamemodePath changed, 10 files unchanged, previous empty gamemode untouched |
| Development server startup | PASSED | PID 27544 / tool session 2402; UDP127.0.0.1:7777, HTTP127.0.0.1:3000; metrics unauth401/auth200; 10 ChangeForms / 1 player loaded; ready marker |
| Native artifact fingerprints after deployment | PASSED 5/5 | integrity-result.json vs baseline-artifacts.json |
| Earlier unfiltered upstream CTest baseline | Previously PASSED 12/12 | Not rerun destructively against rp-world; unchanged native source/artifacts, relevant new isolated tests run |
| Real client with RP bundle, before restart | PASSED — user confirmation | Existing character/items/equipment/appearance/position and reconnect confirmed; native/RP logs show same actor |
| Live actor RP association / reconnect before restart | PASSED for actor association/reconnect | ff000000/profile1, one saved player, schema1 metadata present after reconnect; no separate metadata snapshot between first and second login |
| Actual development server restart / on-disk metadata retention | PASSED | Same world/config/bundle; 13 files and RP metadata unchanged; ready/listeners/metrics verified |
| Post-restart real client + live RP identity/native state | NOT TESTED | User must log in after PID20076 restart; verify association and gameplay before final acceptance |
| In-game `/whoami` | NOT EXPOSED | Domain tests PASSED, actual input/output transport unverified |
| 50–100 player capacity / two-client sync | NOT TESTED | One-client phase; no capacity or synchronization claim |

Expected red-first unit failures were observed before implementation. Review found a deployment record-write ordering gap and corrupt-actor polling starvation; regression tests reproduced both and passed after fixes. Fresh full-suite and native/wrapper checks passed after the fixes. A read-only independent review found no remaining critical/important issues in those changes.

Two retained failed harness attempts did not affect the live world: `native-KPtktR/` lacked copied generated data/scripts; `wrapper-sgAVFW/` requested HTTP before asynchronous UI readiness. Harnesses were corrected to copy runtime data and wait for actual listener readiness; successful fixtures above supersede these attempts. Do not interpret them as unexplained engine failures or hide them.

## Deployment and rollback

Only server-settings.json `gamemodePath` changed to:

```text
<SKYMP_REPO>\rp-gamemode\deployed\0344e18596e37d2146b667ca7fbe1f653782cd7bc497eada582fd3679a46f07c.cjs
```

Bundle SHA256: `0344e18596e37d2146b667ca7fbe1f653782cd7bc497eada582fd3679a46f07c`.

Current development server log: `build/dist/server/logs/phase21-restart.log` (previous log retained as `phase21-startup.log`). Backups/rollback record: `build/rp-audit/phase21/20261013-131609/deployment/deployment.json`; secrets stay in ignored backups/settings, not these documents. Deployed bundle is immutable; do not edit while server is running. Engine rebuilds do not write this bundle but may affect generated config/artifacts; inspect them afterward.

After exiting Skyrim and stopping the server, take a latest-world backup and run `npm run rollback` from rp-gamemode. It validates hashes and restores previous gamemode configuration while retaining current world/progress/RP metadata. Changed unrelated config or previous gamemode is refused for review. No automatic world restore. Actual live rollback NOT RUN; isolated rollback tests PASSED. Details and exact startup commands: [RP README](../../rp-gamemode/README.md).

## Files and remaining gate

Created original `rp-gamemode/` package/build config, nine TS source files, build/native/wrapper/deploy/rollback scripts, seven test/type-contract files and README. Generated `dist/`, `.test-build/` and `deployed/` remain ignored. New plan/report: [implementation plan](PHASE21_IMPLEMENTATION_PLAN.md) and this report. Updated architecture, BUILD_REPORT, MULTIPLAYER_TEST_CHECKLIST and PHASE1_PLAN with current superseding status. Existing Phase 2.0 audit docs remain intact.

Known old issues remain: transient mod-count warning (master/manifest lookup not validated), Equipment/Inventory NUMBER_OUT_OF_RANGE and OnHit unknown target from prior sessions; no speculative suppression/fix. Current startup retains upstream punycode deprecation, stamina-default and damage-formula-default messages and empty master gateway fallback. No RP boot/observation error appeared during idle startup; game regression coverage is pending. Controlled module stop is tested but no new OS signal handler or native save-flush guarantee was added.

Follow the new [Phase 2.1 manual checklist](MULTIPLAYER_TEST_CHECKLIST.md). Capture RP metadata on disk after the first real login; reconnect, then perform an explicitly coordinated restart and compare metadata plus native state/no duplicate actor. Only after confirmed acceptance should a separately approved next slice verify command input/output transport and expose the existing read-only whoami handler. Phase 2.2 is not authorized or implemented here.
