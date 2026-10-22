# Multiplayer verification checklist

## Latest user acceptance — Phase 2.3

2026-10-14: Phase2.3 five-item solo handoff checklist PASSED by user confirmation: profile Save/Thai edits; reopen/Cancel/blank validation; Escape/F7 gameplay controls; reconnect/server-restart profile retention; existing `/whoami`/`/me`/`/do` and character/items. Final Phase2.2 solo checks are also confirmed. [PHASE23](../../rp-gamemode/PHASE23.md) is the current evidence scope. Do not require these same checks again for unrelated changes; additional checks follow change impact. Automated output/count, direct edit-command variants and two-player behavior are not newly verified. Older pending checklists below remain historical. No gameplay/test operation performed in this update.

## Current checkpoint and change-based testing

2026-10-13: the user confirmed baseline solo native state/restart and all Phase 2.1 regressions. Phase 2.2 real chat display, Enter submission, normal/Thai self-echo and `/whoami`, `/me`, `/do` replies are now SOLO PASS from screenshot plus five server/client deliveries. Remaining relevant chat acceptance: close/focus, menu interference, invalid-input/throttling, reconnect/duplicate cleanup and native-state preservation after this change. Two-player proximity/movement/combat/cell transition checks remain deferred, not failed and not missing source implementations. See [SYSTEM_CAPABILITY_REPORT](SYSTEM_CAPABILITY_REPORT.md). Do not turn every historical checklist below into mandatory full regression for each new phase: reuse baseline and select checks based on changed paths. Documentation-only planning does not require game tests. No tests run by the agent in this audit.

## Historical Phase 2.1 one-client acceptance gate

2026-10-13: the user confirmed the post-deployment character/items/equipment/appearance/position and reconnect checks passed and exited the game. Live logs/save verify actor ff000000/profile1, RP schema1 metadata and one profile1 actor. Fresh world/config backup taken; server restarted at 19:32 as PID20076 / session86951 on localhost7777/HTTP3000. Loaded the latest 13 ChangeForms/one player; RP ready, metrics and unchanged world/metadata/config verified. **Only the post-restart game/live identity check remains pending for this phase.** No two-player test is required. Older pending items/PIDs below are historical checkpoints.

| Check | Current status | Required evidence |
| --- | --- | --- |
| RP build/domain/source-contract/deployment tests | PASSED 67/67 | Phase 2.1 automated-tests.log; strict TS/type contracts |
| Real native metadata persistence in copied world | PASSED | Separate write/reload processes; same actor/native physical state |
| Actual wrapper/temp loader + idle local startup | PASSED | RP ready marker, authenticated metrics 200, unchanged 10 world files/5 artifacts |
| Existing character/inventory/equipment/appearance/position with RP bundle before restart | PASSED — user confirmation | Existing native state retained in gameplay |
| Identity assigned to the same native actor/profile before restart | PASSED | Native login/RP association ff000000/profile1; saved schema1 metadata |
| Disconnect/reconnect with RP bundle before restart | PASSED — user + server evidence | Same actor on both logins; one profile1 saved actor; metadata present on disk after reconnect |
| Actual development server restart / saved metadata retention | PASSED | Save captured before stop, latest backup, same world/config/bundle; 13 file hashes/metadata match afterward |
| Post-restart game/native state/live RP identity | NOT TESTED | Relaunch same SKSE/profile1; compare character/items/equipment/appearance/position; verify new native/RP association and saved metadata |
| `/whoami` domain | PASSED | Read-only handler/contract tests |
| `/whoami` in game | NOT EXPOSED | No verified compatible input/output transport |
| Two-player sync / 50–100 players | NOT TESTED | Future explicit validation, no claim from solo or mocks |

User steps:

1. Launch the existing `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\skse64_loader.exe` (Skyrim1.6.1170 / SKSE2.2.6). Use the same localhost7777/offline profile1; do not create a new character/profile.
2. Compare the existing character, inventory counts, worn equipment, appearance and initial position. Report anything missing, reset, duplicated or any new crash/error. Walk briefly.
3. Stay connected for at least 5 seconds, then exit Skyrim normally. RP metadata is private and has no in-game display. Server evidence should contain `Loading character ff000000`, profile1 login and `[rp] identity associated actor=ff000000 profile=1 schema=1`.
4. Wait 5 seconds and relaunch through the same SKSE loader/profile. Check the same character/items/equipment and most recent position. Exit and report reconnect results. A second connection ID is normal; a second native actor for profile1 is not.
5. After exiting the game, request the Phase 2.1 metadata restart test. Before stopping, inspect the actual `rp-world/changeForms` profile1 record for `dynamicFields["private.rp.v1.identity"]`, record actor/profile and metadata, and back up the latest world/config. Wait until metadata is actually on disk; do not assume Ctrl+C flushes it.
6. Restart the same server/world and log in again. Compare user-visible native state, metadata before/after, and the count of native actors associated with profile1. Confirm all checks individually. A new-process fixture result alone cannot mark this row PASSED.

Steps 1–5 above are now performed; continue with step6 using the already restarted server. Stay in-game at least 15 seconds, then exit/report. Current server log: `build/dist/server/logs/phase21-restart.log`; restart evidence: ignored `build/rp-audit/phase21/20261013-131609/restart-20261013-193146/`; initial deployment/rollback remains in its parent. Record fresh SKSE/SkyrimPlatform logs if any regression occurs, with private credentials omitted. Exact procedures: [RP README](../../rp-gamemode/README.md); results/contracts: [Phase 2.1 report](PHASE21_BUILD_REPORT.md).

Historic mod-count warning, Equipment/Inventory NUMBER_OUT_OF_RANGE and OnHit unknown-target errors remain unresolved. Record recurrence and effects separately; do not suppress checks or reset the world. If a new state-loss/duplicate-actor regression appears, stop the game, preserve the current world and logs, and roll back only bundle/config after review. Phase 2.1 acceptance and Phase 2.2 readiness remain pending.

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


## Phase 1.6 — current user-operated game test

**Current game is the existing Steam folder**, runtime 1.6.1170.0, SKSE 2.2.6 binaries and 62 scripts verified against the downloaded archive. It is not the Phase 1.5 proposed separate installation. Client deployment is complete after explicit user approval: 99 additions, no replacements, 8 existing databases retained; all 107 destination hashes verified. Use the Phase 1.6 section of SETUP_WINDOWS for the actual in-place launch/rollback process; earlier isolated-profile instructions are historical alternatives.

Automated asset rerun: 12/12 CTest targets passed, 255 native cases/476,792 assertions passed and 11 integrations executed. Actual local server was launched again with current assets; single-client milestones below have been exercised; unexecuted checks remain **NOT TESTED**.

The installed client is ready for the user to test:

1. Keep the verified localhost server running and launch the existing game's `skse64_loader.exe`. Avoid Steam Play/Verify and personal saves.
2. Verify the SKSE/platform/client initialization logs and game console (`Hello Multiplayer!` is a source-defined script trace). Offline profile ID 1 should initiate local authentication; record actual behavior rather than assuming it succeeded.
3. Complete race selection if shown, confirm controllable world spawn, walk for at least a minute and note any freeze/crash/error.
4. Exit Skyrim, relaunch with the same profile ID and record reconnect/actor/location behavior. Leave the server running between launches.
5. Provide fresh `skse*.log`, `skyrim-platform.log`, actual optional client logs, relevant server log timestamps and screenshots of errors/spawn. Resolve the real Documents path; no fabricated log path/file should be marked collected.

| First real-client milestone | Current result |
| --- | --- |
| Game/SKSE files and script versions | VERIFIED; SKSE runtime loading PASSED |
| Client installed | PASSED; 99 additions, all 107 files hash-verified |
| Skyrim launches through SKSE | PASSED; loader log and running module |
| Skyrim Platform and native client load | PASSED; all expected modules loaded |
| Client JS/offline authentication initializes | PASSED to profile login; serialization errors retained |
| Actual UDP connect and server login/actor assignment | PASSED; connect/login and ff000000 server evidence |
| Controllable spawn and sustained connection | PASSED for initial walking, per user; no full stability certification |
| Disconnect/reconnect | PASSED for re-entry and same actor/profile reuse; exact position/inventory unverified |
| Real-player restart persistence | Server loaded saved player; disk inventory unchanged; client item/position check PENDING |

Only after this one-client pass proceed to the existing two-client table. Prefer two machines with valid matching installations, profile IDs 1/2 and identical master CRCs. The initial server remains loopback-only; separate-machine testing requires an explicitly reviewed private-LAN change to both server binds, both client addresses and narrowly scoped UDP 7777/TCP 3000 firewall access. No LAN/firewall or public exposure change has been made.

## Historical Phase 1.5 isolated-client smoke test — superseded; NOT TESTED

Run only after the approval/installation/asset-alignment gates in [SETUP_WINDOWS](SETUP_WINDOWS.md). Selected configuration is isolated **Steam 1.6.1170.0 + Steam SKSE 2.2.6**, this checkout's paired native distribution, and matching five-master server/client files. No verified 1.7.104 port was found; the current installed game is not the selected test runtime. New client logs do not exist yet because no game launch was attempted.

1. Verify `C:\SkyrimDev\SE-1.6.1170\SkyrimSE.exe` reports 1.6.1170.0. Verify the archive/readme, `skse64_loader.exe` and `skse64_1_6_1170.dll` belong to Steam SKSE 2.2.6. Confirm separate test INI/saves and the virtual profile's complete SkyMP distribution; no unrelated mods. Save fingerprints and the profile manifest.
2. With the aligned/validated server assets, start the real server from `<SKYMP_REPO>\build\dist\server`: `node dist_back/skymp5-server.js`. Capture a new startup log and verify both localhost binds, UDP 7777/HTTP 3000 and private metrics. Do not run destructive CTest while it is active.
3. Start Steam under the owning account, select the isolated profile and run its **isolated SKSE loader through the mod manager**. Verify the resulting SkyrimSE process actually uses the isolated path/version; a main menu alone does not prove plugin loading. Do not open an existing personal save. Follow the client's new-session flow if prompted.
4. Inspect SKSE logs and `skyrim-platform.log` for successful platform initialization and the client settings/plugin load. After connection, inspect the running process's modules for the SKSE runtime DLL, SkyrimPlatform.dll, SkyrimPlatformImpl.dll and MpClientPlugin.dll at the intended physical/virtual profile paths. MpClientPlugin is loaded by the platform API, not an SKSE plugin entry point: a missing SKSE export for that DLL alone is not proof of client failure.
5. Check script traces/errors in the in-game console and platform log. This source's client logging uses `printConsole`, so do not assume every trace is automatically written to a client log file. Capture console screenshots on failure. The source's optional `writeLogs` API writes `Data/Platform/Logs/<plugin>-logs.txt`; collect these only if they actually exist, without adding a custom logging plugin. Stop on address-library/version mismatch, missing implementation/CEF/Node DLLs, native hook errors or script exceptions; retain the first error and reproduce it before changing anything.
6. Confirm the virtual settings specify localhost:7777 and integer offline profileId **1**. AuthService detects that integer and emits local authentication automatically on its auth-needed event; Discord/production login is unnecessary for this offline test. Require actual server connect/login/actor-assignment evidence, not just HTTP reachability or the menu. Confirm master CRC32/size matches the server manifest and record connection failure/denial messages if present.
7. Finish the initial race selection if presented and verify controllable spawn in the server's configured default region. Record a screenshot and the corresponding server login/actor record. Keep the client connected briefly, move, then exit and confirm the disconnect. Mark launch/platform/native/script/connect/spawn results separately. This one-client pass still does not establish two-player synchronization.

Read-only process verification in a second PowerShell (run at the same privilege level as the game; collect access errors rather than treating them as missing modules):

```powershell
Get-Process -Name SkyrimSE | Select-Object Id,Path
Get-Process -Name SkyrimSE | ForEach-Object { $_.Modules } |
  Where-Object { $_.ModuleName -in @('skse64_1_6_1170.dll','SkyrimPlatform.dll','SkyrimPlatformImpl.dll','MpClientPlugin.dll') } |
  Select-Object ModuleName,FileName
$skseLogs = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\Skyrim Special Edition\SKSE'
Get-ChildItem -LiteralPath $skseLogs -Filter '*.log' | Select-Object Name,Length,LastWriteTime
```

Collect newly timestamped `skse*.log` (including loader/runtime logs where generated), `skyrim-platform.log`, actual optional profile `Data/Platform/Logs` files, console screenshots and server stdout/stderr. Documents may be redirected to OneDrive; resolve it as above. Logs can be shared across sessions even when game folders differ, so archive them immediately after each run and label client/profile/date/PID. Keep game masters, private metrics/auth configuration, account tokens and personal saves out of Git/shared evidence.

## Phase 1.5 two-client preparation — all gameplay NOT TESTED

Require two legitimately available matching installations/instances with the same verified Steam 1.6.1170 runtime, SKSE 2.2.6, local native/JS fingerprints and five-master manifest. Use separate save/INI profiles and distinct offline IDs **1** and **2**. Separate PCs are the simplest two-real-client setup; each needs a valid game installation and account/license access. Two profile directories on one PC do not prove Steam/SKSE permits two simultaneous real instances.

Keep localhost for the initial one-client smoke test. For separate PCs, explicitly choose the server's private LAN IPv4 and use the later checklist's private-LAN bind procedure for both `listenHost` and `uiListenHost`, client address and narrowly scoped UDP 7777/TCP 3000 firewall access. Do not use 127.0.0.1 on a different PC or publish offline services. This preparation makes no firewall/configuration changes.

Then execute every manual row below: two connections/spawns, mutual visibility, movement, animations, combat, entering/leaving cells, disconnect/reconnect and server restart persistence. Before restart, allow actual player saves to settle, retain the same IDs, snapshot `rp-world/changeForms`, record actor IDs/location/inventory and log timestamps; after restart verify those properties, not just filenames. Do not replace player evidence with a bot/unit fixture. User participation is required for graphical gameplay and both observers; record each result as PASSED/FAILED/NOT TESTED with evidence.

## Historical 1.7.104 completion checkpoint — superseded by Phase 1.6

**Phase 1 PARTIALLY COMPLETE.** Skyrim is installed at `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`, executable **1.7.104.0**. Five vanilla masters loaded successfully. Incremental configure/full Release build passed. First native run: 254 passed/1 failed (`Activate torch`, suspected timing flake); unchanged focused test passed; full rerun: **255 native cases and all 11 integrations PASSED**, CTest exit 0. CI-only hash and packaging test bodies remained SKIPPED by upstream guards.

The actual baseline server started with both loopback binds, maxPlayers 5, offline mode, debug logging, file database `rp-world`, absolute vanilla masters and Misc archive. It sustained advancing ticks without logged errors for over 85 seconds. UDP 7777/HTTP 3000 and metrics 401/200 checks passed. Ctrl+C removed its process/listeners without force-kill; restart with the same configuration initialized successfully. This establishes controlled termination/restart, not pending-save flushing. The world has zero player characters/change forms; real-player restart persistence remains NOT TESTED. Full evidence and restart observation are in BUILD_REPORT and ignored completion logs.

**Do not install/launch these plugins on the current 1.7.104 game yet.** The checkout/distribution supports older runtimes and lacks a 1.7.104 address database; SKSE is absent. Obtain a legally owned isolated compatible Steam 1.6.1170 installation and matching SKSE, then approve the installation plan in SETUP_WINDOWS. A mod profile alone does not isolate the executable version. Prepared profile-ID settings: `build/rp-audit/completion/client-1-settings.json` and `client-2-settings.json`.

All two-player checks below remain **NOT TESTED**. Once compatible clients are available, run the server from `build/dist/server` via `node dist_back/skymp5-server.js`, launch both isolated clients with matching SKSE, capture server/client logs and both screens, and record actual results for each table row. Separate PCs require the explicit private-LAN bind/address procedure below. Do not run destructive CTest integrations while the development server is active; preserve/restore its runtime as in BUILD_REPORT.

## Historical initial and recovery observations

2026-10-13 baseline: **all runtime and real-client checks NOT TESTED**. Configure failed, no server/client artifacts were built, and the user confirmed Skyrim is not installed. This file is a procedure, not test evidence. Record date, commit, executable/SKSE/platform versions, master CRCs, config, logs, outcome and reproduction details for each later run.

Recovery results: required VS 2022/v143, Windows SDK/.NET components and Yarn are verified. Configure and full Release compilation succeeded, including server, unit and native/client distribution. Node 24 loaded the actual addon successfully. CTest found 12 targets: native unit cases reported **138 PASSED / 33 FAILED**, with `[espm]` excluded and the CI-only packaging check skipped by upstream guards. All **11 integrations NOT RUN / NOT TESTED** because the unit fixture failed. Failures expose additional untagged game-data dependencies; no tests or fixtures were bypassed. Five-player loopback config is JSON-validated, but all five master paths are missing. Actual server startup, gameplay and restart persistence remain **NOT TESTED**. See [BUILD_REPORT](BUILD_REPORT.md) for logs and exact commands.

## Prerequisites and automated baseline

- [x] Verify required tools and complete Release build per [SETUP_WINDOWS](SETUP_WINDOWS.md).
- [x] Archive full CTest output: completion rerun exit 0, 255 native cases and all 11 integrations passed; initial timing failure and local CI-only guards remain documented. Repeat after changing to the selected 1.6.1170 Data.
- [x] Verify currently installed owned masters and successful loader parsing. Selected 1.6.1170 assets/client manifest alignment remains pending approval; never publish/distribute masters.
- [x] Build the official empty gamemode and apply five-player loopback configuration. Keep tests' `world` separate from development `rp-world`; no runtime/startup pass is implied.

## Actual local startup smoke test

This is the repeatable smoke-test procedure. Startup, loopback sockets, metrics, liveness, Ctrl+C cleanup and empty-world restart have now been exercised as described above. Pending-save flush and real-player durability remain **NOT TESTED**.

1. Start the actual generated server in `build/dist/server`, logging stdout/stderr to `logs/startup.log`. Do not use mock binaries or bots as evidence of a game-client test.
2. Confirm settings parse and the generated `server-settings-merged.json` contains `maxPlayers=5`, `listenHost=127.0.0.1`, `uiListenHost=127.0.0.1`, file driver and the intended load order. Confirm no unwanted additional settings sources.
3. Confirm all five masters are loaded with no missing-file/record errors. Check the generated `data/manifest.json` for expected order, CRC32 and sizes. Confirm script storage and gamemode initialize and logs show persistence attachment and system initialization. Merely reaching a PID log is insufficient.
4. Record the Node PID from logs. In another PowerShell, inspect its actual sockets:

   ```powershell
   $serverPid = [int](Read-Host 'Node PID printed by this server')
   Get-NetUDPEndpoint -OwningProcess $serverPid | Select-Object LocalAddress,LocalPort
   Get-NetTCPConnection -OwningProcess $serverPid | Select-Object LocalAddress,LocalPort,State
   ```

   Require UDP 7777 and listening HTTP TCP 3000 on loopback, no unexpected wildcard listener. HTTP connection activity is not a UDP handshake test. Any unexpected binding fails local isolation.
5. Check metrics protection: `curl.exe -i http://127.0.0.1:3000/metrics` must return 401; `curl.exe -u local-prometheus http://127.0.0.1:3000/metrics` prompts for the local password and should return Prometheus metrics. Verify tick/login/connect counters. Never use the source's metrics-auth bypass sentinel. This does not authenticate `/rpc`; loopback remains necessary.
6. Observe for at least 60 seconds, including logs and tick metrics. The process must remain alive without repeated tick/gamemode exceptions, save errors or fatal networking errors. Time the startup and note idle memory/CPU. A live process continuing after logged exceptions is a failed smoke test until investigated.
7. Ctrl+C the foreground server, verify the recorded PID exits and UDP/TCP listeners disappear. Record elapsed shutdown time and any error. Do not silently force-kill and label shutdown graceful. If termination is forced, classify persistence durability as unverified.
8. Restart with the same settings; verify clean startup and readable logs. Only a run satisfying items 1–8 constitutes a real startup smoke-test pass.

## Two real Skyrim clients

Requires two playable, matching game clients with different offline test identities. Bots, native network unit tests and manifests cannot establish visual synchronization. On the initial loopback config, clients must actually reach the server's loopback interface. For two separate PCs, use an isolated private test LAN: intentionally change **both** listenHost/uiListenHost to the server's actual private IPv4, allow only the test client addresses in Windows Firewall, and use that private address in both clients. Do not configure public forwarding. Recheck sockets before proceeding; this is a later manual LAN test, not the initial localhost smoke test.

Install the built `build/dist/client` distribution into each separate test profile, along with the correct SKSE/runtime prerequisites. Use the same vanilla masters/order and avoid unrelated gameplay/UI mods. Launch via the matching SKSE loader. Edit each profile's `Data/Platform/Plugins/skymp5-client-settings.txt` using strict JSON:

```json
{
  "server-ip": "127.0.0.1",
  "server-port": 7777,
  "gameData": { "profileId": 1 }
}
```

Use profile ID **2** on client B. For separate PCs replace `server-ip` with the actual private LAN address; never leave localhost on a different machine. These fields are confirmed in the client settings generator/auth source. Preserve unrelated generated settings where needed. Use new test saves and complete the initial race menu. Default spawn comes from `Settings.startPoints`; both should initially use that same default region. Do not invent a teleport command or console privilege to compensate for a failed spawn.

| Manual check | Procedure and required evidence | Current status |
| --- | --- | --- |
| Connect A and B | Server records two connections/logins with distinct profiles and actor assignments; neither displaces the other | NOT TESTED |
| Spawn | Both finish race selection and can control their actors in the same region; capture client screens/logs | NOT TESTED |
| Visibility | Each sees the other actor at the expected location; verify both directions | NOT TESTED |
| Movement | A walks/runs/jumps while B watches, then reverse; inspect delays, rubber-banding and position disagreement | NOT TESTED |
| Animation | Alternate crouching, weapon draw/sheath and attacks; each observer sees changes | NOT TESTED |
| Combat | Agree to one basic melee hit; verify animation, target health and server processing; test reverse direction | NOT TESTED |
| Cell transitions | A enters an interior and returns, then B repeats; verify loading, correct subscriptions/visibility, no ghost actor, and both clients' logs | NOT TESTED |
| Disconnect/reconnect | A exits/rejoins with profile 1 while B stays; same character is restored, stale actor removed/disabled, no identity crossover | NOT TESTED |
| Restart persistence | Disconnect both; allow saves to settle, inspect `rp-world/changeForms`, record location/appearance/inventory, stop normally, restart and reconnect both | NOT TESTED |

For persistence, require retained actors/identity plus the specific properties under test, not merely the existence of JSON files. Record save timestamps/errors before shutdown and backups outside the disposable integration-test world. Disconnect may disable the actor; returning online should enable the same profile's character. The current spawn code picks the first actor for a profile, so multi-character selection is outside this test.

## Capacity and failure testing after the two-client pass

50–100 concurrent players, congested cells, packet loss, reconnect storms, NPCs, extended play and crash recovery are **NOT TESTED**. Start at five players; expand only after collecting tick p95/p99, CPU/RAM, bandwidth, save latency/backlog and client frame-time evidence. Define performance budgets before setting a larger capacity. Keep offline identities separate from future production authentication. No phase-completion or synchronization claim can be based on these unchecked boxes.
