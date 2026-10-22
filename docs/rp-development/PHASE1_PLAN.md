# SkyMP Phase 1 execution plan

## Superseding checkpoint — approved Phase 2.1 foundation

2026-10-13: the user's Phase 2.1 specification confirms the working solo baseline, including inventory/equipment/position and real restart persistence. Older pending statements below are retained as historical evidence. The original engine/source and `develop` baseline remain unchanged; no Phase 1 system was replaced.

The approved original additive RP foundation is built/deployed with 67/67 automated tests and isolated actual native save/new-process reload verification. The user confirmed pre-restart native-state checks and reconnect; live logs/save show the same actor/profile and RP metadata. Latest 13-file world/config backed up, actual development server restarted as PID20076 / localhost7777/HTTP3000; ready/listeners/metrics and unchanged saved metadata/world verified. Only post-restart gameplay/live RP association remain NOT TESTED. Phase 2.2 is not started and no automatic commit was made.

See [Phase 2.1 plan](PHASE21_IMPLEMENTATION_PLAN.md), [current report](PHASE21_BUILD_REPORT.md) and [manual gate](MULTIPLAYER_TEST_CHECKLIST.md). Two-player synchronization and historical log warnings remain separate outstanding work.

## Item persistence restart test — server restarted; client check pending

2026-10-13: user explicitly requested an item-save restart test. Backed up all 10 development `rp-world` files before stopping the original server PID 15836 with Ctrl+C. Its process and both listeners exited. All 10 files remained byte-identical through shutdown; the player save contains 25 `inv.entries` (inventory entries, not necessarily 25 individual items). Restarted the same configuration/world as PID 17280, foreground tool session 3057; log confirms 10 ChangeForms loaded, including 1 player character. UDP localhost:7777, HTTP localhost:3000 and authenticated metrics 200 verified. Persisted inventory JSON remains identical to the pre-restart snapshot. Evidence is in ignored `build/rp-audit/installation/restart-20261013-121242/`; live restart log: `build/dist/server/logs/phase16-restart-items.log`.

Server restart and reuse of persisted world **PASSED**. Actual client-visible inventory/count/equipment, position and character restoration after this restart remain **PENDING user verification**. Disk equality and a player-loading log do not establish all properties were restored into gameplay, nor that Ctrl+C flushed any latest pending changes. User should exit the old client session, relaunch via the same SKSE loader/profile 1, compare character/items/counts/equipment and position, and report any missing items. Do not stop the newly running server during that check.


## Current checkpoint — reconnect passed, multiplayer validation pending

2026-10-13: the user confirms the same character returned and walking works after re-entry. Server evidence at 11:55:50 shows connection 2 loading character `ff000000` and logging in as offline profile 1; connection 1 disconnect appears at 11:56:23. Re-entry/actor reuse **PASSED** with the server continuously running. These are connection IDs for the same profile, not proof of two distinct simultaneous players. Evidence: ignored `build/rp-audit/installation/reconnect/server.log` and `summary.json`. This does not verify exact position/inventory restoration or persistence across a server restart.

**Phase 1.6 single-client installation and basic smoke test PASSED with known issues. Phase 1 overall remains PARTIALLY COMPLETE.** Build, 12-target automated baseline, SKSE/platform/native loading, localhost login, character creation, walking and re-entry are verified. The session is not certified error-free: transient load-order warning, Equipment/Inventory NUMBER_OUT_OF_RANGE errors and server OnHit unknown-target errors remain unresolved.

### Proposed Phase 1.7 — multiplayer validation and stability (not started)

1. Capture the in-game client/server mod lists and manifest request result, reproduce the inventory/equipment and hit errors, and determine their effects before making a verified minimal fix. Do not suppress load-order checks or change engine code speculatively.
2. Test two real matching clients with distinct offline profile IDs 1/2. Prefer two licensed installations on separate PCs. Review private-LAN bind/client addresses and narrow firewall changes when this test is scheduled; current server remains loopback-only. Confirm mutual visibility, movement/animations, basic combat and inventory/equipment behavior from both screens and logs.
3. Test exterior/interior cell transitions, disconnect/reconnect while the other player remains connected, and distinct actor/identity assignment without ghost duplicates.
4. With the user ready and clients exited, record both players' actor IDs, positions and inventory, preserve `rp-world`, restart the same server, then reconnect and compare those actual properties. An on-disk save file or same-process reconnect alone does not certify restart persistence.
5. Run a timed two-client session (at least 15 minutes), recording disconnects, crashes and server/client errors. Mark each check PASSED/FAILED/NOT TESTED with evidence. Resolve or explicitly bound material synchronization issues before declaring the multiplayer foundation complete.

No Phase 1.7 execution, server restart, LAN/firewall change, game modification, Phase 2 implementation or commit is performed by this documentation update. Phase 2 planning may follow the validation results; RP features are outside the current scope.


## First real client — confirmed; follow-up checks pending

First real-client test (2026-10-13): user reports successful connection, character creation and walking. Server log confirms localhost connect at 11:37:50, character ff000000 creation and profile 1 login. Running Skyrim process contains all four expected modules: SKSE runtime, SkyrimPlatform, SkyrimPlatformImpl and MpClientPlugin. Launch/native loading/login/spawn/basic walking PASSED for this one-client smoke test; Re-entry is now PASSED as recorded above; restart persistence and two-player synchronization remain NOT TESTED. Evidence snapshots: ignored build/rp-audit/installation/first-client/. This is not an error-free session: platform log contains Equipment/Inventory count NUMBER_OUT_OF_RANGE exceptions; server logs contain OnHit target e70e4 not found. Effects/root causes remain unresolved and combat/inventory synchronization is not certified. User saw a transient more-mods warning: source clears it after 5 seconds and emits it when client mod count exceeds returned server count, including an empty returned manifest after failed lookup. Current empty master setting falls back to public gateway; actual console mod lists/request errors have not been captured, so Creation Club extras versus failed manifest lookup is unconfirmed. No mods/settings/native code were changed to suppress it.


**Goal:** Establish and verify the upstream multiplayer foundation before RP implementation.
**Scope:** User-supplied Phase 1 request, checkout `2849e676fe008925384b26f34476e382a30bd877`.
**Approach:** Inspect source and environment, initialize pinned dependencies, build existing targets, test actual artifacts, and document observations. Execute inline under the user's explicit autonomous-work instruction. No engine, dependency, lockfile, authentication, or gameplay changes.

## Current completion checkpoint — 2026-10-13

**Phase 1.6 supersedes the isolated-folder proposal:** user downgraded the existing Steam install to 1.6.1170 and installed SKSE 2.2.6; no duplicate game copy is authorized. The user will perform graphical gameplay tests.

- [x] Verify EXE/SKSE versions, both SKSE binaries and all 62 archive PEX matches, readable masters/BSA headers and known plugin/root-injector inventory.
- [x] Verify existing built artifacts/fingerprints/settings and compare every client destination. Exact plan: 99 ADD / 0 REPLACE / 8 KEEP_IDENTICAL, 107 files total.
- [x] Back up overlap files and personal INI; record full deployment path/hash manifest and rollback instructions.
- [x] Rerun necessary unfiltered tests for changed masters with a backed-up/restorable runtime: 12/12 CTest, 255 native cases and all 11 integrations passed; development world restored.
- [x] Start the actual server with current 1.6.1170 assets and prepare local manual launch/log procedure; socket/liveness evidence in BUILD_REPORT.
- [x] User approved the required installation; exact additions were reviewed before writing (explicit Task 3 requirement).
- [x] Deploy 99 approved additions and verify all 107 destination hashes; 0 replacements, 8 identical databases retained, CMake automatic install OFF.
- [x] User launched SKSE, created a character and walked; module and server login evidence captured.
- [x] Verify re-entry restores the same actor/profile and walking; server log and user report retained.
- [ ] Investigate transient load-order warning and recorded equipment/hit errors; execute proposed Phase 1.7 only when scheduled.
- [ ] Review real client/server logs; only then prepare the two-machine LAN test and player restart-persistence evidence.

No new download, downgrade, unrelated mod changes, engine patch or automatic commit is needed. Earlier Phase 1.5 unchecked installation steps are historical proposals, not instructions to create another installation.

Phase 1.5 research checkpoint: upstream main is still the local commit; 33 public branches, release metadata, runtime issue/PR searches, official Nexus file descriptions, local DLL exports/imports and pinned CommonLib runtime selection were inspected. No verified SkyMP 1.7.104 port was found. **Recommend isolated Steam 1.6.1170 + SKSE 2.2.6**, using existing paired client artifacts. Historical three-depot manifests and a concrete new-folder/mod-profile/server-asset plan are in SETUP_WINDOWS; live owned-account retrieval is not verified.

- [x] Investigate both runtime choices and record a sourced compatibility matrix/artifact fingerprints in BUILD_REPORT.
- [x] Prepare reversible installation, update-isolation, one-client smoke and two-client test instructions.
- [ ] Obtain explicit approval to retrieve owned depots/official SKSE and assemble `C:\SkyrimDev\SE-1.6.1170`. No game downloads/changes have occurred.
- [ ] Verify Steam access, completed depot manifests, actual 1.6.1170 EXE, matching Data and SKSE archive.
- [ ] Prepare the approved isolated game/mod profile with separate saves/INI and localhost client settings.
- [ ] Back up and align server/test assets with the selected clients; incrementally rebuild and repeat appropriate tests/startup because the Data changes.
- [ ] Perform the first real client launch/connect/spawn, then two-client gameplay/reconnect/persistence validation.

This is an approval checkpoint imposed by the user's Phase 1.5 restriction on game downloads/modification, not a technical success or Phase 1 completion. No native patch, dependency update, commit or Phase 2 work is planned.

**Phase 1 PARTIALLY COMPLETE; real-client validation is blocked.** Historical audit/recovery checkboxes below describe earlier runs, not current missing software.

- [x] Detect the installed Steam game and verify readable vanilla masters/archive headers/scripts. Path: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`; executable 1.7.104.0. Full Steam integrity verification not performed.
- [x] Incrementally configure the existing `build` with absolute `SKYRIM_DIR`; preserve VS 2022/x64/v143 and dependency pins; both game download and client installation OFF.
- [x] Run the official incremental full Release build: exit 0, existing server/unit/client outputs refreshed.
- [x] Protect development settings/world before CTest; run on a disposable copy and restore the development runtime afterward.
- [x] Run full native and integration validation: first native run 254/255 passed with a suspected 25 ms timing flake; focused diagnosis passed unchanged; full rerun 255/255 native cases and 11/11 integrations passed, CTest exit 0. Retain both runs and upstream CI-only skipped-body caveats.
- [x] Start the real upstream baseline server, verify world/native/system/persistence initialization, advancing ticks, loopback UDP 7777 and HTTP 3000, and protected metrics.
- [x] Deliver Ctrl+C, verify process/listener cleanup, then restart the same configuration. Explicit pending-save flush is not verified; no shutdown handler was added.
- [x] Inspect native client/platform/runtime/address-library distribution and prepare profile 1/2 settings plus reversible installation instructions.
- [ ] Resolve client runtime mismatch: installed 1.7.104 vs checkout support/data through 1.6.1170. SKSE loader is not installed. No game-directory modification, downgrade, engine port or dependency upgrade authorized/performed.
- [ ] Launch two compatible real clients; verify spawn/visibility/movement/animation/combat/cell transitions/reconnect and actor persistence across restart with logs/screens.
- [ ] Verify real-player persistence and graceful save flushing. Empty-world restart and the successful integration save fixture do not satisfy this.

Stop at the compatibility/manual participation checkpoint. Do not start Phase 2, custom gameplay, anti-cheat or capacity claims. BUILD_REPORT contains actual results and evidence paths; SETUP_WINDOWS and MULTIPLAYER_TEST_CHECKLIST provide the next steps.

## Historical initial audit plan

- [x] Read repository instructions, licensing, CMake, server/client source, persistence, tests and CI.
- [x] Record initial Git state; create `develop` from clean `main`; initialize pinned vcpkg.
- [x] Audit tools and registered game locations; user confirmed Skyrim is not installed.
- [x] Attempt official Windows configuration with the discovered CMake; investigate failure logs.
- [x] Build Release server and client: recovery configure and full Release build succeeded with verified VS 2022/v143 and SDK.
- [x] Execute available compiled tests: CTest found 12 targets; unit reported 138 passed / 33 failed cases; 11 integrations NOT RUN due failed fixture. Green validation remains blocked by game data.
- [ ] Smoke-test actual local server: local config is ready, but the five required game masters are absent.
- [x] Document local setup, two-client testing, and future RP adapters without implementing gameplay.
- [x] Verify documentation references, whitespace, Git changes, ignored build logs and unchanged source.

Deliverables: `ARCHITECTURE.md`, `SETUP_WINDOWS.md`, `BUILD_REPORT.md`, `MULTIPLAYER_TEST_CHECKLIST.md`, `RP_ARCHITECTURE.md`.

Review focus: correct generator/toolset; no fabricated build/test success; no downloaded game assets; loopback for both protocols; preserve upstream and pinned dependency history; persistence tests must use a disposable world.

Decision: keep the audited checkout and use the requested `develop` branch directly. No isolation is needed for documentation and ignored build artifacts. No changes to core code or dependency pins are justified by missing system tools. No major tool installation was authorized or performed.

## Recovery continuation — 2026-10-13

- [x] Re-read actual CMake, contribution requirements, manifests, workflows and initial report.
- [x] Verify newly available VS 2022/v143, SDK/.NET files and Yarn; preserve installed VS 2026.
- [x] Inspect incompatible cache and begin `--fresh` configuration with explicit VS 2022 selection and no game downloads.
- [x] Finish pinned dependency installation and configuration; retry after a stalled helper download using validated cache archives, with no generator bypass or dependency changes. Final configure exit 0.
- [x] Build dedicated server, unit binary, client TS and default native/client distribution in Release; commands exited 0.
- [x] Execute available tests and record passed/failed/skipped/not-built/not-tested separately; preserve failing CTest output and fixture requirements.
- [x] Verify server output paths and Node addon loading after successful Release build. Generated runtime/test-base config uses localhost and five players; world startup remains blocked by missing masters.
- [x] Update recovery results and verify project integrity; keep Phase 2 out of scope. Engine source, lockfiles, branch HEAD, remote and submodule pin remain unchanged.

Recovery build objective achieved. Phase 1 is still incomplete: game data must be supplied, full CTest must be rerun without exclusions beyond upstream defaults, and real server/client startup must be tested. No system components were installed by this agent. The only build-policy adjustment was the existing `NO_CLEAN_AFTER_BUILD=ON` cache retention option after a demonstrated helper-download stall; expected hashes were preserved.
