# Frostveil G2.4.1B — real authored asset integration

Date: 2026-10-26 (Asia/Bangkok). Baseline `61fc544043cd09738f032ba36775b1497cd0516e`; branch `dev/npc-asset-integration-g241b`. Continues G2.4.1; no G2.4.2 work, production deployment or game GUI control.

**Result: BLOCKED_WITH_REASON.** The real ESP and exports now exist and their structure/record relationships were inspected. The female Face Tint shader has an empty tint-map slot; the male path has an unresolved `Data\Textures` prefix. Complete scene/skin/archived-mesh closure and authenticated development delivery remain unverified. No custom template was approved/spawned and no Skyrim visual success is claimed.

## Actual source and identity inventory

Read-only input: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data`. Source plugin `FrostveilNPCTest.esp`: **1,545 bytes**, SHA-256 **`ecb1f7f70aa15cab92d4dfde7773bf920f88d6558623224c5940454ba59439fc`**. TES4 header is an ordinary non-master ESP, ESL flag off; masters are Skyrim.esm, Update.esm, Dawnguard.esm, HearthFires.esm, Dragonborn.esm in that order. CreationKit.exe is now present, file version **1.7.99.0**; no reinstall or GUI editing was performed. xEdit/SSEEdit was not found in the scoped PATH/game-root checks.

| Local ID | Type / state | Actual EditorID / purpose |
|---|---|---|
| `00005901` | NPC_, active, unique | `FV_GuildClerk_Test`, female Nord (`13746:Skyrim.esm`) |
| `00005906` | NPC_, active, unique | `FV_Warrior_Test`, male Imperial (`13744:Skyrim.esm`) |
| `00005902` | OTFT, active | `FV_GuildClerk_TestOutfit`: `c5d11:Skyrim.esm` ClothesWarlockRobes + `c5d12:Skyrim.esm` ClothesWarlockBoots |
| `00005905` | OTFT, active | `FV_Warrior_TestOutfit`: `13ed9:Skyrim.esm` ArmorImperialLightCuirass + `13ed7:Skyrim.esm` ArmorImperialLightBoots |
| `00005900` | NPC_, deleted | Additional discovered empty tombstone; no EDID/payload |
| `00005903` | NPC_, deleted | Owner-reported duplicate, still present as empty tombstone |
| `00005904` | NPC_, deleted | Owner-reported duplicate, still present as empty tombstone |

All three deleted records have exactly flags `0x20`, zero payload and the plugin's own master-count index, not vanilla override identities. There are **four active records and three deleted records**, not a clean four-record binary. No unexpected active records or vanilla overrides were found. Deleted 5903 FaceGen is absent from the inspected source inventory; no additional game files were deleted.

Both active NPCs have empty base inventory, no template inheritance, no VMAD scripts, SNAM factions, SPLO spells or PKID packages; AIDT aggression is zero. Sleep outfit is absent/NONE. Race/headpart and outfit references resolve through the installed native libespm reader. Twenty-one additional scalar form references were checked; the bounded dependency walk resolves **85 records** (2 NPC_, 2 OTFT, 2 RACE, 11 HDPT, 5 ARMO, 29 ARMA, 34 TXST), with no missing/type-mismatched references. It includes compatible-race/sex alternatives and is an overapproximation, not a proof of the minimal render graph. No inspected active links target 5900/5903/5904.

Persistent catalog identities are **`5901:FrostveilNPCTest.esp`** and **`5906:FrostveilNPCTest.esp`**. CK `05005901`/`05005906` describe that authoring load order only. Native staging appends the ESP after the six existing server entries and resolves its actual index; neither a CK-global nor FF dynamic ID is stored as template identity.

## Deleted-record decision

These are technically inert new-record tombstones: no executable payload, no active assignment and no master override. They need not be physically removed to inspect this exact package safely. Nothing was rewritten or silently filtered from the source ESP.

The default scanner **still rejects all deleted records**. A new optional `reviewedTombstones` catalog field permits only an exact, bounded review of these owned NPC_ IDs, flags and zero payload. The integration driver supplies that review only for the exact plugin SHA above. Header ownership bits, uniqueness, complete review consumption and absence from active template references are checked. Changing a deletion to active, adding data, moving it to a master identity, omitting a review or reviewing an absent deletion fails. The catalog hash covers the review metadata. This is an explicit documented retention decision, not binary cleanup or an arbitrary numeric allowlist from a game client.

Optional minimal cleanup, only if desired: copy the tiny authored ESP to a disposable authoring folder, open **that copy** with supported SSEEdit, expand NPC_, verify the three exact entries are owned/deleted/empty and unreferenced, then remove those three records only and save the copy. Do not use global “undelete and disable references” or modify masters. Reinspect all four active records, all references and hashes afterward. No supported edit tool was established here, so no binary writer was invented and no cleanup is required as a workaround for the separate FaceGen defect.

## Real FaceGen and warning investigation

| Owned runtime file | Bytes | SHA-256 |
|---|---:|---|
| FaceGeom `00005901.nif` | 204,143 | `e0e44eb8112c9b10bc9e6b547bf8a671152b2cd8714629ae7b9383c0d19d2aa3` |
| FaceGeom `00005906.nif` | 267,382 | `6a2ba2bb0139999d8b88aaeda389479dc11bdc1620edd6ab559325527a678458` |
| FaceTint `00005901.dds` | 1,048,704 | `2bf59a37d76e13644b205f1778fbdfdf874c987b772a5e8375240b4d04e2e14c` |
| FaceTint `00005906.dds` | 1,048,704 | `1e5dacdb9bfa2cf51a74fed55030d26bc3b52d0e2f14f827c883f71eed7c1fd8` |

Paths use the correct defining-plugin folder and local IDs. Both NIFs are SSE `20.2.0.7`, user version 12, Bethesda version 100. A bounded block-table reader validates block boundaries/footer, texture-set blocks and the leading lighting-shader fields: female 46 blocks, male 45. Both DDS headers are readable 512×512 files. This is **VERIFIED_ASSET_STRUCTURE for these stated checks**, not full skin/geometry or rendering verification.

The official [NifTools schema](https://github.com/niftools/nifxml/blob/develop/nif.xml) identifies Face Tint shader type 4 and its detail/tint texture channels. On the actual exports:

- **Female:** shader block 17, texture set 18, zero-based tint slot 6 is **empty**, despite a correct `00005901.dds` existing on disk. Detail slot 3 contains `FemaleHeadDetail_Rough.dds`. This is an observed empty material link consistent with the tint-map warning; engine-side substitution is not established here; it is not fixed by copying another DDS beside it.
- **Male:** shader block 15, texture set 16, tint slot 6 contains `Data\Textures\actors\Character\FaceGenData\FaceTint\FrostveilNPCTest.esp\00005906.dds`. It names the intended file, but whether this engine path prefix is accepted is **unverified**; no silent path stripping or NIF rewrite was performed. Detail slot 3 names `MaleHeadDetail_Age40.dds`.
- Both exported detail texture paths have BSA member evidence. A prior warning about source FemaleHead detail therefore cannot be generalized into a claim that the final export lacks that detail path. Actual dark-face/seam behavior still needs owner testing.
- “Should have been converted offline” was not treated as permission to convert Bethesda meshes globally. Export headers are SSE-compatible; full scene/skin conversion semantics remain unproven. Runtime remains Skyrim 1.6.1170 / SKSE 2.2.6 / existing custom Platform 2.9.0.

TGA files are authoring intermediates. The inspected runtime texture sets reference DDS, not TGA; neither TGA is packaged. All source ESP/NIF/DDS/TGA hashes remain unchanged.

## Resource verifier implementation and honest limits

`g241b-resources.cjs` implements bounded native dependency traversal, safe resource paths, loose-file SHA approval, DDS checks and immutable hash caches. `g241b-nif-structure.cjs` adds a source-backed narrow structural/material diagnostic. Header or regex path scanning is **never sufficient** to return full closure. A complete semantic evidence adapter is required for all shader references/skin bindings; archived NIF contents also cannot be approved from membership alone. Unsupported paths, unknown schemas, conflicting/unapproved loose resources and missing resources fail closed.

The installed `rsm-bsa 4.1.0` library was found under `build/vcpkg_installed/x64-windows-sp`, and an isolated read-only named-member query tool was built from `research/g241b/tools/bsa-index-query.cpp`. Its ~403 KB executable and object stay ignored under the audit tools folder; no engine/native DLL was patched or published. It reads archive metadata and selected member availability, never extracts an entire archive or changes it.

Actual evidence:

- The two FaceGen string scans find 16/17 path strings, 25 unique texture candidates. Twenty-four are indexed in queried base-game texture BSAs; the remaining owner FaceTint path exists loose.
- The native record walk yields **102 unique model/texture candidate paths**. Named-member queries across Meshes0/1 and Textures0–8 find all 102; none has a loose override in that candidate set. This checks availability, not archived NIF contents or race/skin suitability.
- Observed archive SHA-256 values were recorded, but were not authenticated against a pinned Bethesda-content baseline. Filename/existence alone is not archive provenance approval.
- Full shader/skin parsing and alternate/material semantics for archived meshes are not established. The actual closure callback remains **BLOCKED**, not a no-op success. Existing `verifyResourceClosure` is wired to the real adapter; the earlier unconditional missing-adapter placeholder has been replaced with actionable real-asset diagnostics and conservative gates.

## Staging and client/server readiness

Reused `build/rp-audit/g241/dev-7FNiLN`, with only two compiled catalog modules refreshed and a small previous-code backup. No world/player/economy journal was copied. The staged package is:

`build/rp-audit/g241/dev-7FNiLN/staging-7RaVpv/`

It contains exactly the ESP and four NIF/DDS files: **2,570,478 bytes (~2.45 MiB)**, plus metadata. Catalog hash: **`1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77`**. `launcher-handoff.UNSIGNED.json`, `resource-dependency-report.json`, `nif-material-diagnostics.json` and disabled proposed approval record the exact hashes and failure. Repeating unchanged staging reuses those five files; a redundant failed-stage copy's identical data files were removed after hash comparison, retaining its metadata and the current package. No large archive or Data/game backup was created.

**Catalog activation: disabled.** Structural/native metadata checks pass, but the female tint material and remaining closure/delivery gates prevent an approved catalog. No unsupported equipment setter, player equip packet, arbitrary Papyrus or raw appearance update was used. Fixed OTFT records are the intended gear path; visible equipment remains untested.

**Signed delivery: blocked.** The generic modpack remote trust source is still unconfigured. The existing Launcher NSIS updater signer authorizes updater artifacts, not an arbitrary new NPC development pack. No key/trust/signature checks were bypassed, no production manifest was replaced, no R2 upload or Launcher installation change occurred.

Read-only client plugin inspection finds no active FrostveilNPCTest.esp. A static header-based candidate list puts Navigation at full index 7, whereas the server's six-entry baseline places it at index 5. This is **not** a runtime GetModName proof, but clearly prevents claiming the assumed matching prefix is ready. Current FormView consumes network baseId directly, so a signed isolated profile must prove actual client/server full-index mapping or a separately tested mapping integration before custom spawning. The CK index is not such proof. No installed plugins.txt/loadorder was edited.

Expected future isolated ports are UDP 17777 and resource HTTP 17778. No appearance-enabled gameplay server or HTTP service was started; no production start/restart was issued. Probe processes used only disposable state. Existing Clerk, registry UUIDs, pose handling, graphs and protected data remain unchanged. Protected manifest before/after staging: **`5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616`**.

## Tests and remaining acceptance

Logs under `build/rp-audit/g241b/` retain complete failure diagnostics and successful summaries. Portable RP **375/375** plus **6/6 explicit real-asset tests**, editor **80/80**, client/source **58/58** passed; server/editor builds and client typecheck passed. Tests cover real ESP/tombstone inventory, exact review policy, official-master winning overrides, real NIF structure/tint diagnosis, malformed NIF/DDS/path input, missing closure evidence and existing registry/pose/dialogue/Blueprint/Courier/spawn/persistence regressions. Actual native legacy registry reload retained one existing UUID/base without creating a custom actor.

Native `[espm]` initially failed one pre-existing `Activate torch` assertion (83/84 cases): that test sets a 25 ms reloot deadline while the run overlapped other suites. The unchanged compiled binary then passed the focused case (18 assertions) and all **84 cases / 475,789 assertions** with the **same RNG seed 2957034403** when rerun alone. This is consistent with timing sensitivity, not proof of a repaired engine bug; the initial failure log is retained. No timeout increase, test skip or native patch was used. Editor retains its existing chunk-size warning.

**VERIFIED_RESOURCE_CLOSURE = false; VERIFIED_CATALOG = false; VERIFIED_ISOLATED_DEPLOYMENT = false.** One-client acceptance is not ready; multiplayer remains **DEFERRED_MULTICLIENT_TEST**. Mock tests are not renderer proof. No 50–100-player claim follows from this work.

## Smallest concrete next actions

1. In CK, inspect **FV_GuildClerk_Test** and regenerate only its new FaceGen export with a correctly linked Face Tint material or independent proof of the engine substitution mechanism. The current female texture-set tint slot is empty; this is not a claim that a dark face was observed. Check the male `Data\Textures` prefix with a supported NIF tool/engine-path proof or a correct export. Do not delete masters, globally optimize meshes or patch bytes in installed files. Let Codex re-read/hash the new real exports; copying an existing DDS again does not fix the missing NIF link.
2. Finish/independently verify the complete scene/skin/archive-content adapter and archive/loose-resource provenance against those corrected assets. The supplied material diagnostics and member-query tool make the missing scope explicit; a fake evidence object or no-op callback is not acceptable.
3. Complete an authenticated **development** Launcher profile, activation and actual client/server index verification. Then enable only the reviewed isolated approval and start its visible server. Until then do not manually edit approval JSON, plugin lists or the player installation to force the test.

Only after these gates pass, owner commands are:

```text
/npc templates
/npc fixture create
/npc fixture list
```

Compare two faces/outfits, idle/rotation, stream unload/reload, reconnect and isolated-server restart; the same two UUIDs must remain, with no duplicate actors. Cleanup is `/npc fixture cleanup`. Codex will not control Skyrim. No second client/VM is requested. The existing G2.4.1 single-client guide remains conditional on these gates, not executable acceptance readiness today.

Implementation/evidence commit `5544ae6398551fdefb565bb4b410c2b5b87ce8b9` was pushed to `frostveil/dev/npc-asset-integration-g241b` and the remote SHA was independently verified. This report follows in a documentation commit on that same branch. No force-push, upstream push, production deployment or unrelated WIP.
