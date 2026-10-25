# Frostveil G2.4.0 — NPC appearance and equipment compatibility

Research date: 2026-10-26. Research branch: `dev/npc-compatibility-g240`; baseline `db212a92033b8a2068901ac6b4fe6f787e738c29` (owner-confirmed Phase C). This milestone changes research files only. G2.1 pose/AI, Clerk identity, dialogue, graphs, world, characters, economy and installed game files are unchanged.

## Decision and evidence vocabulary

**Primary:** preauthored, distinct NPC base forms with matching FaceGen and fixed outfits, delivered as a versioned, ordinary ESP asset catalog. **Fallback:** a vetted vanilla base/default-outfit catalog; retain the last working assignment when assets are unavailable. These are architecture recommendations, not a claim that custom assets have passed Skyrim acceptance.

RaceMenu is an optional administrator authoring tool. NPA is excluded from the production dependency set for now. Native appearance is a useful data protocol but the installed NPC renderer and equipment API prevent promoting that approach today.

- **VERIFIED:** relevant source plus tests confirm the stated property.
- **PARTIAL:** only specified layers work; other gates remain open.
- **UNVERIFIED:** no direct proof, particularly actual rendering and two real clients.
- **BLOCKED:** a demonstrated incompatibility or unmet dependency prevents this route.

**Overall visual target: UNVERIFIED. Real two-client acceptance: UNVERIFIED. No G2.4 client/native artifact published or deployed.**

## R1 — Exact environment and current architecture

Read-only installed-file audit: `build/rp-audit/g240/installed-runtime.json`. Versions come from actual file metadata unless explicitly labelled otherwise.

| Component | Observed identity | Qualification |
|---|---|---|
| Skyrim Steam AE | `1.6.1170.0` | SkyrimSE.exe; no upgrade attempted |
| SKSE64 | `2.2.6` | loader/runtime DLL metadata and SKSE log |
| Skyrim Platform wrapper / implementation | `2.9.0.0` / `2.9.0.0` | implementation is the existing Frostveil custom build, not an assertion about stock upstream |
| Skyrim Platform type package | `2.8.0` | installed npm declarations; differs from runtime |
| SkyMP native addon | 5,569,536 bytes; SHA-256 `a9e77780133b3c064a8abc9aa6f6971b1c73ff3c1b2d1539af404b3cbe389157` | No reliable semantic release identifier; tested this binary |
| Installed client JS | 1,451,296 bytes; SHA-256 `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6` | Matches Launcher client-repair pin |
| SkyrimPlatformImpl.dll | 15,676,928 bytes; SHA-256 `c91b5ed52adf1328877366c9497a668e2abaf1c5314b2b9ed422b762320f1a66` | Existing installed binary; untouched |
| RaceMenu skee64.dll | `0.4.20.0`, 2,521,088 bytes | SHA-256 `5225e4e3b185e6fc57c8d31b0cedbe5a030a951d9a744d33071b64c45a38c208` |
| RaceMenu configuration | `bExternalHeads=0` | Read, never changed |
| NPA / SKSE Menu Framework | Not found in installed SKSE plugins | No download or installation |
| Address Library | `versionlib-1-6-1170-0.bin` present | Package release/version 13 not established merely by this filename |
| Launcher | source package `0.1.26` | Installed Launcher executable version not independently established |
| Public graphics repair recipe | `1.0.20`, 498,388 bytes | Downloaded JSON only; SHA-256 `869d042275926fb13f14c44d08523572b5d0d77a35ac90ef35087370822f538c` matches existing source pin |

The client package's `1.0.0` and server package's `0.0.0` are not credible upstream release provenance. Use the baseline and artifact hashes above. Source anchors below are relative to this repository and baseline; key FormView history is `b88d476c0f3c616b6b4fa67e373740df1dd67ccc`, AppearanceBinding history `c7be428c8a4d1b0f225d65e51844704a5cc918d2`.

`rp-gamemode/src/modules/npc/npc-service.ts` validates a single `clerk` template, uses `39f83:Skyrim.esm`, UUIDs and `private.frostveil.npc`, verifies base/tag on recovery and uses the separate checksummed EconomyJournal storage mechanism. The maximum is 64 definitions including tombstones. Appearance/equipment/dialogue profile slots currently accept **null only**; they are not functioning customization APIs. Provisioning reserves identity durably before actor recovery. Owner-confirmed pose code keeps AI/idle enabled, anchors movement with `setDontMove`, handles degrees/radians and does not retain native wrappers across updates. None was altered.

### API and lifetime findings

| API/path | Evidence | Meaning/status |
|---|---|---|
| `mp.get/set(actor,'appearance',object)` | `skymp5-server/cpp/addon/property_bindings/AppearanceBinding.cpp:4–54`; `MpActor.cpp:225–232`; native PoC | **VERIFIED data:** per-actor changeForm `appearanceDump`, not mutation of ESM base. Binding has a validation TODO; raw input must never become an admin content API. |
| `mp.get/set(actor,'inventory',…)` | `InventoryBinding.cpp`, `MpObjectReference.cpp:808–815`; native PoC | **VERIFIED data:** saved inventory is separate from authoritative equipped state. |
| `mp.get(actor,'equipment')` | `EquipmentBinding.cpp:4–13` | Readable. `mp.set(...,'equipment',...)` **BLOCKED**, actual addon error: `mp.set is not implemented for 'equipment'`. |
| `baseDesc` | property docs and registry identity verification | Read-only identity, not an appearance switch. |
| `TESModPlatform.createNpc`, `setNpcRace`, `setNpcSex`, base setters | installed `index.d.ts:3230–3243`; `skyrim-platform/src/platform_se/skyrim_platform/PapyrusTESModPlatform.cpp:299–305` | API declaration/source verified. Creates a synthetic client base from `0010D13E`; setters operate on ActorBase, not a network-owned per-reference appearance profile. Actual custom NPC rendering **UNVERIFIED**. |
| `Actor.EquipItem` via Papyrus server integration | `skymp5-server/cpp/server_guest_lib/script_classes/PapyrusActor.cpp:254–285`; `SpSnippet.cpp:22–31` | API exists, but snippet execution returns unresolved for actors not created as players. Arbitrary ownerless NPC equipment delivery **BLOCKED on this path**, not an assertion that all equip APIs are nonexistent. |

Appearance fields in `Appearance.h`: sex, race, weight, skin/hair colors, head parts, head texture set, options, presets, tints and name. This is not the full RaceMenu jslot/sculpt/overlay/body-morph model.

## R2 — Why persisted data is insufficient for visible NPC differences

Server streaming includes appearance and equipment (`PartOne.cpp:783–814`). A non-player base other than 0/7 also sends `baseId`. `remoteServer.ts:378–398,607–648` stores initial and subsequent payloads in each client model.

However, `skymp5-client/src/view/formView.ts:139–147` resolves `model.baseId` **before** `getAppearanceBasedBase()`. A valid Courier base therefore bypasses creation of a distinct appearance-derived base. Eight source-executing VM tests reproduce this precedence, distinct-base preservation and stream teardown; they are inert platform mocks, not game or network tests. Two independent RemoteServer instances receive cloned updates and keep separate models. This confirms handler behavior only.

Additional hazards are documented, not patched: name-only appearance updates call `getBaseObject().setName` (`formView.ts:90–98`); `sync/appearance.ts:126–132` requests `setFormIdUnsafe` on the actor base while applying tints. The native function directly assigns formID (`PapyrusTESModPlatform.cpp:479–487`). PoC tests intercept this request without invoking Skyrim. Do not send unreviewed appearance updates into the live stock-base Clerk path.

Thus two server actors sharing a base can store different faces/races/hair/weight **as data**, but genuinely independent visible faces/body shapes on that path remain **BLOCKED/UNVERIFIED**. Streaming/reconnect renderer correctness is not established by persistence or successful player RaceMenu rendering.

## R2 / R10 — Comparison matrix

| Approach | Compatibility / fidelity | Equipment | Sync / persistence | Complexity / delivery / rights | Recommendation |
|---|---|---|---|---|---|
| A. Native appearance + inventory | **PARTIAL:** actual addon accepts per-instance appearance; installed valid-base renderer bypasses appearance-derived base. Schema omits full sculpt/body workflow. | **BLOCKED** direct equipment setter; inventory `worn` did not change equipment. Seeded default gear works at data layer. | Actor data/restart **VERIFIED**. Handler convergence **PARTIAL**. Actual two-client visuals **UNVERIFIED**. | Needs reviewed client renderer and an authoritative equipment route before use; would require signed client delivery and GPL/AGPL compliance for changed project code. No third-party assets needed for vanilla probe. | Research candidate, not current production customization. |
| B. Distinct preauthored NPC bases + FaceGen + fixed OTFT | **PARTIAL:** actual FormView distinct-base selection tested; custom FaceGen rendering/export not tested. Can package different race/sex/hair/face and supported body assets per authored base. | Native template/outfit seeding source-backed; fixed outfit/weapon visual convergence **UNVERIFIED**. | G2.1 identity/restart reusable. Immutable shared catalog makes convergence plausible, not proven. New base catalog integration required. | Ordinary ESP, matching FaceGen/resources, stable qualified IDs; asset authoring/manual review cost, low runtime mutation. Distribute only owned/permitted outputs and verified dependencies. | **PRIMARY**, gated on fixture asset and real-client acceptance. |
| C. RaceMenu preset authoring / application | **PARTIAL** authoring ecosystem; installed RM present. No existing validated jslot→SkyMP NPC converter. Full sculpt/overlays unsupported by native schema. | Not a server equipment service. | Local authoring does not establish network identity, persistence or convergence. | Manual asset conversion/export plus plugin dependency validation. Optional author tool; no runtime requirement in primary design. Author file redistribution restricted. | Optional authoring input, not runtime authority. |
| D. NPA | **BLOCKED** as installed dependency (absent); dynamic SkyMP reference recognition **UNVERIFIED**. | Does not establish an authoritative SkyMP gear API. | Documented local/co-save behavior does not prove server replication. | Extra runtime/dependency and permission review, closed implementation. | Exclude production; research reference only. |

## R3 — Authoring and FaceGen pipeline

The [RaceMenu author's page](https://www.nexusmods.com/skyrimspecialedition/mods/19080) documents JSON jslot preset save/load, head export and a release supporting 1.6.1170; it prohibits redistributing its files. These capabilities do not establish a supported SkyMP NPC renderer. Installed RaceMenu is 0.4.20; no configuration or binary changes were made.

| Step | State for this milestone | Required future gate |
|---|---|---|
| Author and save a preset in RM | **MANUAL**, not executed here | Use administrator's own authoring environment, not live Clerk mutation |
| Enumerate race/sex, headparts, eyes, hair, texture sets and source plugin-local IDs | **MANUAL / future validator** | Record exact dependency versions, meshes/textures, body and skeleton compatibility, ownership/permissions |
| Convert jslot to native Appearance | **UNSUPPORTED as a complete conversion** | No importer exists; sculpt TRI, overlays and body morphs cannot be silently dropped and called equivalent |
| Create distinct NPC_ bases / fixed OTFT | **MANUAL future asset authoring** | Separate local form IDs; no shared base edits; inspect template inheritance, factions, scripts and AI packages |
| Export matching FaceGen | **MANUAL, UNVERIFIED here** | CK/xEdit export procedure and resulting custom ESP/NIF/DDS must be independently tested; no generated asset claim |
| Package, validate, install on Play | Existing mechanism, **future content integration** | Signed manifest/recipe hash closure, exact plugins/masters/load order and permitted dependencies |
| Render / replace / revert | **UNVERIFIED** | Test both clients after streaming and restart; immutable revision rollback to last valid profile |

Expected FaceGen conventions to validate with the authored plugin are `meshes/actors/character/FaceGenData/FaceGeom/<plugin>/<local-id>.nif` and corresponding `textures/actors/character/FaceGenData/FaceTint/<plugin>/<local-id>.dds`; no custom export was created or loaded to verify them. Do not infer valid export from filename existence alone. Dark face, skin seam, missing eyes/hair, incompatible sex/race morphs, body textures and head-weight/mesh mismatches are explicit asset acceptance failures. Existing skee startup TRI vertex-count warnings were observed; their relevance to new authored assets is not established and they were not modified.

NPA author evidence, checked 2026-10-26: [NPC Preset Applier](https://www.nexusmods.com/skyrimspecialedition/mods/193575), version 3.0.1, documents unique-NPC limits, exclusion of console-created copies and local SKSE/co-save persistence. Requirements include RM 0.4.20, `bExternalHeads=0`, Address Library v13 and Menu Framework 3.18.0 for its UI. Its source is not public and modification/reupload requires permission. Our Courier base is actually **unique** (native ACBS check); that alone does not prove dynamic copies are accepted. No NPA binary was downloaded, inspected or run. Dynamic recognition remains **UNVERIFIED**, not a measured rejection.

## R4 — Equipment boundary

`MpActor.cpp:1313–1324` initializes a template chain, base container and best weapon. `MpObjectReference.cpp:1875–1924,1947–1995` resolves default outfits and creates worn equipment. The fixture's two Courier instances can receive different seeded gear from the same base; leveled lists/random defaults are unsuitable for deterministic authored profiles. Future catalog outfits must use validated fixed items and explicit slots, without uncontrolled LVLI or mutable player inventories.

Installed record lookup verified `209a5:Skyrim.esm` (ARMO ClothesFarmBoots02), `6c1d8:Skyrim.esm` (ARMO ClothesFarmClothesVariant04), race `13746:Skyrim.esm` (NordRace), and NPC `39f83:Skyrim.esm` (WICourierNPC). No guessed equipment form IDs were used. Distinct `inventory` entries with `worn:true` persisted, while authoritative `equipment` stayed unchanged; this is a negative result, **not** two successfully equipped outfits.

Clothing, armor, helmets and accessories must validate ARMO/ARMA and conflicting slots; weapons require WEAP/ammo and hand/attachment review. Current inventory transport does not prove any of these can be dynamically equipped on ownerless NPCs. `sendInputsService.ts:58–88,264–286` sends equipment for player 0x14, while `ActionListener.cpp:230–245,619–630` resolves the submitting user's actor. Do not spoof a player equipment packet as an NPC administration API.

`formView.ts:518–540` consumes equipment after spawn/menu/time gates; `sync/equipment.ts:109–125` clears inventory/unequips then applies worn entries/spells. A future adapter must not blindly send an arbitrary inventory blob into this destructive client path. First stream, approaching client, cross-cell, reconnect and restart **visible** gear acceptance all remain **UNVERIFIED**.

## R5 / R6 — Isolated PoC and results

Files: `rp-gamemode/research/g240/native-poc.cjs`, `client-state.test.cjs`, `README.md`, `evidence.json`. No production import, template, startup script or default feature activation references them.

The CLI requires `--isolated`; children realpath-check an audit-root fixture and assert private storage/config, offline loopback, a nonproduction port and the five installed vanilla masters. A fresh empty world and separate NPC journal use the actual installed addon and compiled G2.1 NpcService. No live world is cloned. Two UUIDs create two native forms (`ff000000`, `ff000001`) using the same existing base. Numeric appearance capability markers are **not valid visual presets and must never be opened in Skyrim**.

Separate writer/reloader processes confirmed:

- two registered identities, private tags, distinct appearance/inventory data and exactly two dynamic actors;
- both saved properties and initially seeded equipment recovered, no duplicate actors after registry restart;
- direct equipment setter rejection and no change to equipment from inventory writes;
- protected live config/world/economy/NPC/dialogue/Blueprint manifests unchanged: before/after SHA-256 `5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616`.

Raw logs and disposable state remain ignored under `build/rp-audit/g240/`; sanitized capability evidence is committed without game assets, account identifiers or player saves. Initial isolated setup probes failed for missing dataDir/scripts and were corrected inside the disposable fixture. A mock test initially incorrectly assigned the getter-only worldModel; corrected to independent injected storage, then all eight tests passed. No production fix was needed.

**Promotion gate failed:** independently rendered faces and intended equipped outfits were not demonstrated. Therefore no PoC deployment, R2 upload, native build, Launcher release or server restart. A data-path success must not be promoted as visual success.

## R7 — Asset delivery and stable identity

Existing Launcher `src/main/modpack/schema.ts:25–49` validates required plugin filename, order, masters, role and SHA-256, links plugin/file hashes, and checks content permission metadata. `graphics-source-repair` and client-repair pins provide existing verified Play delivery; the audited public recipe is not itself the full required-plugin manifest. Reuse these mechanisms instead of copying to the player's Data directory. No pipeline or signing checks were weakened.

For new owned assets, require an ordinary non-ESL ESP in both server profile and required-client plugin list, matching hashes/masters and all FaceGen/headpart/body/outfit resources. `FormDesc.cpp:46–99` currently maps file index × 0x01000000 plus local ID; this does **not** demonstrate FE/light-plugin encoding. ESL/light support remains blocked pending explicit end-to-end resolution tests. Store plugin-qualified local identities in catalogs, resolve against approved server/client load orders, never persist transient FF IDs as asset identity. Raw numeric IDs inside Appearance need explicit conversion, not blind reuse.

Missing/incorrect plugin or asset: reject the new assignment and retain the previous working NPC/profile; report the missing dependency. Do not partially apply, invent an alternate hair/race, reveal assets or fall back to unrestricted client mutation. Third-party authors' files/presets need permission or the established external-source workflow. No RaceMenu/NPA files or Bethesda assets are included in this research commit or uploaded to R2.

## R8 — Future Studio and 50–100-player design

See the architecture decision for a proposed contract, not an implemented editor. Keep UUID registry authority and immutable versioned profile catalogs isolated from player/economy journals. Assign using expected revisions, session generations and idempotency; validate all asset/form references and reject arbitrary native/script content. Preview only a disposable fixture, never overwrite Clerk by opening an inspector.

Prefer one server identity per NPC with interest-based existing streaming and immutable asset revisions. Cache asset validation by catalog hash, send changes only when revisions change, and do not apply presets every frame or persist on every observer stream. Fixed preauthored content adds authoring/download cost but avoids per-observer sculpt processing. Existing 64-definition capacity includes tombstones and needs a separate measured capacity decision; it is not evidence of support for 50–100 concurrent players. No 50–100-player load test, real two-client test or native-reference rendering soak was performed.

## R9 — Verification, Git and next acceptance

| Check | Result |
|---|---|
| RP build/typecheck + complete RP suite | **347/347 PASS**, including NPC, Dialogue, Blueprint backend, persistence, Courier, economy and startup fixtures |
| Blueprint editor | **80/80 PASS**, 13 files; typecheck/production build PASS; existing >500 kB chunk warning |
| Client recovery / movement regressions | **50/50 PASS** |
| New client source capability tests | **8/8 PASS**, mocks explicitly not real clients |
| Actual native isolated registry write/reload | PASS data boundary; equipment negative result expected; promotion false |
| Native ESM regressions | **84 cases PASS, 475,373 assertions** on this run; counts can vary with seeded native cases |
| Client webpack/typecheck | PASS, webpack 5.94.0; DEPLOY_PLUGIN=false, build output only |
| Real rendering, cell/reconnect visual soak, two actual clients | **UNVERIFIED / owner acceptance pending** |

Full local diagnostics: `build/rp-audit/g240/{rp-regressions,editor-regressions,editor-build,client-regressions,client-state-tests,client-build,espm-regressions,native-poc}.log`. An initial command referenced the wrong unit.exe path; corrected to `build/unit/Release/unit.exe`, whose suite passed. No tests were silently skipped to hide a failure.

Commit/push targets only `frostveil/dev/npc-compatibility-g240`, never upstream SkyMP; final command results are reported with delivery. No production behavior changes and no reason to restart the test server. Existing deployable Phase C bundle remains `b3942dd191d761d99205469d1d68367d0c6db9b1832427b1d281c5e7afa7825f`.

### G2.4.1 acceptance sequence (not instructions to run this data-only probe in Skyrim)

1. Author and validate two owned ordinary-ESP bases with distinct faces and fixed outfits in a **new disposable test world**. Integrate a versioned allowlisted catalog without changing Clerk or existing null profile records.
2. Deliver the approved fixture assets through signed Launcher Play. Both real clients must verify matching plugin/asset hashes. Missing-dependency client must fail clearly before new assignment.
3. With two accounts, inspect A and B face/race/hair/skin/body and all outfit/weapon slots. Check an unrelated same-base actor remains unchanged; compare each client's result. Record screenshots and client/server logs.
4. Leave/re-enter cell and worldspace; reconnect both clients; restart the disposable server. Verify same UUIDs, no duplicates, same appearance/gear and no unsafe wrapper callbacks/reference growth.
5. Change/revert an approved catalog revision and verify both observers converge. Test invalid asset/profile, disabled/deleted NPC and stale sessions. Existing Spawn Recovery, Map Discovery, Courier, dialogue, Blueprint, wallet and economy must still pass.

Do not claim production completion until these gates pass. G2.4.2/G2.4.3 UI work should follow catalog and convergence proof, not precede it.

Primary external references: [SkyMP source](https://github.com/skyrim-multiplayer/skymp), [RaceMenu author](https://www.nexusmods.com/skyrimspecialedition/mods/19080), [NPA author](https://www.nexusmods.com/skyrimspecialedition/mods/193575), [SKSE author](https://skse.silverlock.org/), [RaceMenu source](https://github.com/expired6978/SKSE64Plugins). Upstream current pages are context; installed hashes and pinned source take precedence. Creation Kit wiki pages were unavailable during research; no export procedure or custom FaceGen success is inferred from them.
