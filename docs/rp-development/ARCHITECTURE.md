# SkyMP architecture audit

Audited 2026-10-13 (Asia/Bangkok), commit `2849e676fe008925384b26f34476e382a30bd877`. This is the original source audit; subsequent build and single-client runtime verification passed with outstanding multiplayer/stability checks. See [BUILD_REPORT](BUILD_REPORT.md).

## Repository and entry points

| Component | Checked-in implementation | Responsibility |
| --- | --- | --- |
| Dedicated server process | `skymp5-server/ts/index.ts` | Node entry point: settings, manifest, HTTP UI, native server, ticking, login/spawn systems, persistence, gamemode loading |
| Native server addon | `skymp5-server/cpp/addon/main.cc`, `ScampServer.cpp` | N-API module registration and JS bindings; output is `scam_native.node`, not a standalone server EXE |
| Authoritative world | `skymp5-server/cpp/server_guest_lib/PartOne.h`, `WorldState.cpp`, `MpActor.h`, `MpObjectReference.h`, `ActionListener.cpp` | Actor/reference state, actions, validation, simulation and saves |
| Message and transport layer | `skymp5-server/cpp/messages`, `cpp/mp_common/Networking.cpp`, `NetworkingCombined.h` | Typed messages, serialization, SLikeNet transport and real/mock server combination |
| Multiplayer client | `skymp5-client/src/index.ts`, `src/services/services` | TS services for network, world model, synchronization, auth, animations, hits and gamemode events |
| Native client integration | `skymp5-server/cpp/client`, `skyrim-platform/src/platform_se` | `MpClientPlugin.dll`, Skyrim Platform/SKSE integration and game API bridge |
| Game records/scripts | `libespm`, `papyrus-vm`, `savefile`, `serialization`, `skymp5-scripts` | ESPM parsing, Papyrus VM, save formats and shared serialization/scripts |

Read the existing [repository overview](../docs_repository_structure.md), [server scripting reference](../docs_serverside_scripting_reference.md) and [Skyrim Platform overview](../docs_skyrim_platform.md) alongside these paths. Source takes precedence over stale prose.

## Server and gamemode lifecycle

`Settings.get()` reads `server-settings.json` from the process working directory, optionally merges GitHub settings, and writes dump/merged JSON files. The wrapper generates a CRC32/size manifest, starts HTTP, constructs the native `ScampServer`, and repeatedly calls `tick()` with a 1 ms asynchronous delay. This delay is not a measured tick-rate guarantee. Connection/custom-packet handlers feed TS systems. `attachSaveStorage()` runs before gamemode setup.

Gamemode code runs in Node with `globalThis.mp` bound to the native server object. `gamemodePath` selects a file or directory; file watching reloads it after clearing registered properties/event sources. The loader uses temporary JS files. Prefer a bundled gamemode with dependencies included; runtime relative imports should be checked against this temporary-file loading behavior.

The default build uses `BUILD_GAMEMODE=OFF`. `skymp5-functions-lib/CMakeLists.txt` creates the upstream empty `gamemode.js`; core login and spawn still live in the server wrapper. This is the baseline for initial tests, not an implemented RP gamemode. The optional full gamemode is a separate `skyrim-multiplayer/skymp5-gamemode` repository and its current build path requires `GITHUB_TOKEN`. It is not a missing Git submodule. Do not add credentials merely to run the initial core baseline.

## Networking

SLikeNet/RakNet UDP carries gameplay on `port` (default 7777). `Networking.cpp` sends client reliable packets as `RELIABLE`, server reliable packets as `RELIABLE_ORDERED`, and unreliable traffic as `UNRELIABLE`. The TS client calls native `mpClientPlugin` through `NetworkingService`. Message reliability and protocol serialization should remain upstream-compatible.

The Node Koa server in `ts/ui.ts` uses **HTTP**, not HTTPS. UI port is 3000 for UDP 7777, otherwise UDP port + 1. `listenHost` binds UDP; `uiListenHost` binds HTTP. Both otherwise accept wildcard binding. `/rpc/:rpcClassName` delegates to a gamemode hook without a general authentication gate at this router. `/metrics` uses `metricsAuth` Basic auth; when credentials are omitted, the route returns 401. The source has an explicit metrics-auth bypass password; do not use it.

UI dev-server detection probes localhost:1234. If detected, an internal ephemeral HTTP server is started without an explicit host in that branch. Keep that dev server off for the first loopback smoke test and inspect all actual sockets. Port 9000 mentioned in upstream docs is client Chromium tooling, not gameplay transport. `dataDir` is used for manifest/record lookup, but `ui.ts` statically serves literal `data`; keep the initial data directory as `data`. The router blocks game master/BSA downloads. Never rely on HTTP to distribute copyrighted masters.

## Persistence

`DatabaseFactory.cpp` implements `file` (default), `mongodb`, `zip` and `migration`. `file` defaults to `world`; `FileDatabase.cpp` writes serialized `MpChangeForm` records to `world/changeForms`, using temporary files and rename. `WorldState` queues changes and drives asynchronous save storage with retry/re-save paths. See `viet` save-storage implementation and [driver documentation](../docs_database_drivers.md).

Profile IDs map to actors. `Spawn` reuses the first actor returned by `getActorsByProfileId`, otherwise creates one and opens race selection. Disconnect disables the assigned actor. This is a starting lifecycle, not a complete multi-character account model. Custom properties can persist with actor change forms; visibility flags govern client replication, not account authentication or database encryption. Crash durability and flush-on-shutdown have not been tested.

## Build and dependencies

Root CMake requires CMake >=3.19, C++20 and the `Visual Studio 17 2022` MSVC generator. The binary directory must be exactly `<repo>/build`. Priority-ordered `cmakeproj.cmake` files register subprojects. vcpkg is pinned at `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`, with manifest `vcpkg.json`, `overlay_ports` and `overlay_triplets/x64-windows-sp.cmake` (x64, static CRT/libraries).

Dependencies include SLikeNet, libsodium, spdlog/fmt, simdjson, JSON, Catch2, Mongo drivers, BSA/ZIP support and Node addon headers. Windows also resolves CommonLibSSE, CEF, DirectX helpers, Frida and embedded Node packages. Turning client build flags off does not automatically remove Windows client dependencies from this manifest. The native server links `server_guest_lib`, `mp_common` and localization; TS is built by `tsc --noEmit` then esbuild. Yarn is invoked directly, including during configure. MSVC defaults include `/WX`; do not suppress warnings to make a build green.

Generated server artifacts are intended for `build/dist/server`; client distribution for `build/dist/client`. Actual produced artifacts: none in this audit. [SETUP_WINDOWS](SETUP_WINDOWS.md) separates attempted commands from future commands.

## Tests and CI

`unit/CMakeLists.txt` defines Catch2 executable `unit` and CTest `test_unit`; optional OpenCppCoverage adds `test_unit_coverage`. Existing suites cover movement validation, networking, actors, inventory, animations, Papyrus, ESPM and save/database behavior. `unit/main.cpp` excludes `[espm]` when Skyrim.esm is absent. ESPM tests mention pre-AE data and hash checks are CI-gated; current client executable support does not imply all record tests accept current data hashes.

Root CMake registers 11 `misc/tests/test_*.js` integration scripts, requires the `unit_passed` fixture, locks `server_directory`, and invokes `cmake/run_integration_test.cmake`. This runner resets settings, deletes `world/changeForms`, installs the test as `gamemode.js`, then launches Node and requires exit 0 plus `Test passed!`. Use a disposable build test world and stop any development server first.

CI includes Windows flatrim/VR, Linux variants, Emscripten, formatting and deployment workflows. Windows uses `.github/actions/pr_base/action.yml` with configure/build/CTest in Release. CI's asset-download and secret-driven deployment paths were not run locally. Upstream [CONTRIBUTING](../../CONTRIBUTING.md) supports Linux server/unit builds; the older running-server page still says Windows only. `docs_cmake_workflow.md` still mentions VS 2019, contradicted by current CMake's VS 2022 requirement.

## Game compatibility and 50–100 player limitations

Checked-in `skyrim-platform/README.md` lists Steam SE/AE 1.6.1170 and 1.6.640; 1.5.97 is deprecated. These are checkout declarations, not a claim about today's Steam release. VR is an explicit separate build option. Match executable, SKSE, native platform libraries, and client/server commit before testing. Default masters are Skyrim.esm, Update.esm, Dawnguard.esm, HearthFires.esm and Dragonborn.esm in that order. `Skyrim - Misc.bsa` can supply Papyrus scripts via `archives`.

No evidence here establishes 50–100 player capacity. `MAX_PLAYERS=1000` is a compiled ceiling and `maxPlayers=100` is a generated default, neither is a benchmark. Measure crowded-cell neighbor fan-out, UDP bandwidth/loss, tick p95/p99, JS/native boundary calls, NPC/Papyrus load, HTTP RPC work, manifest memory, save latency/backlog and reconnect races. Source notes a login/networking soul-transmission workaround; asynchronous GUID validation must be preserved. Gamemode exceptions are logged and the process may continue, so process liveness alone is insufficient health evidence. Client mod conflicts and Chromium UI cost are upstream-declared limitations. Basic synchronization, combat completeness and restart durability remain NOT TESTED.

Licensing is preserved: root [TERMS](../../TERMS.md) points to per-project GPL/AGPL obligations and third-party licenses. No license or engine source was changed.
