# Frostveil G2.4.4 — NPC Appearance & Equipment Management

2026-10-30, Asia/Bangkok. Implementation and isolated deployment complete; **new in-game workflow acceptance is PENDING_OWNER**. No production promotion or public Launcher/modpack release.

Baseline: SkyMP `dc0c2432`, Launcher `3d88c56f`. The owner confirmed the previous NPC system working, including the protection/dialogue baseline supplied in this mission. That does not certify detailed FaceGen, every outfit field, new management operations or multiplayer rendering.

**Owner update, 2026-10-30:** Rename, new catalog NPC creation, Move and Rotate are confirmed working. The newly created Clerk displayed a walking animation while anchored; the hotfix below is deployed but its real Skyrim animation result is still PENDING_OWNER.

## Status

| Area | Result | Scope |
|---|---|---|
| CATALOG | PASS | Immutable approved catalog extended with derived metadata; exactly two existing templates |
| ADMIN_UI | PASS | React/browser fixture and live authenticated transport checks; real owner login pending |
| TEMPLATE_SELECTION | PASS | Search, race/sex/category/availability filters and fixed configuration details |
| NEW_NPC_TEMPLATE_CREATE | PASS | Existing native addon create/save/reload verified; actual Skyrim rendering PENDING_OWNER |
| EXISTING_NPC_REASSIGNMENT | BLOCKED | Deliberately unavailable; no proven safe Base replacement/rematerialization protocol |
| OUTFIT_SELECTION | PARTIAL | One approved authored fixed outfit per template; arbitrary combinations unavailable |
| WEAPON_LOADOUT | PARTIAL | Authored inventory metadata displayed; both approved bases contain no weapon; no dynamic setter |
| PLUGIN_IDENTITY | PASS | Existing qualified identity/profile/mapper gates preserved; new owner session must prove identity |
| ANCHOR_AND_COMBAT | PARTIAL | Protection/Move/Rotate accepted; owner video rejected locomotion hotfix, latest pre-render correction PENDING_OWNER |
| DIALOGUE_COMPATIBILITY | PASS | Prior owner acceptance retained; assignments/runtime untouched, rename retention tested |
| PERSISTENCE | PASS | Actual native fresh-storage restart and registry journal recovery; protected original journals unchanged |
| ISOLATED_DEPLOYMENT | PASS | Process ancestry, ports, HTTP, 30 seals, profile and native capability verified |
| NATIVE_CRASH | BLOCKED | Original 0xC0000005 remains unresolved; diagnostics preserved |
| SINGLE_CLIENT_ACCEPTANCE | PENDING_OWNER | Checklist below |
| MULTIPLAYER_ACCEPTANCE | DEFERRED | No real two-client claim or G2.4.3 work |

## Architecture and supported techniques

The existing `NpcTemplateCatalog` validates canonical catalog approval hashes, plugin order/hashes/masters, native records, owned NPC/OTFT provenance, race/sex/headparts, armor slots, authored inventory, exact FaceGen pairs and resource closure. The development profile explicitly limits the known renderer uncertainty; it does not convert partial FaceGen evidence into production approval. Registry persistence remains the existing checksummed/fsynced `EconomyJournal`, in the separate NPC directory. No second NPC database or player/economy schema was introduced.

Audited native `ScampServer::Place`: creates a new `MpActor`, generates a dynamic Form ID and adds it to WorldState. That dynamic ID is separate from the persistent registry UUID. `BaseDescBinding` and `EquipmentBinding` provide getters, not a supported setter. Client FormView explicitly skips actor inventory application; equipment updates use a separate model/change counter. Worn inventory state alone cannot certify a rendered NPC outfit.

| Technique | Decision |
|---|---|
| Unique authored NPC Base + FaceGen + DOFT/OTFT | Selected existing validated baseline |
| Additional authored outfit variants | Extensible catalog design, but no new forms/assets invented this phase |
| Actor.SetOutfit | Declared by installed APIs; per-instance isolation, replication and reconnect behavior unproven, not invoked |
| ActorBase.SetOutfit | Shared-base mutation risk; not used |
| Inventory/equip calls | Availability does not prove authoritative NPC render synchronization; not used |
| Controlled rematerialization | Not implemented: active references/dialogues, crash recovery and old/new visibility reconciliation have not been proven |
| RaceMenu injection, preset appliers, SPID/SkyPatcher, new equipment framework | Excluded |

Inspected installed Platform declarations (`skymp5-client/node_modules/@skyrim-platform/skyrim-platform/index.d.ts`, package 2.8.0) against the pinned Custom 2.9.0 integration/source; SetOutfit exists on Actor and ActorBase and equip APIs exist. This is declaration/source evidence, not proof of production-ready behavior. External research consulted the [SKSE ActorBase implementation](https://github.com/ianpatt/skse64/blob/master/skse64/PapyrusActorBase.cpp); CK SetOutfit documentation returned HTTP 403. No unverified community workaround was adopted.

## Catalog, appearance and equipment metadata

The approved raw catalog/hash and ESP/NIF/DDS remain unchanged. Derived metadata is added to the existing immutable catalog snapshot, not written back into source records. `catalog-model.ts` shares serializable types with React without importing Node/native code into the browser.

- Stable template/preset ID, display name, description, catalog version/hash, asset manifest revision and qualified Base reference.
- Actual native EDID-derived readable race/item labels, sex, category, default outfit, actual armor slot masks and separate authored weapon metadata.
- Exact FaceGen paths/SHA-256/sizes, required plugin hashes, approval and render-proof states. No fake preview, stock portrait or new appearance variant.
- `resourceStatus: AVAILABLE` means validated local resources only. Primary availability stays `DEVELOPMENT_ONLY`, or `IDENTITY_UNVERIFIED`, `ASSET_MISSING`, `INCOMPATIBLE`; detailed rendering remains `PENDING_RENDER_PROOF`. These are not live-use certifications. Invalid startup catalogs fail closed.

| ID | Qualified Base | Race / sex | Fixed outfit | Weapon |
|---|---|---|---|---|
| guild-clerk | `5901:FrostveilNPCTest.esp` | Nord / female | `5902:FrostveilNPCTest.esp`: Warlock Robes + Warlock Boots | None authored |
| warrior | `5906:FrostveilNPCTest.esp` | Imperial / male | `5905:FrostveilNPCTest.esp`: Imperial Light Cuirass + Imperial Light Boots | None authored |

The UI and service enumerate catalog data. Additional approved assets later require reviewed catalog/development-policy data, not template-specific UI components. Ordinary users never enter raw item/Base IDs or plugin paths.

## Actual admin workflow and mutation protocol

`/npc manage` uses the existing server authority to issue a one-use, 60-second login grant for **http://127.0.0.1:13210/npcs**. The React view is isolated from graph authoring/publication. It reuses `EditorAuthority` and the existing HTTP security transport; Blueprint Studio's graph code/store/publish lifecycle was not refactored.

The view lists all managed NPCs, retains the selected UUID on refresh, shows current assigned template/outfit, location/yaw, effective movement/combat policy and actual dialogue graph. The isolated baseline uses its existing fallback Clerk graph; the view reports that graph, without creating new assignments. It supports browsing/filtering the two catalog entries, viewing verified dependency details, choosing a fixed configuration for creation, naming, review/cancel/apply, keyboard focus/ESC and responsive layout. Other templates remain inspectable for existing NPCs, while visual reassignment and Apply are disabled.

Supported mutations are **create an additional approved NPC at the reviewed player location** and **rename an existing custom managed NPC**. Rename does not replace actors or modify Base, inventory, outfit, UUID, pose/anchor, policy, dialogue or metadata. The original legacy `clerk` is read-only through this development management interface. Existing game Move/Rotate commands remain unchanged. Existing fixture UUIDs are not recreated automatically.

Every apply rechecks live admin authority, character/session identity, mapper readiness, isolated configuration, actual approved resources, catalog version/assignment, current registry revision digest and world/cell compatibility. Review capabilities are bounded, single-use, expire after 60 seconds, are bound to principal/session/actor and consumed before side effects. Movement beyond 16 horizontal/64 vertical units or a changed cell invalidates review. Concurrent rename edits conflict rather than overwrite.

Creation reuses the durable reservation -> native place/tag -> final assignment -> apply lifecycle. A replay cannot provision twice. Interrupted native provisioning remains fail-closed with its reservation retained; restart does not blindly create another actor. This phase does not invent automatic repair for an ambiguous native provisioning failure. UI success is `APPLIED_PENDING_RENDER_PROOF`, explicitly requiring Skyrim verification.

Local binding is not authentication: Host/Origin checks, cross-site rejection, HttpOnly/SameSite cookies, CSRF, per-session/global rate limits and bounded bodies remain enforced. Identity/actor IDs, arbitrary form IDs, script content and paths cannot be supplied through management operations. No filesystem writes occur for browsing/review; only approved apply uses the existing journal. No credentials, signing keys or profile receipt contents are logged.

## Verification

| Gate | Result / private evidence in `build/rp-audit/g244` |
|---|---|
| RP build/typecheck + complete G1/G2 regression | **417/417 PASS**, `rp-final.log` |
| Editor build + complete UI/graph regression | **84/84 PASS**, `ui-build-final.log`, `editor-regressions-final.log` |
| Client/Spawn Recovery/identity + authored asset tests | **73/73 PASS**, `client-assets-regressions.log` |
| Affected Launcher profile/startup/seal tests + CLI syntax | **20/20 PASS**, `launcher-regressions-final.log` |
| Native full unchanged suite | **256/256 PASS**, 476,650 assertions, seed 2353133241, `native-regressions-serial.log` |
| Actual addon + real asset catalog, create/rename/native save/reload | **PASS**, `native-probe-TPZMF8/{write,reload}-result.json` |
| Real compiled UI in Chromium | **PASS — synthetic owner/registry fixture**, desktop/mobile/filter/review/cancel/rename/create/refresh |
| Live isolated listener / anonymous and cross-origin rejection | **PASS**, `deployed-verification.json` |
| Code rollback preflight / interrupted rollback fixture | **PASS**, original backups intact; full live rollback not executed |

Total automated cases: **850 passed** across those five suites. Native probes and browser acceptance are additional checks, not real owner/multiplayer proof. The actual addon probe uses fresh private storage and a simulated authorized session; it never grants the owner, launches Skyrim or creates NPCs in the owner's registry. It verifies actual native records, authored items/slots, tags, pose/policy and retained UUIDs after a separate process reload. It does not certify client appearance rendering.

Failures are retained: two initial full native runs failed the previously recorded 25ms `Activate torch` case at `unit/PartOne_ActivateTest.cpp:587`; unchanged focused execution passed (18 assertions), and a serial full run passed. No test/timeout was edited or skipped. The initial fresh native probe omitted its empty `data/scripts` directory; the harness was corrected and both phases passed. UI development parse/label-query failures and a browser selector timeout were diagnosed; final UI suites/browser checks passed using the observed accessible combobox role. The only browser console resource warning was an absent favicon, not application code failure. Vite retains its dependency `use client` bundling warning.

Focused tests cover malformed/catalog/asset requests, raw IDs, unauthorized/forged HTTP requests, replay, expiry, reconnect, another character's review, location changes, revision conflicts, interrupted provisioning, default passive/stationary policy, independent combat override, preserved pose/dialogue/UUID, symlink escape, stale UI output and resumable code rollback. An independent reviewer identified the last two deployment issues; both were fixed with red/green tests and re-reviewed without remaining important blockers.

Browser screenshots (private, synthetic NPCs): `npc-management-desktop-final.png`, `npc-management-review-final.png`, `npc-management-mobile-final.png`. No production/native gameplay rendering is claimed from these screenshots.

## Isolated deployment and protected data

Existing root only: `build/rp-audit/g241/dev-7FNiLN`. The owner game was closed and development listeners/processes idle before mutation. No owner session was terminated. Code/config backup: **`build/rp-audit/g244/deploy-zThPIl`**, 70 files. No world/player/economy data was copied over or reset.

Thirty exact server/UI artifacts are sealed. The native addon remains **e7a9da57df5f5ea32d94cdfd37a0dd15e1980117ca0b0ddc22f013904bef8855**, with required `combatVetoVersion=1`. Client profile **634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de** and catalog **1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77** are unchanged. The local source CLI validates the expanded exact backend/UI seal; installed Launcher version, signed release/update pipeline, CEF, client JS/DLL, game files and owned assets were not replaced.

Verified visible PowerShell **4028** -> supervisor **22328** -> engine **1572**. Startup UUID **d0efd0b7-8f1f-48e2-bb52-9891b3ee0603**, readiness **7,881ms**, SAFE_WAITING, zero custom auto-spawns. Engine alone owns loopback UDP17777, TCP17778 and TCP13210. Live `/npcs` returns 200, unauthenticated snapshot 401, cross-origin mutation 403. No agent-issued real owner grant or Skyrim launch occurred.

Production config/world/economy/NPC/dialogue manifests and isolated NPC/dialogue journal bytes are unchanged. Native startup rewrote only the two original NPC ChangeForms while parking them disabled pending mapper proof; the player ChangeForm stayed unchanged. Do not interpret this as byte-identical world files. Original UUIDs remain `c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421` and `c780497d-41e1-451c-82f7-a96093c13988`. Native crash diagnostics are preserved, including the pre-phase engine22572 dump dated 2026-10-30 14:52:07; its root cause is not established here.

UI installation validates non-link destinations, stages exclusive/fsynced files, replaces the flat directory and retains the prior directory; stale assets are not served. Rollback preflights all backups/current hashes and can resume already-restored files. It rejects unknown later edits, live Skyrim and active isolated processes/ports. Close Skyrim and stop only the isolated console before actual rollback:

```powershell
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode\research\g244\deployment.cjs" rollback-check
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode\research\g244\deployment.cjs" rollback
```

This restores original paired runtime/operator code/config, never registry/world/economy files. Unused new helper/UI files remain recoverable. Actual rollback against the live server was not run. Unit-created `world.zip`, `unit/data` and Playwright artifacts were preserved in the private audit directory, not committed or deleted.

## Owner single-client acceptance

The isolated server is already running. Use the development CLI, not normal production Launcher Play. In the same PowerShell window:

```powershell
$npcDev="C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs"
node $npcDev play
# After the character enters the isolated server:
node $npcDev grant
```

Review the observed session and type `GRANT`. In Skyrim:

1. `/npc identity` -> `/npc identity status` -> `/npc fixture list`. Original Clerk/Warrior UUIDs should return; do not recreate the fixture pair.
2. `/npc manage` -> open **http://127.0.0.1:13210/npcs** -> enter the one-use grant from chat. Do not share the grant.
3. Select Clerk and Warrior. Verify UUID/current template, race/sex, fixed outfit, policy, position/yaw and dialogue details. Browse/filter both templates and inspect plugin/FaceGen metadata.
4. With an existing NPC selected, inspect the other appearance: Apply must remain unavailable and explain the restriction. Return to the current template, edit its name -> Review -> Cancel/ESC, then Review -> Apply. Check the same UUID/name in `/npc info` and E-dialogue; no spin or relocation.
5. Stand in a clear nearby location, choose **สร้าง NPC ใหม่**, select one approved template, enter a recognizable test name -> Review -> Apply once. This intentionally adds a new NPC; it does not replace either original fixture. Verify exactly one new UUID and the expected clothes/face/idle in Skyrim.
6. Test passive protection and E on the appropriate dialogue-assigned NPC; Move/Rotate through existing commands; verify new anchor/yaw, no chasing and no loss of protection. Confirm no unintended effect on player/vanilla combat.
7. Walk out of streaming range and return. Reconnect, grant/identity again, and inspect the same UUIDs, names, positions, outfits and dialogue. When ready, close Skyrim and restart only the isolated server; repeat grant/identity and checks. No duplicate NPC should appear.
8. Report Clerk/Warrior/new NPC, clothing/FaceTint/eyes/neck, protection, E, move/rotate, streaming, reconnect/restart and any crash separately. Multiplayer remains deferred.

If the isolated server is later stopped, use the existing `activate-and-play` command with its deliberate `CONFIRM` prompt. No new ESP/FaceGen authoring or asset copy is required.

## Commits and remaining limitations

- SkyMP implementation **1b42d7104fd93b0d3e49a9fed1205b9a69339a5b**, `dev/npc-activation-g241d`, authorized `frostveil` (`kaktv2016/skymp`). Report/ledger follow in a documentation commit.
- Launcher local CLI **59e9a88673d3bf6c0046f8c208878330d519b99b**, `dev/npc-local-activation-g241d`, authorized `origin` (`kaktv2016/frostveil-launcher`). No installed release change.
- Existing-NPC Base/outfit switching requires an independently proven recoverable lifecycle, reference/dialogue handling and streamed/reconnect rendering evidence. No unsafe workaround is advertised.
- Detailed FaceGen/outfit proof, new workflow in Skyrim and real multi-client replication remain owner acceptance; no 50–100-player certification is implied by isolated tests.
- Native 0xC0000005 remains unresolved. No G2.4.3 multiplayer phase, production promotion or unrelated feature was started.

## Stationary locomotion hotfix — 2026-10-30 (superseded below)

Owner created managed NPC `dd84d54e-5231-42f1-9162-3ed4f623d28c` through the UI; server logs confirm one create at 17:08:01 followed by Move. The approved template/appearance was correct. This workflow provisions a new actor from an authored Base; it does not copy another instance's current idle state.

Confirmed implementation gap: `updateNpcPose` set the network movement model to Standing and enforced SetDontMove/anchor, but did not clear a pending translation or loaded locomotion graph. `movementGet.ts` derives NPC speed/run mode from **SpeedSampled**, not the rewritten model. `movementApply.ts` can also start translation/offset movement before the neighbor updater runs. A nonzero graph therefore remains compatible with walking-in-place despite a correct anchor. The focused regression reproduced this exact disagreement (Standing model with SpeedSampled110); old code failed and patched code passed. The original actor's actual pre-fix graph floats were not captured, so a specific renderer trigger is not claimed proven beyond this gap and owner symptom.

The repair uses installed ObjectReference `stopTranslation`, `getAnimationVariableFloat` and `setAnimationVariableFloat`; actual package declarations and native master graph indexes contain SpeedSampled, Speed, SpeedDamped and Direction. It stops translation for a fresh reference, stale movement model or dirty locomotion, and zeros only nonzero finite locomotion floats. Already-idle updates make no repeated setter/stop calls. It retains enabled AI, CastBlend/dialogue/idle/combat graph state, Ghost protection, position and yaw. No forced-idle event, graph-wide reset, shared ActorBase mutation or new DLL/installed client update was added. Native failures are reported once per reference without disabling the existing anchor. These newly invoked client setters still require the owner test; server-addon tests cannot execute Skyrim's behavior graph.

Regression: **418/418 RP build/typecheck/tests** (`walk-regressions.log`), **73/73 client/assets** (`walk-client-assets.log`). Focused tests exercise dirty graph repair, 10,000 stable updates without native write/AI-reset/translation spam, later stale movement, unloaded/wrong-world guards, reference replacement and preserved idle/dialogue state. Other unchanged G2.4.4 native/editor/Launcher gates remain the earlier results above, not new gameplay proof.

Owner explicitly closed Skyrim before deployment. The original verified engine1572 tree was stopped only after checking empty sessions, game closed, startup UUID, process ancestry and owned loopback ports. The previous delivery receipts were retained under `build/rp-audit/g244/delivery-before-walk-*`; original backup `deploy-zThPIl` is preserved. Latest code-only backup is **`build/rp-audit/g244/deploy-A639Pw`**, 82 files; the rollback commands above now use this latest paired runtime snapshot. Rollback preflight passed.

New visible PowerShell **11960**, engine **3292**, startup UUID **30a6797f-dfa9-496a-9b9f-f74e5bb412f2**, SAFE_WAITING. Thirty runtime/UI seals, native capability, process/ports/HTTP/auth rejection checks passed. Registry/dialogue bytes and production/player data remain unchanged. Native startup parked all three existing managed NPCs pending identity proof; it did not delete/recreate them. Read-only deployment diagnostics now derive managed UUIDs from the checked, unchanged registry instead of assuming only the original pair. No production, Launcher release, asset or world migration.

Owner retest: use the same development `play` command -> fresh `grant` -> `/npc identity`. Inspect the existing newly created NPC; do not create another. It should retain its name/outfit/UUID/anchor, stand with normal idle rather than stepping, support E and retain Move/Rotate/protection. Walk out of streaming range and return. Report whether the walking animation remains; diagnostics print `[Frostveil NPC] cleared stationary locomotion ...` or a bounded native-call error if the real runtime refuses it. Native 0xC0000005 remains unresolved and multiplayer deferred.

## Owner video follow-up — pre-render stationary projection

Owner rejected the prior hotfix: NPC jitter and slow walking remain visible in `Skyrim Special Edition 2026-10-30 17-30-14.mp4`. The clip was inspected locally with extracted frames; no Skyrim GUI was controlled. Saved-state observations during investigation showed vertical differences around 1–5 units, inside the existing64-unit allowance. This does **not** establish uneven terrain as the primary cause or rule out collision/pitch/horizontal effects. Original clip/frames are private, not Git assets.

Source confirms `FormView.applyAll` executes stock movement **before** neighbor pose updates. The previous fix therefore corrected the model too late, while also clamping engine-owned Speed/SpeedSampled/SpeedDamped/Direction each update. That is not an appropriate steady-state animation controller; those writes have been removed. Prior simulated graph-zeroing tests did not establish correct behavior with real engine blending; the owner's video takes precedence.

The existing verified owner-before-view identity pass now projects the approved managed NPC's stationary pose into the stock movement model before WorldView/FormView consumes it. It runs only after existing catalog/Base/dynamic-ID/proof checks and validates finite pose arrays and an actually verified official world/cell plugin. Animation, equipment, health/blocking and unrelated actors are preserved. A changed projection increments the local movement counter once so the stock cadence gate sees it immediately; already-correct frames do not increment it. Existing host ownership/first-apply gates remain intact. No hardcoded client plugin index, new protocol, arbitrary IDs or installed client change was introduced.

Neighbor updates retain the existing2-horizontal/64-vertical/1-degree correction thresholds, Ghost, enabled AI and Move/Rotate. They stop translation only for a new reference or explicit anchor change, never merely because the graph reports damped motion. No per-frame animation setter or forced-idle event is used. Localhost17777-only read-only diagnostics record at most20 samples at500ms spacing per reference/anchor, including actual/target positions, correction reasons/counts and sampled graph state. The game writes these through the established `writeLogs` API to `Data/Platform/Logs/rpNpcPose-logs.txt`; no account/session secrets are recorded. These measurements have not yet been collected from the owner running this build.

Verification: **421/421 full RP build/typecheck/regressions**, **73/73 client/assets** (`prerender-final.log`, `prerender-client-assets.log`). The new regression was first observed failing against the prior implementation. `npc-stock-movement.test.cjs` executes the real stock `movementApply.ts` **and** `FormView.applyAll` with native dependencies simulated: it verifies zero self-offset instead of a Walking offset, the real counter/time gate, immediate changed input and no stable-frame counter spam. Tests also exercise invalid pose hiding, unrelated actor/animation preservation,10,000 updates with no animation-float writes/translation restart, load/world/reference guards, and the20-sample logging bound. Reviewer found the initial missing counter notification; it was fixed and re-reviewed. These are source/VM proofs, not a real Skyrim result.

Owner explicitly closed Skyrim; empty sessions and exact owned process/ports/boot were verified before stopping the previous isolated tree. Code-only backup **`build/rp-audit/g244/deploy-sqZ6xL`**,82 files, retains the prior82-file and original70-file backups. Previous receipts are preserved under `delivery-before-prerender-*`. New visible PowerShell **27500**, engine **2420**, startup **d675042e-3b7d-4c31-89e0-79cd0dcad2d7**, SAFE_WAITING. Thirty artifact seals, process/loopback UDP17777/TCP17778/TCP13210, anonymous401/cross-origin403 and rollback preflight passed. Original NPC UUIDs plus owner-created `dd84d54e-5231-42f1-9162-3ed4f623d28c` are retained; registry/dialogue and production/player data are unchanged. Normal native startup parks all three pending fresh identity proof. Installed client SHA-256 remains67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6; native addon/profile/catalog pins unchanged. No Launcher/R2/public release, production deployment, data migration or new phase.

Owner acceptance stays **PENDING_OWNER**. Rejoin using the existing `play` -> `grant` -> `/npc identity` flow. Observe the existing NPCs on their existing terrain for10 seconds before moving them; then try Move/Rotate and streaming return. Leave the game open and report the result so the bounded diagnostic file can distinguish remaining horizontal/yaw/pitch correction from animation state. Do not recreate the NPCs. Native0xC0000005 remains unresolved and multiplayer deferred.
