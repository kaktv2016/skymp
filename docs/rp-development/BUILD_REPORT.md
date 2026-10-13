# Phase 1 build and verification report

## Git baseline — Phase 1 working foundation

This baseline records the unchanged upstream implementation at parent commit `2849e676fe008925384b26f34476e382a30bd877` on `develop`, plus the six Phase 1 audit/setup/plan documents. Pinned vcpkg remains `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`. The current supported local environment is Steam Skyrim 1.6.1170.0, SKSE 2.2.6, VS 2022 x64/v143, Release server/client distribution, offline profile 1 and loopback server. Prior recorded unfiltered CTest: 12/12 targets passed; this documentation-only baseline does not rerun destructive integration fixtures against the live player world.

Verified working scope: server builds/starts, native client loads, real localhost connection, character creation/walking and same-character re-entry. Restart subsequently loaded the persisted player and retained matching on-disk inventory; actual client-visible item/position restoration after that restart is still awaiting user confirmation. Load-order warning and equipment/hit errors are known unresolved issues, and two-player synchronization remains unverified. This is a working single-client baseline, not a declaration that all Phase 1 acceptance tests are complete.

The Git commit preserves source and documentation, not the local installation. Ignored `build/` contains generated binaries, runtime configuration/private credentials, test evidence and `rp-world` player saves; these remain local and are excluded. Game assets and game-directory client files are also outside this Git snapshot. Use SETUP_WINDOWS to recreate the build/install and retain the existing ignored world backup separately when preserving player state. No Phase 2 implementation, engine patch, dependency update or push is included.


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


Date: 2026-10-13, Asia/Bangkok. **Phase 1 PARTIALLY COMPLETE. The user has installed runtime 1.6.1170 and SKSE 2.2.6 in place; the complete SkyMP client is installed and verified; real-client testing awaits the user.** The Phase 1.6 results below supersede earlier runtime/isolation proposals.

## Phase 1.6 — current in-place installation checkpoint

User approved the required installation on 2026-10-13. Deployment completed at 10/13/2026 11:26:56: 99 ADD, 0 REPLACE, 8 KEEP_IDENTICAL; all 107 destination SHA256 hashes match the approved distribution. Evidence: ignored build/rp-audit/installation/deployment-results.json and deployment-summary.json. Skyrim/SKSE, masters, personal saves and INI were not changed. Installed client settings are localhost:7777, offline profile ID 1. Server PID 15836 was rechecked listening on UDP 127.0.0.1:7777 and HTTP 127.0.0.1:3000. Game launch, plugin loading, connect, spawn and reconnect remain NOT TESTED; the user will operate the game.

The user chose to downgrade the registered Steam installation in place, without a second full game copy. Verified game folder: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`. `SkyrimSE.exe` is 1.6.1170.0; loader and `skse64_1_6_1170.dll` report 0,2,2,6. Both binaries and all **62 required PEX scripts** match the user's downloaded `skse64_2_02_06.7z`, SHA256 `D7297F1A1D613E5265E1AF4DBBFE8BD37A32719C1CCEF363FC6187FA6EBA0848`. The archive was extracted only under ignored audit storage to compare files; no game/SKSE download or modification was performed during the pre-deployment audit; approved SkyMP additions are recorded below. Actual SKSE loading remains NOT TESTED until the user launches the game.

All five masters and Misc archive changed relative to the previous 1.7.104 smoke test. Current sizes: Skyrim.esm 249,753,412; Update.esm 18,874,041; Dawnguard.esm 25,885,111; HearthFires.esm 3,977,420; Dragonborn.esm 64,663,863; Misc BSA 17,713,449 bytes. Hashes are in `build/rp-audit/installation/assets.json`. All five parsed successfully in the new unit run. The 23 installed BSAs have readable headers/end bytes. Older depot manifests are now present in Steam's depotcache, but downloaded depot payload directories are empty, so a complete byte-for-byte comparison to historical depot contents was unavailable. No Steam integrity verification was run.

No extra native SKSE plugin DLL or root DLL injector was found in the inspected folders. Existing Address Library files for other runtimes, including 1.7, are distinct filenames; the 1.6.1170 database matches the built distribution and is selected by the current EXE version. These extra files were not removed. Creation Club files, `_ResourcePack`, Marketplace archive and Skyrim.ccc remain untouched; optional content is not added to the five-master server load order. plugins.txt has no active third-party entries. This is a filesystem conflict audit, not proof that all optional content/mod behavior is compatible in-game. Residual-file/runtime behavior must be checked in the manual launch logs.

The existing built DLL fingerprints still match the Phase 1.5 audit. Complete client distribution: **107 files**. Approved, completed game changes: **99 additions, 386,864,447 bytes (~369 MiB), 0 replacements, 8 identical existing databases retained without rewriting**. Seven added loose PEX scripts can override scripts packed in vanilla BSAs by normal asset resolution; no BSA or personal save is changed. This effect is part of the official distribution and is included in the approval request.

Exact source/destination paths, original hashes, source hashes and actions are in ignored `build/rp-audit/installation/deployment-manifest.csv` and `.json`. The eight existing destination files were backed up under `game-backup`, and personal INI files under `personal-ini-backup`; backup hashes checked. Saves, Creation Club files, original game EXE, SKSE and unrelated assets are excluded from deployment. **Client installation COMPLETED after explicit user approval; all 107 destination hashes verified.** `INSTALL_CLIENT_DIST=OFF` and game-data downloads remain OFF.

Because assets changed, the unfiltered CTest suite was rerun on a backed-up/restorable disposable server runtime: **exit 0, all 12 targets PASSED**, **255 native cases / 476,792 assertions passed**, 11 integrations executed/passed, 58.67 seconds. Existing CI-only hash/DistContents guards still skip their bodies locally. No target rebuild was necessary: existing artifacts and compiled absolute game path are unchanged. The development runtime/gamemode/private credentials/world were restored afterward; test runtime retained separately. No integration fixture touched development `rp-world` data. Test logs and exit status: `build/rp-audit/installation/ctest.log`, `ctest-exit.txt`, `LastTest.log`.

The real baseline server was started again with these 1.6.1170 assets, PID 15836 (foreground tool session 17911), retaining localhost/five-player/offline/file `rp-world` configuration and the official empty gamemode. Native/system/persistence initialization succeeded and loaded zero player characters. **Readiness PASSED:** sampled after 181.04 seconds with 11,653 advancing tick samples, zero error/critical/unhandled-exception log lines, UDP `127.0.0.1:7777`, HTTP listener `127.0.0.1:3000`, authenticated metrics 200 and unauthenticated 401. The server is **left running** for the next approved client step; recheck its PID/ports before launch and do not start a duplicate. Known default-formula/stamina and Node punycode warnings remain, not suppressed. Evidence: `build/rp-audit/installation/server-readiness.json`, `metrics.txt`, `server-startup.log`, `server-manifest.json`; live log `build/dist/server/logs/phase16-startup.log`.

The regenerated client/server five-master manifest uses signed CRC32 values: Skyrim 616253901, Update -423982917, Dawnguard -744926134, HearthFires -1578363749, Dragonborn 287315548, with the current sizes above. Both sides resolve the same existing game Data folder; no assets were copied into Git. Client/platform initialization, real network handshake, spawn, sustained gameplay and reconnect remain **NOT TESTED**; the user will perform graphical interaction. The manual procedure and rollback are in SETUP_WINDOWS/MULTIPLAYER_TEST_CHECKLIST.

No Phase 2, anti-cheat, game downgrade, duplicate game installation, dependency change, engine patch or Git commit was performed. Current branch remains `develop` at the original SHA. Only the four requested development documents and ignored audit/configuration/runtime outputs changed in this continuation.

## Phase 1.5 compatibility decision — 2026-10-13

**No verified SkyMP 1.7.104 implementation was found. Recommend Option B: isolated Steam 1.6.1170 plus Steam SKSE 2.2.6, pending explicit approval.** The installation plan is ready; the client installation and in-game smoke test are not ready to execute. No game/depot/SKSE binary was downloaded, no original game file was modified, and no engine/dependency/branch change was made. The prior passing build, 12-target CTest rerun and server smoke results remain historical evidence; these successful tasks were not repeated in this research-only continuation.

The live GitHub API reports upstream default `main` at the same local SHA `2849e676fe008925384b26f34476e382a30bd877`. All 33 public branch heads were listed; the other 32 were compared against that SHA, with no API errors or truncated 300-file lists. Runtime-related ahead changes were plugin-loading/message changes, function-dump data, and a dependency lockfile, not a 1.7.104 port. Searches for `"1.7.104"` and `"1.7"` returned zero indexed issues/PRs; broader searches covered 1170, runtime and Skyrim update, plus the 100 most recently updated PRs. No compatible runtime implementation/test evidence emerged. This is a dated public-evidence audit, not proof about private/unindexed work or an exhaustive review of every historical comment.

The sole GitHub release is the 2022 `sp-v2.6-beta`, not a new runtime implementation. The official team's [Nexus files](https://www.nexusmods.com/skyrimspecialedition/mods/54909?tab=files) list Skyrim Platform 2.9.0 AE for 1.6.640/1.6.1170 (May 2024), alongside a separate deprecated 1.5.97 SE build. Do not mix those older packaged DLLs with this checkout's rebuilt implementation/Node/CEF distribution. [Merged PR 1938](https://github.com/skyrim-multiplayer/skymp/pull/1938) added the 1.6.1170 version library; merged 2024-04-21, commit `ad0f0569a27a235f715789efebf103b356ef944f`. [Pinned supported-games README](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/skyrim-platform/README.md) corroborates the intended runtimes.

| Runtime option | SKSE | Platform/address/native evidence | Decision / actual launch |
| --- | --- | --- | --- |
| Installed Steam 1.7.104.0 | Current 2.3.1 targets this runtime | No matching database in local dist; pinned CommonLib runtime classification/offset concerns; no verified upstream SkyMP port | Not a supported development choice; NOT TESTED |
| Isolated Steam 1.6.1170.0 | **2.2.6 Steam**, archive `skse64_2_02_06.7z` | Documented support; merged version-library PR; bundled format-2 DB header explicitly reads 1,6,1170,0 | **Recommended**, not yet installed/approved or launched |
| Steam 1.6.640.0 | Requires its own matching archived SKSE | README support and matching local database; 1170-specific hook assumptions still warrant real testing | Alternative, not selected or launched |
| GOG 1.6.1179 / GOG SKSE | Separate GOG package | Not interchangeable with Steam runtime/depot/database selection | Not selected; NOT TESTED |

SKSE 2.2.6's [official tagged version header](https://github.com/ianpatt/skse64/blob/v2.2.6/skse64_common/skse_version.h) sets `CURRENT_RELEASE_RUNTIME` to 1.6.1170. Obtain the Steam archive through the [official archive index](https://skse.silverlock.org/download/archive/), not the `_gog` package or the current 1.7.104 package. Binary/archive verification remains pending retrieval.

Native inspection used VS 2022 `dumpbin /headers /dependents /exports`, without loading plugins into Skyrim:

| Selected local artifact | Verified metadata / role |
| --- | --- |
| `Data/SKSE/Plugins/SkyrimPlatform.dll` | x64, 149,504 bytes, version 2.9.0.0; SKSE load/query/version exports; imports Kernel32/User32; dynamically loads implementation from RuntimeDependencies |
| `Data/Platform/Distribution/RuntimeDependencies/SkyrimPlatformImpl.dll` | x64, 15,668,224 bytes, version 2.9.0.0; `SKSEPlugin_Load_Impl` and IPC exports; imports libcef/libnode plus Windows system DLLs; game hooks/relocations reside here |
| `Data/SKSE/Plugins/MpClientPlugin.dll` | x64, 1,477,632 bytes, no PE FileVersion; source API version 2.0.0; exports CreateClient/DestroyClient/IsConnected/Send/SendRaw/Tick; imports Winsock/Kernel32/IPHLPAPI. Dynamically loaded by the platform; not itself an SKSE plugin-load entry point |
| `Data/SKSE/Plugins/versionlib-1-6-1170-0.bin` | 795,129 bytes, format 2, embedded runtime 1.6.1170.0; SHA256 `C4093C569A3C83B26587F4B9EA4C55DE9AE6E73B84A2AF9FB3FBD30E2FE0D452` |
| `Data/Platform/Plugins/skymp5-client.js` | Existing official bundled JS, 1,362,222 bytes; selected with the same native/server commit, not replaced by another release |

Full DLL/script SHA256 fingerprints and import inventories are in ignored `build/rp-audit/compatibility/selected-artifacts.json` and `decision.json`; dumpbin evidence is alongside them. Client runtime dependencies include bundled libnode/libcef, CEF resources/locales and `TESModPlatform.pex`; preserve the complete distribution tree. A successful PE/import inventory is not an in-game load test.

The platform entry's generated metadata declares AddressLibrary and a zero minimum SKSE version, which is not a compatibility guarantee for all future runtimes. [Hooks.cpp](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/skyrim-platform/src/platform_se/skyrim_platform/Hooks.cpp) references `skse64_1_6_1170.dll`. The [pinned CommonLib port](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/overlay_ports/commonlibsse-ng-flatrim/portfile.cmake) uses `b93280e832f263dbef44e44cbe2936622a02f91a` (2024). Its installed `REL/Module.h::load_version` treats minor 6 as AE, minor 4 as VR and defaults everything else, including minor 7, to SE. `REL/ID.h::load` selects AE `versionlib-*.bin`/format 2 versus SE `version-*.bin`/format 1. `game/Offsets.h` selects SE/AE relocation IDs and fixed variant offsets. Consequently adding/renaming a 1.7 database alone would not validate runtime classification, layouts or hook offsets. No bypass/experimental patch was attempted.

For Option B, the historical January 2024 three-depot manifests are identified in SETUP_WINDOWS. Current local Steam depotcache contains only 1.7.104 manifests. **Authenticated availability/access and actual 1.6.1170 executable/Data remain NOT VERIFIED**, because checking retrieval by downloading game files requires approval. SteamDB history is evidence of observed manifest IDs, not a Valve availability guarantee or an asset download source. If Steam refuses an old manifest, stop; do not substitute unofficial files or mix current Data with an old EXE.

Approval scope proposed: retrieve the three owned Steam depots into Steam's separate content cache; assemble a new `C:\SkyrimDev\SE-1.6.1170` outside Steam-managed folders, OneDrive and Git; obtain matching official SKSE; install the existing client into that isolated environment with separate saves/INI. Preserve the registered 1.7.104 game. After asset verification, back up runtime/world settings, repoint server and CMake to the isolated matching five-master Data/Misc archive, incrementally rebuild/retest, and rerun startup before client connection. No such changes have been made yet. About 89 GB free was observed on C:, but download plus assembled-copy space must be checked again.

Read-only research evidence: `build/rp-audit/compatibility/upstream.json`, `branch-comparisons.json`, `issue-searches.json`, `pr-1938.json`, pinned upstream source excerpts and SKSE source header. Phase 1 remains partially complete; Phase 1.5 research/plan is prepared and installation awaits user approval. All real-client smoke/multiplayer tests remain NOT TESTED.

## Installation integration and automated validation — current results

Skyrim was found through Steam app 489830 and Bethesda's registry entry at `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`. The executable reports **1.7.104.0**, Bethesda TESV: Skyrim, Steam build 24914197. Steam's manifest reports installed state 4, matching downloaded/staged totals and zero remaining staging size. No account identifiers are copied into this report. This is the Steam SE application with the updated runtime; the store name does not establish plugin compatibility. GOG and older SE/AE runtimes are distinct.

| Vanilla asset | Readable size (bytes) | Generated manifest CRC32 (signed) |
| --- | ---: | ---: |
| Skyrim.esm | 249752131 | -887922991 |
| Update.esm | 19121864 | 570937091 |
| Dawnguard.esm | 25884488 | 1827440538 |
| HearthFires.esm | 3979105 | 514574725 |
| Dragonborn.esm | 64664159 | -458950934 |

All five have TES4 headers and were parsed successfully by the native loader. All installed BSA files examined had readable headers/end bytes and BSA version 105. Vanilla animation/interface/mesh/shader/sound/texture/English-voice archives are present. `Skyrim - Misc.bsa` is 17,658,991 bytes with 14,031 entries and script names including Actor/ObjectReference PEX; it is configured through an absolute archive path. SHA256 fingerprints of the masters/Misc archive and the archive inventory are in ignored `build/rp-audit/completion/assets.json`. No obvious incomplete file was observed; full Steam integrity verification and exhaustive archive decompression were not performed. Optional Creation Club, Marketplace and ResourcePack files were observed but not added to the server's five-master order. No original game file was changed or downloaded by this task.

The existing `build` cache was reconfigured without `--fresh`, retaining VS 2022 Build Tools, `Visual Studio 17 2022`, x64, `-T v143`, pinned vcpkg and `NO_CLEAN_AFTER_BUILD=ON`. Added `-DSKYRIM_DIR:PATH=<verified game folder>`; `DOWNLOAD_SKYRIM_DATA=OFF` and `INSTALL_CLIENT_DIST=OFF`. All dependencies were already installed. Configure exit **0**, incremental official default Release build exit **0**. Server, unit and client outputs remain at the verified paths in the recovery artifact list below. Optional Creation Kit/Papyrus compilation is skipped by upstream detection; prebuilt scripts remain available. No MSVC/compiler-linker warning diagnostics were matched in this incremental build log; the configure-time utf8proc deprecation remains.

The development runtime was backed up before configuration. Before CTest it was moved into a verified path under ignored `build/rp-audit/completion` and copied back as a disposable test runtime. The test base used the required `databaseName=world`, five players, both loopback binds, absolute masters and Misc archive. The upstream runner's settings/gamemode/world cleanup therefore affected the test copy. After the suite, the test copy was retained as `integration-runtime-after-tests`, and the development runtime, empty official gamemode, private metrics credentials and development base were restored. No integration test operated on development `rp-world` data.

| Validation run | Actual result |
| --- | --- |
| Historical no-game baseline | 171 native cases: 138 passed / 33 failed; 11 integrations NOT RUN |
| First asset-enabled full CTest | Exit 8; 255 cases: **254 passed / 1 failed**; 476,284 assertions: 476,283 passed / 1 failed; 11 integrations NOT RUN |
| Focused diagnosis, unchanged `Activate torch` | Exit 0; 1 case / 18 assertions passed; diagnostic only, not full-suite evidence |
| Second complete unfiltered CTest | **Exit 0; all 12 CTest targets passed** in 56.27 seconds: 255 native cases / 476,305 assertions passed and all 11 integrations executed/passed |
| Upstream local guards | CI-only ESPM hash check and DistContents check bodies **SKIPPED** because CI is not true; included in Catch2's case count |
| Optional coverage target | **NOT BUILT / NOT TESTED**, no OpenCppCoverage configured |

The first failure was `Activate torch`, `unit/PartOne_ActivateTest.cpp:587`, checking `ref.IsHarvested()` after a tick. That test sets a 25 ms reloot timer; `WorldState::RequestReloot` schedules `DoReloot`, which clears harvested state. The same unmodified test passed independently and in the full rerun. Classification: **test-environment/timing flake suspected**, not proven fixed or proven an upstream regression. No filtering, changed assertions, added skip tags or fixture bypass was used for the successful full run. All previous missing-record failures disappeared when game assets were supplied; 84 previously excluded cases became available. No unsupported-data assertion failure persisted in the successful rerun, which does not prove in-game executable compatibility.

Unit logs still contain exercised error-path/unsupported Papyrus-native diagnostics; integration/server logs include Node's punycode deprecation, default stamina settings and fallback damage-formula warnings. These were not suppressed. Integration `test_partial_location_save` verified an actual file-backed fixture save, but it does not establish real-player reconnect or persistence across the development server's restart.

Evidence: ignored `build/rp-audit/completion/configure.log`, `build.log`, `ctest.log` (first failure), `torch-repro.log`, `ctest-retry.log`, matching exit files, `LastTest.log`, `assets.json`, `client-artifacts.json` and generated `manifest.json`. Do not upload game assets, backup runtime settings or credentials.

Client status: **NOT INSTALLED / NOT LAUNCHED / gameplay NOT TESTED**. The checkout lists 1.6.1170/1.6.640; the generated address libraries include 1.6.1170 and no 1.7.104 database, and hook code references SKSE's 1.6.1170 DLL. Generated Skyrim Platform metadata reports 2.9.0 with AddressLibrary support; that does not validate the new runtime. SKSE loader is absent from the game directory. The [official SKSE page](https://skse.silverlock.org/) now lists 2.3.1 for Steam 1.7.104, which alone cannot make this platform/client compatible. A supported isolated Steam runtime and matching SKSE are required before approving installation. See [SETUP_WINDOWS](SETUP_WINDOWS.md) for the reversible installation/launch plan and prepared profile 1/2 settings.

## Real dedicated-server smoke test — current results

The actual command was `node dist_back/skymp5-server.js`, from `build/dist/server`, with foreground output captured by PowerShell `Tee-Object`. Both runs used the upstream empty baseline `gamemode.js`, maxPlayers 5, UDP/HTTP loopback, port 7777, debug logging, offline mode, file driver `rp-world`, the verified absolute vanilla load order and `Skyrim - Misc.bsa`. Existing private metrics credentials were retained, not regenerated or printed. No custom gamemode, player bot or fake executable was used.

| Check | Evidence / outcome |
| --- | --- |
| First real startup | **PASSED**, Node PID 16420; native construction, five-master manifest, systems, gamemode and `AttachSaveStorage` initialized |
| Socket isolation | **PASSED**, owning PID's UDP `127.0.0.1:7777` and HTTP listener `127.0.0.1:3000`; no wildcard or additional TCP listener observed |
| Metrics protection | **PASSED**, unauthenticated request 401; existing credential request 200 |
| First idle liveness | **PASSED**, sampled at 85.30 seconds, 6,534 tick samples; 0 error/critical/unhandled-exception log lines; working set about 631 MB, cumulative CPU 4.25 seconds |
| First shutdown | Ctrl+C delivered to foreground PTY; **process and socket cleanup PASSED**, no force-kill; shell reports exit 1 from interruption |
| Restart | **PASSED**, PID 6588, same config and manifest; persistence reattached; sampled at 64.99 seconds with 4,275 tick samples, metrics 200, 0 error lines and expected loopback sockets |
| Second shutdown | Ctrl+C again; process exited and UDP/TCP listeners absent; shell interruption exit 1; server **left stopped** |
| Graceful pending-save flush | **NOT VERIFIED**: no explicit SIGINT/SIGTERM flush handler found; controlled Ctrl+C termination is not evidence that queued saves were flushed |
| Real-player world persistence | **NOT TESTED**, both runs loaded 0 ChangeForms / 0 player characters; no clients connected. Empty-world restart does not prove actor durability |
| Automated file persistence | **PASSED** in the upstream integration fixture `test_partial_location_save`; distinct from real-player reconnect/restart validation |

Warnings: default stamina values, fallback damage-multiplier formula config, and Node punycode deprecation. No repeated tick/gamemode/save/network errors were logged in the idle smoke runs. Settings merging leaves the wrapper's default master URL visible in logs despite `master=""`; offline guards are present and no established remote TCP connection was observed in socket samples. No packet capture was performed, so complete absence of external traffic is not asserted. Both listener binds and the selected settings were checked against generated merged configuration without printing credentials.

Smoke evidence under ignored `build/rp-audit/completion`: `startup.log`, `restart.log`, `smoke-first.json`, `smoke-last.json`, `smoke-restart.json`, `shutdown-first.json`, `shutdown-restart.json`, three metrics snapshots and `manifest.json`. Runtime copies remain under `build/dist/server/logs`. Masters/Misc SHA256 values were unchanged after testing. The development settings still use `rp-world`; the prepared integration base uses `world` and must be rechecked after any server post-build settings generation.

Remaining blockers: a client runtime supported by these binaries, matching SKSE installation and user approval before game-directory changes, two real clients, gameplay/cell/reconnect evidence, and real actor persistence/flush results. Full Steam integrity verification is available if corruption is suspected; no evidence required repair in this run. No 50–100-player performance or Phase 2 claim is made. Only BUILD_REPORT, SETUP_WINDOWS, PHASE1_PLAN and MULTIPLAYER_TEST_CHECKLIST were changed in this continuation, plus ignored configuration/build/test evidence. Branch `develop`, upstream source, HEAD, dependency pins and lockfiles remain unchanged; no commit was made.

## Historical recovery recheck (before game installation)

The initial audit below is historical. A subsequent recovery inspection found installed VS 2022 Build Tools 17.14.37710.0 at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`, MSVC tools 14.44.35207 / compiler 19.44.35229, Windows SDK 10.0.26100.0 headers and x64 libraries, .NET Framework 4.8 SDK headers and targeting assemblies, and Yarn 1.22.22. `vswhere` now detects the VS 2022 C++ component. VS 2026 remains installed. No system components were installed by this recovery run; they were already present when rechecked.

Git remains on `develop` at the same HEAD, with the same pinned vcpkg. Git 2.54.0, Python 3.14.3 and Node 24.11.1 remain available. Bundled CMake 4.2.3-msvc3 is usable by full path but not on the shell's default PATH. No engine, dependency pin or lockfile changes were made to recover the toolchain.

Recovery configuration selects `Visual Studio 17 2022`, x64, `-T v143`, an explicit `CMAKE_GENERATOR_INSTANCE`, and process-local `VCPKG_VISUAL_STUDIO_PATH` pointing at VS 2022. `cmake --fresh` regenerates only the incompatible CMake cache/files; initial failure logs and documentation are preserved. `SKYRIM_DIR` is omitted and `DOWNLOAD_SKYRIM_DATA=OFF`. vcpkg now detects the VS 2022 compiler for both host and target triplets. Complete configuration/build/test results will be recorded below after the commands finish.

Recovery logs are under `build/rp-audit/recovery-configure.log`; final command status is written to `recovery-configure-exit.txt`. The initial report's missing-tool findings and zero-test result do not describe a completed recovery build.

Recovery attempt 1 resolved the original VS/CMake generator failures and built dependencies through the Mongo C++ driver's Debug/Release compilation. Its post-build helper download stalled: a 102,496-byte MSYS2 pkgconf archive remained at zero bytes for several minutes, while curl reached the official redirect and downloaded it in about one second. The verified vcpkg download worker was stopped; configure returned 1 with a helper-download failure, not a compiler error. Both helper archives were cached from the original `mirror.msys2.org` URLs using curl. A retry uses the existing `NO_CLEAN_AFTER_BUILD=ON` option to retain downloads/build diagnostics and avoid repeatedly fetching the same helpers. vcpkg's expected SHA512 checks remain enabled; no package version or checksum was altered. Retry log: `build/rp-audit/recovery-configure-retry.log` and `recovery-configure-retry-exit.txt`.

Dependency warnings observed so far: Frida's Debug library uses static Release CRT instead of static Debug CRT; zf-log has a post-build packaging warning; liblzma passes an unused `XZ_SANDBOX` option. These were recorded without suppressing checks or changing ports. Complete warning details remain in the recovery logs.

## Historical verified recovery results (no game data)

| Check | Result |
| --- | --- |
| Final configure | **PASSED**, exit 0; VS 2022 generator, x64, v143, MSVC 19.44.35229, SDK 10.0.26100.0 |
| Pinned vcpkg installation | **PASSED**, all requested dependencies installed; no version/hash changes |
| Dedicated server Release target | **PASSED**, exit 0 |
| Unit executable Release target | **PASSED**, exit 0 |
| Official baseline gamemode and client TS targets | **PASSED**, exit 0; default empty upstream gamemode, no custom RP code |
| Default full Release build | **PASSED**, exit 0; native platform/client components and distribution produced |
| Node addon load | **PASSED**, exit 0 under Node 24.11.1 x64; `ScampServer` export verified without constructing a world/server |
| Full CTest invocation | **FAILED**, exit 8; 12 registered tests found, unlike the initial zero-test attempt |
| Native unit cases | 171 cases reported: **138 passed, 33 failed**; 731 assertions: 698 passed, 33 failed; unit process exit 42 |
| Upstream exclusions | `[espm]` tests excluded by the existing runner; DistContents check skips its body outside CI. The reported 138 includes that guarded case; it is not packaging verification |
| Integration tests | **NOT TESTED / NOT RUN**: all 11 blocked by failed `unit_passed` fixture. Fixture was not bypassed |
| Runtime settings | Five-player, loopback, offline file-persistence configuration prepared and JSON validated; runtime behavior **NOT TESTED** |
| Actual server/world/network startup | **NOT TESTED**, required masters absent; addon loading does not constitute startup |
| Two real clients and persistence after restart | **NOT TESTED** |
| Optional front/full external gamemode/coverage | **NOT BUILT / NOT TESTED**, upstream default options remain OFF; no tests disabled to change the result |

The no-game build support is verified, but the advertised partial test skipping does not yield a green suite at this checkout. Untagged tests also depend on game data. Observed failures include missing NPC/player record `0x7`, missing world forms (`0x54b15`, `0x39fe4`, `0x8a986`, `0x3a1e1`), invalid file indexes 0/4, and an empty Solstheim neighbor lookup. Source examples are `unit/ActivateParentTest.cpp`, `MovementValidationTest.cpp`, `TemplateScriptTest.cpp` and `LoadCellsTest.cpp`; these lack `[espm]` tags despite requiring master records. No tests/tags/assertions were changed or removed. A full pass cannot be claimed until legally owned data is supplied and the entire suite is rerun. CTest lists the 11 fixture-blocked integrations among unsuccessful tests; they did not execute their assertions and must not be counted as 11 independent regression failures.

Actual commands after successful configuration, from repository root (CMake/CTest full path or process-local PATH as in SETUP_WINDOWS):

```powershell
cmake --build build --config Release --target skymp5-server --parallel 2
cmake --build build --config Release --target unit --parallel 2
ctest --test-dir build -C Release --verbose --no-tests=error
cmake --build build --config Release --target skymp5-functions-lib skymp5-client --parallel 2
cmake --build build --config Release --parallel 2
```

Verified artifacts under `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp`:

- `build/dist/server/scam_native.node` (5,569,536 bytes), `dist_back/skymp5-server.js` (3,155,763 bytes), source map, generated `launch_server.bat`, settings and upstream `gamemode.js`. The server runs through the installed Node executable, not a new dedicated-server EXE.
- `build/unit/Release/unit.exe` (5,656,064 bytes).
- `build/dist/client/Data/Platform/Plugins/skymp5-client.js` (1,362,222 bytes) and generated client settings.
- `build/dist/client/Data/SKSE/Plugins/SkyrimPlatform.dll` (149,504 bytes) and `MpClientPlugin.dll` (1,477,632 bytes).
- `build/dist/client/Data/Platform/Distribution/RuntimeDependencies/SkyrimPlatformImpl.dll` (15,668,224 bytes), bundled CEF/Node runtime files. Distribution existence is verified; in-game loading is not.

Final `server-settings.json` uses port 7777, `maxPlayers=5`, UDP/HTTP loopback binds, offline mode, debug logging, the official empty gamemode, file driver `rp-world`, disabled global console commands and locally generated Basic-auth metrics credentials. Credentials remain in ignored build configuration and were not printed. Test base keeps its original world/fixture conventions, with five players and loopback binds. Configured `data/Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm` are all **MISSING**. No masters were invented or downloaded. No dedicated-server startup command was run; the Node addon probe did not instantiate `ScampServer`.

Logs under `build/rp-audit`: `recovery-server-build.log`, `recovery-unit-build.log`, `recovery-packaging-build.log`, `recovery-full-build.log`, `recovery-addon-load.log`, `recovery-ctest.log`, `recovery-readiness.log`; command exit statuses have matching `*-exit.txt` files where applicable. Full CTest detail also remains in `build/Testing/Temporary/LastTest.log`. Server/unit/full build logs contained no MSVC `warning C...`/linker warning diagnostics. The full client build prints the SDK's informational `DIRECTINPUT_VERSION` default message. Configure additionally reports the dependency's deprecated `unofficial-utf8proc` package alias. Existing compiler/test policies were preserved.

Remaining actions: supply legally owned matching Skyrim Data (masters and the script archives used by world/Papyrus tests), configure `SKYRIM_DIR` or `UNIT_DATA_DIR`, rebuild affected targets and rerun the unfiltered suite. Preserve the development config/world before tests: integration scripts replace gamemode/settings and clear their fixture world. Only after validation should the real world startup and two-client checklist be executed. No Phase 2 work started.

## Repository baseline and changes

- Checkout: `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp`.
- Original branch `main`, clean working tree, HEAD `2849e676fe008925384b26f34476e382a30bd877`.
- Created and selected `develop` at the same HEAD. No commits, pushes, history rewrites or remote changes.
- `origin`: `https://github.com/skyrim-multiplayer/skymp` (fetch/push).
- vcpkg initially uninitialized; `git submodule update --init --recursive` exited 0 and checked out `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`. Recursive status has no missing/mismatched marker.
- `core.autocrlf=true` from system Git config. `core.longpaths` and `submodule.recurse` were unset. Existing main tracks origin. No identity/credential values were printed or changed.
- Changes are documentation only, plus ignored build/dependency outputs and local Git branch/submodule registration. No second repository was initialized.

## Initial audit environment (before recovery)

| Requirement | Observed result |
| --- | --- |
| Git | 2.54.0.windows.1, usable |
| VS 2022 / MSVC v143 | Missing. `vswhere -version '[17.0,18.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` returns `[]` |
| Other Visual Studio | Community 2026 Insiders 18.6.11716.218 at `C:\Program Files\Microsoft Visual Studio\18\Insiders`; discovered with `-prerelease` |
| Other compiler | `VC\Tools\MSVC\14.51.36231\bin\Hostx64\x64\cl.exe`, compiler 19.51.36237; v145, not required v143 |
| Windows SDK | Standard Windows Kits 10 folder contains UnionMetadata only; no Include headers were found. A usable SDK was not demonstrated |
| CMake/CTest | Bundled CMake 4.2.3-msvc3; not on normal PATH, usable by full path |
| vcpkg helper CMake | Standard bootstrap downloaded local CMake 3.31.10 and 7-Zip 26 helpers |
| Python | `python --version` succeeds with 3.14.3; upstream CONTRIBUTING asks for 3.9.x. Build-script compatibility with 3.14 unverified |
| Node/npm | Node 24.11.1, npm 11.6.2; upstream prose asks for Node 17.x, while TS build targets node16/ES2022 and types are Node 22. No exact current runtime pin verified |
| Yarn | Missing on PATH and in normal npm shim location; classic Yarn lockfiles present |
| .NET | dotnet host exists, `dotnet --version` reports no SDK. Upstream .NET Framework SDK >=4.6 requirement is separate; reference assembly folder absent |
| Disk | Approximately 138 GB free on C: during audit; upstream estimates ~22 GB for build |
| Skyrim | Steam registry and its libraryfolders.vdf inspected; no SE manifest/executable. User explicitly confirmed the game has not been downloaded |

## Original configuration attempt

From the repository root in PowerShell:

```powershell
$cmake = 'C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
& $cmake -S . -B build -G 'Visual Studio 17 2022' -A x64 -DDOWNLOAD_SKYRIM_DATA=OFF
```

Exit **1**. Output captured in `build/rp-audit/configure.log`; exit recorded in `build/rp-audit/configure-exit.txt`.

vcpkg bootstrap succeeded and dependency installation started. Only `vcpkg-cmake-config` and `vcpkg-cmake` were installed before `antigo` failed. This is not a completed dependency installation or SkyMP compilation.

Two distinct errors were traced:

1. `vcpkg/buildtrees/antigo/config-x64-windows-sp-out.log`: vcpkg selects `Visual Studio 18 2026` / v145 from the only installed toolchain, but its local CMake 3.31.10 cannot create that generator. Both Release and Debug dependency configuration fail.
2. Top-level MSBuild reports **MSB8020**: required `Platform Toolset = 'v143'` cannot be found. The incomplete CMake cache selected the Insiders installation under the requested VS 2022 generator.

The correction requires the supported VS 2022 C++ toolchain/SDK. No dependency or source patch solves an absent compiler/SDK. Do not follow generic vcpkg advice to update the pinned checkout, or retarget the project to VS 2026, for this phase. After installation, explicitly select VS 2022 for both CMake and vcpkg and reset the incomplete cache; see [SETUP_WINDOWS](SETUP_WINDOWS.md).

Additional logs: `build/vcpkg-manifest-install.log`, `build/vcpkg-bootstrap.log`, `vcpkg/buildtrees/antigo/config-x64-windows-sp-out.log`, `build/CMakeFiles/4.2.3-msvc3/VCTargetsPath.vcxproj`. Paths are relative to the checkout above. Raw logs stay ignored. Standard helper downloads, vcpkg bootstrap/install files and two host helper cache entries were created; no major system installation or global upgrade was performed.

## Initial build, tests and startup status

| Check | Status / evidence |
| --- | --- |
| Configure | FAILED, exit 1 |
| Release dedicated server compilation | BLOCKED, no generated solution and no completed configure; build invocation not run |
| Required client components | BLOCKED by the same configuration; not compiled |
| CTest invocation | `ctest --test-dir build -C Release --output-on-failure --no-tests=error`, exit **8**, `No tests were found!!!` |
| Compiled unit/integration test cases | **0 executed**; this is not a passing test suite |
| Compiler warnings | SkyMP compilation never began; warning inventory unavailable. MSBuild probe reported 0 warnings / 1 error, which does not describe the engine |
| Server startup/config/world/network loading | NOT TESTED: no native addon/JS server artifacts and no game assets |
| Liveness, shutdown, persistence and metrics | NOT TESTED |
| Two real clients / gameplay synchronization | NOT TESTED |

CTest logs: `build/rp-audit/ctest.log`, `ctest-exit.txt`. Expected outputs from source are `build/dist/server/scam_native.node`, `dist_back/skymp5-server.js`, `launch_server.bat`, and client assets under `build/dist/client`. **These outputs have not been produced or verified.** A custom launcher/config was not installed because task 5 explicitly depends on a successful server build; the supported generated launcher and future configuration recipe are documented instead.

## Historical initial acceptance and blockers

Repository/environment audit, pinned submodule initialization, development branch, architecture documentation and manual instructions are complete. A successful server compile, relevant compiled tests, actual startup smoke test, and two-client gameplay evidence remain outstanding. Therefore Phase 1 must not be called complete.

The initial toolchain blockers listed above were resolved by components found during recovery; see the current results at the top of this report. The remaining blockers are game data, a green full test run, and real startup/client evidence. No game assets were downloaded or RP systems implemented. Do not start Phase 2 gameplay development until the baseline runs and survives reconnect/restart tests.
