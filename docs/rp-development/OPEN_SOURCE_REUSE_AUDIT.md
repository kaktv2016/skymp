# Phase 2.0 — SkyMP RP open-source reuse audit

Date: 2026-10-13 (Asia/Bangkok). Scope: research and documentation only. No donor code merged, builds or external setup scripts run, dependencies installed, game/DLL/world files modified, runtime restarted, or commits created. Related deliverables: [component matrix](COMPONENT_COMPATIBILITY_MATRIX.md), [recommended architecture](PHASE2_RECOMMENDED_ARCHITECTURE.md), [license review](THIRD_PARTY_LICENSE_REVIEW.md).

## Decision

Use the current engine and add a small TypeScript gamemode. Heavy RP is the strongest source for selected modern registry/command/interaction concepts; its complete gamemode is not compatible with our state-ownership rules. Red House is useful as a chat/interaction/UI reference, not a deployable stack. The 2019 gamemode uses an obsolete native/auth model. The standalone Papyrus scripts have no inspected license grant. The two engine forks provide no reason to replace our validated native/client foundation.

No component is verified compatible in-game by this audit. REUSE means a narrowly bounded code candidate with limited adaptation and required acceptance tests, not a ready-to-install module. Many attractive features are implemented but disabled, require an external gamemode, or only have mocks/helper tests.

## Current local foundation

- Branch `develop`, documentation baseline HEAD `5397cd3bf4666c942f78193107881d8cf0ac2748`; parent engine commit `2849e676fe008925384b26f34476e382a30bd877`. Their diff contains only six development documents. vcpkg remains pinned to `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`.
- Installed runtime/SKSE: Steam 1.6.1170.0 / 2.2.6. Current paired SkyrimPlatform/implementation 2.9.0 and MpClientPlugin/client JS come from our build. Retain all native dependencies/address databases; no new fork DLLs are evaluated as installed here.
- User states solo character, inventory, equipment and position persistence have passed. This supersedes earlier documentation awaiting final item confirmation. Recorded baseline logs/tests provide source and earlier test evidence; this audit does not rerun gameplay or certify two-player synchronization.
- Server entry `skymp5-server/ts/index.ts` owns wrapper systems, exposes `globalThis.mp`, attaches native save storage before gamemode, and requires a temporary copied JS entry. `ts/systems/login.ts` retains connection GUID checks; `spawn.ts` finds/reuses the first actor by profile ID. Current offline profile 1 is a development identity, not proof of production account authentication.
- API authority is `skymp5-server/cpp/addon/ScampServer.cpp`, property bindings and gamemode event classes. `ts/scampNative.ts` covers only part of the native surface. `skymp5-functions-lib/index.ts` imports an absent `src` tree; the enabled CMake path fetches separate `skyrim-multiplayer/skymp5-gamemode`. The similarly named `skymp-team/skymp-gamemode` reference is not that repository.
- Inventory/equipment/location/profile/dynamic fields are native persisted state via `MpChangeForms.{h,cpp}`, `WorldState` and `skymp5-server/cpp/server_guest_lib/database_drivers/FileDatabase.cpp`. Native `inventory` setter replaces the entries structure; `equipment` getter does not imply a supported setter. `rp-world` is kept local/ignored. A second SQL/property saver must not reset this state on login.

Exact local source links: [server loader](../../skymp5-server/ts/index.ts), [native API](../../skymp5-server/cpp/addon/ScampServer.cpp), [spawn](../../skymp5-server/ts/systems/spawn.ts), [bindings](../../skymp5-server/cpp/addon/property_bindings/PropertyBindingFactory.cpp), [change forms](../../skymp5-server/cpp/server_guest_lib/MpChangeForms.cpp), [file storage](../../skymp5-server/cpp/server_guest_lib/database_drivers/FileDatabase.cpp), [gamemode build](../../skymp5-functions-lib/CMakeLists.txt).

## Reproducible research snapshot

Research root is outside production: `<LOCAL_PATH>`. Directory naming is `<owner>--<repo>`. All six default branches were cloned with depth 1 and submodule recursion disabled. No submodule content, external build binary, private backend or uncommitted gamemode patch is assumed present. Clone exit statuses were 0. Shallow histories establish these exact trees, not every branch's features or proven fork merge bases.

Metadata was read from the public GitHub repository API; full hashes verified by local `git rev-parse HEAD`. Last default-branch commit differs from repository `pushed_at` because another ref may have been pushed. `updated_at`, stars and unarchived status are not evidence of active maintenance or working gameplay. Snapshot files: `repository-metadata.json`, `dependency-inventory.json`, `license-inventory.json`, three domain notes, exact fork blob-diff CSVs/native text diffs in the research root.

| ID | Repository / clone directory | Full inspected commit | Default branch / latest HEAD date | Repository pushed_at / archive | Maintenance assessment |
| --- | --- | --- | --- | --- | --- |
| H | [vinicius3232/skymp-heavy-rp](https://github.com/vinicius3232/skymp-heavy-rp) / `vinicius3232--skymp-heavy-rp` | `f686977343156a2b188dc1271cabe9b2ae197e6a` | main / 2026-09-06 | 2026-09-06; not archived | Most recent maintained-looking RP source; substantial tests, gameplay verification gap |
| R | [alekcey0211/red-house-public](https://github.com/alekcey0211/red-house-public) / `alekcey0211--red-house-public` | `65c66bb3e1b9f5765ed5fc036d69d75e3afbb53d` | master / 2021-11-01 | 2021-11-16; not archived | Stale handwritten RP stack with legacy bundled server-build |
| G | [skymp-team/skymp-gamemode](https://github.com/skymp-team/skymp-gamemode) / `skymp-team--skymp-gamemode` | `bb77d388a4e5f45f2fffd91d418917344d6ddc8a` | master / 2019-12-01 | 2022-12-04; not archived | Old RemoteServer auth/router, not modern RP features |
| P | [alekcey0211/skymp5-scripts](https://github.com/alekcey0211/skymp5-scripts) / `alekcey0211--skymp5-scripts` | `fdd20ccbc95134d38a6deb92b4cefa08f85c107e` | master / 2021-02-20 | 2021-02-20; not archived | Papyrus policy examples; absent license/API bridge |
| K | [1kxzy/skyrp](https://github.com/1kxzy/skyrp) / `1kxzy--skyrp` | `8d3059f8347e5c9041b34119e0b72e33ff67f226` | main / 2026-07-23 | 2026-07-24; not archived | Engine/client/deployment fork; matching external gamemode not supplied |
| F | [skyrim-roleplay/skymp](https://github.com/skyrim-roleplay/skymp) / `skyrim-roleplay--skymp` | `456190b4780863e5277c33f2384976143cbe65a1` | main / 2026-08-15 | 2026-08-15; not archived | Small engine fork; no added RP implementation found |

Each donor path below and in the matrix belongs to the exact full commit in this table, not a moving branch. A path `H:skymp/gamemode/core/command-registry.js` means that path in H's pinned clone. License details/ambiguities are in the separate review.

## Evidence levels

Implemented = body exists. Registered = inspected boot/import/hook path reaches it. Enabled = inspected template explicitly activates it; unknown deployment settings are not inferred. Mock-covered = assertions against fakes exist in source; **we did not execute them** and do not claim they passed. In-game verified = matching real gameplay evidence, absent for donor integrations here. A UI fixture, helper test or README screenshot is not proof of transaction settlement, durable identity or multiplayer behavior.

No external test scripts were executed: many can open SQL/network services, load globals or mutate runtime; research did not need that risk. We inspected actual test files and registration assertions rather than converting package test commands into claimed results. Existing local CTest success is baseline evidence, not tests of imported modules.

## H — Heavy RP

Pinned source entry is `skymp/gamemode/phase0-basic.js`. CommonJS gamemode runtime deps are dotenv `^17.4.2`, mysql2 `^3.22.6`, ws `^8.21.0`; TS `^5.9.3`, Node types `^26.1.2` are dev deps. It is JS with JSDoc/types and a no-emit typecheck, not a ready strict TypeScript package. Our Node 24 runtime is not certified by newer Node typings. Use manifest ranges as declared requirements, not asserted installed/resolved versions.

### Registry/types/commands

`core/module-registry.js` provides lifecycle states, dependency ordering, flags, command/interaction cleanup and health checks; `core/module-registry.test.js` covers that logic with fakes. Registry boot is invoked by phase0 entry; feature flags gate descriptors. Header comments describing six modules are stale: actual entry registers many more, including trade, jobs, contracts, crafting, mining, environment and public work. Do not use comments as the activation inventory.

Registry is REFACTOR: `_active.add(id)` precedes command registration and the catch path removes interactions but does not guarantee removal of the active entry/partially registered commands or teardown of initialized resources. Current engine `clear()` does not own its Node singletons/timers. Keep states/ordering but define stronger failure/teardown and reload contracts.

`core/command-registry.js` is dependency-free and a limited REUSE candidate with its test. It normalizes aliases, lists metadata and traps handler errors. It warns then overwrites collisions and returns command-found, not action-success. It supplies no standalone authenticated transport or permission checks. Keep explicit caller validation/ID mapping and tests around those semantics.

`core/interaction-registry.js` is a descriptor vocabulary/registry, another limited REUSE candidate; actual resolution/permissions live elsewhere. A declared target type does not mean its resolver is implemented. `types/mp.d.ts` and `core/skymp-adapter/*` are REFACTOR: `place` declaration differs from our numeric return, Papyrus docs imply client execution while ours is server VM, reflection arg positions differ and catalogue pins `d85f18d808f877401c4e20484d2c2f6f73cf9caa`, not our engine. Fixed profile/user scanning in `core/connection-monitor.js` is not a robust session identity map.

### Identity/persistence/transactions

`whitelist.js`, `commands.js`, `identity-service.js`, `database.js` and SQL schema implement account/character/RP mappings. They are richer than a name string, but not compatible by default: whitelist writes stored SQL location to `locationalData`; inventory-service replays SQL stacks on login with only a per-session cache. Existing native state is already persisted in our installation. Reject the import of that login/state synchronization path.

`core/transaction-service.js`, `core/economy-service.js`, `core/inventory.js`, SQL schema/migrations contain ledgers, transaction boundaries, locks and idempotency work worth examining. But DB transaction and native state mutation are separate; `_applyToClient` sends numeric item base IDs as Papyrus form args, and SQL commits can precede an ineffective native operation. `inventory-service.js` assumes a cache reset is reconciliation, which does not compare persisted native item extras/counts. Do not label this an atomic native trading/economy system. REFACTOR logic patterns; REJECT full native inventory mirror. Exact native evidence: our `PapyrusUtils.h`, `ScampServer::CallPapyrusFunction` and `skymp5-server/cpp/server_guest_lib/script_classes/PapyrusObjectReference.cpp` require proper reference conversion.

`skymp/packages/database/schema.sql`, `migration-v*.sql`, `skymp/gamemode/scripts/apply-migrations.js` are a large independent RP schema; not an engine `rp-world` migration. Versioned files alone do not prove safe upgrade/rollback for our identity model. No SQL server/migration was run or installed.

### Chat/UI/jobs/crafting/housing/trading/launcher

`rp-chat-service.js` and tests are useful RP channel/policy reference, but bound to commands/active characters and need target UI transport. `skymp/ui/index.html` plus `core/ui-event-router.js`, `ui-event-gateway.js`, `interaction-service.js`, `interaction-targets.js` and prompt/dashboard services provide concrete flows. Adopt a descriptor or one consumer, not the whole UI/gateway/service graph.

Jobs/profession/resource/mining/public-work/crafting/trade/contracts/market-stalls have implementation and mock test files, with registered flag-gated descriptors. Presence of a flag does not establish enabled deployment or in-game success. Housing and other parked services must not be counted as active gameplay from their file names alone. Donor native interactions/objects/forms/SQL identities/content stations require concrete in-game acceptance on our installed masters.

Specific inspected gaps: `core/depot-service.js` changes SQL inventory/depot counts without removing/returning the native carried item or a durable delivery ledger; `housing-service.js` charges gold in a separate committed operation before ownership update; crafting XP/signature effects occur after item commit and can be lost on interruption/replay. `commands.js` chat cell check reads fields other than our actual `cellOrWorldDesc`. These are source-grounded blockers, not just general concerns about older versions.

Critical pinned evidence: [transaction native calls](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/skymp/gamemode/core/transaction-service.js), [inventory session replay](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/skymp/gamemode/inventory-service.js), [login location](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/skymp/gamemode/whitelist.js), [depot](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/skymp/gamemode/core/depot-service.js), [our Papyrus conversion](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/skymp5-server/cpp/addon/PapyrusUtils.h). Item arguments must be ESPM record references, distinct from actor self references; fixing that argument alone still leaves the SQL/native authority conflict.

Actual module activation is inventoried below. All rows have descriptors in `skymp/gamemode/phase0-basic.js`; the gamemode `.env.example` has their enabling flags false or unset. This says nothing about a private operator's deployment. Core UI/chat/connection-monitor setup outside the registry can still run. Paired test sources generally use injected/mock services; none were executed or verified in-game by this audit.

| Registered descriptor | Required dependencies | Enabling flag |
| --- | --- | --- |
| interaction | none | ENABLE_INTERACTION_FRAMEWORK |
| npc-cleaner | none | ENABLE_NPC_CLEANER |
| death | interaction | ENABLE_DEATH_SERVICE |
| governance | interaction | ENABLE_GOVERNANCE_SERVICE |
| profession | none | ENABLE_PROFESSION_SERVICE |
| mining | profession, interaction | ENABLE_MINING_SERVICE |
| environment | none | ENABLE_ENVIRONMENT_SERVICE |
| economy-physical-sync | none | ENABLE_ECONOMY_PHYSICAL_SYNC |
| market-stalls | governance, interaction | ENABLE_MARKET_STALLS_SERVICE |
| player-panel | governance | ENABLE_PLAYER_PANEL_SERVICE |
| character-dashboard-bridge | interaction, player-panel | ENABLE_INTERACTION_PROMPT |
| soul | none | ENABLE_SOUL_SERVICE |
| voip | none | ENABLE_VOIP_SERVICE |
| nametag | none | ENABLE_NAMETAG_SERVICE |
| interaction-prompt | interaction | ENABLE_INTERACTION_PROMPT |
| player-shortcuts | none | ENABLE_PLAYER_SHORTCUTS (not set in inspected template) |
| fauna-census | none | ENABLE_FAUNA_CENSUS |
| corpse-probe | none | ENABLE_CORPSE_PROBE |
| trade | interaction | ENABLE_TRADE_SERVICE |
| depot | interaction | ENABLE_DEPOT_SERVICE |
| crime | interaction | ENABLE_CRIME_SYSTEM |
| crafting | interaction | ENABLE_CRAFTING_SERVICE |
| public-work | interaction, interaction-prompt | ENABLE_PUBLIC_WORK_SERVICE |
| jobs | none | ENABLE_JOBS_SERVICE |
| contracts | none | ENABLE_CONTRACTS_SERVICE |

Optional dependencies do not imply activation: governance's economy-regional is parked; mining's prompt and market-stalls' dashboard can be absent. Public work requires a real route/anchor configuration not tracked in the inspected snapshot. `housing-service.js`, `horse-service.js` and `economy-regional.js` are unregistered/parked; debt is caller-dependent rather than independently booted. Header descriptions of a smaller registry and thirteen profession names are not proof of thirteen working jobs.

Electron launcher, modpack parity, web/game API, Discord/voice services are separate products under `apps/` and voice directories. They are excluded from initial RP integration and need separate dependency/asset/network/install review. Anti-cheat features are not proposed.

Selected launcher implementation was inspected directly: `apps/launcher/electron/parity.mjs` parses plugin/Creation Club data and compares manifests with injected header/hash I/O; `main.ts` imports and uses it. Its tests use synthetic headers/manifests; `version-gate.test.mjs` checks Home.tsx source order, not an actual Skyrim/SKSE launch. `connection-settings.mjs` writes connection settings and removes profileId credentials in favor of the donor ticket/session contract, which is not our offline-profile configuration. Do not install it just to reuse hash comparisons. Declared launcher stack: React19.2.7 range, Electron `^43.1.0`, Vite `^8.1.1`, TypeScript `~6.0.2`; game-api uses Express `^4.22.2`, mysql2 `^3.22.6`, dotenv `^17.4.2`. These separate versions/contracts do not upgrade our supported native runtime or establish install compatibility.

## R — Red House

Concrete activation chain: `server-build/src/index.ts` uses an old constructor/Chakra loader/chat bridge; `functions-lib/index.ts` replaces global registrations and starts JS modules/property saver; `functions-lib/src/events/index.ts` routes CEF chat to `scripts/GM/GM_Main.psc`, `GM_Commands.psc` and `scripts/Custom/RHF_Commands.psc`. Native/UI wrapper exports that this chain expects are absent from our binding table. README assumes the author's engine branch/ESMs/scripts, not a portable current gamemode.

Chat (`RHF_Chat.psc`, `GM_ChatSend.psc`, `server-build/src/chat.ts`) implements local/world-aware and RP action channels. Reference channel/distance behavior while selecting one target transport; do not deploy duplicate Papyrus and websocket message routes. Identity is display name/firstLoad, not a reviewed account-to-RP-character persistence model. `RHF_onLoad.psc` removes inventory/unequips on first load; reject against our baseline.

Trading is implemented and wired, but settlement is client-authoritative: `scripts/Custom/Systems/RHF_Trade.psc` exposes add/delete commands from client IDs/counts, and `front/src/features/systems/trade/components/tradeFooter/index.js` sends independent item mutations after local Redux consent flags. It has no authoritative reservation/atomic paired commit/recovery contract. REJECT backend; UI/offer flow REFERENCE ONLY. Outer `RHF_Commands` exposes unsafe mutation commands outside the narrower admin gate.

`functions-lib/src/propertiesSaver/index.ts` writes separate actor JSON periodically; `papyrus/multiplayer/globalStorage.ts` assumes hardcoded first actor. Reject duplicate persistence. Recipe helpers use xelib/raw record IDs and must map plugin-local IDs; our native crafting already exists. No complete banking/paycheck/housing ownership subsystem was found in handwritten RP feature paths.

Tests: real Jest source exists for argument/function/localization helpers, multiplayer wrappers and client idManager. The trade `front/src/test/tests/trade.js` is a manual fake UI fixture. Static stale expectations exist in multiplayer wrapper tests (Log/Format); not executed/passed here. TS4.4/Jest27/Parcel1/React17/MUI4 ranges imply tooling modernization, not automatic Node24 compatibility.

## G / P — Old gamemode and Papyrus examples

G's `index.js` registers only `src/systems/auth/index.js` through a router. `src/createServer.js` searches for `skymp-api.node` RemoteServer, saves devPassword with node-localstorage and creates chained actor objects. Auth stores plaintext password on actor storage, distinct from current numeric profile/actor APIs. Reject auth/bootstrap; router/request correlation is reference only, no tests/types or RP economic modules found. MIT license does not fix API age. Dependencies include axios `^0.19.0`, node-localstorage `^1.3.1`, commander `^4.0.1`, recursive-readdir `^2.2.2` and nodemon `^1.19.1`.

P has 14 Papyrus .psc files. `Source/Scripts/GM_Chat*.psc` implements RP message formatting/range policies but requires unprovided `M.psc` native functions; `GM_Main` alone does not register server callbacks. `/ban` in `GM_CommandBan.psc` only broadcasts an announcement/test value, not a persisted ban or actual kick. No tests, package manifest or inspected license. Reference functionality ideas; reject code copying and misleading moderation implementation until permission/complete matching bridge exists.

## K / F — Engine forks, not drop-in RP modules

Git blob path inventories compared to our engine (not line endings or docs baseline) show K has 247 changes: 134 added/30 deleted/83 modified. F has only 15: 1 added/2 deleted/12 modified. Shallow comparison is exact tree difference, not a claimed merge base.

F has no new RP gameplay modules. Differences include installer workflow dispatch, removed LCTN/map-marker parser support and older client startup/exit/directory-monitor behavior. It would discard fixes already in our source; reject engine migration.

K registers actual client CharacterSelect/Housing/Trade/Chat/Capture services in `skymp5-client/src/index.ts` and changes wrapper Spawn/Login/Capture/backendFactionApi. That is implemented/registered source, but needs matching backend/gamemode. Docs claiming classes are disabled or Housing uses slash commands contradict structured packet source. `HoldClaims.{h,cpp}` plus `unit/HouseClaimTest.cpp` have 20 helper cases but no live save/activation use found; this is not persistent integrated housing. CaptureSystem needs authoritative role/rule work and changes bleedout state; no proof of full arrest/jail system.

The fork still fetches an external `skyrim-multiplayer/skymp5-gamemode`; tracked build-output trade/respawn fragments are not wired/clearly licensed standalone packages. Both forks retain shared 1.6.1170 support already present in our baseline; no new compatible DLL is required. Native API declarations/serializer blobs are unchanged, but K's native gameplay/input/port semantics differ and both restore older native client regressions. Reject whole-fork/client replacement.

K adds MIT backend/launcher components and a manager package. Backend stores accounts/access/session material in synchronous JSON, not a transactional RP economy. Launcher builds MO2/modpack/SKSE setups, but manifest destination/source path joins and late hash validation require containment/staging work; no launcher/backend/manager automated test script/tree was found. Separate asset/media rights remain unverified. All are future reference, outside current implementation scope.

## Duplicate functionality to retain locally

| Donor idea | Already available in our engine | Decision |
| --- | --- | --- |
| Actor/profile spawn and first-load equipment | `ts/systems/spawn.ts`, native actor/changeform state | Keep current behavior; no donor reset/replay |
| Inventory/equipment/location save | `MpChangeForms`, native property bindings, `WorldState`, `FileDatabase` | Keep sole native authority; reject periodic/SQL world mirrors |
| Item add/remove and craft | `skymp5-server/cpp/server_guest_lib/script_classes/PapyrusObjectReference.cpp`, `CraftService.cpp`, `skymp5-server/cpp/server_guest_lib/gamemode_events/CraftEvent.cpp` | Adapt correct typed calls only if new domain flow needs them; no engine replacement |
| Event/property/network bridge | `ScampServer.cpp`, gamemode events, client `gamemodeEventSourceService.ts` / `gamemodeUpdateService.ts` | Reuse existing contracts with a narrow typed facade |
| SKSE1170, platform/CEF/node, address DB | Current official paired client distribution | No fork/native update for RP UI |
| Metrics, file/mongo/zip/migration drivers | Current wrapper/native database implementations | Existing capability, not license to migrate world during research |

## Ranked integration recommendation

1. Current-source TS facade/ID mapping and minimal command registry; use H command registry/test as limited adaptation source. No SQL or new native files. 1–2 days for facade plus 0.5–1 day registry; tests must match actual native signatures and explicit dispatch outcomes.
2. Lifecycle/event ownership, adapting H module registry design and pure interaction descriptor vocabulary. 2–4 days; fix failed boot/resource cleanup and reload ownership, not a blanket singleton import.
3. RP identity metadata/read-only command, borrowing H's domain vocabulary rather than its login/state code. 2–4 days; same actor and inventory/equipment/location survive RP deployment/reconnect/restart.
4. One RP chat slice, referencing H and R channel policies. 3–5 days with actual target UI transport and two-client recipient/identity/focus/Unicode evidence.
5. One interaction consumer using H registry/pipeline concepts. 3–6 days; real target resolver, cancellation/permissions/range and reconnect tested.
6. Later approved economy ledger + native item reconciliation. 8–15+ days. SQL/native two-system commits and identity migration are design blockers; jobs/crafting/trading depend on that boundary. Housing and launcher are deferred.

Full per-component dependencies, files, commits, rejection reasons and acceptance tests are in COMPONENT_COMPATIBILITY_MATRIX. No estimate promises compatibility or complete feature coverage. Overlapping estimates must not be summed blindly.

## Limits and stop point

Only the six pinned default-branch snapshots/public metadata and local pinned source were audited, plus selected source/tests. We did not claim exhaustive contributor history, all dependency licenses, live donor production settings, private/uncommitted gamemode code, vulnerability clearance or successful donor in-game validation. No imported module is currently installed.

Research clones and notes remain outside production. Only the four requested Phase 2.0 Markdown files are new local repository files. No commit, source merge, gameplay implementation, anti-cheat, launcher deployment or state migration is performed. Wait for approval of a precise implementation slice and licensing posture before beginning Phase 2 code.
