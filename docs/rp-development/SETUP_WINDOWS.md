# Windows setup and recovery

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


## Phase 1.6 — current manual deployment and launch

**Use the existing Steam game folder**, now verified as runtime 1.6.1170.0 with SKSE 2.2.6 installed by the user. The previous Phase 1.5 isolated-folder proposal below is historical and is superseded by this request; do not create a second game copy or downgrade again. Current destination: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`.

### Completed approved installation and backup

Source: `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\dist\client`. All 107 files were inventoried and compared. The approved installation added **99 files (~369 MiB)**, retains **8 byte-identical Address Library files**, and replaces **0 existing files**. Native DLLs, generated JS/settings, complete CEF/Node distribution/resources, fonts/modules/example resources, one overlay SWF and seven PEX/five PSC scripts are included. Added loose Papyrus scripts can shadow vanilla BSA scripts; this is reversible by removing those exact loose files. No original masters/BSA/EXE/SKSE/Creation Club/save/INI is a deployment destination.

Review the exact list and hashes in ignored `build/rp-audit/installation/deployment-manifest.csv` or `.json`. Existing overlap backups: `build/rp-audit/installation/game-backup`; personal INI snapshot: `personal-ini-backup`. Saves remain untouched. The eight existing databases were copied to backup and hash-checked. **The user approved installation and all 99 additions are now deployed; all 107 destination hashes were verified.** See deployment-results.json and deployment-summary.json for the recorded result. No automatic CMake client install is enabled.

Deployment rechecked game/source fingerprints and every destination before writing, with no new conflicts. For any future redeployment, halt if new conflicts appear. Copy each approved ADD file to its exact relative destination, create needed directories, and verify the resulting SHA256. Keep identical files untouched. Do not use a mirror/delete operation or bulk overwrite unrelated files. Copy the entire approved distribution, including CEF locales/resources and bundled libnode/libcef, not only the three native DLLs. Existing generated settings already parse correctly as localhost UDP 7777, offline profile ID 1; preserve their supported JSON fields.

Rollback after closing Skyrim: use this manifest to remove only ADD files whose current SHA256 still equals their deployed source hash. Preserve and report files modified since deployment; do not recursively delete Data/Platform, Data/Scripts or Data/SKSE. KEEP_IDENTICAL files are retained. There are no REPLACE entries in this plan; if the reviewed plan later changes, restore each affected original from its hash-verified backup. The game masters, SKSE files, personal saves and INI snapshots are not rollback deletion targets. Generated client logs/config caches are outside the manifest and must not be indiscriminately deleted.

### User's first in-game test — installation ready

The user will handle all graphical game testing. With the verified server running, open the actual game folder and launch **`skse64_loader.exe`**, not Steam Play or SkyrimSELauncher.exe. Steam should already be running under the owning account. The Steam appmanifest still identifies the newer managed build despite the manual downgrade; do not use Steam Verify Integrity or launch/update through Steam during this test. Check the EXE version before each launch. No appmanifest, registry, update/Cloud setting or permissions were changed by this task.

Wait for SkyMP initialization and offline authentication. Source emits `Hello Multiplayer!` to the game console and requests authentication on the next tick; an integer `gameData.profileId=1` selects offline authentication automatically. Do not load a personal vanilla save or enter Discord credentials for this local test. If the race menu appears, finish character selection and verify a controllable spawn. If the game stays at the vanilla menu, starts a vanilla intro, crashes or reports a mismatch, capture that exact screen/log state instead of applying a random patch.

Walk briefly, exit the game, then relaunch through the same SKSE loader with profile ID 1 to test reconnect. Report whether the same server actor/location returns. This is a requested test, not a verified outcome. Keep the server running between these launches; do not launch a second server on occupied port 7777. If the current server has stopped, start it in a PowerShell window:

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\dist\server'
node dist_back/skymp5-server.js 2>&1 | Tee-Object -FilePath logs/manual-client-test.log
```

Keep that window open; Ctrl+C stops a foreground server after testing. The agent's current foreground tool session can also be stopped on request. Existing upstream shutdown behavior does not prove queued-save flushing. Do not force-stop while testing persistence and call it a graceful save pass.

Collect fresh SKSE/platform logs from the actual Documents path (may be redirected), server stdout and console screenshots. `skyrim-platform.log` and newly generated `skse*.log` are under `My Games\Skyrim Special Edition\SKSE`. Client trace functions use the in-game console; a standalone client log is not guaranteed. Collect `Data/Platform/Logs` files only if actually generated. Full evidence checklist is in MULTIPLAYER_TEST_CHECKLIST. Do not send game masters, passwords/tokens or personal saves.

## Historical Phase 1.5 isolated-install proposal — superseded by Phase 1.6

Recommended target: **Steam Skyrim 1.6.1170.0 + Steam SKSE 2.2.6 + this checkout's complete built client distribution**. No verified 1.7.104 SkyMP port was found in the dated upstream audit; see the compatibility matrix and source evidence in [BUILD_REPORT](BUILD_REPORT.md). No installation or download in this section has been executed.

Keep `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition` at its present 1.7.104 state. Proposed development folder: **`C:\SkyrimDev\SE-1.6.1170`**, outside Steam's managed library, Git and OneDrive. Do not replace the registered install, edit its appmanifest/registry, use a partial EXE-only downgrade, or copy newer Data over older depot files.

### Owned Steam depots — historical IDs, live access pending

The installed appmanifest/depotcache confirm app 489830 and depot IDs 489831/489832/489833. Their currently cached manifests are for 1.7.104. SteamDB's directly recorded January 17, 2024 manifest history identifies this older coherent build:

| App / depot | Historical manifest | Contents / observation source |
| --- | --- | --- |
| 489830 / 489831 | **8442952117333549665** | disk/content depot; [manifest history](https://steamdb.info/depot/489831/manifests/) |
| 489830 / 489832 | **8042843504692938467** | core/content depot; [manifest history](https://steamdb.info/depot/489832/manifests/) |
| 489830 / 489833 | **1914580699073641964** | SkyrimSE.exe depot; [manifest history](https://steamdb.info/depot/489833/manifests/) |

These are observed historical IDs, not confirmation that Valve currently grants this account access to every old manifest. **No authenticated old-manifest retrieval has been attempted.** Steam must accept the exact IDs and report completed downloads before availability can be marked verified. If unavailable, stop and use a legally owned coherent backup or reassess upstream support; no unofficial game mirror is acceptable.

After explicit approval, the user can open the installed Steam console via `steam://nav/console` while signed in to the account that owns Skyrim. Run each command separately and wait for its completed-download message (these are Steam console commands, not PowerShell):

```text
download_depot 489830 489831 8442952117333549665
download_depot 489830 489832 8042843504692938467
download_depot 489830 489833 1914580699073641964
```

Record the output's exact manifest ID and destination. Expected cache location is Steam's `steamapps/content/app_489830/depot_<id>`; use the actual reported location rather than assuming a successful download. Keep credentials/Steam Guard interaction in Steam, never paste passwords into scripts/chat. Check space again: approximately 89 GB free was observed, and both depot cache and assembled game copy need room (plan roughly 35–40 GB headroom, then measure actual totals).

Assemble only those complete depot contents into the new empty development folder, merging their root-relative file trees. Do not merge them into the original game or include current 1.7 files. Record conflicts before resolving any overlapping files. The resulting executable must report **1.6.1170.0**. Verify all five masters and required BSAs, parse them with the existing server/unit loader, and record SHA256/CRC32/size. An observed historical manifest is not executable verification; do not proceed if the version/content is wrong or any depot is incomplete.

### SKSE and isolated client configuration

Obtain **Steam `skse64_2_02_06.7z` (SKSE 2.2.6)** through the [official archive index](https://skse.silverlock.org/download/archive/). The [official v2.2.6 source header](https://github.com/ianpatt/skse64/blob/v2.2.6/skse64_common/skse_version.h) explicitly targets 1.6.1170. Do not choose the similarly named GOG archive or current SKSE 2.3.1 for 1.7.104. Inspect the archive/readme and fingerprint it before installation. Put its loader and runtime DLL (`skse64_1_6_1170.dll`) into the isolated game root, and its required Data scripts into the isolated profile, following that archive's instructions. Other root files, if required by the readme, must come from the same archive. Binary verification/installation are pending approval.

Use a separate mod-manager instance/profile directed explicitly at the isolated game, with **profile-specific INI files and saves**. Separate game folders alone can still share Documents/My Games settings and saves. [Mod Organizer 2](https://www.modorganizer.org/) supports portable installations; it is an optional tooling choice, not an installed/verified dependency here. Before using it, verify its game path and enable the profile's INI/save isolation; back up existing personal INI/saves first. Do not add unrelated mods. Configure its executable to the isolated `skse64_loader.exe` and working directory to `C:\SkyrimDev\SE-1.6.1170`; launch through the manager so its virtual mods are visible, as described in the [official executable-window documentation](https://github.com/ModOrganizer2/modorganizer/wiki/Executables-window).

Install the existing `build/dist/client/Data` tree as one local mod in that profile, keeping the complete `Data/SKSE/Plugins`, `Data/Platform/Distribution/RuntimeDependencies`, CEF resources/locales, `Data/Platform/Plugins` and scripts. Retain bundled address library files; the selected unsuffixed `versionlib-1-6-1170-0.bin` has an embedded 1.6.1170.0 header. Do not rename a database to spoof 1.7.104 support. Use the paired rebuilt SkyrimPlatform.dll/SkyrimPlatformImpl.dll/MpClientPlugin.dll and generated JS, not a mix of Nexus/old release binaries.

Set the profile's virtual `Data/Platform/Plugins/skymp5-client-settings.txt` to strict JSON containing:

```json
{
  "server-ip": "127.0.0.1",
  "server-port": 7777,
  "gameData": { "profileId": 1 }
}
```

Preserve the distribution's other supported fields where appropriate. Profile B uses ID **2**. The current generated settings and existing ignored templates already contain these supported values; no game-side settings have been installed. Both clients must use identical runtime, SKSE, client artifacts and five-master CRCs/load order.

Keep development updates isolated: do not register this directory as Steam's managed Skyrim install, run Steam Play/Verify against it, or let a deployment tool mirror newer registered-install files into it. Start Steam normally for ownership before launching the isolated SKSE executable. Verify the running EXE path/version and saved SHA256 before each test; Steam launch/update preferences alone are not a version lock. Preserve a local fingerprinted depot snapshot for recovery. Do not modify original appmanifest permissions, disable DRM or globally change Steam Cloud/update settings as part of this plan. Ensure test saves stay in the isolated profile.

### Align server assets, then test

The current server points at **1.7.104 Data**. Its prior passing tests are not validation of a future 1.6.1170 asset set. After approval and successful depot verification, stop the server and back up its runtime/config/world; update CMake `SKYRIM_DIR` to the isolated folder using the same VS 2022/x64/v143 arguments, keeping downloads and client auto-install OFF. No cache reset or dependency update is needed. Incrementally rebuild only affected targets (unit/server plus any affected script/distribution targets).

Explicitly update the runtime and disposable-test-base load order to the five **absolute isolated Data paths**, in Skyrim/Update/Dawnguard/HearthFires/Dragonborn order, and point `archives` to that installation's `Skyrim - Misc.bsa`. Existing settings are preserved by the generator, so reconfigure alone does not change their old paths. Keep development `rp-world` separate from test `world`, retain credentials, and rerun the unfiltered CTest suite with the backed-up/restorable runtime. Rerun the real baseline server smoke test and regenerate the five-master manifest; verify each client file's CRC32/size matches it. Exclude optional Creation Club content from the first test.

Then follow the one-client smoke test and two-client procedure in [MULTIPLAYER_TEST_CHECKLIST](MULTIPLAYER_TEST_CHECKLIST.md). Installation approval does not constitute a client/multiplayer pass. Stop on version mismatch, native-load failure, wrong process path or master CRC disagreement.

## Installed game and client checkpoint — 2026-10-13

Steam/registry detection now finds `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition`. `SkyrimSE.exe` reports **1.7.104.0**. All five vanilla masters are readable; `Skyrim - Misc.bsa` has BSA version 105, 14,031 entries, and script names including `actor.pex` and `objectreference.pex`. Header/readability checks and SHA256 fingerprints are recorded in ignored `build/rp-audit/completion/assets.json`; these are not a Steam integrity verification. Optional Creation Club and ResourcePack content is not added to the server load order.

**Client installation is blocked by a runtime mismatch.** This checkout's Skyrim Platform README lists 1.6.1170/1.6.640, and the generated distribution has 1.6.1170 address-library databases but no database for 1.7.104. Its hook code explicitly references `skse64_1_6_1170.dll`. Skyrim Platform 2.9.0 metadata declares AddressLibrary support; that is not proof of compatibility with a runtime for which its database/hooks are unavailable. `skse64_loader.exe` is absent. The [official SKSE page](https://skse.silverlock.org/) currently lists SKSE 2.3.1 for Steam 1.7.104; installing it alone does not validate these SkyMP binaries. GOG 1.6.1179 uses a separate build and is not interchangeable.

Keep the original game untouched. Before approving installation, supply a legally owned, isolated **Steam 1.6.1170** installation (including matching Data), or separately resolve upstream 1.7.104 compatibility outside this task. A mod-manager profile isolates mods/saves, not the executable version. No automatic downgrade, dependency update or engine port is performed here.

Once that compatibility checkpoint is resolved:

1. Verify the isolated executable version and five master fingerprints against the server manifest. Reconfigure/retest the server with that Data if it differs from today's 1.7.104 files.
2. Obtain the matching Steam SKSE from the [official archived builds](https://skse.silverlock.org/download/archive/) and verify its runtime DLL/readme identifies 1.6.1170 (the 2.2.6 Steam archive). Follow its included installation instructions in the isolated game only. Do not choose the GOG archive or current 1.7.104 build for 1.6.1170.
3. After user approval, install the already-built `build/dist/client` contents into an isolated mod-manager profile, preserving the `Data` structure and the DLLs under `Data/Platform/Distribution/RuntimeDependencies`. Keep `INSTALL_CLIENT_DIST=OFF`; no automatic copying to the original installation is required. SKSE's loader/runtime DLLs require its separate root-directory installation.
4. Use strict JSON settings at `Data/Platform/Plugins/skymp5-client-settings.txt`. Prepared templates are `build/rp-audit/completion/client-1-settings.json` and `client-2-settings.json`; they use localhost:7777 and distinct offline profile IDs 1/2. Use new test saves, the same five masters in order, and no unrelated mods.
5. Run the server from `build/dist/server` using `node dist_back/skymp5-server.js`. Launch each compatible game via `skse64_loader.exe` in its isolated profile. Inspect SKSE/platform/client logs and complete [MULTIPLAYER_TEST_CHECKLIST](MULTIPLAYER_TEST_CHECKLIST.md). No in-game launch has been verified.

Two clients on different PCs cannot reach a localhost-bound server. After the local smoke test, use the private-LAN procedure in the checklist and explicitly change both server bind addresses and both client addresses. A second profile on one PC is not evidence of two working concurrent game instances.

Reconfigure the existing build without `--fresh` or cleaning dependencies:

```powershell
$gameDir = 'C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition'
cmake -S . -B build -G 'Visual Studio 17 2022' -A x64 -T v143 "-DCMAKE_GENERATOR_INSTANCE=$vs2022" "-DSKYRIM_DIR:PATH=$gameDir" -DDOWNLOAD_SKYRIM_DATA=OFF -DINSTALL_CLIENT_DIST=OFF
cmake --build build --config Release --parallel 2
```

Use the verified CMake PATH/VS selection below first. Back up the whole server runtime and test base before reconfigure/build/testing. Generated settings preserve an existing load order, so explicitly resolve the five absolute master paths and Misc archive; merely setting `SKYRIM_DIR` does not fix old relative runtime settings. The test base must use `databaseName=world` because upstream fixtures target `world/changeForms`; the development runtime uses `rp-world`. Never run integrations against the development runtime without backup/restoration. See the current completion results in BUILD_REPORT; older no-game sections below retain the historical recovery procedure.

Checked 2026-10-13 against commit `2849e676fe008925384b26f34476e382a30bd877`. Current results are in [BUILD_REPORT](BUILD_REPORT.md); the commands below are **future recovery instructions**, unless explicitly described there as executed. Base instructions: [CONTRIBUTING](../../CONTRIBUTING.md), root CMake and checked-in Windows CI.

Historical recovery result: VS 2022 Build Tools 17.14, MSVC v143 (tools 14.44.35207), Windows SDK 10.0.26100.0, .NET Framework 4.8 SDK/targeting files, and Yarn 1.22.22 are verified. They were discovered, not installed by this agent. Configure, server/unit targets, and the default full Release build succeeded. Node 24.11.1 passed server/client TS builds and a native-addon load probe. Python 3.14.3 is usable by version check; optional legacy Python paths were not separately exercised. No downgrade or major installation was needed. The former missing-game blocker is now resolved; current tests and actual server startup are recorded in BUILD_REPORT.

## Required installation

Install **Visual Studio 2022** Community or Build Tools with Desktop development with C++, MSVC **v143 x64/x86**, and a Windows 10/11 SDK containing headers, libraries and tools. SkyMP does not pin one Windows SDK build number. Also satisfy CONTRIBUTING's .NET Framework SDK >=4.6 requirement via the Framework development/targeting components (.NET desktop development in the full installer); the `dotnet` runtime alone is insufficient. Use Microsoft's [C++ installation guidance](https://learn.microsoft.com/en-us/cpp/overview/acquire-msvc?view=msvc-170) and [VS 2022 component list](https://github.com/MicrosoftDocs/visualstudio-docs/blob/main/docs/install/includes/vs-2022/workload-component-id-vs-build-tools.md). No major software was installed by this audit.

Open a fresh VS 2022 developer PowerShell. Ensure CMake >=3.19 and CTest are on PATH, for example through the C++ CMake tools component. The currently discovered bundled CMake is 4.2.3-msvc3, usable via its full path, but complete dependency compatibility remains unverified. vcpkg downloads its own 3.31.10 helper. Do not replace the pinned submodule to adjust these versions.

Install classic Yarn (1.x matches the checked-in v1 lockfiles); the upstream command is `npm install --global yarn`. This installation was **not performed** here. Preserve `yarn.lock`; investigate any changes caused by upstream configure-time `yarn install` before keeping them.

Python 3.14.3 and Node 24.11.1 are installed. CONTRIBUTING's Python 3.9.x / Node 17.x guidance is old; server build targets and types have moved. Do not silently downgrade/upgrade either. First test the available versions with the supported compiler, then choose a maintained compatible version only for a demonstrated incompatibility. Neither runtime is a proven cause of the current failure. A runtime version recommendation cannot be certified until real build/tests run.

## Verify and select VS 2022

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp'
$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$vs2022 = & $vswhere -latest -version '[17.0,18.0)' -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs2022) { throw 'Install VS 2022 C++ tools first' }
$env:VCPKG_VISUAL_STUDIO_PATH = $vs2022
$cmakeBin = Join-Path $vs2022 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin'
if (-not (Test-Path -LiteralPath (Join-Path $cmakeBin 'cmake.exe'))) { throw 'Install the VS C++ CMake tools component' }
$env:PATH = "$cmakeBin;$env:APPDATA\npm;$env:PATH"
git status --short
git submodule status --recursive
cmake --version
ctest --version
python --version
node --version
yarn --version
```

Existing branch is `develop`; do not recreate it. vcpkg is already initialized at the pinned commit. Keep the original `origin` remote, history, licenses and gitlink. A global vcpkg installation is unnecessary. Build outputs, logs, game assets, runtime settings, credentials and saves belong under the already ignored `build` directory. Never stage dependency downloads or credential-bearing merged settings. Review `git status` after configure/build.

The installed VS 2022 CMake component provides **3.31.6-msvc6** at the path above. The recovery attempt also verified the existing VS 2026-bundled **4.2.3-msvc3** and used that full path for its initial recovery configure. vcpkg uses its own pinned/downloaded **3.31.10** helper. All satisfy root CMake's >=3.19 requirement; this distinction matters when reproducing logs. The PATH adjustment above is limited to the current shell and does not modify Windows system settings.

## Configure, build and test

Root CMake requires the binary directory to be exactly `build`. `--fresh` resets its incomplete configure cache; the audited CMake supports this option. It does not delete saved runtime data or the audit logs. With an older CMake lacking `--fresh`, remove only `build/CMakeCache.txt` and `build/CMakeFiles` after verifying the resolved paths lie inside this checkout's `build` directory. Do not recursively delete a development world.

Historical supported workflow without Skyrim:

```powershell
cmake --fresh -S . -B build -G 'Visual Studio 17 2022' -A x64 -T v143 "-DCMAKE_GENERATOR_INSTANCE=$vs2022" -DDOWNLOAD_SKYRIM_DATA=OFF -DNO_CLEAN_AFTER_BUILD=ON
if ($LASTEXITCODE -ne 0) { throw 'Configure failed; inspect logs before building' }
cmake --build build --config Release
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
ctest --test-dir build -C Release --verbose --no-tests=error
if ($LASTEXITCODE -ne 0) { throw 'Tests failed or were not available' }
```

This preserves default unit/client/platform/script build options. CMake's `-T v143` selects its compiler; the process-local `VCPKG_VISUAL_STUDIO_PATH` selects the installed VS 2022 toolchain for dependency builds according to [vcpkg's selection rules](https://github.com/MicrosoftDocs/vcpkg-docs/blob/main/vcpkg/users/triplets.md). The dedicated server target is `skymp5-server` and unit target is `unit`; `cmake --build build --config Release --target skymp5-server unit` can narrow an investigation, but does not by itself create all distribution/gamemode/script assets. The default full build is the initial packaging baseline. Windows client dependencies remain in the vcpkg manifest even when client flags are disabled. Do not assume a lightweight server-only dependency graph on Windows.

`NO_CLEAN_AFTER_BUILD=ON` is an existing upstream cache/diagnostic option. Recovery enabled it after a repeated MSYS2 helper download stalled; it retains local downloads and dependency build trees instead of cleaning them after each package. This needs more disk space but changes no dependency pin, checksum, compiler option or test policy. A curl download into the normal vcpkg download cache can recover a stuck helper; use exactly its logged upstream URL/filename and let vcpkg validate the existing expected checksum on retry. Never alter a port hash to accept a different archive.

Without game data, compilation succeeds and `unit/main.cpp` excludes `[espm]`. **The full unit suite nevertheless fails at this checkout:** 171 cases reported, 138 passed and 33 failed, because untagged tests also require master records/cells. The CI-only distribution check skips its assertions outside CI and is included in the framework's reported passed count. CTest exits 8, and all 11 integration tests are NOT RUN because the unit fixture failed. Do not disable tests, add skip tags, bypass fixtures or manufacture masters to obtain a green result. No real world startup is possible with the configured vanilla load order until legally owned masters are supplied. Bethesda's Papyrus compiler is optional for the fallback/prebuilt script path described upstream; default full compilation succeeded without it.

After installing the game, discover its actual folder from Steam's Manage > Browse local files (or registry/library metadata). Verify `SkyrimSE.exe` and the five masters in `Data`, then reconfigure with `-DSKYRIM_DIR=<actual-folder>` in addition to the same generator/toolset arguments. Keep `DOWNLOAD_SKYRIM_DATA=OFF`. `UNIT_DATA_DIR` can point to legally owned master files for server tests independently of a game executable; it does not provide a playable client.

Tests must run on disposable data **before** preparing the development server. The integration runner replaces gamemode/settings and removes `world/changeForms`. If tests have replaced the upstream empty gamemode, rerun `cmake --build build --config Release --target skymp5-functions-lib` with the default `BUILD_GAMEMODE=OFF` to restore that upstream core-only baseline. No custom gameplay is needed for the initial login/spawn test.

## Verified recovery outputs

- `build/dist/server/scam_native.node` and `dist_back/skymp5-server.js` (+ map), runtime package files, generated settings, `gamemode.js` and `launch_server.bat`.
- `build/dist/client/Data/Platform/Plugins/skymp5-client.js` and `skymp5-client-settings.txt`.
- Native platform distribution: `Data/SKSE/Plugins/SkyrimPlatform.dll` and `MpClientPlugin.dll`; `Data/Platform/Distribution/RuntimeDependencies/SkyrimPlatformImpl.dll` plus CEF/runtime files, per `skyrim-platform/tools/dev_service/index.js`.
- `build/unit/Release/unit.exe` was built successfully and executed by CTest.

These server/client distribution outputs were produced and their paths/files verified during recovery. `BUILD_FRONT=OFF` and `BUILD_GAMEMODE=OFF` remain upstream defaults: no custom front or external gameplay gamemode was built. Match SKSE/runtime to the supported executable version declared in `skyrim-platform/README.md`; use an isolated vanilla/mod-manager test profile and a new save. Native-addon loading passed under Node 24, but Skyrim launch/client compatibility remain manual verification.

## Prepare local settings only after successful build/tests

From the repo root, use the generated config and owned absolute game paths. No assets need to be copied into Git:

```powershell
$gameDir = Read-Host 'Full folder containing SkyrimSE.exe'
$masters = 'Skyrim.esm','Update.esm','Dawnguard.esm','HearthFires.esm','Dragonborn.esm'
if (-not (Test-Path -LiteralPath (Join-Path $gameDir 'SkyrimSE.exe'))) { throw 'Invalid game folder' }
$loadOrder = @($masters | ForEach-Object {
    $masterPath = Join-Path $gameDir "Data\$_"
    if (-not (Test-Path -LiteralPath $masterPath)) { throw "Missing master: $_" }
    $masterPath
})
$serverDir = Join-Path (Get-Location) 'build\dist\server'
$settingsPath = Join-Path $serverDir 'server-settings.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$settings | Add-Member -Force -NotePropertyMembers @{
    name = 'SkyMP RP Local Development'
    maxPlayers = 5
    port = 7777
    listenHost = '127.0.0.1'
    uiListenHost = '127.0.0.1'
    offlineMode = $true
    master = ''
    dataDir = 'data'
    loadOrder = $loadOrder
    gamemodePath = 'gamemode.js'
    databaseDriver = 'file'
    databaseName = 'rp-world'
    npcEnabled = $false
    logLevel = 'debug'
    enableConsoleCommandsForAll = $false
    metricsAuth = @{ user = 'local-prometheus'; password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) }
}
$miscBsa = Join-Path $gameDir 'Data\Skyrim - Misc.bsa'
if (Test-Path -LiteralPath $miscBsa) {
    $settings | Add-Member -Force -NotePropertyName archives -NotePropertyValue @($miscBsa)
}
$settings | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $settingsPath -Encoding utf8
New-Item -ItemType Directory -Path (Join-Path $serverDir 'data'),(Join-Path $serverDir 'logs') -Force | Out-Null
```

The game-path recipe above is for **after obtaining legally owned data**. Recovery already prepared a generated `build/dist/server/server-settings.json` with five players, both loopback binds, offline mode, file driver `rp-world`, debug logging and private metrics credentials. Its strict JSON/selected values were verified, but its five configured master paths are all missing. Runtime behavior is **NOT TESTED**. Keep the test base's original `world` convention separate from development `rp-world`; back up runtime config/world before later CMake post-build settings generation or CTest. Settings above are supported by inspected source; no arbitrary `uiPort`, `ip`, tick-rate or shutdown option is introduced. Offline mode accepts a client-chosen profile ID and must stay within isolated local testing. `Settings.loadSettings()` only copies truthy values, so `master=''` does not reliably clear its wrapper default; offline guards should prevent normal master updates, but check runtime logs/traffic before asserting complete external-service isolation. Leave `discordAuth` and `additionalServerSettings` unset for this baseline. Keep the development web server on port 1234 stopped.

Start from `build/dist/server` using the generated `launch_server.bat`; it already launches the real Node entry point. For accessible logs, the equivalent foreground command is:

```powershell
Push-Location build/dist/server
try {
    node dist_back/skymp5-server.js 2>&1 | Tee-Object -FilePath logs/startup.log
} finally {
    Pop-Location
}
```

Use a second terminal for the checks in [MULTIPLAYER_TEST_CHECKLIST](MULTIPLAYER_TEST_CHECKLIST.md). Stop with Ctrl+C and verify ports/process exit. No explicit shutdown signal handler was found in the inspected TS entry point; Ctrl+C does not prove pending writes were flushed. Record persistence results separately. Do not expose HTTP RPC or offline authentication to the Internet. No extra startup script is needed while the supported generated launcher suffices.
