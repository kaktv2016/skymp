# G2.4.1 NPC Asset Authoring Guide (tool and delivery audit)

Audit date: 2026-10-26  
Repository: `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp`  
Scope: read-only installed-tool, master, and Launcher audit. No game files, production data, signing material, or GUI were touched. No ESP, FaceGen, or staged asset package was created.

## Findings and current gate

- **Manual asset-authoring gate: BLOCKED / MISSING TOOL.** No `CreationKit.exe`, xEdit/SSEEdit/TES5Edit command was found on PATH or in `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition` or its `Creations` directory. No version is established. Creation Kit and xEdit are not bundled in this project. This is a scoped check, not a claim that they cannot be installed elsewhere.

### Native-verified source worksheet (not new template IDs)

The bounded `g241-record-inspect.cjs` reader inspected at most 4,096 headers in the installed Skyrim.esm NPC group, then resolved selected records and dependencies with the installed addon. Sanitized facts are in `rp-gamemode/research/g241/source-records.json`. These are **source-only vanilla identities**, never spawn these as the G241 templates:

| Role | Appearance source | Race / sex | Fixed source items verified as ARMO |
|---|---|---|---|
| Guild Clerk A | `af522:Skyrim.esm`, `SailorEris` | `13746:Skyrim.esm`, Nord female | `c5d12` ClothesWarlockBoots, `c5d11` ClothesWarlockRobes; source OTFT `1093af:Skyrim.esm` |
| Warrior B | `f3e76:Skyrim.esm`, `dunCGImperialMageD01` | `13744:Skyrim.esm`, Imperial male | `13ed9` ArmorImperialLightCuirass, `13ed7` ArmorImperialLightBoots; source OTFT `f3e7d:Skyrim.esm` also contains `ee5c0` ArmorTorturerHood |

For B's **new** fixed outfit, omit the hood initially so face and hair remain visible. All unqualified item numbers in this table belong to Skyrim.esm. Headpart IDs and EditorIDs are in the worksheet; they were read from actual `PNAM` fields, not guessed. Appearance inspiration may be copied into fresh owned records, but do not retain source scripts, spells, factions, packages, template links/flags, hostile AI or base inventory. Set AIDT aggression to zero. The validator rejects these unsafe inherited behaviors. If a weapon is wanted, author exactly one concrete validated WEAP CNTO count=1; no bow/ammo or dynamic equipping workflow is supported yet. An empty base inventory is the initial safe choice.

Create **new** `NPC_`/`OTFT` records in FrostveilNPCTest.esp; read their newly assigned local IDs after saving. The source IDs above must never be substituted into the catalog. The assets do not exist yet and no FaceGen export is claimed.

### Implemented handoff commands

After manual CK authoring, place only the owned ESP and four corresponding FaceGen files under a separate package root's `Data/` tree, plus an `AUTHORING_REVIEW.md` describing provenance/rights and the reviewed vanilla resource dependency closure. From the repository root:

```powershell
node .\rp-gamemode\scripts\g241-dev.cjs prepare
node .\rp-gamemode\scripts\g241-stage.cjs "<isolated-root printed above>" "<authored-package-root>"
```

The stage tool reads actual IDs/sex/race/headparts/OTFT/CNTO via the addon, scans exactly two new NPC_ and two new OTFT records, hashes real files and prepares a catalog draft. Until a verified resource-closure adapter is integrated, its handoff status is **BLOCKED_RESOURCE_CLOSURE_VERIFIER** and it exits nonzero. It does not create ESP/NIF/DDS content, sign, install, publish, enable fixtures or overwrite the production manifest. With missing/invalid files it fails. Keep the proposed approval disabled until the established signed development delivery has verified the one-client installation and matching full plugin order. No owner should type raw Form IDs or JSON into in-game chat.

Staging automatically verifies header/hash/record type and ownership scan and the declared FaceGen file pairs. It does **not** fully parse every NIF texture dependency or prove visual correctness; the manual review and Skyrim acceptance remain mandatory. Only the actual approved export's hash can be authorized. The generic modpack `remoteTrust=null` audit describes that particular mechanism, not proof that every existing pinned graphics-repair delivery mechanism is unavailable; neither was changed or bypassed here.
- Installed game data is under `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data`. Present Bethesda masters include `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, and `Dragonborn.esm`. Installed community plugins also exist; keep all candidate source forms restricted to the five baseline masters until dependencies are intentionally approved.
- Verified runtime is Skyrim AE `1.6.1170.0`, SKSE64 `2.2.6`, custom Skyrim Platform `2.9.0.0`, RaceMenu `0.4.20.0`. RaceMenu is optional authoring context and is not a substitute for CK plugin/FaceGen export. NPA and SKSE Menu Framework are absent. RaceMenu external heads setting is `bExternalHeads=0`.
- G2.4.0 already verified `39f83:Skyrim.esm` as `NPC_` (`WICourierNPC`) and established the `lookupEspmRecordById` reader in the native addon. That is the existing Clerk base; do not edit it, use it as either fixture, or treat it as proof of a custom record. The native lookup accepts a load-order-global ID and returns record fields/type; current existing NPC source use is documented in `rp-gamemode/research/g240/native-poc.cjs` and `rp-gamemode/tests/map-discovery-native.test.cjs`.
- Launcher source is the sibling repository `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher`; source package version in prior audit is `0.1.26`. Its manifest is per-file (plugin and loose assets), hashes content with SHA-256, requires an Ed25519 envelope, checks plugin headers/masters/load order, and stages/installs individual verified payloads transactionally. It supports `.esm/.esp/.esl` targets and `Data\meshes`, `Data\textures` loose asset targets. BSA input is header-checked, but should not be used to hide unreviewed payload in this first test. No archive (`zip`/`7z`) packaging requirement or plugin auto-authoring workflow was found. Launcher tests cover disposable sandbox installs/rollback; they do not authorize writes into the installed game.
- **Delivery/signing gate: BLOCKED / NO APPROVED RELEASE KEY OR REAL-GAME PLAN.** Launcher `src/main/modpack/trust.ts` has `remoteTrust = null` and explicitly says no production key or distribution URL has been approved. A local-development manifest is not authenticated production distribution. The safe current output after authoring should be a content inventory plus hashes for review; do not modify production manifests or install the plugin. Real-game staging needs the owner-approved signed pipeline and an explicitly approved target.
- Existing server profile/load order is verified for the five masters above. Client's effective plugin activation/order is a separate Launcher check; do not assume an ESP added to Data is active or has the same full-plugin index. G2.4.0 expressly blocks claiming server-qualified ESL/light IDs. Use ordinary ESP and full-plugin identity only.

## Source-record inspection without guessed IDs

Use the already-installed native record reader as a read-only *record inspection* path after the local test server provides the real runtime context. Do not try to manufacture a plugin by writing TES records by hand or synthesize FaceGen.

1. Preserve the exact configured `loadOrder` array from the isolated server settings. The G2.4.0 proof used the five masters in this order: `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`. Resolve the actual currently configured order at time of authoring; report it alongside every resolved ID.
2. For each source candidate, call `mp.lookupEspmRecordById(globalId)` and record the returned record `type`, `editorId`, source plugin, source-local form ID, and selected raw field signatures. Construct global IDs from the reader's observed convention, `masterIndex * 0x1000000 + localRecordId`; verify the returned record resolves and belongs to the expected plugin before trusting it. `record.toGlobalRecordId(localReference)` is demonstrated by the G2.4.0 probe for resolving dependent record fields. Include a guard that rejects unresolved forms or unexpected record types.
3. Enumerate candidate source IDs with a bounded offline reader against these already-installed master files (e.g. a small inspection script using repository `libespm` parser APIs), or a bounded loop over a declared candidate set. Do not use an unbounded ID sweep against the game and do not extract entire BSA archives. Read the NPC_ fields needed for race (`RNAM`), sex/flags (`ACBS`), head parts (` head-part references`), hair/eyes/skin, and default outfit (`DOFT`/OTFT link as represented by the parser); follow references through `toGlobalRecordId` and verify each referenced record's type (`RACE`, `HDPT`, `OTFT`, `ARMO`, `WEAP`, `LVLI` as relevant). Verify actual field tags/encoding against parser output before coding the reader; do not assume tag spelling from this guide.
4. Save the inspection output as a proposed source-record worksheet for manual CK work. A suitable JSON row includes `sourcePlugin`, `sourceLocalFormId`, `editorId`, `recordType`, `race`, `sex`, `headPartRefs`, `hairRef`, `eyeRef`, `defaultOutfitRef`, `linkedArmorWeaponRefs`, `leveledRefs`, and evidence for each resolved record. Preserve null/absent distinctly from unresolved.
5. Select two different source NPC_ records, one meeting the guild-clerk target and another the warrior target, based on verified records. This audit did not identify or verify two target source records, so no candidate IDs are asserted here. Prefer candidates whose race/head parts and source assets are all in Skyrim.esm and whose clothing/armor are fixed records. A source actor whose default outfit or inventory links to leveled lists is not deterministic; replace its outfit with a newly authored fixed OTFT in CK and explicitly inspect every included armor/weapon item.

The lookup API is a record resolver, not proof of an installed plugin's FaceGen/rendering. The project already has tests/examples for native lookup, but no supported one-command CK/xEdit export or FaceGen validation tool. The G2.4.0 report's visual status remains UNVERIFIED.

## Manual Creation Kit authoring procedure once CK is installed

Use the owner-controlled CK UI; this guide does not automate it. Install a CK version compatible with Skyrim `1.6.1170.0` using the owner's chosen official tooling and note its exact executable version. Work in a disposable authoring profile/output directory, not the active installation. Back up the working plugin and keep the target plugin ordinary ESP.

1. Load only `Skyrim.esm` and required official masters needed by the chosen source records. Avoid loading community plugins unless the asset is specifically approved to depend on them. Create `FrostveilNPCTest.esp` as an ordinary ESP. Keep the five-master server/client runtime baseline and confirm the actual ESP master list before export.
2. In CK, locate each source NPC using the JSON worksheet's plugin/local ID and verify EditorID, race, sex and linked source records against the read-only inspection. Duplicate each NPC as a **new record** into `FrostveilNPCTest.esp`, assign unique EditorIDs such as `FV_GuildClerk_Test` and `FV_Warrior_Test`, and retain the source's race/sex as deliberately selected. Do not edit/override the source vanilla NPC. Confirm CK gives each duplicate a distinct plugin-local form ID; capture those IDs from CK/xEdit after saving. Do not predict IDs.
3. Give each duplicate a deliberately distinct face/head-part configuration using only verified resources. Keep source headpart dependencies available and record their owning plugin. Save the NPC FaceGen configuration to the new records, not to a source NPC override. Prefer vanilla assets for the initial package.
4. Create two explicit `OTFT` records in the new ESP, for example `FV_GuildClerk_TestOutfit` and `FV_Warrior_TestOutfit`. Populate each with concrete `ARMO` records; use only concrete, reviewed `WEAP` records if needed. Avoid `LVLI` and randomized outfit chains. Assign each OTFT as the corresponding NPC's default outfit. Review NPC inventory/template inheritance and any outfit/add-on records for random leveled content. Record all used item IDs and source masters.
5. Save the ESP, close CK, reopen it and verify both new NPC_ records and both OTFT records persist. Check that no vanilla NPC record is an override and that every referenced base item/race/headpart exists in the declared masters. Confirm plugin is ESP (not ESL/light) and no master was added implicitly that is outside the approved list.
6. Select the two new NPC records and use CK's `Ctrl+F4` FaceGen export. Confirm it reports the intended records, then inspect the files on disk. Expected plugin-specific paths are `Data\meshes\actors\character\FaceGenData\FaceGeom\FrostveilNPCTest.esp\<local-form-id>.nif` and `Data\textures\actors\character\FaceGenData\FaceTint\FrostveilNPCTest.esp\<local-form-id>.dds`. Confirm one matching NIF and DDS per NPC by parsed local ID and exact plugin folder. Export completion text and filenames alone do not establish valid FaceGen.
7. In xEdit, if available after install, inspect the final plugin and master chain read-only: exactly two new NPC_ records and two OTFT records expected (plus any deliberately authored required support records); no vanilla NPC overrides; correct source links and outfits; no unapproved dependencies; no unintended leveled lists. Record xEdit version and screenshot/export evidence. Do not use xEdit to hand-edit binary FaceGen.
8. Perform an asset closure check: every record reference resolves; every required mesh/texture/headpart dependency is present from the base game or approved content; no third-party asset was copied; all new files have SHA-256 and size inventory. Do not redistribute Bethesda master/BSA assets or RaceMenu/NPA files. The package may contain the authored ESP and the two matching FaceGen outputs only if the relevant distribution rights/policy have been reviewed; otherwise stage metadata/hashes and install from the owner's local source assets.

### Acceptance checklist before catalog activation

- [ ] Exactly two distinct new `NPC_` records in the ordinary ESP; IDs captured from the saved file.
- [ ] Source vanilla records are referenced/provenance only and remain unchanged.
- [ ] Race, sex, headpart references and all dependencies verified.
- [ ] Two explicit fixed `OTFT` records and every contained `ARMO`/`WEAP` record verified; no uncontrolled `LVLI` path.
- [ ] Correct FaceGeom NIF and FaceTint DDS for each new local ID and defining plugin.
- [ ] No unsupported light-plugin identity assumptions or unexplained master additions.
- [ ] SHA-256 inventory, provenance/permissions note and load-order evidence prepared.
- [ ] Real one-client visual review still required: face/hair/body, dark face, textures, seams, clothes, weapon, cell reload and restart. Static inspection is not gameplay verification.

## Package/manifest handoff

After authoring is complete and separately reviewed, provide the Launcher owner a file-level handoff containing plugin filename/hash/size, each FaceGen path/hash/size, required plugin masters and order, record local IDs and record types, asset provenance, expected runtime, and any permission restrictions. Launcher schema (`skyrim-rp-launcher/src/shared/modpack-contracts.ts` and `src/main/modpack/schema.ts`) represents files individually and validates SHA-256, plugin header/master chain and full-plugin order. Preserve its Ed25519 signature/hash checks; do not disable them. Do not publish or install using this audit. Until an approved signing key, authenticated distribution source, and explicit test target exist, status is `BLOCKED_MISSING_ASSETS` and delivery remains a manual review gate.

## Evidence references

- `FROSTVEIL_G2_4_0_COMPATIBILITY_REPORT.md` — installed versions, asset/rendering limits and expected FaceGen paths.
- `rp-gamemode/research/g240/native-poc.cjs` and `build/rp-audit/g240/poc-summary.json` — existing native record lookup proof and confirmed Clerk base.
- `rp-gamemode/tests/map-discovery-native.test.cjs` — use of runtime record type checks and source-reference conversion.
- Sibling Launcher `src/main/modpack/schema.ts`, `src/main/modpack/trust.ts`, `src/main/installer/engine.ts`, `src/shared/modpack-contracts.ts` — file manifest, signature, plugin validation and sandbox install boundaries.
